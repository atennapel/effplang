import { GTEnv, LTEnv } from './env';
import { Term, showTerm } from './terms';
import { Type, prune, showType, isTFun, tfunL, tfunR, freshTMeta, openTForall, TFun, tforall, tmetas, TMeta, TVar } from './types';
import { contextMark, contextDrop, contextAdd, ETVar, contextIndexOfTMeta, contextReplace2, contextAdd2, EMarker, showElem, showContext } from './context';
import { Nil, extend, lookup } from './list';
import { log } from './config';
import { terr } from './util';
import { kType, Kind } from './kinds';
import { Name } from './names';
import { subsume } from './subsumption';

const generalize = (m: EMarker, t: Type): Type => {
  log(() => `generalize ${showElem(m)} ${showType(t)} | ${showContext()}`);
  const dropped = contextDrop(m);
  const tms = tmetas(t, dropped.filter(t => t.tag === 'TMeta') as TMeta[]);
  const l = tms.length;
  const tvs: [Name, Kind][] = Array(l);
  for (let i = 0; i < l; i++) {
    const c = tms[i];
    // TODO: better tvar naming
    const name = `'${c.id}`;
    c.type = TVar(name);
    tvs[i] = [name, c.kind];
  }
  return tforall(tvs, prune(t));
};

export const infer = (genv: GTEnv, term: Term): Type => {
  log(() => `infer ${showTerm(term)}`);
  const m = contextMark();
  const ty = synth(genv, Nil, term);
  return generalize(m, ty);
};

export const synth = (genv: GTEnv, env: LTEnv, term: Term): Type => {
  log(() => `synth ${showTerm(term)}`);
  if (term.tag === 'Var') {
    const lty = lookup(env, term.name);
    if (lty) return lty;
    const gty = genv.vars[term.name];
    if (!gty) return terr(`undefined var ${term.name}`);
    return gty.type;
  }
  if (term.tag === 'Ann') {
    // TODO: wfType + inferKinds
    check(genv, env, term.term, term.type);
    // TODO: do type applications
    return term.type;
  }
  if (term.tag === 'App') {
    const f = synth(genv, env, term.left);
    return synthapp(genv, env, f, term.right);
  }
  if (term.tag === 'Abs') {
    const a = freshTMeta(kType);
    const b = freshTMeta(kType);
    const m = contextMark();
    contextAdd2(a, b);
    check(genv, extend(env, term.name, a), term.body, b);
    return generalize(m, TFun(a, b));
  }
  return terr(`cannot synth ${showTerm(term)}`);
};

export const check = (genv: GTEnv, env: LTEnv, term: Term, type: Type): void => {
  log(() => `check ${showTerm(term)} : ${showType(type)}`);
  if (type.tag === 'TForall') {
    const m = contextMark();
    contextAdd(ETVar(type.name, type.kind || kType));
    check(genv, env, term, type.type);
    contextDrop(m);
    return;
  }
  if (term.tag === 'Abs' && isTFun(type)) {
    const m = contextMark();
    check(genv, extend(env, term.name, tfunL(type)), term.body, tfunR(type));
    contextDrop(m);
    return;
  }
  const ty = synth(genv, env, term);
  subsume(ty, type)
};

export const synthapp = (genv: GTEnv, env: LTEnv, type: Type, term: Term): Type => {
  log(() => `synthapp ${showType(type)} @ ${showTerm(term)}`);
  if (type.tag === 'TForall') {
    const tm = freshTMeta(type.kind || kType, type.name);
    contextAdd(tm);
    return synthapp(genv, env, openTForall(tm, type), term);
  }
  if (isTFun(type)) {
    check(genv, env, term, tfunL(type));
    return tfunR(type);
  }
  if (type.tag === 'TMeta') {
    if (type.type) return synthapp(genv, env, type.type, term);
    const i = contextIndexOfTMeta(type);
    if (i < 0) return terr(`undefined tmeta ${showType(type)}`);
    const a = freshTMeta(kType);
    const b = freshTMeta(kType);
    contextReplace2(i, a, b);
    type.type = TFun(a, b);
    check(genv, env, term, a);
    return b;
  }
  return terr(`cannot synthapp ${showType(type)} @ ${showTerm(term)}`);
};
