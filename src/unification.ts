import { Type, TMeta, showTypePruned, occursTMeta } from './types';
import { terr } from './util';

const unifyTMeta = (x: TMeta, t: Type): void => {
  if (x.type) return unify(x.type, t);
  if (t.tag === 'TMeta' && t.type) return unifyTMeta(x, t.type);
  if (occursTMeta(x, t))
    return terr(`occurs check failed: ${showTypePruned(x)} in ${showTypePruned(t)}`);
  x.type = t;
};

export const unify = (a: Type, b: Type): void => {
  if (a === b) return;
  if (a.tag === 'TMeta') return unifyTMeta(a, b);
  if (b.tag === 'TMeta') return unifyTMeta(b, a);
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(a.left, b.left);
    unify(a.right, b.right);
    return;
  }
  return terr(`cannot unify ${showTypePruned(a)} ~ ${showTypePruned(b)}`);
};
