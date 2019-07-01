import { impossible } from './util';

// names
export type TConName = string;
export type TVarName = string;

export type TMetaId = number;
let _tmetaId: TMetaId = 0;
export const freshTMetaId = (): TMetaId => _tmetaId++;
export const resetTMetaId = () => { _tmetaId = 0 };

export type TSkolId = number;
let _tskolId: TSkolId = 0;
export const freshTSkolId = (): TSkolId => _tskolId++;
export const resetTSkolId = () => { _tskolId = 0 };

// types
export type Type
  = TCon
  | TVar
  | TMeta
  | TSkol
  | TApp
  | TForall;

export interface TCon {
  readonly tag: 'TCon';
  readonly name: TConName;
}
export const TCon = (name: TConName): TCon =>
  ({ tag: 'TCon', name });

export interface TVar {
  readonly tag: 'TVar';
  readonly name: TVarName;
}
export const TVar = (name: TVarName): TVar =>
  ({ tag: 'TVar', name });

export interface TMeta {
  readonly tag: 'TMeta';
  readonly id: TMetaId;
  name: TVarName | null;
  type: Type | null;
}
export const TMeta = (id: TMetaId, name: TVarName | null = null): TMeta =>
  ({ tag: 'TMeta', id, name, type: null });
export const freshTMeta = (name: TVarName | null = null): TMeta =>
  TMeta(freshTMetaId(), name);

export interface TSkol {
  readonly tag: 'TSkol';
  readonly id: TSkolId;
  readonly name: TVarName | null;
}
export const TSkol = (id: TMetaId, name: TVarName | null = null): TSkol =>
  ({ tag: 'TSkol', id, name });
export const freshTSkol = (name: TVarName | null = null): TSkol =>
  TSkol(freshTSkolId(), name);

export interface TApp {
  readonly tag: 'TApp';
  readonly left: Type;
  readonly right: Type;
}
export const TApp = (left: Type, right: Type): TApp =>
  ({ tag: 'TApp', left, right });
export const tappFrom = (ts: Type[]): Type => ts.reduce(TApp);
export const tapp = (...ts: Type[]): Type => tappFrom(ts);
export const flattenTApp = (t: Type): Type[] => {
  const ret: Type[] = [];
  while (t.tag === 'TApp') {
    ret.push(t.right);
    t = t.left;
  }
  ret.push(t);
  return ret.reverse();
};

export interface TForall {
  readonly tag: 'TForall';
  readonly name: TVarName;
  readonly type: Type;
}
export const TForall = (name: TVarName, type: Type): TForall =>
  ({ tag: 'TForall', name, type });
export const tforall = (ns: TVarName[], type: Type): Type =>
  ns.reduceRight((t, n) => TForall(n, t), type);
