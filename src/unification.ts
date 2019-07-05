import { Type, TMeta, showTypePruned, occursTMeta, instantiate, tvars, occursTVars, showType, SkolMap, Scheme, showScheme, skolemize, occursSkol } from './types';
import { terr } from './util';
import { eqKindOf } from './kindinference';
import { each, Nil } from './list';
import { LTEnv } from './env';
import { log } from './config';

const unifyTMeta = (x: TMeta, t: Type, skols: SkolMap): void => {
  log(() => `unifyTMeta ${showType(x)} := ${showType(t)}`);
  if (x.type) return unify(x.type, t, skols);
  if (t.tag === 'TMeta') {
    if (!x.name && t.name) x.name = t.name;
    if (!t.name && x.name) t.name = x.name;
    if (t.type) return unifyTMeta(x, t.type, skols);
  }
  if (occursTMeta(x, t))
    return terr(`occurs check failed: ${showTypePruned(x)} in ${showTypePruned(t)}`);
  x.type = t;
};

export const unify = (a: Type, b: Type, skols: SkolMap = {}): void => {
  log(() => `unify ${showType(a)} ~ ${showType(b)}`);
  if (a === b) return;
  if (!eqKindOf(a, b))
    return terr(`kind mismatch ${showTypePruned(a)} ~ ${showTypePruned(b)}`);
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

export const subsume = (a: Scheme, b: Scheme, env: LTEnv = Nil): void => {
  log(() => `subsume ${showScheme(a)} <: ${showScheme(b)}`);
  const skols: SkolMap = {};
  const itype = skolemize(b, skols);
  unify(instantiate(a), itype, skols);
  each(env, ({ name, scheme }) => {
    if (occursSkol(skols, scheme.type))
      terr(`skolem escape in ${name} : ${showTypePruned(scheme.type)}`);
  });
};
