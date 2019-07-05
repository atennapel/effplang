import { impossible, terr } from './util';

export type Type
  = TCon
  | TVar
  | TMeta
  | TApp;

export type TConName = string;
export interface TCon {
  readonly tag: 'TCon';
  readonly name: TConName;
}
export const TCon = (name: TConName): TCon =>
  ({ tag: 'TCon', name });

export type TVarName = string;
export interface TVar {
  readonly tag: 'TVar';
  readonly name: TVarName;
}
export const TVar = (name: TVarName): TVar =>
  ({ tag: 'TVar', name });

type TMetaId = number;
let tmetaId: TMetaId = 0;
const freshTMetaId = (): TMetaId => tmetaId++;
export const resetTMetaId = () => { tmetaId = 0 }
export interface TMeta {
  readonly tag: 'TMeta';
  readonly id: TMetaId;
  name: TVarName | null;
  type: Type | null;
}
export const TMeta = (id: TMetaId, name: TVarName | null = null): TMeta =>
  ({ tag: 'TMeta', id, type: null, name });
export const freshTMeta = (name: TVarName | null = null) =>
  TMeta(freshTMetaId(), name);

export interface TApp {
  readonly tag: 'TApp';
  readonly left: Type;
  readonly right: Type;
}
export const TApp = (left: Type, right: Type): TApp =>
  ({ tag: 'TApp', left, right });
export const tappFrom = (ts: Type[]): Type => ts.reduce(TApp);
export const tapp = (...ts: Type[]): Type => tappFrom(ts);
export const tapp1 = (t: Type, as: Type[]): Type => as.reduce(TApp, t);

export interface TFun {
  readonly tag: 'TApp';
  readonly left: {
    readonly tag: 'TApp';
    readonly left: TCon;
    readonly right: Type;
  }
  readonly right: Type;
}
export const TFunC = TCon('->');
export const TFun = (left: Type, right: Type): TApp =>
  TApp(TApp(TFunC, left), right);
export const isTFun = (type: Type): type is TFun =>
  type.tag === 'TApp' && type.left.tag === 'TApp' &&
    type.left.left === TFunC;
export const tfunL = (type: TFun) => type.left.right;
export const tfunR = (type: TFun) => type.right;
export const tfunFrom = (ts: Type[]): Type =>
  ts.reduceRight((x, y) => TFun(y, x));
export const tfun = (...ts: Type[]): Type => tfunFrom(ts);

const showTypeParens = (b: boolean, type: Type) =>
  b ? `(${showType(type)})` : showType(type);
export const showType = (type: Type): string => {
  if (type.tag === 'TCon') return type.name;
  if (type.tag === 'TVar') return type.name;
  if (type.tag === 'TMeta')
    return `?${type.id}${type.name ? `\$${type.name}` : ''}${type.type ? `{${showType(type.type)}}` : ''}`;
  if (isTFun(type)) {
    const l = tfunL(type);
    const r = tfunR(type);
    return `${showTypeParens(isTFun(l), l)} -> ${showType(r)}`;
  }
  if (type.tag === 'TApp') {
    const l = type.left;
    const r = type.right;
    return `${showTypeParens(isTFun(l), l)} ${showTypeParens(r.tag === 'TApp', r)}`;
  }
  return impossible('showType');
};

export const prune = (type: Type): Type => {
  if (type.tag === 'TMeta') {
    if (!type.type) return type;
    return type.type = prune(type.type);
  }
  if (type.tag === 'TApp') {
    const l = prune(type.left);
    const r = prune(type.right);
    return l === type.left && r === type.right ? type : TApp(l, r);
  }
  return type;
};
export const showTypePruned = (type: Type): string =>
  showType(prune(type));

export const tvars = (type: Type, ret: TVar[] = []): TVar[] => {
  if (type.tag === 'TVar') {
    if (ret.indexOf(type) >= 0) return ret;
    ret.push(type);
    return ret;
  }
  if (type.tag === 'TMeta') {
    if (type.type) return tvars(type.type, ret);
    return ret;
  }
  if (type.tag === 'TApp')
    return tvars(type.right, tvars(type.left, ret));
  return ret;
};

