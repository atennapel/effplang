import { terr } from './util';
import { showType, Type, TMeta, isTFun, freshTMeta, openTForall, tfunR, tfunL, hasTMeta, TFun, TApp } from './types';
import { contextRemove, showContext, contextIndexOfTVar, contextAdd, contextMark, ETVar, contextDrop, contextIndexOfTMeta, contextReplace2 } from './context';
import { log } from './config';
import { kType, eqKind, showKind } from './kinds';
import { GTEnv } from './env';
import { kindOf } from './kindinference';

const solve = (x: TMeta, i: number, t: Type): void => {
  log(() => `solve ${showType(x)} ${i} ${showType(t)} | ${showContext()}`);
  contextRemove(i);
  x.type = t;
};

const subsumeTMeta = (genv: GTEnv, x: TMeta, t: Type, contra: boolean): void => {
  log(() => `subsumeTMeta ${contra ? `${showType(t)} =: ${showType(x)}` : `${showType(x)} := ${showType(t)}`}`);
  if (x.type) return contra ? subsume(genv, t, x.type) : subsume(genv, x.type, t);
  const i = contextIndexOfTMeta(x);
  if (i < 0) return terr(`undefined tmeta ${showType(x)}`);
  if (x === t) return;
  if (t.tag === 'TCon') return solve(x, i, t);
  if (t.tag === 'TMeta') {
    if (!x.name && t.name) x.name = t.name; 
    if (!t.name && x.name) t.name = x.name;
    if (t.type) return subsumeTMeta(genv, x, t.type, contra);
    const j = contextIndexOfTMeta(t);
    if (j < 0) return terr(`undefined tmeta ${showType(t)}`);
    return i > j ? solve(x, i, t) : solve(t, j, x);
  }
  if (t.tag === 'TVar') {
    const j = contextIndexOfTVar(t);
    if (j < 0) return terr(`undefined tvar ${showType(t)}`);
    if (j > i)
      return terr(`tvar out of scope ${showType(x)} := ${showType(t)}`);
    return solve(x, i, t);
  }
  if (t.tag === 'TApp') {
    if (hasTMeta(x, t))
      return terr(`occurs check fail ${showType(x)} := ${showType(t)}`);
    const fun = isTFun(t);
    const a = freshTMeta(fun ? kType : kindOf(genv, t.left));
    const b = freshTMeta(fun ? kType : kindOf(genv, t.right));
    contextReplace2(i, a, b);
    const ty = fun ? TFun(a, b) : TApp(a, b);
    x.type = ty;
    return contra ? subsume(genv, t, ty) : subsume(genv, ty, t);
  }
  return terr(`subsumeTMeta failed ${contra ? `${showType(t)} =: ${showType(x)}` : `${showType(x)} := ${showType(t)}`}`);
};

export const subsume = (genv: GTEnv, t1: Type, t2: Type): void => {
  log(() => `subsume ${showType(t1)} <: ${showType(t2)} | ${showContext()}`);
  if (t1 === t2) return;
  const ka = kindOf(genv, t1);
  const kb = kindOf(genv, t2);
  if (!eqKind(ka, kb))
    return terr(`kind mismatch ${showType(t1)} <: ${showType(t2)}: ${showKind(ka)} != ${showKind(kb)}`);
  if (t1.tag === 'TCon' && t2.tag === 'TCon' && (t1 === t2 || t1.name === t2.name)) return;
  if (t1.tag === 'TVar' && t2.tag === 'TVar' && (t1 === t2 || t1.name === t2.name)) return;
  if (isTFun(t1) && isTFun(t2)) {
    subsume(genv, tfunL(t2), tfunL(t1));
    subsume(genv, tfunR(t1), tfunR(t2));
    return;
  }
  if (t1.tag === 'TApp' && t2.tag === 'TApp') {
    unify(genv, t1.left, t2.left);
    unify(genv, t1.right, t2.right);
    return;
  }
  if (t2.tag === 'TForall') {
    const m = contextMark();
    contextAdd(ETVar(t2.name, t2.kind || kType));
    subsume(genv, t1, t2.type);
    contextDrop(m);
    return;
  }
  if (t1.tag === 'TForall') {
    const tm = freshTMeta(t1.kind || kType, t1.name);
    contextAdd(tm);
    subsume(genv, openTForall(tm, t1), t2);
    return;
  }
  if (t1.tag === 'TMeta') return subsumeTMeta(genv, t1, t2, false);
  if (t2.tag === 'TMeta') return subsumeTMeta(genv, t2, t1, true);
  return terr(`cannot subsume ${showType(t1)} <: ${showType(t2)}`);
};

export const unify = (genv: GTEnv, t1: Type, t2: Type): void => {
  subsume(genv, t1, t2);
  subsume(genv, t2, t1);
};
