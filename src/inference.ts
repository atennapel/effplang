import { LTEnv, LTEnvEntry, TEnv, lookupLTEnv, lookupTEnv } from './env';
import { Type, prune, annotAny, Annot, isSigma, TFun, isMono, isTFun, tString, tFloat, showType } from './types';
import { Name, resetId, terr, impossible, zip } from './util';
import { Cons, Nil } from './list';
import { Term, Abs, flattenApp, showTerm, isAnnot } from './terms';
import { generalize, instantiate, subsume, instantiateAnnot, matchTFuns, unify } from './unification';
import { log } from './config';

type Expected = 'Inst' | 'Gen';
const Inst = 'Inst';
const Gen = 'Gen';
const maybeInst = (ex: Expected, ty: Type) =>
  ex === Inst ? instantiate(ty) : ty;
const maybeGen = (ex: Expected, env: LTEnv, ty: Type) =>
  ex === Gen ? generalize(env, ty) : ty;
const maybeInstOrGen = (ex: Expected, env: LTEnv, ty: Type) =>
  ex === Gen ? generalize(env, ty) : instantiate(ty);

export const infer = (genv: TEnv, term: Term) => {
  resetId();
  const ty = synth(null, Gen, genv, Nil, term);
  return prune(ty);
};

const extend = (n: Name, t: Type, e: LTEnv) =>
  Cons(LTEnvEntry(n, t), e);

const synth = (prop: Type | null, ex: Expected, genv: TEnv, env: LTEnv, term: Term): Type => {
  log(() => `synth ${showTerm(term)}`);
  if (term.tag === 'Var') {
    const x = term.name;
    const ty = lookupLTEnv(x, env) || lookupTEnv(x, genv);
    if (!ty) return terr(`undefined var ${x}`);
    return maybeInst(ex, ty);
  }
  if (term.tag === 'Let') {
    const ty = synth(null, Gen, genv, env, term.val);
    return synth(prop, ex, genv, extend(term.name, ty, env), term.body);
  }
  if (term.tag === 'Abs') {
    if (term.annot === annotAny) {
      const { left: proparg } = propFun(prop);
      term = Abs(term.name, proparg ? Annot([], proparg) : annotAny, term.body);
    }
    const { right: propres, ex: exres } = propFun(prop);
    const { tmetas: some, type: ty1 } = instantiateAnnot(term.annot);
    const ty2 = synth(propres, exres, genv, extend(term.name, ty1, env), term.body);
    for (let i = 0, l = some.length; i < l; i++) {
      if (!isMono(prune(some[i])))
        return terr(`unannotated parameters used polymorphically in ${showTerm(term)}`);
    }
    return maybeGen(ex, env, TFun(ty1, ty2)); 
  }
  if (term.tag === 'Ann') {
    const { type } = instantiateAnnot(term.annot);
    const ty = synth(
      type,
      isSigma(type) ? Gen : Inst,
      genv,
      env,
      term.term,
    );
    subsume(type, ty);
    return prune(type);
  }
  if (term.tag === 'App') {
    const { fn, args } = flattenApp(term);
    const fty = synth(null, Inst, genv, env, fn);
    return inferApp(prop, ex, genv, env, fty, args);
  }
  if (term.tag === 'Lit')
    return typeof term.val === 'string' ? tString : tFloat;
  return impossible(`synth`);
};

const inferApp = (prop: Type | null, ex: Expected, genv: TEnv, env: LTEnv, fty: Type, args: Term[]): Type => {
  log(() => `inferApp ${showType(fty)} with ${args.map(showTerm).join(' ')}`);
  const { args: tpars, res } = matchTFuns(args.length, fty);
  // log(() => `${tpars.map(showType).join(' ')} ; ${showType(res)}`);
  propApp(prop, res, tpars.length === args.length);
  const pargs = zip(tpars, args);
  subsumeInferN(genv, env, pargs);
  const argsLeft = args.slice(tpars.length);
  if (argsLeft.length === 0)
    return maybeInstOrGen(ex, env, res);
  // log(() => `argsLeft: ${argsLeft.map(showTerm).join(' ')}`);
  return inferApp(prop, ex, genv, env, res, argsLeft);
};

const subsumeInferN = (genv: TEnv, env: LTEnv, tps: [Type, Term][]) => {
  if (tps.length === 0) return;
  const [tpar_, arg] = pickArg(tps);
  const tpar = prune(tpar_);
  const targ = synth(tpar, isSigma(tpar) ? Gen : Inst, genv, env, arg);
  if (isAnnot(arg)) unify(tpar, targ);
  else subsume(tpar, targ);
  subsumeInferN(genv, env, tps);
};

const propApp = (prop: Type | null, ty: Type, fapp: boolean): void => {
  const isuni = ty.tag === 'TMeta' && !ty.type;
  if (prop && fapp && !isuni) {
    const rho = instantiate(prop);
    subsume(rho, ty);
  }
};
const propFun = (prop: Type | null): { left: Type | null, right: Type | null, ex: Expected } => {
  if (!prop) return { left: null, right: null, ex: Inst };
  const rho = prune(instantiate(prop));
  if (isTFun(rho))
    return { left: rho.left.right, right: rho.right, ex: isSigma(rho.right) ? Gen : Inst };
  return { left: null, right: null, ex: Inst };
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