export const occursTMeta = (x: TMeta, type: Type): boolean => {
  if (x === type) return true;
  if (type.tag === 'TMeta')
    return type.type ? occursTMeta(x, type.type) : false;
  if (type.tag === 'TApp')
    return occursTMeta(x, type.left) || occursTMeta(x, type.right);
  return false;
};

export const occursTVar = (x: TVar, type: Type): boolean => {
  if (x === type) return true;
  if (type.tag === 'TMeta')
    return type.type ? occursTVar(x, type.type) : false;
  if (type.tag === 'TApp')
    return occursTVar(x, type.left) || occursTVar(x, type.right);
  return false;
};

export const occursTVars = (x: TVar[], type: Type): boolean => {
  if (type.tag === 'TVar') return x.indexOf(type) >= 0;
  if (type.tag === 'TMeta')
    return type.type ? occursTVars(x, type.type) : false;
  if (type.tag === 'TApp')
    return occursTVars(x, type.left) || occursTVars(x, type.right);
  return false;
};

export type InstMap = { [name: string]: TMeta };
export const instantiate = (type: Type, map: InstMap = {}): Type => {
  if (type.tag === 'TVar')
    return map[type.name] || (map[type.name] = freshTMeta(type.name));
  if (type.tag === 'TMeta')
    return type.type ? instantiate(type.type, map) : type;
  if (type.tag === 'TApp') {
    const l = instantiate(type.left, map);
    const r = instantiate(type.right, map);
    return l === type.left && r === type.right ? type : TApp(l, r);
  }
  return type;
};

export const instantiateTVars = (tvs: TVarName[], type: Type, map: InstMap = {}): Type => {
  if (type.tag === 'TVar')
    return tvs.indexOf(type.name) >= 0 ? map[type.name] || (map[type.name] = freshTMeta(type.name)) : type;
  if (type.tag === 'TMeta')
    return type.type ? instantiateTVars(tvs, type.type, map) : type;
  if (type.tag === 'TApp') {
    const l = instantiateTVars(tvs, type.left, map);
    const r = instantiateTVars(tvs, type.right, map);
    return l === type.left && r === type.right ? type : TApp(l, r);
  }
  return type;
};

export type SkolMap = { [name: number]: true };
export const skolemize = (type: Type, skols: SkolMap = {}): Type => {
  const utms: InstMap = {};
  const itype = instantiate(type, utms);
  for (let k in utms) skols[utms[k].id] = true;
  return itype;
};

export const occursSkol = (skols: SkolMap, type: Type): boolean => {
  if (type.tag === 'TMeta')
    return type.type ? occursSkol(skols, type.type) : skols[type.id];
  if (type.tag === 'TApp')
    return occursSkol(skols, type.left) || occursSkol(skols, type.right);
  return false;
};

export const generalize = (type: Type, ns: TVarName[] = []): Type => {
  if (type.tag === 'TMeta')
    return type.type ?
      generalize(type.type, ns) :
      (type.type = TVar(freshTVarName(ns, type.name)));
  if (type.tag === 'TApp') {
    const l = generalize(type.left, ns);
    const r = generalize(type.right, ns);
    return l === type.left && r === type.right ? type : TApp(l, r);
  }
  return type;
};

const freshTVarName = (ns: TVarName[], given: TVarName | null = null): TVarName => {
  const isGiven = given !== null;
  let name: TVarName = given || 'a';
  while (ns.indexOf(name) >= 0) name = nextTVarName(name, isGiven);
  ns.push(name);
  return name;
};
const nextTVarName = (name: TVarName, given: boolean): TVarName => {
  const res = name.match(/[a-z]+([0-9]*)/);
  if (!res) return terr(`invalid tvarname ${name}`);
  if (given) {
    if (!res[1]) return `${name}0`;
    return `${name}${(+res[1]) + 1}`;
  }
  const x = res[0];
  if (x === 'z') return `a${(+res[1]) + 1}`;
  const y = String.fromCharCode(x.charCodeAt(0) + 1);
  return `${y}${res[1]}`;
};
