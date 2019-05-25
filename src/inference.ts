import { LTEnv, LTEnvEntry, TEnv, lookupLTEnv, lookupTEnv } from './env';
import { Type, prune, annotAny, Annot, isSigma, TFun, isMono, isTFun, tString, tFloat, showType, tEffsEmpty, freshTMeta, matchTFun, TForall, flattenTEffsExtend, teffsFrom } from './types';
import { Name, resetId, terr, impossible, zip } from './util';
import { Cons, Nil } from './list';
import { Term, Abs, flattenApp, showTerm, isAnnot } from './terms';
import { generalize, instantiate, subsume, instantiateAnnot, unifyTFuns, unify } from './unification';
import { log } from './config';
import { kEffs } from './kinds';

export interface TypeEff { type: Type, effs: Type }
const TypeEff = (type: Type, effs: Type): TypeEff => ({ type, effs });
const pruneTypeEff = (te: TypeEff): TypeEff =>
  TypeEff(prune(te.type), prune(te.effs));
export const showTypeEff = (t: TypeEff): string =>
  `${showType(t.type)} ; ${showType(t.effs)}`;

type Expected = 'Inst' | 'Gen';
const Inst = 'Inst';
const Gen = 'Gen';
const maybeInst = (ex: Expected, ty: Type) =>
  ex === Inst ? instantiate(ty) : ty;
const maybeGen = (ex: Expected, env: LTEnv, ty: Type) =>
  ex === Gen ? generalize(env, ty) : ty;
const maybeInstOrGen = (ex: Expected, env: LTEnv, ty: Type) =>
  ex === Gen ? generalize(env, ty) : instantiate(ty);

export const infer = (genv: TEnv, term: Term): TypeEff => {
  resetId();
  const ty = synth(null, Gen, genv, Nil, term);
  return TypeEff(
    generalize(Nil, prune(ty.type)),
    prune(ty.effs),
  );
};

const extend = (n: Name, t: Type, e: LTEnv) =>
  Cons(LTEnvEntry(n, t), e);

const openEffsRow = (t: Type): Type => {
  const f = flattenTEffsExtend(t);
  if (f.rest === tEffsEmpty)
    return teffsFrom(f.effs, freshTMeta(kEffs, 'e'));
  return t;
};
const openEffs = (t: Type): Type => {
  if (t.tag === 'TForall')
    return TForall(t.names, openEffs(t.type));
  if (isTFun(t)) {
    const m = matchTFun(t);
    return TFun(m.left, openEffsRow(m.effs), openEffs(m.right));
  }
  return t;
};

const synth = (prop: Type | null, ex: Expected, genv: TEnv, env: LTEnv, term: Term): TypeEff => {
  log(() => `synth ${showTerm(term)}`);
  if (term.tag === 'Var') {
    const x = term.name;
    const ty = lookupLTEnv(x, env) || lookupTEnv(x, genv);
    if (!ty) return terr(`undefined var ${x}`);
    return TypeEff(openEffs(maybeInst(ex, ty)), freshTMeta(kEffs, 'e'));
  }
  if (term.tag === 'Let') {
    const ty = synth(null, Gen, genv, env, term.val);
    const res = synth(prop, ex, genv, extend(term.name, ty.type, env), term.body);
    unify(genv, ty.effs, res.effs);
    return pruneTypeEff(res);
  }
  if (term.tag === 'Abs') {
    const { left: proparg, effs: propeffs, right: propres, ex: exres } = propFun(prop);
    if (term.annot === annotAny) {
      term = Abs(term.name, proparg ? Annot([], proparg) : annotAny, term.body);
    }
    const { tmetas: some, type: ty1 } = instantiateAnnot(genv, term.annot);
    const ty2 = synth(propres, exres, genv, extend(term.name, ty1, env), term.body);
    for (let i = 0, l = some.length; i < l; i++) {
      if (!isMono(prune(some[i])))
        return terr(`unannotated parameters used polymorphically in ${showTerm(term)}`);
    }
    if (propeffs) unify(genv, propeffs, ty2.effs);
    const fty = maybeGen(ex, env, TFun(ty1, ty2.effs, ty2.type));
    return TypeEff(fty, freshTMeta(kEffs, 'e'));
  }
  if (term.tag === 'Ann') {
    const { type } = instantiateAnnot(genv, term.annot);
    const ty = synth(
      type,
      isSigma(type) ? Gen : Inst,
      genv,
      env,
      term.term,
    );
    subsume(genv, type, ty.type);
    return pruneTypeEff(TypeEff(type, ty.effs));
  }
  if (term.tag === 'App') {
    const { fn, args } = flattenApp(term);
    const fty = synth(null, Inst, genv, env, fn);
    return inferApp(prop, ex, genv, env, fty.type, args, fty.effs);
  }
  if (term.tag === 'Lit')
    return TypeEff(
      typeof term.val === 'string' ? tString : tFloat,
      freshTMeta(kEffs, 'e'), 
    );
  return impossible(`synth`);
};

