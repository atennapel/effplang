import { Term, showTerm, Pat, showPat } from './terms';
import { inferKind } from './kindinference';
import { kType } from './kinds';
import { log } from './config';
import { impossible, terr, resetId, Name } from './util';
import { List, toArray, each, first, Cons, Nil } from './list';
import { TEnv } from './env';
import {
  Type,
  showTy,
  TSkol,
  TFun,
  prune,
  tmetas,
  quantify,
  freshTMeta,
  TMeta,
  tString,
  tFloat,
} from './types';
import {
  unifyTFun,
  subsCheck,
  skolemise,
  skolemCheck,
  instantiate,
  subsCheckRho,
} from './unification';

export type LTEnv = List<[string, Type]>;
export const extendVar = (lenv: LTEnv, x: Name, t: Type): LTEnv =>
    Cons([x, t] as [Name, Type], lenv);
export const extendVars = (env: LTEnv, vs: [Name, Type][]): LTEnv =>
  vs.reduce((l, kv) => Cons(kv, l), env);
export const lookupVar = (
  env: TEnv,
  lenv: LTEnv,
  x: Name,
): Type | null => {
  const t = first(lenv, ([k, _]) => x === k);
  if (t) return t[1];
  return env.global[x] || null;
};
export const skolemCheckEnv = (sk: TSkol[], env: LTEnv): void => {
  each(env, ([_, t]) => skolemCheck(sk, prune(t)));
};

type Expected = Check | Infer;
interface Check {
  readonly tag: 'Check';
  readonly type: Type;
}
const Check = (type: Type): Check => ({ tag: 'Check', type });
interface Infer {
  readonly tag: 'Infer';
  type: Type | null;
}
const Infer = (): Infer => ({ tag: 'Infer', type: null });
const showEx = (ex: Expected): string => {
  if (ex.tag === 'Check') return `Check(${showTy(ex.type)})`;
  if (ex.tag === 'Infer')
    return `Infer(${ex.type ? showTy(ex.type) : '...'})`;
  return impossible('showEx');
};

const checkRho = (env: TEnv, lenv: LTEnv, term: Term, ty: Type): void =>
  tcRho(env, lenv, term, Check(ty));
const inferRho = (env: TEnv, lenv: LTEnv, term: Term): Type => {
  const i = Infer();
  tcRho(env, lenv, term, i);
  if (!i.type)
    return terr(`inferRho failed for ${showTerm(term)}`);
  return i.type;
};
const tcRho = (env: TEnv, lenv: LTEnv, term: Term, ex: Expected): void => {
  log(() => `tcRho ${showTerm(term)} with ${showEx(ex)}`)
  if (term.tag === 'Var') {
    const ty = lookupVar(env, lenv, term.name);
    if (!ty) return terr(`undefined var ${showTerm(term)}`);
    return instSigma(env, ty, ex);
  }
  if (term.tag === 'App') {
    const ty = inferRho(env, lenv, term.left);
    const { left: { right: left }, right } = unifyTFun(env, ty);
    checkSigma(env, lenv, term.right, left);
    return instSigma(env, right, ex);
  }
  if (term.tag === 'Abs') {
    if (ex.tag === 'Check') {
      const { left: { right: left }, right } =
        unifyTFun(env, ex.type);
      const bs = checkPat(env, term.pat, left);
      const nenv = extendVars(lenv, bs);
      return checkRho(env, nenv, term.body, right);
    } else if (ex.tag === 'Infer') {
      const [bs, ty] = inferPat(env, term.pat);
      const nenv = extendVars(lenv, bs);
      const bty = inferRho(env, nenv, term.body);
      ex.type = TFun(ty, bty);
      return;
    }
  }
  if (term.tag === 'Let') {
    const ty = inferSigma(env, lenv, term.val);
    if (term.pat.tag === 'PVar') {
      const nenv = extendVar(lenv, term.pat.name, ty);
      return tcRho(env, nenv, term.body, ex);
    } else {
      const vars = checkPatSigma(env, term.pat, ty);
      const nenv = extendVars(lenv, vars);
      return tcRho(env, nenv, term.body, ex);
    }
  }
  if (term.tag === 'Ann') {
    const type = inferKind(env, term.type);
    checkSigma(env, lenv, term.term, type);
    return instSigma(env, type, ex);
  }
  if (term.tag === 'Hole') {
    const ty = freshTMeta(kType);
    holes.push([term.name, ty, lenv]);
    instSigma(env, ty, ex);
    return;
  }
  if (term.tag === 'Lit') {
    instSigma(env, typeof term.val === 'string' ? tString : tFloat, ex);
    return;
  }
  return impossible('tcRho');
};

