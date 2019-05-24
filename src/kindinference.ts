import { terr, impossible, Name } from './util';
import { TEnv, lookupTCon } from './env';
import {
  TApp,
  TForall,
  substTVar,
  TVar,
  Type,
  TVMap,
  freshTSkol,
  showType,
  showAnnot,
  Annot,
} from './types';
import {
  Kind,
  showKind,
  occursKMeta,
  KMeta,
  freshKMeta,
  KFun,
  kType,
} from './kinds';
import { log } from './config';
import { List, Nil, lookupListKey, Cons } from './list';

const bindKMeta = (x: KMeta, k: Kind): void => {
  if (x.kind) return unifyKind(x.kind, k);
  if (k.tag === 'KMeta' && k.kind) return unifyKind(x, k.kind);
  if (occursKMeta(x, k))
    return terr(`${showKind(x)} occurs in ${showKind(k)}`);
  x.kind = k;
};
const unifyKind = (a: Kind, b: Kind): void => {
  if (a === b) return;
  if (a.tag === 'KMeta') return bindKMeta(a, b);
  if (b.tag === 'KMeta') return bindKMeta(b, a);
  if (a.tag === 'KFun' && b.tag === 'KFun') {
    unifyKind(a.left, b.left);
    unifyKind(a.right, b.right);
    return;
  }
  if (a.tag === 'KCon' && b.tag === 'KCon' && a.name === b.name)
    return;
  return terr(`failed to unify kinds: ${showKind(a)} ~ ${showKind(b)}`);
};

type TVarEnv = List<[Name, Kind]>;
const inferKindR = (env: TEnv, t: Type, tvars: TVarEnv): [Kind, Type] => {
  if (t.tag === 'TMeta') return [t.kind, t];
  if (t.tag === 'TSkol') return [t.kind, t];
  if (t.tag === 'TVar') {
    const k = lookupListKey(tvars, t.name);
    if (!k) return terr(`undefined tvar ${showType(t)} in inferKindR`);
    return [k, t];
  }
  if (t.tag === 'TCon') {
    const k = lookupTCon(t.name, env);
    if (!k) return terr(`undefined type constructor ${showType(t)}`);
    return [k, t];
  }
  if (t.tag === 'TApp') {
    const [l, tl] = inferKindR(env, t.left, tvars);
    const [r, tr] = inferKindR(env, t.right, tvars);
    const km = freshKMeta();
    unifyKind(l, KFun(r, km));
    return [km, TApp(tl, tr)];
  }
  if (t.tag === 'TForall') {
    const { names, type } = t;
    const nks: [Name, Kind][] = Array(names.length);
    let ntvs = tvars;
    for (let i = 0, l = names.length; i < l; i++) {
      const c = names[i];
      const ki = c[1] || freshKMeta();
      const kv: [Name, Kind] = [c[0], ki];
      ntvs = Cons(kv, ntvs);
      nks[i] = kv;
    }
    const [km, b] = inferKindR(env, type, ntvs);
    return [km, TForall(nks, b)];
  }
  return impossible('inferKindR');
};

const defaultKindInKind = (k: Kind): Kind => {
  if (k.tag === 'KCon') return k;
  if (k.tag === 'KMeta') {
    if (k.kind) return defaultKindInKind(k.kind);
    k.kind = kType;
    return kType;
  }
  if (k.tag === 'KFun') {
    return KFun(
      defaultKindInKind(k.left),
      defaultKindInKind(k.right)
    );
  }
  return impossible('defaultKindInKind');
};

const defaultKind = (t: Type): Type => {
  if (t.tag === 'TApp')
    return TApp(defaultKind(t.left), defaultKind(t.right));
  if (t.tag === 'TForall') {
    const nks = t.names.map(([n, k]) =>
      k ? [n, defaultKindInKind(k)] : [n, kType]) as [Name, Kind][];
    return TForall(nks, defaultKind(t.type));
  }
  if (t.tag === 'TSkol') {
    t.kind = defaultKindInKind(t.kind);
    return t;
  }
  if (t.tag === 'TMeta') {
    t.kind = defaultKindInKind(t.kind);
    return t;
  }
  return t;
};

export const inferKind = (env: TEnv, ty: Type): Type => {
  log(() => `inferKind ${showType(ty)}`);
  const [_, ti] = inferKindR(env, ty, Nil);
  return defaultKind(ti);
};
export const inferKindAnnot = (env: TEnv, annot: Annot): Annot => {
  log(() => `inferKindAnnot ${showAnnot(annot)}`);
  const { names, type } = annot;
  const nks: [Name, Kind][] = Array(names.length);
  let ntvs: List<[Name, Kind]> = Nil;
  for (let i = 0, l = names.length; i < l; i++) {
    const c = names[i];
    const ki = c[1] || freshKMeta();
    const kv: [Name, Kind] = [c[0], ki];
    ntvs = Cons(kv, ntvs);
    nks[i] = kv;
  }
  const [_, b] = inferKindR(env, type, ntvs);
  return Annot(nks, defaultKind(b));
};

export const kindOf = (env: TEnv, t: Type): Kind => {
  if (t.tag === 'TMeta') return t.kind;
  if (t.tag === 'TSkol') return t.kind;
  if (t.tag === 'TCon')
    return lookupTCon(t.name, env) ||
      terr(`undefined type constructor ${showType(t)}`);
  if (t.tag === 'TApp') {
    const f = kindOf(env, t.left);
    if (f.tag !== 'KFun')
      return terr(`not a kind fun in left side of type application (${showType(t)}): ${showKind(f)}`);
    return f.right;
  }
  return terr(`unexpected type ${showType(t)} in kindOf`);
};
