import { Type, TMeta, showTypePruned, occursTMeta, instantiate, tvars, occursTVars, showType, SkolMap } from './types';
import { terr } from './util';

const unifyTMeta = (x: TMeta, t: Type, skols: SkolMap): void => {
  if (x.type) return unify(x.type, t, skols);
  if (t.tag === 'TMeta' && t.type) return unifyTMeta(x, t.type, skols);
  if (occursTMeta(x, t))
    return terr(`occurs check failed: ${showTypePruned(x)} in ${showTypePruned(t)}`);
  x.type = t;
};

export const unify = (a: Type, b: Type, skols: SkolMap = {}): void => {
  if (a === b) return;
  if (a.tag === 'TMeta' && !skols[a.id]) return unifyTMeta(a, b, skols);
  if (b.tag === 'TMeta' && !skols[b.id]) return unifyTMeta(b, a, skols);
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(a.left, b.left, skols);
    unify(a.right, b.right, skols);
    return;
  }
  if (a.tag === 'TCon' && b.tag === 'TCon' && a.name === b.name) return;
  if (a.tag === 'TVar' && b.tag === 'TVar' && a.name === b.name) return;
  return terr(`cannot unify ${showTypePruned(a)} ~ ${showTypePruned(b)}`);
};

export const subsume = (a: Type, b: Type): void => {
  const ta = instantiate(a);
  unify(ta, b);
  const tvs = tvars(b);
  if (occursTVars(tvs, a))
    return terr(`${showType(a)} not polymorphic enough in ${showType(a)} <: ${showType(b)}`);
};
