import { Name, Id, impossible, freshId, terr, indexOf } from './util';
import { Kind, kType, showKind } from './kinds';
import { TEnv } from './env';
import { inferKind } from './kindinference';
import { config, log } from './config';

export type Type
  = TForall
  | TApp
  | TCon
  | TVar
  | TSkol
  | TMeta;

export interface TForall {
  readonly tag: 'TForall';
  readonly names: [Name, Kind | null][];
  readonly type: Type;
}
export const TForall = (
  names: [Name, Kind | null][],
  type: Type
): TForall => ({ tag: 'TForall', names, type });
export const tforall = (ns: (Name | [Name, Kind | null])[], type: Type) => {
  if (ns.length === 0) return type;
  return TForall(
    ns.map(x => Array.isArray(x) ? x : [x, null]),
    type,
  );
};

export interface TApp {
  readonly tag: 'TApp';
  readonly left: Type;
  readonly right: Type;
}
export const TApp = (left: Type, right: Type): TApp =>
  ({ tag: 'TApp', left, right });
export const tappFrom = (ts: Type[]): Type =>
  ts.reduce(TApp);
export const tapp = (...ts: Type[]): Type =>
  tappFrom(ts);
export const flattenTApp = (t: Type): Type[] => {
  let c = t;
  const r: Type[] = [];
  while (c.tag === 'TApp') {
    r.push(c.right);
    c = c.left;
  }
  r.push(c);
  return r.reverse();
};

export interface TCon {
  readonly tag: 'TCon';
  readonly name: Name;
}
export const TCon = (name: Name): TCon =>
  ({ tag: 'TCon', name });

export interface TVar {
  readonly tag: 'TVar';
  readonly name: Name;
}
export const TVar = (name: Name): TVar =>
  ({ tag: 'TVar', name });

export interface TSkol {
  readonly tag: 'TSkol';
  readonly name: Name;
  readonly id: Id;
  readonly kind: Kind;
}
export const TSkol = (name: Name, id: Id, kind: Kind): TSkol =>
  ({ tag: 'TSkol', name, id, kind });
export const freshTSkol = (name: Name, kind: Kind) =>
  TSkol(name, freshId(), kind);

export interface TMeta {
  readonly tag: 'TMeta';
  readonly id: Id;
  readonly kind: Kind;
  name: Name | null;
  type: Type | null;
}
export const TMeta = (
  id: Id,
  kind: Kind,
  name: Name | null = null,
): TMeta =>
  ({ tag: 'TMeta', id, kind, name, type: null });
export const freshTMeta = (kind: Kind, name: Name | null = null) =>
  TMeta(freshId(), kind, name);

export const tFloat = TCon('Float');
export const tString = TCon('String');

export interface TFun {
  readonly tag: 'TApp';
  readonly left: {
    readonly tag: 'TApp';
    readonly left: TCon;
    readonly right: Type;
  }
  readonly right: Type;
}
export const tFun = TCon('->');
export const TFun = (left: Type, right: Type): TFun =>
  TApp(TApp(tFun, left), right) as TFun;
export const isTFun = (ty: Type): ty is TFun =>
  ty.tag === 'TApp' && ty.left.tag === 'TApp' &&
    (ty.left.left === tFun ||
      (ty.left.left.tag === 'TCon' &&
        ty.left.left.name === tFun.name));
export const tfunFrom = (ts: Type[]): Type =>
  ts.reduceRight((x, y) => TFun(y, x));
export const tfun = (...ts: Type[]): Type =>
  tfunFrom(ts);
export const flattenTFun = (t: Type): Type[] => {
  let c = t;
  const r: Type[] = [];
  while (isTFun(c)) {
    r.push(c.left.right);
    c = c.right;
  }
  r.push(c);
  return r;
};

export interface Annot {
  readonly names: [Name, Kind][];
  readonly type: Type;
}
export const Annot = (names: [Name, Kind][], type: Type): Annot =>
  ({ names, type });
