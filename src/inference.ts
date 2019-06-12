import { LTEnv, globalenv } from './env';
import { Term, showTerm } from './terms';
import { Type, prune, showType, isTFun, tfunL, tfunR, freshTMeta, openTForall, TFun, tforall, tmetas, TMeta, TVar, tbinders } from './types';
import { contextMark, contextDrop, contextAdd, ETVar, contextIndexOfTMeta, contextReplace2, contextAdd2, EMarker, showElem, showContext, resetContext } from './context';
import { Nil, extend, lookup } from './list';
import { log } from './config';
import { terr } from './util';
import { kType, Kind } from './kinds';
import { Name, resetId } from './names';
import { subsume } from './subsumption';

const generalize = (m: EMarker, t: Type): Type => {
  log(() => `generalize ${showElem(m)} ${showType(t)} | ${showContext()}`);
  const dropped = contextDrop(m);
  const tms = tmetas(t, dropped.filter(t => t.tag === 'TMeta') as TMeta[]);
  const l = tms.length;
  if (l === 0) return t;
  const used = tbinders(t);
  const tvs: [Name, Kind][] = Array(l);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < l) {
    const x = tms[i].name;
    const v = x && !used[x] ? x :
      `${String.fromCharCode(k + 97)}${j > 0 ? j : ''}`;
    if (!used[v]) {
      used[v] = true;
      tms[i].type = TVar(v);
      tvs[i] = [v, tms[i].kind];
      i++;
    }
    k = (k + 1) % 26;
    if (k === 0) j++;
  }
  return tforall(tvs, prune(t));
};

export const infer = (term: Term): Type => {
  log(() => `infer ${showTerm(term)}`);
  resetId();
  resetContext();
  const m = contextMark();
  const ty = synth(Nil, term);
  return generalize(m, ty);
};

export const synth = (env: LTEnv, term: Term): Type => {
  log(() => `synth ${showTerm(term)}`);
  if (term.tag === 'Var') {
    const lty = lookup(env, term.name);
    if (lty) return lty;
    const gty = globalenv.vars[term.name];
    if (!gty) return terr(`undefined var ${term.name}`);
    return gty.type;
  }
  if (term.tag === 'Ann') {
    // TODO: wfType + inferKinds on term.type
    check(env, term.term, term.type);
    let ty = term.type;
    for (let i = 0, l = term.ts.length; i < l; i++) {
      const c = term.ts[i];
      // TODO: wfType + inferKinds on c
      if (ty.tag !== 'TForall')
        return terr(`not a forall in ${showTerm(term)}`);
      ty = openTForall(c, ty);
    }
    return ty;
  }
  if (term.tag === 'App') {
    const f = synth(env, term.left);
    return synthapp(env, f, term.right);
  }
  if (term.tag === 'Abs') {
    const a = freshTMeta(kType);
    const b = freshTMeta(kType);
    const m = contextMark();
    contextAdd2(a, b);
    check(extend(env, term.name, a), term.body, b);
    return generalize(m, TFun(a, b));
  }
  return terr(`cannot synth ${showTerm(term)}`);
};

export const check = (env: LTEnv, term: Term, type: Type): void => {
  log(() => `check ${showTerm(term)} : ${showType(type)}`);
  if (type.tag === 'TForall') {
    const m = contextMark();
    contextAdd(ETVar(type.name, type.kind || kType));
    check(env, term, type.type);
    contextDrop(m);
    return;
  }
  if (term.tag === 'Abs' && isTFun(type)) {
    const m = contextMark();
    check(extend(env, term.name, tfunL(type)), term.body, tfunR(type));
    contextDrop(m);
    return;
  }
  const ty = synth(env, term);
  subsume(ty, type)
};

export const synthapp = (env: LTEnv, type: Type, term: Term): Type => {
  log(() => `synthapp ${showType(type)} @ ${showTerm(term)}`);
  if (type.tag === 'TForall') {
    const tm = freshTMeta(type.kind || kType, type.name);
    contextAdd(tm);
    return synthapp(env, openTForall(tm, type), term);
  }
  if (isTFun(type)) {
    check(env, term, tfunL(type));
    return tfunR(type);
  }
  if (type.tag === 'TMeta') {
    if (type.type) return synthapp(env, type.type, term);
    const i = contextIndexOfTMeta(type);
    if (i < 0) return terr(`undefined tmeta ${showType(type)}`);
    const a = freshTMeta(kType);
    const b = freshTMeta(kType);
    contextReplace2(i, a, b);
    type.type = TFun(a, b);
    check(env, term, a);
    return b;
  }
  return terr(`cannot synthapp ${showType(type)} @ ${showTerm(term)}`);
};
