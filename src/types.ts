import { Name, Id, showName } from './name';
import { impossible } from './util';

export type Type
  = TCon
  | TVar
  | TMeta
  | TApp
  | TRowExtend;

export interface TCon {
  tag: 'TCon';
  name: Name;
}
export const TCon = (name: Name): TCon =>
  ({ tag: 'TCon', name });

export interface TVar {
  tag: 'TVar';
  name: Name;
}
export const TVar = (name: Name): TVar =>
  ({ tag: 'TVar', name });

export interface TMeta {
  tag: 'TMeta';
  id: Id;
  name: Name | null;
  type: Type | null;
}
export const TMeta = (id: Id, name: Name | null = null, type: Type | null = null): TMeta =>
  ({ tag: 'TMeta', id, name, type });

export interface TApp {
  tag: 'TApp';
  left: Type;
  right: Type;
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

export const nRowEmpty = Name('{}');
export const tRowEmpty = TCon(nRowEmpty);

export type Label = string;
export interface TRowExtend {
  tag: 'TRowExtend';
  label: Label;
}
export const TRowExtend = (label: Label): TRowExtend =>
  ({ tag: 'TRowExtend', label });

export interface TFun {
  tag: 'TApp';
  left: {
    tag: 'TApp';
    left: {
      tag: 'TApp';
      left: TCon;
      right: Type;
    };
    right: Type;
  };
  right: Type;
}
export const nFun = Name('->');
export const tFun = TCon(nFun);
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
  tag: 'TApp';
  left: {
    tag: 'TApp';
    left: TRowExtend;
    right: Type;
  }
  right: Type;
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

export const showType = (t: Type): string => {
  if (t.tag === 'TVar') return showName(t.name);
  if (t.tag === 'TCon') return showName(t.name);
  if (t.tag === 'TMeta') return `?${t.id}${t.name ? `\$${showName(t.name)}` : ''}`;
  if (t.tag === 'TRowExtend') return `|${t.label}`;
  if (isTFun(t)) {
    const l = tfunLeft(t);
    const ls = isTFun(l) ? `(${showType(l)})` : showType(l);
    const e = tfunEff(t);
    return `${ls} -> ${e === tRowEmpty ? '' : `${showType(e)} `}${showType(tfunRight(t))}`;
  }
  if (isTRow(t)) {
    const f = flattenTRow(t);
    return `<${f.labels.map(([l, t]) => `${l} : ${showType(t)}`)}${f.rest === tRowEmpty ? '' : ` | ${showType(f.rest)}`}>`;
  }
  if (t.tag === 'TApp') {
    const r = t.right;
    const rs = isTFun(r) || r.tag === 'TApp' ? `(${showType(r)})` : showType(r);
    const l = t.left;
    const ls = isTFun(r) ? `(${showType(l)})` : showType(l);
    return `${ls} ${rs}`;
  }
  return impossible('showType');
};
