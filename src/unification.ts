import { TEnv } from './env';
import { terr, Name } from './util';
import { kType, showKind, eqKind, Kind, kRow } from './kinds';
import { kindOf } from './kindinference';
import { log } from './config';
import {
  TMeta,
  freshTMeta,
  Type,
  TFun,
  isTFun,
  occursTMeta,
  showTy,
  TSkol,
  prune,
  TVMap,
  substTVar,
  freshTSkol,
  isTRowExtends,
  TRowExtends,
} from './types';

const rewriteRow = (label: Name, ty: Type): TRowExtends => {
  if (isTRowExtends(ty)) {
    if (ty.left.left.label === label) return ty;
    const tail = rewriteRow(label, ty.right);
    return TRowExtends(label, tail.left.right,
      TRowExtends(ty.left.left.label, ty.left.right, tail.right));
  }
  if (ty.tag === 'TMeta') {
    if (ty.type) return rewriteRow(label, ty.type);
    const tv = freshTMeta(kType);
    const tr = freshTMeta(kRow);
    const row = TRowExtends(label, tv, tr);
    ty.type = row;
    return row;
  }
  return terr(`cannot rewriteRow: ${label} in ${showTy(ty)}`);
};

const bindTMeta = (env: TEnv, x: TMeta, t: Type): void => {
  if (x.type) return unify(env, x.type, t);
  if (t.tag === 'TMeta' && t.type) {
    if (!x.name && t.name) x.name = t.name;
    return unify(env, x, t.type);
  }
  if (occursTMeta(x, t))
    return terr(`${showTy(x)} occurs in ${showTy(t)}`);
  const k1 = kindOf(env, x);
  const k2 = kindOf(env, t);
  if (!eqKind(k1, k2))
    return terr(`kind mismatch in unification of ${showTy(x)} ~ ${showTy(t)}: ${showKind(k1)} ~ ${showKind(k2)}`);
  if (!x.name && t.tag === 'TMeta' && t.name) x.name = t.name;
  x.type = t;
};
export const unify = (env: TEnv, a_: Type, b_: Type): void => {
  const a = prune(a_);
  const b = prune(b_);
  log(() => `unify ${showTy(a)} ~ ${showTy(b)}`);
  if (a.tag === 'TVar' || b.tag === 'TVar')
    return terr(`tvar in unify: ${showTy(a)} ~ ${showTy(b)}`);
  if (a === b) return;
  if (a.tag === 'TMeta') return bindTMeta(env, a, b);
  if (b.tag === 'TMeta') return bindTMeta(env, b, a);
  if (isTRowExtends(a) && isTRowExtends(b)) {
    const rewr = rewriteRow(a.left.left.label, b);
    unify(env, a.left.right, rewr.left.right);
    unify(env, a.right, rewr.right);
    return;
  }
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(env, a.left, b.left);
    unify(env, a.right, b.right);
    return;
  }
  if (a.tag === 'TRowExtend' && b.tag === 'TRowExtend' &&
      a.label === b.label)
    return;
  if (a.tag === 'TSkol' && b.tag === 'TSkol' && a.id === b.id)
    return;
  if (a.tag === 'TCon' && b.tag === 'TCon' && a.name === b.name)
    return;
  return terr(`failed to unify: ${showTy(a)} ~ ${showTy(b)}`);
};

export const unifyTFun = (env: TEnv, ty: Type): TFun => {
  if (isTFun(ty)) return ty;
  const fn = TFun(freshTMeta(kType), freshTMeta(kType));
  unify(env, ty, fn);
  return fn;
};

export const skolemCheck = (sk: TSkol[], ty: Type): void => {
  if (ty.tag === 'TSkol' && sk.indexOf(ty) >= 0)
    return terr(`skolem check failed: ${showTy(ty)}`);
  if (ty.tag === 'TApp') {
    skolemCheck(sk, ty.left);
    return skolemCheck(sk, ty.right);
  }
  if (ty.tag === 'TForall')
    return skolemCheck(sk, ty.type);
};

export const instantiate = (ty: Type): Type => {
  if (ty.tag !== 'TForall') return ty;
  const m: TVMap = {};
  const names = ty.names;
  for (let i = 0, l = names.length; i < l; i++) {
    const x = names[i];
    m[x] = freshTMeta(ty.kinds[i] as Kind, x);
  }
  return substTVar(m, ty.type);
};

export const skolemise = (ty: Type, sk: TSkol[] = []): Type => {
  if (ty.tag === 'TForall') {
    const m: TVMap = {};
    const names = ty.names;
    for (let i = 0, l = names.length; i < l; i++) {
      const k = freshTSkol(names[i], ty.kinds[i] as Kind);
      m[names[i]] = k;
      sk.push(k);
    }
    return skolemise(substTVar(m, ty.type), sk);
  }
  if (isTFun(ty)) {
    const { left: { right: left }, right } = ty;
    const b = skolemise(right, sk);
    return TFun(left, b);
  }
  if (isTRowExtends(ty)) {
    const { left: { right: type }, right: rest } = ty;
    return TRowExtends(ty.left.left.label,
      skolemise(type), skolemise(rest));
  }
  return ty;
};

export const subsCheck = (env: TEnv, a: Type, b: Type): void => {
  log(() => `subsCheck ${showTy(a)} <: ${showTy(b)}`);
  const sk: TSkol[] = [];
  const rho = skolemise(b, sk);
  subsCheckRho(env, a, rho);
  skolemCheck(sk, prune(a));
  skolemCheck(sk, prune(b));
};
export const subsCheckRho = (env: TEnv, a: Type, b: Type): void => {
  if (a.tag === 'TForall')
    return subsCheckRho(env, instantiate(a), b);
  if (isTFun(b))
    return subsCheckTFun(env, unifyTFun(env, a), b);
  if (isTFun(a))
    return subsCheckTFun(env, a, unifyTFun(env, b));
  if (isTRowExtends(a) && isTRowExtends(b))
    return subsCheckTRowExtends(env, a, b);
  return unify(env, a, b);
};
const subsCheckTFun = (env: TEnv, a: TFun, b: TFun): void => {
  subsCheck(env, b.left.right, a.left.right);
  return subsCheck(env, a.right, b.right);
};
const subsCheckTRowExtends = (
  env: TEnv,
  a: TRowExtends,
  b: TRowExtends,
): void => {
  subsCheck(env, a.left.right, b.left.right);
  return subsCheck(env, a.right, b.right);
};