export const annotAny = Annot([['t', kType]], TVar('t'));

export const showAnnot = (annot: Annot): string =>
  annot.names.length === 0 ? showType(annot.type) :  
    `exists ${annot.names.map(([x, k]) =>
      k && config.showKinds ?
        `(${x} : ${showKind(k)})` :
        `${x}`).join(' ')}. ${showType(annot.type)}`;

export const showType = (t: Type): string => {
  if (t.tag === 'TCon') return t.name;
  if (t.tag === 'TVar') return t.name;
  if (t.tag === 'TMeta')
    return `?${t.name ? `${t.name}\$` : ''}${t.id}`;
  if (t.tag === 'TSkol') return `'${t.name}\$${t.id}`;
  if (t.tag === 'TForall')
    return `forall ${t.names.map(([x, k]) =>
      k && config.showKinds ?
        `(${x} : ${showKind(k)})` :
        `${x}`).join(' ')}. ${showType(t.type)}`;
  if (isTFun(t))
    return flattenTFun(t)
      .map(t => isTFun(t) || t.tag === 'TForall' ?
        `(${showType(t)})` : showType(t))
      .join(' -> ');
  if (t.tag === 'TApp')
    return flattenTApp(t)
      .map(t => t.tag === 'TApp' || t.tag === 'TForall' ?
            `(${showType(t)})` : showType(t))
      .join(' ');
  return impossible('showType');
};

export type TVMap = { [key: string]: Type };
export const substTVar = (map: TVMap, ty: Type): Type => {
  if (ty.tag === 'TVar') return map[ty.name] || ty;
  if (ty.tag === 'TApp')
    return TApp(substTVar(map, ty.left), substTVar(map, ty.right));
  if (ty.tag === 'TForall') {
    const { names, type } = ty;
    const m: TVMap = {};
    for (let k in map) if (indexOf(names, ([l, _]) => k === l) < 0) m[k] = map[k];
    return TForall(names, substTVar(m, type));
  }
  return ty;
};

export const tmetas = (
  ty: Type,
  free: TMeta[] = [],
  tms: TMeta[] = [],
): TMeta[] => {
  if (ty.tag === 'TMeta') {
    if (free.indexOf(ty) >= 0 || tms.indexOf(ty) >= 0) return tms;
    tms.push(ty);
    return tms;
  }
  if (ty.tag === 'TApp')
    return tmetas(ty.right, free, tmetas(ty.left, free, tms));
  if (ty.tag === 'TForall')
    return tmetas(ty.type, free, tms);
  return tms;
};

export const prune = (ty: Type): Type => {
  if (ty.tag === 'TMeta') {
    if (!ty.type) return ty;
    const t = prune(ty.type);
    ty.type = t;
    return t;
  }
  if (ty.tag === 'TApp')
    return TApp(prune(ty.left), prune(ty.right));
  if (ty.tag === 'TForall')
    return TForall(ty.names, prune(ty.type));
  return ty;
};

export const containsTCon = (c: string, t: Type): boolean => {
  if (t.tag === 'TCon') return t.name === c;
  if (t.tag === 'TApp')
    return containsTCon(c, t.left) || containsTCon(c, t.right);
  if (t.tag === 'TForall') return containsTCon(c, t.type);
  return false;
};