export const flattenTForall = (t: Type): { ns: TVarName[], type: Type } => {
  const ns: TVarName[] = [];
  while (t.tag === 'TForall') {
    ns.push(t.name);
    t = t.type;
  }
  return { ns, type: t };
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
export const TFunC = TCon('->');
export const TFun = (left: Type, right: Type): TFun =>
  TApp(TApp(TFunC, left), right) as TFun;
export const tfunL = (t: TFun) => t.left.right;
export const tfunR = (t: TFun) => t.right;
export const isTFun = (t: Type): t is TFun =>
  t.tag === 'TApp' && t.left.tag === 'TApp' && t.left.left === TFunC;
export const tfunFrom = (ts: Type[]): Type =>
  ts.reduceRight((x, y) => TFun(y, x));
export const tfun = (...ts: Type[]): Type => tfunFrom(ts);
export const flattenTFun = (t: Type): Type[] => {
  const ret: Type[] = [];
  while (isTFun(t)) {
    ret.push(tfunL(t));
    t = tfunR(t);
  }
  ret.push(t);
  return ret;
};

// methods
const showTypeP = (b: boolean, t: Type): string =>
  b ? `(${showType(t)})` : showType(t);
export const showType = (t: Type): string => {
  if (t.tag === 'TVar') return `${t.name}`;
  if (t.tag === 'TMeta')
    return `?${t.id}${t.name ? `\$${t.name}` : ''}${t.type ? `{${showType(t.type)}}` : ''}`;
  if (t.tag === 'TSkol') return `'${t.id}${t.name ? `\$${t.name}` : ''}`;
  if (t.tag === 'TCon') return `${t.name}`;
  if (isTFun(t)) {
    const f = flattenTFun(t);
    return f.map((t, i) => showTypeP(isTFun(t) || (t.tag === 'TForall' && i < f.length - 1), t)).join(' -> ');
  }
  if (t.tag === 'TApp')
    return flattenTApp(t).map(t => showTypeP(t.tag === 'TApp' || t.tag === 'TForall', t)).join(' ');
  if (t.tag === 'TForall') {
    const f = flattenTForall(t);
    return `forall ${f.ns.join(' ')}. ${showType(t.type)}`;
  }
  return impossible('showType');
};

export const prune = (t: Type): Type => {
  if (t.tag === 'TMeta')
    return t.type ? (t.type = prune(t.type)) : t;
  if (t.tag === 'TApp')
    return TApp(prune(t.left), prune(t.right));
  if (t.tag === 'TForall')
    return TForall(t.name, prune(t.type));
  return t;
};

export const substTVar = (x: TVarName, s: Type, t: Type): Type => {
  if (t.tag === 'TVar') return t.name === x ? s : t;
  if (t.tag === 'TMeta') return t.type ? substTVar(x, s, t.type) : t;
  if (t.tag === 'TApp')
    return TApp(substTVar(x, s, t.left), substTVar(x, s, t.right));
  if (t.tag === 'TForall')
    return t.name === x ? t : TForall(t.name, substTVar(x, s, t.type));
  return t;
};
export const openTForall = (t: TForall, s: Type): Type =>
  substTVar(t.name, s, t.type);

export const hasTMeta = (x: TMeta, t: Type): boolean => {
  if (x === t) return true;
  if (t.tag === 'TMeta') return t.type ? hasTMeta(x, t.type) : false;
  if (t.tag === 'TApp')
    return hasTMeta(x, t.left) || hasTMeta(x, t.right);
  if (t.tag === 'TForall') return hasTMeta(x, t.type);
  return false;
};

export const hasTSkol = (x: TSkol, t: Type): boolean => {
  if (x === t) return true;
  if (t.tag === 'TMeta') return t.type ? hasTSkol(x, t.type) : false;
  if (t.tag === 'TApp')
    return hasTSkol(x, t.left) || hasTSkol(x, t.right);
  if (t.tag === 'TForall') return hasTSkol(x, t.type);
  return false;
};
export const hasAnyTSkol = (xs: TSkol[], t: Type): boolean => {
  if (t.tag === 'TSkol' && xs.indexOf(t) >= 0) return true;
  if (t.tag === 'TMeta')
    return t.type ? hasAnyTSkol(xs, t.type) : false;
  if (t.tag === 'TApp')
    return hasAnyTSkol(xs, t.left) || hasAnyTSkol(xs, t.right);
  if (t.tag === 'TForall') return hasAnyTSkol(xs, t.type);
  return false;
};

export const tmetas = (t: Type, tms: TMeta[], res: TMeta[] = []): TMeta[] => {
  if (t.tag === 'TMeta') {
    if (t.type) return tmetas(t.type, tms, res);
    if (tms.indexOf(t) < 0 && res.indexOf(t) < 0) res.push(t);
    return res;
  }
  if (t.tag === 'TApp')
    return tmetas(t.right, tms, tmetas(t.left, tms, res));
  if (t.tag === 'TForall') return tmetas(t.type, tms, res);
  return res;
};

export const isMono = (t: Type): boolean => {
  if (t.tag === 'TMeta') return t.type ? isMono(t.type) : true;
  if (t.tag === 'TApp') return isMono(t.left) && isMono(t.right);
  if (t.tag === 'TForall') return false;
  return true;
};

export const isTMeta = (t: Type): boolean =>
  t.tag === 'TMeta' && (!t.type || isTMeta(t.type));