const checkPatSigma = (
  env: TEnv,
  pat: Pat,
  ty: Type,
): [Name, Type][] => {
  const rho = instantiate(ty);
  return checkPat(env, pat, rho);
};

const checkPat = (env: TEnv, pat: Pat, ty: Type): [Name, Type][] =>
  tcPat(env, pat, Check(ty));
const inferPat = (env: TEnv, pat: Pat): [[Name, Type][], Type] => {
  const i = Infer();
  const bs = tcPat(env, pat, i);
  if (!i.type)
    return terr(`inferPat failed for ${showPat(pat)}`);
  return [bs, i.type];
};
const tcPat = (
  env: TEnv,
  pat: Pat,
  ex: Expected
): [Name, Type][] => {
  if (pat.tag === 'PWildcard') {
    if (ex.tag === 'Infer') ex.type = freshTMeta(kType);
    return [];
  }
  if (pat.tag === 'PVar') {
    if (ex.tag === 'Check') return [[pat.name, ex.type]];
    const ty = freshTMeta(kType);
    ex.type = ty;
    return [[pat.name, ty]];
  }
  if (pat.tag === 'PAnn') {
    const ty = inferKind(env, pat.type);
    const bs = checkPat(env, pat.pat, ty);
    instPatSigma(env, ty, ex);
    return bs;
  }
  return impossible('tcPat');
};

const instPatSigma = (env: TEnv, ty: Type, ex: Expected): void => {
  if (ex.tag === 'Check')
    return subsCheck(env, ex.type, ty);
  ex.type = ty;
};

const tmetasEnv = (
  env: LTEnv,
  free: TMeta[] = [],
  tms: TMeta[] = [],
): TMeta[] => {
  each(env, ([_, t]) => tmetas(prune(t), free, tms));
  return tms;
};

const inferSigma = (env: TEnv, lenv: LTEnv, term: Term): Type => {
  const ty = inferRho(env, lenv, term);
  const etms = tmetasEnv(lenv);
  const tms = tmetas(prune(ty), etms);
  return quantify(tms, ty);
};

const checkSigma = (env: TEnv, lenv: LTEnv, term: Term, ty: Type): void => {
  const sk: TSkol[] = [];
  const rho = skolemise(ty, sk);
  checkRho(env, lenv, term, rho);
  skolemCheck(sk, prune(ty));
  skolemCheckEnv(sk, lenv);
};

const instSigma = (env: TEnv, ty: Type, ex: Expected): void => {
  if (ex.tag === 'Check')
    return subsCheckRho(env, ty, ex.type);
  ex.type = instantiate(ty);
};

let holes: [string, Type, List<[string, Type]>][];
export const infer = (env: TEnv, term: Term, lenv: LTEnv = Nil): Type => {
  log(() => `infer ${showTerm(term)}`);
  resetId();
  holes = [];
  const nty = inferSigma(env, lenv, term);
  const ty = prune(nty);
  if (holes.length > 0)
    return terr(`${showTy(ty)}\nholes:\n\n${holes.map(([n, t, e]) =>
      `_${n} : ${showTy(prune(t))}\n${toArray(e, ([x, t]) =>
        `${x} : ${showTy(prune(t))}`).join('\n')}`).join('\n\n')}`);
  return ty;
};
