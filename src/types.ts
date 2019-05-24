import { Name, Id, impossible, freshId } from './util';
import { log } from './config';

export type Type
  = TForall
  | TApp
  | TCon
  | TVar
  | TSkol
  | TMeta;

export interface TForall {
  readonly tag: 'TForall';
  readonly names: Name[];
  readonly type: Type;
}
export const TForall = (
  names: Name[],
  type: Type
): TForall => ({ tag: 'TForall', names, type });
export const tforall = (ns: Name[], type: Type) => {
  if (ns.length === 0) return type;
  return TForall(ns, type);
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
}
export const TSkol = (name: Name, id: Id): TSkol =>
  ({ tag: 'TSkol', name, id });
export const freshTSkol = (name: Name) =>
  TSkol(name, freshId());

export interface TMeta {
  readonly tag: 'TMeta';
  readonly id: Id;
  name: Name | null;
  type: Type | null;
}
export const TMeta = (
  id: Id,
  name: Name | null = null
): TMeta =>
  ({ tag: 'TMeta', id, name, type: null });
export const freshTMeta = (name: Name | null = null) =>
  TMeta(freshId(), name);

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
  readonly names: Name[];
  readonly type: Type;
}
export const Annot = (names: Name[], type: Type): Annot =>
  ({ names, type });
export const annotAny = Annot(['t'], TVar('t'));

export const showAnnot = (annot: Annot): string =>
  annot.names.length === 0 ? showType(annot.type) :  
    `exists ${annot.names.join(' ')}. ${showType(annot.type)}`;

export const showType = (t: Type): string => {
  if (t.tag === 'TCon') return t.name;
  if (t.tag === 'TVar') return t.name;
  if (t.tag === 'TMeta')
    return `?${t.name ? `${t.name}\$` : ''}${t.id}`;
  if (t.tag === 'TSkol') return `'${t.name}\$${t.id}`;
  if (t.tag === 'TForall')
    return `forall ${t.names.map((tv, i) =>
      `${tv}`).join(' ')}. ${showType(t.type)}`;
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
    for (let k in map) if (names.indexOf(k) < 0) m[k] = map[k];
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
      if (bs.indexOf(x) < 0) bs.push(x);
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

export const normalize = (ty: Type): Type => {
  return ty;
};
export const normalizeAnnot = (a: Annot): Annot => {
  return a;
};
