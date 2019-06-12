import { Name, Id, freshId } from './names';
import { Kind, showKind } from './kinds';
import { impossible } from './util';
import { config } from './config';

export type Type
  = TVar
  | TCon
  | TMeta
  | TApp
  | TForall;

export interface TVar {
  readonly tag: 'TVar';
  readonly name: Name;
}
export const TVar = (name: Name): TVar =>
  ({ tag: 'TVar', name });

export interface TCon {
  readonly tag: 'TCon';
  readonly name: Name;
}
export const TCon = (name: Name): TCon =>
  ({ tag: 'TCon', name });

export interface TMeta {
  readonly tag: 'TMeta';
  readonly id: Id;
  readonly kind: Kind;
  name: Name | null;
  type: Type | null;
}
export const TMeta = (id: Id, kind: Kind, name: Name | null = null): TMeta =>
  ({ tag: 'TMeta', id, kind, name, type: null });
export const freshTMeta = (kind: Kind, name: Name | null = null): TMeta =>
  TMeta(freshId(), kind, name);

export interface TApp {
  readonly tag: 'TApp';
  readonly left: Type;
  readonly right: Type;
}
export const TApp = (left: Type, right: Type): TApp =>
  ({ tag: 'TApp', left, right });
export const tappFrom = (ts: Type[]): Type => ts.reduce(TApp);
export const tapp = (...ts: Type[]): Type => tappFrom(ts);
export const flattenTApp = (type: Type): Type[] => {
  let c = type;
  const r: Type[] = [];
  while (c.tag === 'TApp') {
    r.push(c.right);
    c = c.left;
  }
  r.push(c);
  return r.reverse();
};

export interface TForall {
  readonly tag: 'TForall';
  readonly name: Name;
  readonly kind: Kind | null;
  readonly type: Type;
}
export const TForall = (name: Name, kind: Kind | null, type: Type): TForall =>
  ({ tag: 'TForall', name, kind, type });
export const tforall = (ns: [Name, Kind | null][], type: Type): Type =>
  ns.reduceRight((t, [n, k]) => TForall(n, k, t), type);
export const flattenTForall = (type: Type): { ns: [Name, Kind | null][], type: Type } => {
  let c = type;
  const ns: [Name, Kind | null][] = [];
  while (c.tag === 'TForall') {
    ns.push([c.name, c.kind]);
    c = c.type;
  }
  return { ns, type: c };
};

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
    ty.left.left === tFun;
export const tfunL = (ty: TFun): Type => ty.left.right;
export const tfunR = (ty: TFun): Type => ty.right;
export const tfunFrom = (ts: Type[]): Type =>
  ts.reduceRight((x, y) => TFun(y, x));
export const tfun = (...ts: Type[]): Type => tfunFrom(ts);
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

const showTypeW = (b: boolean, t: Type): string =>
  b ? `(${showType(t)})` : showType(t);
export const showType = (t: Type): string => {
  if (t.tag === 'TVar') return `${t.name}`;
  if (t.tag === 'TCon') return `${t.name}`;
  if (t.tag === 'TMeta')
    return `?${t.name ? `${t.name}\$` : ''}${t.id}`;
  if (isTFun(t))
    return flattenTFun(t)
      .map(t => showTypeW(isTFun(t) || t.tag === 'TForall', t))
      .join(' -> ');
  if (t.tag === 'TApp')
    return flattenTApp(t)
      .map(t => showTypeW(t.tag === 'TApp' || t.tag === 'TForall', t))
      .join(' ');
  if (t.tag === 'TForall') {
    const f = flattenTForall(t);
    return `∀${f.ns.map(([tv, k]) =>
      config.showKinds ?
        `(${tv} : ${k ? showKind(k) : '?'})` :
        `${tv}`
      ).join(' ')}. ${showType(f.type)}`;
  }
  return impossible('showType');
};

export const prune = (t: Type): Type => {
  if (t.tag === 'TMeta') {
    if (!t.type) return t;
    return t.type = prune(t.type);
  }
  if (t.tag === 'TApp') {
    const l = prune(t.left);
    const r = prune(t.right);
    return t.left === l && t.right === r ? t : TApp(l, r);
  }
  if (t.tag === 'TForall') {
    const b = prune(t.type);
    return t.type === b ? t : TForall(t.name, t.kind, b);
  }
  return t;
};

export const substTVar = (x: Name, s: Type, t: Type): Type => {
  if (t.tag === 'TVar') return t.name === x ? s : t;
  if (t.tag === 'TMeta' && t.type) return substTVar(x, s, t.type);
  if (t.tag === 'TApp') {
    const l = substTVar(x, s, t.left);
    const r = substTVar(x, s, t.right);
    return l === t.left && r === t.right ? t : TApp(l, r);
  }
  if (t.tag === 'TForall') {
    if (t.name === x) return t;
    const b = substTVar(x, s, t.type);
    return b === t.type ? t : TForall(t.name, t.kind, b);
  }
  return t;
};
export const openTForall = (t: Type, tf: TForall) =>
  substTVar(tf.name, t, tf.type);

export const hasTMeta = (x: TMeta, t: Type): boolean => {
  if (x === t) return true;
  if (t.tag === 'TMeta' && t.type) return hasTMeta(x, t.type);
  if (t.tag === 'TApp')
    return hasTMeta(x, t.left) || hasTMeta(x, t.right);
  if (t.tag === 'TForall') return hasTMeta(x, t.type);
  return false;
};

export const tmetas = (t: Type, tms: TMeta[], res: TMeta[] = []): TMeta[] => {
  if (t.tag === 'TMeta') {
    if (t.type) return tmetas(t.type, tms, res);
    if (tms.indexOf(t) >= 0 && res.indexOf(t) < 0) res.push(t);
    return res;
  }
  if (t.tag === 'TApp')
    return tmetas(t.right, tms, tmetas(t.left, tms, res));
  if (t.tag === 'TForall') return tmetas(t.type, tms, res);
  return res;
};

export type TBinders = { [key: string]: true };
export const tbinders = (t: Type, map: TBinders = {}): TBinders => {
  if (t.tag === 'TForall') {
    map[t.name] = true;
    return tbinders(t.type, map);
  }
  if (t.tag === 'TApp')
    return tbinders(t.right, tbinders(t.left, map));
  return map;
}
