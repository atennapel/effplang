import { terr, impossible } from './util';
import { Kind, occursKMeta, showKindPruned, KMeta, eqKind, showKind, freshKMeta, kType, KFun, pruneKind } from './kinds';
import { Type, showType, Scheme, TVarName, showScheme, freshTMeta, PScheme, showPScheme } from './types';
import { gtenv } from './env';
import { log } from './config';
import { DType } from './definitions';

const unifyKMeta = (x: KMeta, t: Kind): void => {
  log(() => `unifyKMeta ${showKind(x)} := ${showKind(t)}`);
  if (x.kind) return unifyKinds(x.kind, t);
  if (t.tag === 'KMeta' && t.kind) return unifyKMeta(x, t.kind);
  if (occursKMeta(x, t))
    return terr(`occurs check failed in kind: ${showKindPruned(x)} in ${showKindPruned(t)}`);
  x.kind = t;
};

export const unifyKinds = (a: Kind, b: Kind): void => {
  log(() => `unifyKinds ${showKind(a)} ~ ${showKind(b)}`);
  if (a === b) return;
  if (a.tag === 'KMeta') return unifyKMeta(a, b);
  if (b.tag === 'KMeta') return unifyKMeta(b, a);
  if (a.tag === 'KFun' && b.tag === 'KFun') {
    unifyKinds(a.left, b.left);
    unifyKinds(a.right, b.right);
    return;
  }
  if (a.tag === 'KCon' && b.tag === 'KCon' && a.name === b.name) return;
  return terr(`cannot unify kinds ${showKindPruned(a)} ~ ${showKindPruned(b)}`);
};

const defaultKind = (k: Kind): Kind => {
  if (k.tag === 'KMeta')
    return k.kind = k.kind ? defaultKind(k.kind) : kType;
  if (k.tag === 'KFun') {
    const l = defaultKind(k.left);
    const r = defaultKind(k.right);
    return l === k.left && r === k.right ? k : KFun(l, r);
  }
  return k;
};

export type TVarKinds = { [name: string]: Kind };

const inferType = (type: Type, tvs: TVarKinds): Kind => {
  log(() => `inferType ${showType(type)}`);
  if (type.tag === 'TCon') {
    const info = gtenv.types[type.name];
    if (!info) return terr(`undefined type ${type.name}`);
    return info.kind;
  }
  if (type.tag === 'TVar')
    return tvs[type.name] || terr(`undefined tvar ${type.name}`);
  if (type.tag === 'TMeta')
    return terr(`TMeta ${showType(type)} in inferType`);
  if (type.tag === 'TApp') {
    const kf = inferType(type.left, tvs);
    const ka = inferType(type.right, tvs);
    const kr = freshKMeta();
    unifyKinds(kf, KFun(ka, kr));
    return kr;
  }
  return impossible('kindOf');
};

export const inferKind = (scheme: PScheme, tvs: TVarKinds = {}): Scheme => {
  log(() => `inferKind ${showPScheme(scheme)}`);
  const kms: [TVarName, Kind][] = [];
  for (let [x, k] of scheme.params) {
    const nk = k || freshKMeta();
    kms.push([x, nk]);
    tvs[x] = nk;
  }
  const kind = inferType(scheme.type, tvs);
  unifyKinds(kind, kType);
  for (let i = 0, l = kms.length; i < l; i++) {
    const [_, k] = kms[i];
    kms[i][1] = pruneKind(defaultKind(k));
  }
  const rscheme = Scheme(kms, scheme.type);
  log(() => `=> ${showScheme(rscheme)}`);
  return rscheme;
};

export const inferKindDef = (def: DType): [[TVarName, Kind][], Scheme] => {
  const tvs: TVarKinds = {};
  const kms: [TVarName, Kind][] = [];
  for (let [x, k] of def.params) {
    const nk = k || freshKMeta();
    kms.push([x, nk]);
    tvs[x] = nk;
  }
  const scheme = inferKind(def.type, tvs);
  for (let i = 0, l = kms.length; i < l; i++) {
    const [_, k] = kms[i];
    kms[i][1] = pruneKind(defaultKind(k));
  }
  log(() => `=> ${def.name} ${kms.map(([x, k]) => `(${x} : ${showKind(k)})`).join(' ')} = ${showScheme(scheme)}`);
  return [kms, scheme];
};

export const kindOf = (type: Type, tvars: TVarKinds = {}): Kind => {
  log(() => `kindOf ${showType(type)}`);
  if (type.tag === 'TCon') {
    const info = gtenv.types[type.name];
    if (!info) return terr(`undefined type ${type.name}`);
    return info.kind;
  }
  if (type.tag === 'TVar')
    return tvars[type.name] || terr(`undefined tvar ${type.name}`);
  if (type.tag === 'TMeta') return type.kind;
  if (type.tag === 'TApp') {
    const kf = kindOf(type.left);
    if (kf.tag !== 'KFun')
      return terr(`not a kind function in ${showType(type)}, got kind ${showKind(kf)}`);
    return kf.right;
  }
  return impossible('kindOf');
};

export const eqKindOf = (a: Type, b: Type, tvars: TVarKinds = {}): boolean =>
  eqKind(kindOf(a, tvars), kindOf(b, tvars));
