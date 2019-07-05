import { terr, impossible } from './util';
import { Kind, occursKMeta, showKindPruned, KMeta, eqKind, showKind } from './kinds';
import { Type, showType } from './types';
import { gtenv } from './env';
import { log } from './config';

const unifyKMeta = (x: KMeta, t: Kind): void => {
  if (x.kind) return unifyKinds(x.kind, t);
  if (t.tag === 'KMeta' && t.kind) return unifyKMeta(x, t.kind);
  if (occursKMeta(x, t))
    return terr(`occurs check failed in kind: ${showKindPruned(x)} in ${showKindPruned(t)}`);
  x.kind = t;
};

const unifyKinds = (a: Kind, b: Kind): void => {
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

export type TVarKinds = { [name: string]: Kind };

// inferKind

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
