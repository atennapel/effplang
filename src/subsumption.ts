import { terr } from './util';
import { showType, Type, TMeta, isTFun, freshTMeta, openTForall, tfunR, tfunL, hasTMeta, TFun, TApp, isTEffExtend, teffEff, flattenTApp, TCon, TEffExtend, teffRest, tfunE, prune } from './types';
import { contextRemove, showContext, contextIndexOfTVar, contextAdd, contextMark, ETVar, contextDrop, contextIndexOfTMeta, contextReplace2, contextReplace3 } from './context';
import { log } from './config';
import { kType, eqKind, showKind, kEffectRow } from './kinds';
import { kindOf } from './kindinference';

const rewriteTEff = (c: TCon, full: Type, other: Type): TEffExtend => {
  log(() => `rewriteTEff ${showType(c)} ; ${showType(full)} ; ${showType(other)}`);
  if (isTEffExtend(other)) {
    const othereff = teffEff(other);
    const effcon = flattenTApp(othereff)[0];
    if (effcon.tag !== 'TCon')
      return terr(`effect should be a type constructor but got ${showType(effcon)}`);
    if (c === effcon || c.name === effcon.name) return other;
    const tail = rewriteTEff(c, full, teffRest(other));
    return TEffExtend(teffEff(tail), TEffExtend(teffEff(other), teffRest(tail)));
  }
  if (other.tag === 'TMeta') {
    if (other.type) return rewriteTEff(c, full, other.type);
    if (hasTMeta(other, full))
      return terr(`occurs check failed in effect ${showType(other)} in ${showType(full)}`);
    const tv = freshTMeta(kEffectRow, 'e');
    contextAdd(tv);
    const ty = TEffExtend(full, tv);
    const i = contextIndexOfTMeta(other);
    if (i < 0) return terr(`undefined tmeta in rewriteEff ${showType(other)}`);
    solve(other, i, ty);
    return ty;
  }
  return terr(`cannot find ${showType(c)} in row ${showType(other)}`);
};

const solve = (x: TMeta, i: number, t: Type): void => {
  log(() => `solve ${showType(x)} ${i} ${showType(t)} | ${showContext()}`);
  contextRemove(i);
  x.type = t;
};

const subsumeTMeta = (x: TMeta, t: Type, contra: boolean): void => {
  log(() => `subsumeTMeta ${contra ? `${showType(t)} =: ${showType(x)}` : `${showType(x)} := ${showType(t)}`}`);
  if (x.type) return contra ? subsume(t, x.type) : subsume(x.type, t);
  const i = contextIndexOfTMeta(x);
  if (i < 0) return terr(`undefined tmeta ${showType(x)}`);
  if (x === t) return;
  if (t.tag === 'TCon') return solve(x, i, t);
  if (t.tag === 'TMeta') {
    if (!x.name && t.name) x.name = t.name; 
    if (!t.name && x.name) t.name = x.name;
    if (t.type) return subsumeTMeta(x, t.type, contra);
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
  if (isTFun(t)) {
    if (hasTMeta(x, t))
      return terr(`occurs check fail ${showType(x)} := ${showType(t)}`);
    const a = freshTMeta(kType);
    const e = freshTMeta(kEffectRow);
    const b = freshTMeta(kType);
    contextReplace3(i, a, e, b);
    const ty = TFun(a, e, b);
    x.type = ty;
    return contra ? subsume(t, ty) : subsume(ty, t);
  }
  if (t.tag === 'TApp') {
    if (hasTMeta(x, t))
      return terr(`occurs check fail ${showType(x)} := ${showType(t)}`);
    const a = freshTMeta(kindOf(t.left));
    const b = freshTMeta(kindOf(t.right));
    contextReplace2(i, a, b);
    const ty = TApp(a, b);
    x.type = ty;
    return contra ? subsume(t, ty) : subsume(ty, t);
  }
  return terr(`subsumeTMeta failed ${contra ? `${showType(t)} =: ${showType(x)}` : `${showType(x)} := ${showType(t)}`}`);
};

export const subsume = (t1: Type, t2: Type): void => {
  log(() => `subsume ${showType(prune(t1))} <: ${showType(prune(t2))} | ${showContext()}`);
  if (t1 === t2) return;
  const ka = kindOf(t1);
  const kb = kindOf(t2);
  if (!eqKind(ka, kb))
    return terr(`kind mismatch ${showType(t1)} <: ${showType(t2)}: ${showKind(ka)} != ${showKind(kb)}`);
  if (t1.tag === 'TCon' && t2.tag === 'TCon' && (t1 === t2 || t1.name === t2.name)) return;
  if (t1.tag === 'TVar' && t2.tag === 'TVar' && (t1 === t2 || t1.name === t2.name)) return;
  if (isTFun(t1) && isTFun(t2)) {
    subsume(tfunL(t2), tfunL(t1));
    unify(tfunE(t1), tfunE(t2));
    subsume(tfunR(t1), tfunR(t2));
    return;
  }
  if (isTEffExtend(t1) && isTEffExtend(t2)) {
    console.log(`HERE`);
    const eff = teffEff(t1);
    const effcon = flattenTApp(eff)[0];
    if (effcon.tag !== 'TCon')
      return terr(`effect should be a type constructor but got ${showType(effcon)}`);
    const rewr = rewriteTEff(effcon, eff, t2);
    console.log('unify effects');
    unify(eff, teffEff(rewr));
    console.log('unify rest');
    unify(teffRest(t1), teffRest(t2));
    return;
  }
  if (t1.tag === 'TApp' && t2.tag === 'TApp') {
    unify(t1.left, t2.left);
    unify(t1.right, t2.right);
    return;
  }
  if (t2.tag === 'TForall') {
    const m = contextMark();
    contextAdd(ETVar(t2.name, t2.kind || kType));
    subsume(t1, t2.type);
    contextDrop(m);
    return;
  }
  if (t1.tag === 'TForall') {
    const tm = freshTMeta(t1.kind || kType, t1.name);
    contextAdd(tm);
    subsume(openTForall(tm, t1), t2);
    return;
  }
  if (t1.tag === 'TMeta') return subsumeTMeta(t1, t2, false);
  if (t2.tag === 'TMeta') return subsumeTMeta(t2, t1, true);
  return terr(`cannot subsume ${showType(prune(t1))} <: ${showType(prune(t2))}`);
};

export const unify = (t1: Type, t2: Type): void => {
  log(() => `unify ${showType(t1)} ~ ${showType(t2)} | ${showContext()}`);
  subsume(t1, t2);
  subsume(t2, t1);
};