const inferApp = (prop: Type | null, ex: Expected, genv: TEnv, env: LTEnv, fty: Type, args: Term[], effsout: Type): TypeEff => {
  log(() => `inferApp ${showType(fty)} with ${args.map(showTerm).join(' ')}`);
  const { args: tpars, effs, res } = unifyTFuns(args.length, fty);
  // log(() => `${tpars.map(showType).join(' ')} ; ${showType(res)}`);
  propApp(genv, prop, res, tpars.length === args.length);
  const pargs = zip(tpars, args);
  for (let i = 0, l = effs.length; i < l; i++)
    unify(genv, effsout, effs[i]);
  subsumeInferN(genv, env, pargs, effsout);
  const argsLeft = args.slice(tpars.length);
  if (argsLeft.length === 0)
    return TypeEff(maybeInstOrGen(ex, env, res), effsout);
  // log(() => `argsLeft: ${argsLeft.map(showTerm).join(' ')}`);
  return inferApp(prop, ex, genv, env, res, argsLeft, effsout);
};

const subsumeInferN = (genv: TEnv, env: LTEnv, tps: [Type, Term][], effs: Type): void => {
  if (tps.length === 0) return;
  const [tpar_, arg] = pickArg(tps);
  const tpar = prune(tpar_);
  const targ = synth(tpar, isSigma(tpar) ? Gen : Inst, genv, env, arg);
  if (isAnnot(arg)) unify(genv, tpar, targ.type);
  else subsume(genv, tpar, targ.type);
  unify(genv, effs, targ.effs);
  subsumeInferN(genv, env, tps, effs);
};

const propApp = (genv: TEnv, prop: Type | null, ty: Type, fapp: boolean): void => {
  const isuni = ty.tag === 'TMeta' && !ty.type;
  if (prop && fapp && !isuni) {
    const rho = instantiate(prop);
    subsume(genv, rho, ty);
  }
};
const propFun = (prop: Type | null): { left: Type | null, effs: Type | null, right: Type | null, ex: Expected } => {
  if (!prop) return { left: null, effs: null, right: null, ex: Inst };
  const rho = prune(instantiate(prop));
  if (isTFun(rho))
    return { left: rho.left.left.right, effs: rho.left.right, right: rho.right, ex: isSigma(rho.right) ? Gen : Inst };
  return { left: null, effs: null, right: null, ex: Inst };
};

const pickArg = (tps: [Type, Term][]): [Type, Term] => {
  for (let i = 0, l = tps.length; i < l; i++) {
    const targ = tps[i];
    if (isAnnot(targ[1])) {
      tps.splice(i, 1);
      return targ;
    }
  }
  for (let i = 0, l = tps.length; i < l; i++) {
    const targ = tps[i];
    if (prune(targ[0]).tag !== 'TMeta') {
      tps.splice(i, 1);
      return targ;
    }
  }
  const ret = tps[0];
  tps.splice(0, 1);
  return ret;
};
