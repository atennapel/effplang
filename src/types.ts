import { impossible, terr } from './util';
import { Kind, showKind } from './kinds';
import { TVarKinds } from './kindinference';

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
  readonly kind: Kind;
  name: TVarName | null;
  type: Type | null;
}
export const TMeta = (id: TMetaId, kind: Kind, name: TVarName | null = null): TMeta =>
  ({ tag: 'TMeta', id, kind, type: null, name });
export const freshTMeta = (kind: Kind, name: TVarName | null = null) =>
  TMeta(freshTMetaId(), kind, name);

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

export interface Scheme {
  readonly tag: 'Scheme';
  readonly params: [TVarName, Kind][];
  readonly type: Type;
}
export const Scheme = (params: [TVarName, Kind][], type: Type): Scheme =>
  ({ tag: 'Scheme', params, type });

export interface PScheme {
  readonly tag: 'PScheme';
  readonly params: [TVarName, Kind | null][];
  readonly type: Type;
}
export const PScheme = (params: [TVarName, Kind | null][], type: Type): PScheme =>
  ({ tag: 'PScheme', params, type });

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

export const showScheme = (scheme: Scheme): string =>
  scheme.params.length === 0 ? showType(scheme.type) :
  `forall ${scheme.params.map(([x, k]) => `(${x} : ${showKind(k)})`).join(' ')}. ${showType(scheme.type)}`;
export const showPScheme = (scheme: PScheme): string =>
  scheme.params.length === 0 ? showType(scheme.type) :
  `forall ${scheme.params.map(([x, k]) => `(${x} : ${k ? showKind(k) : '?'})`).join(' ')}. ${showType(scheme.type)}`;

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
export const pruneScheme = (scheme: Scheme): Scheme => {
  const t = prune(scheme.type);
  return t !== scheme.type ? Scheme(scheme.params, t) : scheme;
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
export const instantiateTVars = (tvs: [TVarName, Kind][], type: Type, map: InstMap = {}): Type => {
  if (type.tag === 'TVar') {
    const name = type.name;
    const res = tvs.find(([x, _]) => x === name);
    if (!res) return type;
    return map[name] || (map[name] = freshTMeta(res[1], name));
  }
  if (type.tag === 'TMeta')
    return type.type ? instantiateTVars(tvs, type.type, map) : type;
  if (type.tag === 'TApp') {
    const l = instantiateTVars(tvs, type.left, map);
    const r = instantiateTVars(tvs, type.right, map);
    return l === type.left && r === type.right ? type : TApp(l, r);
  }
  return type;
};
export const instantiate = (scheme: Scheme, map: InstMap = {}): Type =>
  instantiateTVars(scheme.params, scheme.type, map);

export type SkolMap = { [name: number]: true };
export const skolemize = (type: Scheme, skols: SkolMap = {}): Type => {
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

export const generalizeR = (type: Type, ns: TVarName[], tvs: TVarKinds): Type => {
  if (type.tag === 'TMeta') {
    if (type.type) return generalizeR(type.type, ns, tvs);
    const x = freshTVarName(tvs, type.name);
    ns.push(x);
    tvs[x] = type.kind;
    return type.type = TVar(x);
  }
  if (type.tag === 'TApp') {
    const l = generalizeR(type.left, ns, tvs);
    const r = generalizeR(type.right, ns, tvs);
    return l === type.left && r === type.right ? type : TApp(l, r);
  }
  return type;
};
export const generalize = (type: Type): Scheme => {
  const ns: TVarName[] = [];
  const ks: TVarKinds = {};
  const gtype = generalizeR(type, ns, ks);
  return Scheme(ns.map(x => [x, ks[x]]), gtype);
};

const freshTVarName = (tvs: TVarKinds, given: TVarName | null = null): TVarName => {
  const isGiven = given !== null;
  let name: TVarName = given || 'a';
  while (tvs[name]) name = nextTVarName(name, isGiven);
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
