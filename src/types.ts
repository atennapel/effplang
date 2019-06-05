import { Name, TMetaId, freshTMetaId } from './name';
import { impossible } from './util';

export type Type
  = TCon
  | TVar
  | TMeta
  | TApp
  | TRowExtend;

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

export interface TMeta {
  readonly tag: 'TMeta';
  readonly id: TMetaId;
  name: Name | null;
  type: Type | null;
}
export const TMeta = (id: TMetaId, name: Name | null = null, type: Type | null = null): TMeta =>
  ({ tag: 'TMeta', id, name, type });
export const freshTMeta = (name: Name | null = null): TMeta =>
  TMeta(freshTMetaId(), name);

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
export const tapp1 = (t: Type, ts: Type[]): Type =>
  ts.reduce(TApp, t);
export const flattenTApp = (t: Type): { head: Type, tail: Type[] } => {
  let c = t;
  const r: Type[] = [];
  while (c.tag === 'TApp') {
    r.push(c.right);
    c = c.left;
  }
  return { head: c, tail: r.reverse() };
};

export const tRowEmpty = TCon('<>');

export type Label = string;
export interface TRowExtend {
  readonly tag: 'TRowExtend';
  readonly label: Label;
}
export const TRowExtend = (label: Label): TRowExtend =>
  ({ tag: 'TRowExtend', label });

export interface TFun {
  readonly tag: 'TApp';
  readonly left: {
    readonly tag: 'TApp';
    readonly left: {
      readonly tag: 'TApp';
      readonly left: TCon;
      readonly right: Type;
    };
    readonly right: Type;
  };
  readonly right: Type;
}
export const tFun = TCon('->');
export const TFun = (left: Type, eff: Type, right: Type): TFun =>
  TApp(TApp(TApp(tFun, left), eff), right) as TFun;
export const isTFun = (t: Type): t is TFun =>
  t.tag === 'TApp' && t.left.tag === 'TApp' && t.left.left.tag === 'TApp' && t.left.left.left === tFun;
export const tfunFrom = (ts: Type[]): Type =>
  ts.reduceRight((x, y) => TFun(y, tRowEmpty, x));
export const tfun = (...ts: Type[]): Type =>
  tfunFrom(ts);
export const tfunLeft = (t: TFun): Type => t.left.left.right;
export const tfunEff = (t: TFun): Type => t.left.right;
export const tfunRight = (t: TFun): Type => t.right;
export const flattenTFun = (t: Type): Type[] => {
  let c = t;
  const r: Type[] = [];
  while (isTFun(c)) {
    r.push(tfunLeft(c));
    c = tfunRight(c);
  }
  r.push(c);
  return r;
};

export interface TRow {
  readonly tag: 'TApp';
  readonly left: {
    readonly tag: 'TApp';
    readonly left: TRowExtend;
    readonly right: Type;
  }
  readonly right: Type;
}
export const TRow = (label: Label, type: Type, rest: Type): TRow =>
  TApp(TApp(TRowExtend(label), type), rest) as TRow;
export const isTRow = (t: Type): t is TRow =>
  t.tag === 'TApp' && t.left.tag === 'TApp' && t.left.left.tag === 'TRowExtend';
export const trow = (ts: [Label, Type][], rest: Type = tRowEmpty): Type =>
  ts.reduceRight((r, [l, t]) => TRow(l, t, r), rest);
export const trowLabel = (t: TRow): Label => t.left.left.label;
export const trowType = (t: TRow): Type => t.left.right;
export const trowRest = (t: TRow): Type => t.right;
export const flattenTRow = (t: Type): { labels: [Label, Type][], rest: Type } => {
  let c = t;
  const r: [Label, Type][] = [];
  while (isTRow(c)) {
    r.push([trowLabel(c), trowType(c)]);
    c = trowRest(c);
  }
  return { labels: r, rest: c };
};

export const tRecord = TCon('Rec');
export const tVariant = TCon('Var');

export const showType = (t: Type): string => {
  if (t.tag === 'TVar') return t.name;
  if (t.tag === 'TCon') return t.name;
  if (t.tag === 'TMeta') return `?${t.id}${t.name ? `\$${t.name}` : ''}`;
  if (t.tag === 'TRowExtend') return `|${t.label}`;
  if (isTFun(t)) {
    const l = tfunLeft(t);
    const ls = isTFun(l) ? `(${showType(l)})` : showType(l);
    const e = tfunEff(t);
    return `${ls} -> ${e === tRowEmpty ? '' : `${showType(e)} `}${showType(tfunRight(t))}`;
  }
  if (isTRow(t)) {
    const f = flattenTRow(t);
    return `<${f.labels.map(([l, t]) => `${l} : ${showType(t)}`).join(', ')}${f.rest === tRowEmpty ? '' : ` | ${showType(f.rest)}`}>`;
  }
  if (t.tag === 'TApp' && t.left === tRecord) {
    if (isTRow(t.right)) return `{${showType(t.right).slice(1, -1)}}`;
    return `{${showType(t.right)}}`;
  }
  if (t.tag === 'TApp' && t.left === tVariant) {
    if (isTRow(t.right)) return `[${showType(t.right).slice(1, -1)}]`;
    return `[${showType(t.right)}]`;
  }
  if (t.tag === 'TApp') {
    const r = t.right;
    const rs = r.tag === 'TApp' && !isTRow(r) ? `(${showType(r)})` : showType(r);
    const l = t.left;
    const ls = isTFun(r) ? `(${showType(l)})` : showType(l);
    return `${ls} ${rs}`;
  }
  return impossible('showType');
};

export const prune = (t: Type): Type => {
  if (t.tag === 'TMeta') {
    if (!t.type) return t;
    return t.type = prune(t.type);
  }
  if (t.tag === 'TApp') return TApp(prune(t.left), prune(t.right));
  return t;
};

export const occursTMeta = (m: TMeta, type: Type): boolean => {
  if (type === m) return true;
  if (type.tag === 'TMeta' && type.type)
    return occursTMeta(m, type.type);
  if (type.tag === 'TApp')
    return occursTMeta(m, type.left) || occursTMeta(m, type.right);
  return false;
};

export type Free = { [key: string]: boolean };
export const freeTMeta = (type: Type, map: Free = {}): Free => {
  if (type.tag === 'TMeta') {
    if (type.type) return freeTMeta(type.type, map);
    map[type.id] = true;
    return map;
  }
  if (type.tag === 'TApp') {
    freeTMeta(type.left, map);
    freeTMeta(type.right, map);
    return map;
  }
  return map;
};

export type TMetaCount = { [key: string]: number };
export const countTMeta = (type: Type, map: TMetaCount = {}): TMetaCount => {
  if (type.tag === 'TMeta') {
    if (type.type) return countTMeta(type.type, map);
    map[type.id] = (map[type.id] || 0) + 1;
    return map;
  }
  if (type.tag === 'TApp') {
    countTMeta(type.left, map);
    countTMeta(type.right, map);
    return map;
  }
  return map;
};
