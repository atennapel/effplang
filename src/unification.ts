import { TEnv } from './env';
import { terr } from './util';
import { kType, showKind, eqKind, Kind } from './kinds';
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
} from './types';

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
export const unify = (env: TEnv, a: Type, b: Type): void => {
  log(() => `unify ${showTy(a)} ~ ${showTy(b)}`);
  if (a.tag === 'TVar' || b.tag === 'TVar')
    return terr(`tvar in unify: ${showTy(a)} ~ ${showTy(b)}`);
  if (a === b) return;
  if (a.tag === 'TMeta') return bindTMeta(env, a, b);
  if (b.tag === 'TMeta') return bindTMeta(env, b, a);
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(env, a.left, b.left);
    return unify(env, a.right, b.right);
  }
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
  return unify(env, a, b);
};
const subsCheckTFun = (env: TEnv, a: TFun, b: TFun): void => {
  subsCheck(env, b.left.right, a.left.right);
  return subsCheck(env, a.right, b.right);
};
