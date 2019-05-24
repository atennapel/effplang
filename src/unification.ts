import { Type, prune, freshTMeta, substTVar, TVMap, Annot, TMeta, freshTSkol, showType, tbinders, TVar, TForall, tmetas, occursTMeta, TSkol, occursAnyTSkol, isTFun, TFun, normalizeAnnot } from './types';
import { log } from './config';
import { LTEnv } from './env';
import { each } from './list';
import { terr } from './util';

export const instantiate = (ty: Type): Type => {
  const t = prune(ty);
  if (t.tag !== 'TForall') return t;
  const map: TVMap = {};
  for (let i = 0, l = t.names.length; i < l; i++)
    map[t.names[i]] = freshTMeta(t.names[i]);
  return substTVar(map, t.type);
};

export const instantiateAnnot = (a_: Annot): { tmetas: TMeta[], type: Type } => {
  const a = normalizeAnnot(a_);
  if (a.names.length === 0) return { tmetas: [], type: a.type };
  const tvs: TMeta[] = Array(a.names.length);
  const map: TVMap = {};
  for (let i = 0, l = a.names.length; i < l; i++) {
    const tv = freshTMeta(a.names[i]);
    map[a.names[i]] = tv;
    tvs[i] = tv;
  }
  return { tmetas: tvs, type: substTVar(map, a.type) };
};

export const skolemize = (ty: Type): { sks: TSkol[], type: Type } => {
  const t = prune(ty);
  if (t.tag !== 'TForall') return { sks: [], type: t };
  const sks: TSkol[] = [];
  const map: TVMap = {};
  for (let i = 0, l = t.names.length; i < l; i++) {
    const tv = freshTSkol(t.names[i]);
    sks.push(tv);
    map[t.names[i]] = tv;
  }
  return { sks, type: substTVar(map, t.type) };
};

export const quantify = (tms: TMeta[], ty: Type): Type => {
  log(() =>
    `quantify ${showType(ty)} with [${tms.map(showType).join(', ')}]`);
  const len = tms.length;
  if (len === 0) return ty;
  const used = tbinders(ty);
  const tvs = Array(len);
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
      tvs[i] = v;
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
  const etms = tmetasEnv(lenv);
  const pty = prune(ty);
  const tms = tmetas(pty, etms);
  return quantify(tms, pty);
};

export const unify = (a: Type, b: Type): void => {
  log(() => `unify ${showType(a)} ~ ${showType(b)}`);
  if (a === b) return;
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(a.left, b.left);
    unify(a.right, b.right);
    return;
  }
  if (a.tag === 'TForall' && b.tag === 'TForall' &&
      a.names.length === b.names.length) {
    const sks: TSkol[] = Array(a.names.length);
    const map1: TVMap = {};
    const map2: TVMap = {};
    for (let i = 0, l = a.names.length; i < l; i++) {
      const tv = freshTSkol(a.names[i]);
      sks[i] = tv;
      map1[a.names[i]] = tv;
      map2[b.names[i]] = tv;
    }
    const rho1 = substTVar(map1, a.type);
    const rho2 = substTVar(map2, b.type);
    unify(rho1, rho2);
    if (occursAnyTSkol(sks, prune(a)))
      return terr(`left type not polymorphic enough: ${showType(a)} ~ ${showType(b)}`);
    if (occursAnyTSkol(sks, prune(b)))
      return terr(`right type not polymorphic enough: ${showType(a)} ~ ${showType(b)}`);
    return;
  }
  if (a.tag === 'TMeta') return unifyTMeta(a, b);
  if (b.tag === 'TMeta') return unifyTMeta(b, a);
  if (a.tag === 'TCon' && b.tag === 'TCon' && a.name === b.name) return;
  if (a.tag === 'TVar' && b.tag === 'TVar' && a.name === b.name) return;
  if (a.tag === 'TSkol' && b.tag === 'TSkol' && a.id === b.id) return;
  return terr(`cannot unify: ${showType(a)} ~ ${showType(b)}`);
};
const unifyTMeta = (tv: TMeta, t: Type): void => {
  if (tv.type) return unify(tv.type, t);
  if (t.tag === 'TMeta' && t.type) return unify(tv, t.type);
  if (occursTMeta(tv, t))
    return terr(`occurs check failed: ${showType(tv)} in ${showType(t)}`);
  tv.type = t;
};

export const subsume = (a: Type, b: Type): void => {
  log(() => `subsume ${showType(a)} <: ${showType(b)}`);
  const { sks, type } = skolemize(a);
  const rho2 = instantiate(b);
  unify(type, rho2);
  if (occursAnyTSkol(sks, prune(a)))
    return terr(`left type not polymorphic enough: ${showType(a)} <: ${showType(b)}`);
  if (occursAnyTSkol(sks, prune(b)))
    return terr(`right type not polymorphic enough: ${showType(a)} <: ${showType(b)}`);
};

export const matchTFun = (ty: Type): { left: Type, right: Type } => {
  const rho = prune(instantiate(prune(ty)));
  if (isTFun(rho)) return { left: rho.left.right, right: rho.right };
  if (rho.tag === 'TMeta') {
    const a = freshTMeta(rho.name);
    const b = freshTMeta(rho.name);
    rho.type = TFun(a, b);
    return { left: a, right: b };
  }
  return terr(`applying non-function: ${showType(rho)}`);
};
export const matchTFuns = (n: number, ty: Type): { args: Type[], res: Type } => {
  let c = prune(ty);
  const args: Type[] = [];
  while (args.length < n && isTFun(c)) {
    args.push(c.left.right);
    c = c.right;
  }
  return { args, res: c };
};


