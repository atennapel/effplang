import { impossible } from "./util";

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

export const tFun = TCon('->');
export const TFun = (left: Type, right: Type) => TApp(TApp(tFun, left), right);
export const tfunFrom = (ts: Type[]): Type => ts.reduceRight((a, b) => TFun(b, a));
export const tfun = (...ts: Type[]): Type => tfunFrom(ts);
export interface ITFun { left: Type, right: Type }
export const isTFun = (type: Type): type is TApp =>
  type.tag === 'TApp' && type.left.tag === 'TApp' && type.left.left === tFun;
export const matchTFun = (type: Type): ITFun | null =>
  isTFun(type) ? ({ left: (type.left as any).right, right: type.right }) : null;

export const showType = (type: Type): string => {
  if (type.tag === 'TCon') return `${type.name}`;
  if (type.tag === 'TVar') return `${type.name}`;
  if (type.tag === 'TMeta')
    return type.name ? `?${type.name}\$${type.id}` : `?${type.id}`;
  if (type.tag === 'TApp') return `(${showType(type.left)} ${showType(type.right)})`;
  return impossible('showType');
};

export const occursTMeta = (m: TMeta, type: Type): boolean => {
  if (type === m) return true;
  if (type.tag === 'TApp')
    return occursTMeta(m, type.left) || occursTMeta(m, type.right);
  return false;
};

export const prune = (type: Type): Type => {
  console.log(showType(type));
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