export const occursTMeta = (x: TMeta, t: Type): boolean => {
  if (x === t) return true;
  if (t.tag === 'TMeta' && t.type)
    return occursTMeta(x, t.type);
  if (t.tag === 'TApp')
    return occursTMeta(x, t.left) || occursTMeta(x, t.right);
  if (t.tag === 'TForall') return occursTMeta(x, t.type);
  return false;
};
export const occursTSkol = (x: TSkol, t: Type): boolean => {
  if (x === t) return true;
  if (t.tag === 'TMeta' && t.type)
    return occursTSkol(x, t.type);
  if (t.tag === 'TApp')
    return occursTSkol(x, t.left) || occursTSkol(x, t.right);
  if (t.tag === 'TForall') return occursTSkol(x, t.type);
  return false;
};
export const occursAnyTSkol = (x: TSkol[], t: Type): boolean => {
  if (t.tag === 'TSkol' && x.indexOf(t) >= 0) return true;
  if (t.tag === 'TMeta' && t.type)
    return occursAnyTSkol(x, t.type);
  if (t.tag === 'TApp')
    return occursAnyTSkol(x, t.left) || occursAnyTSkol(x, t.right);
  if (t.tag === 'TForall') return occursAnyTSkol(x, t.type);
  return false;
};

export const tbinders = (ty: Type, bs: Name[] = []): Name[] => {
  if (ty.tag === 'TApp')
    return tbinders(ty.right, tbinders(ty.left, bs));
  if (ty.tag === 'TForall') {
    const names = ty.names;
    for (let i = 0, l = names.length; i < l; i++) {
      const x = names[i];
      if (bs.indexOf(x[0]) < 0) bs.push(x[0]);
    }
    return tbinders(ty.type, bs);
  }
  return bs;
};

export const isMono = (ty: Type): boolean => {
  if (ty.tag === 'TForall') return false;
  if (ty.tag === 'TApp') return isMono(ty.left) && isMono(ty.right);
  return true;
};
export const isSigma = (ty: Type): boolean =>
  ty.tag === 'TForall';

export const normalizeR = (ty: Type, tvs: Name[] = []): Type => {
  if (ty.tag === 'TVar') {
    if (tvs.indexOf(ty.name) < 0) tvs.push(ty.name);
    return ty;
  }
  if (ty.tag === 'TApp') {
    const t1 = normalizeR(ty.left, tvs);
    const t2 = normalizeR(ty.right, tvs);
    return TApp(t1, t2);
  }
  if (ty.tag === 'TForall') {
    if (ty.type.tag === 'TForall')
      return normalizeR(TForall(ty.names.concat(ty.type.names), ty.type.type), tvs);
    const body = normalizeR(ty.type, tvs);
    const bound: [Name, Kind][] = [];
    const unbound: Name[] = [];
    for (let i = 0, l = tvs.length; i < l; i++) {
      const c = tvs[i];
      const j = indexOf(ty.names, ([l, _]) => l === c);
      if (j >= 0) bound.push([ty.names[j][0], ty.names[j][1] || kType]);
      else unbound.push(c);
    }
    tvs.splice(0, tvs.length, ...unbound);
    return TForall(bound, body);
  }
  return ty;
};
export const normalize = (env: TEnv, ty: Type): Type => {
  const tvs: Name[] = [];
  const rty = normalizeR(ty, tvs);
  if (tvs.length > 0)
    return terr(`unbound type variables in ${showType(ty)}`);
  return inferKind(env, rty);
};
export const normalizeAnnot = (env: TEnv, a: Annot): Annot => {
  log(() => `normalizeAnnot ${showAnnot(a)}`);
  const tvs: Name[] = [];
  const ty = normalizeR(a.type, tvs);
  log(() => `normalizeR ${showType(ty)}`);
  const bound: [Name, Kind][] = [];
  for (let i = 0, l = tvs.length; i < l; i++) {
    const c = tvs[i];
    const j = indexOf(a.names, ([l, _]) => l === c);
    if (j >= 0) bound.push(a.names[j]);
    else return terr(`unbound type variable in annotation ${showAnnot(a)}`);
  }
  const map: TVMap = {};
  for (let i = 0, l = bound.length; i < l; i++)
    map[bound[i][0]] = freshTSkol(bound[i][0], bound[i][1]);
  const sty = substTVar(map, ty);
  const kty = inferKind(env, sty);
  const nanno = Annot(bound, kty);
  log(() => `result ${showAnnot(nanno)}`);
  return nanno;
};
