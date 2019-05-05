import { Type, showType, TMeta, occursTMeta } from './types';
import { terr } from './util';

const bindTMeta = (m: TMeta, t: Type): void => {
  if (m.type) return unify(m.type, t);
  if (t.tag === 'TMeta' && t.type) {
    if (!m.name && t.name) m.name = t.name;
    return unify(m, t.type);
  }
  if (occursTMeta(m, t))
    return terr(`${showType(m)} occurs in ${showType(t)}`);
  m.type = t;
};

export const unify = (a: Type, b: Type): void => {
  if (a === b) return;
  if (a.tag === 'TMeta') return bindTMeta(a, b);
  if (b.tag === 'TMeta') return bindTMeta(b, a);
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(a.left, b.left);
    unify(a.right, b.right);
    return;
  }
  if (a.tag === 'TCon' && b.tag === 'TCon' && a.name === b.name)
    return;
  return terr(`unable to unify ${showType(a)} ~ ${showType(b)}`);
};
