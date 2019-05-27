import { Type, prune, freshTMeta, substTVar, TVMap, Annot, TMeta, freshTSkol, showType, tbinders, TVar, TForall, tmetas, occursTMeta, TSkol, occursAnyTSkol, isTFun, TFun, normalizeAnnot, isTEffsExtend, TEffsExtend, TCon, flattenTApp, matchTFun, flattenTEffsExtend, teffsFrom, tEffsEmpty, normalize } from './types';
import { log } from './config';
import { LTEnv, TEnv } from './env';
import { each, List, Nil } from './list';
import { terr, Name } from './util';
import { kindOf } from './kindinference';
import { eqKind, showKind, kType, Kind, kEffs } from './kinds';

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

const rewriteEffs = (env: TEnv, eff: TCon, all: Type, row: Type): TEffsExtend => {
  log(() => `rewriteEffs ${showType(all)} ~ ${showType(row)}`);
  if (isTEffsExtend(row)) {
    const eff2 = flattenTApp(row.left.right)[0];
    if (!eff2 || eff2.tag !== 'TCon')
      return terr(`invalid effect in effs (2): ${showType(row.left.right)}`);
    if (eff === eff2 || eff.name === eff2.name) {
      unify(env, all, row.left.right);
      return row;
    } else {
      const tail = rewriteEffs(env, eff, all, row.right);
      return TEffsExtend(tail.left.right, TEffsExtend(row.left.right, tail.right));
    }
  }
  if (row.tag === 'TMeta') {
    if (row.type) return rewriteEffs(env, eff, all, row.type);
    const tv = freshTMeta(kEffs, 'e');
    if (occursTMeta(row, all))
      return terr(`${showType(row)} occurs in ${showType(eff)} in rewriteEffs`);
    const nrow = TEffsExtend(all, tv)
    row.type = nrow;
    return nrow;
  }
  return terr(`cannot rewriteEffs: ${showType(eff)} in ${showType(row)}`);
};

export const unify = (env: TEnv, a: Type, b: Type): void => {
  log(() => `unify ${showType(a)} ~ ${showType(b)}`);
  if (a === b) return;
  if (isTEffsExtend(a) && isTEffsExtend(b)) {
    const eff = flattenTApp(a.left.right)[0];
    if (!eff || eff.tag !== 'TCon')
      return terr(`invalid effect in effs: ${showType(a.left.right)}`);
    const br = rewriteEffs(env, eff, a.left.right, b);
    unify(env, a.right, br.right);
    return;
  }
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

export const unifyTFun = (ty: Type): { left: Type, effs: Type, right: Type } => {
  const rho = prune(instantiate(prune(ty)));
  if (isTFun(rho)) return matchTFun(rho);
  if (rho.tag === 'TMeta') {
    const a = freshTMeta(kType, rho.name);
    const e = freshTMeta(kEffs, 'e');
    const b = freshTMeta(kType, rho.name);
    rho.type = TFun(a, e, b);
    return { left: a, effs: e, right: b };
  }
  return terr(`applying non-function: ${showType(rho)}`);
};
export const unifyTFuns = (n: number, ty: Type): { args: Type[], effs: Type[], res: Type } => {
  const args: Type[] = [];
  const effsr: Type[] = [];
  const { left, effs, right } = unifyTFun(ty);
  args.push(left);
  effsr.push(effs);
  let c = prune(right);
  while (args.length < n && isTFun(c)) {
    args.push(c.left.left.right);
    effsr.push(c.left.right);
    c = c.right;
  }
  return { args, effs: effsr, res: c };
};

const openEffsRow = (t: Type): Type => {
  const f = flattenTEffsExtend(t);
  if (f.rest === tEffsEmpty)
    return teffsFrom(f.effs, freshTMeta(kEffs, 'e'));
  return t;
};
export const openEffs = (t: Type): Type => {
  if (t.tag === 'TForall')
    return TForall(t.names, openEffs(t.type));
  if (isTFun(t)) {
    const m = matchTFun(t);
    return TFun(m.left, openEffsRow(m.effs), openEffs(m.right));
  }
  return t;
};

const markCounts = (t: Type, map: { [key: string]: number } = {}): void => {
  if (t.tag === 'TVar') {
    map[t.name]++;
    (t as any)._counts = map;
    return;
  }
  if (t.tag === 'TForall') {
    const m = Object.create(map);
    for (let i = 0, l = t.names.length; i < l; i++)
      m[t.names[i][0]] = 0;
    markCounts(t.type, m);
    return;
  }
  if (t.tag === 'TApp') {
    markCounts(t.left, map);
    markCounts(t.right, map);
    return;
  }
};
const closeEffsRow = (t: Type): Type => {
  if (t === tEffsEmpty) return t;
  const f = flattenTEffsExtend(t);
  const r = f.rest;
  let rr = r;
  if (r.tag === 'TVar') {
    const c = (r as any)._counts[r.name];
    delete (r as any)._counts;
    if (c < 2) rr = tEffsEmpty;
  }
  return teffsFrom(f.effs, rr);
};
const closeEffsR = (t: Type): Type => {
  if (t.tag === 'TVar') {
    if ((t as any)._counts) delete (t as any)._counts;
    return t;
  }
  if (t.tag === 'TForall')
    return TForall(t.names, closeEffsR(t.type));
  if (isTFun(t)) {
    const m = matchTFun(t);
    return TFun(m.left, closeEffsRow(m.effs), closeEffsR(m.right));
  }
  return t;
};
export const closeEffs = (t: Type): Type => {
  markCounts(t);
  return closeEffsR(t);
};

export const generalizeAndClose = (genv: TEnv, lenv: LTEnv, ty: Type): Type => {
  const g = generalize(lenv, ty);
  const c = closeEffs(g);
  return normalize(genv, c);
};
