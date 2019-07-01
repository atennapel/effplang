import { Type, TMeta, showType, hasTMeta, freshTSkol, openTForall, hasTSkol, TSkol, freshTMeta, hasAnyTSkol, isTFun, tfunL, tfunR, TFun } from './types';
import { log } from './config';
import { terr } from './util';

const unifyTMeta = (x: TMeta, t: Type): void => {
  log(() => `unifyTMeta ${showType(x)} := ${showType(t)}`);
  if (x.type) return unify(x.type, t);
  if (t.tag === 'TMeta' && t.type) return unifyTMeta(x, t.type);
  if (hasTMeta(x, t)) return terr(`occurs check failed: ${showType(x)} in ${showType(t)}`);
  x.type = t;
};
export const unify = (a: Type, b: Type): void => {
  log(() => `unify ${showType(a)} ~ ${showType(b)}`);
  if (a === b) return;
  if (a.tag === 'TMeta') return unifyTMeta(a, b);
  if (b.tag === 'TMeta') return unifyTMeta(b, a);
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(a.left, b.left);
    unify(a.right, b.right);
    return;
  }
  if (a.tag === 'TForall' && b.tag === 'TForall') {
    const sk = freshTSkol(a.name);
    unify(openTForall(a, sk), openTForall(b, sk));
    if (hasTSkol(sk, a)) return terr(`${showType(a)} not polymorphic enough in ${showType(a)} ~ ${showType(b)}`);
    if (hasTSkol(sk, b)) return terr(`${showType(b)} not polymorphic enough in ${showType(a)} ~ ${showType(b)}`);
    return;
  }
  if (a.tag === 'TCon' && b.tag === 'TCon' && a.name === b.name) return;
  if (a.tag === 'TSkol' && b.tag === 'TSkol' && a.id === b.id) return;
  return terr(`unification failed ${showType(a)} ~ ${showType(b)}`);
};

export const inst = (t: Type): Type => {
  if (t.tag === 'TMeta') return t.type ? inst(t.type) : t;
  if (t.tag === 'TForall') {
    const m = freshTMeta(t.name);
    return inst(openTForall(t, m));
  }
  return t;
};
export const skol = (t: Type, sk: TSkol[] = []): Type => {
  if (t.tag === 'TMeta') return t.type ? skol(t.type, sk) : t;
  if (t.tag === 'TForall') {
    const tv = freshTSkol(t.name);
    sk.push(tv);
    return skol(openTForall(t, tv), sk);
  }
  return t;
};
export const subsume = (a: Type, b: Type): void => {
  log(() => `subsume ${showType(a)} <: ${showType(b)}`);
  const sks: TSkol[] = [];
  const tb = skol(b, sks);
  const ta = inst(a);
  unify(ta, tb);
  if (hasAnyTSkol(sks, a)) return terr(`${showType(a)} not polymorphic enough in ${showType(a)} <: ${showType(b)}`);
  if (hasAnyTSkol(sks, b)) return terr(`${showType(b)} not polymorphic enough in ${showType(a)} <: ${showType(b)}`);
};

export const matchfun = (ty: Type): { left: Type, right: Type } => {
  if (isTFun(ty)) return { left: tfunL(ty), right: tfunR(ty) };
  const a = freshTMeta();
  const b = freshTMeta();
  unify(TFun(a, b), ty);
  return { left: a, right: b };
};
