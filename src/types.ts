import { impossible } from './util';

export type TConName = string;
export type TVarName = string;
export type TMetaId = number;

export type Type
  = TCon
  | TVar
  | TMeta
  | TApp

export interface TCon {
  readonly tag: 'TCon';
  readonly name: TConName;
}
export const TCon = (name: TConName): TCon => ({ tag: 'TCon', name });

export interface TVar {
  readonly tag: 'TVar';
  readonly name: TVarName;
}
export const TVar = (name: TVarName): TVar => ({ tag: 'TVar', name });

export interface TMeta {
  readonly tag: 'TMeta';
  readonly id: TMetaId;
  name: TVarName | null;
  type: Type | null;
}
export const TMeta = (id: TMetaId, name: TVarName | null): TMeta =>
  ({ tag: 'TMeta', id, name, type: null});
let tmetaId = 0;
export const resetTMetaId = () => { tmetaId = 0 };
export const freshTMeta = (name: TVarName | null = null) => TMeta(tmetaId++, name);

export interface TApp {
  readonly tag: 'TApp';
  readonly left: Type;
  readonly right: Type;
}
export const TApp = (left: Type, right: Type): TApp => ({ tag: 'TApp', left, right });
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

export const tFun = TCon('->');
export const TFun = (left: Type, right: Type) => TApp(TApp(tFun, left), right);
export const tfunFrom = (ts: Type[]): Type => ts.reduceRight((a, b) => TFun(b, a));
export const tfun = (...ts: Type[]): Type => tfunFrom(ts);
export interface ITFun { left: Type, right: Type }
export const isTFun = (type: Type): boolean =>
  type.tag === 'TApp' && type.left.tag === 'TApp' && type.left.left === tFun;
export const matchTFun = (type: Type): ITFun | null =>
  isTFun(type) ? ({ left: ((type as TApp).left as TApp).right, right: (type as TApp).right }) : null;
export const flattenTFun = (type: Type): Type[] => {
  let c = type;
  const r: Type[] = [];
  while (isTFun(c)) {
    r.push(((c as TApp).left as TApp).right);
    c = (c as TApp).right;
  }
  r.push(c);
  return r;
};

export const showType = (type: Type): string => {
  if (type.tag === 'TCon') return `${type.name}`;
  if (type.tag === 'TVar') return `${type.name}`;
  if (type.tag === 'TMeta')
    return type.name ? `?${type.name}\$${type.id}` : `?${type.id}`;
  if (isTFun(type)) {
    const ts = flattenTFun(type);
    return ts.map(t => isTFun(t) ? `(${showType(t)})` : showType(t)).join(' -> ');
  }
  if (type.tag === 'TApp') {
    const ts = flattenTApp(type);
    return ts.map(t => t.tag === 'TApp' ? `(${showType(t)})` : showType(t)).join(' ');
  }
  return impossible('showType');
};

export const prune = (type: Type): Type => {
  // console.log(`prune ${showType(type)}`);
  if (type.tag === 'TMeta') {
    if (!type.type) return type;
    const ty = prune(type.type);
    type.type = ty;
    return ty;
  }
  if (type.tag === 'TApp') {
    const l = prune(type.left);
    const r = prune(type.right);
    return l === type.left && r === type.right ? type :
      TApp(l, r);
  }
  return type;
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
