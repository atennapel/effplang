import { Type, prune, freshTMeta, substTVar, TVMap, Annot, TMeta, freshTSkol, showType, tbinders, TVar, TForall, tmetas, occursTMeta, TSkol, occursAnyTSkol, isTFun, TFun, normalizeAnnot } from './types';
import { log } from './config';
import { LTEnv, TEnv } from './env';
import { each } from './list';
import { terr, Name } from './util';
import { kindOf } from './kindinference';
import { eqKind, showKind, kType, Kind } from './kinds';

export const instantiate = (ty: Type): Type => {
  log(() => `instantiate ${showType(ty)}`);
  const t = prune(ty);
  if (t.tag !== 'TForall') return t;
  const map: TVMap = {};
  for (let i = 0, l = t.names.length; i < l; i++) {
    const c = t.names[i];
    map[c[0]] = freshTMeta(c[1] || kType, c[0]);
  }
  return substTVar(map, t.type);
};

export const instantiateAnnot = (env: TEnv, a_: Annot): { tmetas: TMeta[], type: Type } => {
  const a = normalizeAnnot(env, a_);
  if (a.names.length === 0) return { tmetas: [], type: a.type };
  const tvs: TMeta[] = Array(a.names.length);
  const map: TVMap = {};
  for (let i = 0, l = a.names.length; i < l; i++) {
    const c = a.names[i];
    const tv = freshTMeta(c[1], c[0]);
    map[c[0]] = tv;
    tvs[i] = tv;
  }
  return { tmetas: tvs, type: substTVar(map, a.type) };
};

export const skolemize = (ty: Type): { sks: TSkol[], type: Type } => {
  log(() => `skolemize ${showType(ty)}`);
  const t = prune(ty);
  if (t.tag !== 'TForall') return { sks: [], type: t };
  const sks: TSkol[] = [];
  const map: TVMap = {};
  for (let i = 0, l = t.names.length; i < l; i++) {
    const c = t.names[i];
    const tv = freshTSkol(c[0], c[1] || kType);
    sks.push(tv);
    map[c[0]] = tv;
  }
  return { sks, type: substTVar(map, t.type) };
};

export const quantify = (tms: TMeta[], ty: Type): Type => {
  log(() =>
    `quantify ${showType(ty)} with [${tms.map(showType).join(', ')}]`);
  const len = tms.length;
  if (len === 0) return ty;
  const used = tbinders(ty);
  const tvs: [Name, Kind][] = Array(len);
  let i = 0;
  let l = 0;
  let j = 0;
  while (i < len) {
    const x = tms[i].name;
    const v = x && used.indexOf(x) < 0 ? x :
      `${String.fromCharCode(l + 97)}${j > 0 ? j : ''}`;
    if (used.indexOf(v) < 0) {
      used.push(v);
      tms[i].type = TVar(v);
      tvs[i] = [v, tms[i].kind];
      i++;
    }
    l = (l + 1) % 26;
    if (l === 0) j++;
  }
  return TForall(tvs, prune(ty));
};

export const tmetasEnv = (
  env: LTEnv,
  free: TMeta[] = [],
  tms: TMeta[] = [],
): TMeta[] => {
  each(env, ({ type }) => tmetas(prune(type), free, tms));
  return tms;
};
export const generalize = (lenv: LTEnv, ty: Type): Type => {
  log(() => `generalize ${showType(ty)}`);
  const etms = tmetasEnv(lenv);
  const pty = prune(ty);
  const tms = tmetas(pty, etms);
  return quantify(tms, pty);
};

export const unify = (env: TEnv, a: Type, b: Type): void => {
  log(() => `unify ${showType(a)} ~ ${showType(b)}`);
  if (a === b) return;
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(env, a.left, b.left);
    unify(env, a.right, b.right);
    return;
  }
  if (a.tag === 'TForall' && b.tag === 'TForall' &&
      a.names.length === b.names.length) {
    const sks: TSkol[] = Array(a.names.length);
    const map1: TVMap = {};
    const map2: TVMap = {};
    for (let i = 0, l = a.names.length; i < l; i++) {
      const c = a.names[i];
      if (!eqKind(c[1] || kType, b.names[i][1] || kType))
        return terr(`kind mismatch in parameters of ${showType(a)} ~ ${showType(b)}`);
      const tv = freshTSkol(c[0], c[1] || kType);
      sks[i] = tv;
      map1[c[0]] = tv;
      map2[b.names[i][0]] = tv;
    }
    const rho1 = substTVar(map1, a.type);
    const rho2 = substTVar(map2, b.type);
    unify(env, rho1, rho2);
    if (occursAnyTSkol(sks, prune(a)))
      return terr(`left type not polymorphic enough: ${showType(a)} ~ ${showType(b)}`);
    if (occursAnyTSkol(sks, prune(b)))
      return terr(`right type not polymorphic enough: ${showType(a)} ~ ${showType(b)}`);
    return;
  }
  if (a.tag === 'TMeta') return unifyTMeta(env, a, b);
  if (b.tag === 'TMeta') return unifyTMeta(env, b, a);
  if (a.tag === 'TCon' && b.tag === 'TCon' && a.name === b.name) return;
  if (a.tag === 'TVar' && b.tag === 'TVar' && a.name === b.name) return;
  if (a.tag === 'TSkol' && b.tag === 'TSkol' && a.id === b.id) return;
  return terr(`cannot unify: ${showType(a)} ~ ${showType(b)}`);
};
const unifyTMeta = (env: TEnv, tv: TMeta, t: Type): void => {
  if (tv.type) return unify(env, tv.type, t);
  if (t.tag === 'TMeta' && t.type) return unify(env, tv, t.type);
  if (occursTMeta(tv, t))
    return terr(`occurs check failed: ${showType(tv)} in ${showType(t)}`);
  const k1 = kindOf(env, tv);
  const k2 = kindOf(env, t);
  if (!eqKind(k1, k2))
    return terr(`kind mismatch in ${showType(tv)} ~ ${showType(t)} : ${showKind(k1)} ~ ${showKind(k2)}`);
  if (!tv.name && t.tag === 'TMeta' && t.name) tv.name = t.name;
  tv.type = t;
};

export const subsume = (env: TEnv, a: Type, b: Type): void => {
  log(() => `subsume ${showType(a)} <: ${showType(b)}`);
  const { sks, type } = skolemize(a);
  const rho2 = instantiate(b);
  unify(env, type, rho2);
  if (occursAnyTSkol(sks, prune(a)))
    return terr(`left type not polymorphic enough: ${showType(a)} <: ${showType(b)}`);
  if (occursAnyTSkol(sks, prune(b)))
    return terr(`right type not polymorphic enough: ${showType(a)} <: ${showType(b)}`);
};

export const matchTFun = (ty: Type): { left: Type, right: Type } => {
  const rho = prune(instantiate(prune(ty)));
  if (isTFun(rho)) return { left: rho.left.right, right: rho.right };
  if (rho.tag === 'TMeta') {
    const a = freshTMeta(kType, rho.name);
    const b = freshTMeta(kType, rho.name);
    rho.type = TFun(a, b);
    return { left: a, right: b };
  }
  return terr(`applying non-function: ${showType(rho)}`);
};
export const matchTFuns = (n: number, ty: Type): { args: Type[], res: Type } => {
  const args: Type[] = [];
  const { left, right } = matchTFun(ty);
  args.push(left);
  let c = prune(right);
  while (args.length < n && isTFun(c)) {
    args.push(c.left.right);
    c = c.right;
  }
  return { args, res: c };
};


