import { Type, showType, TMeta, matchTEffExtend, ITEffExtend, TEffExtend, freshTMeta, eqType } from './types';
import { terr } from './util';

const rewriteEff = (eff: Type, other: Type): ITEffExtend => {
  // console.log(`rewriteEff ${showType(eff)} in ${showType(other)}`);
  const m = matchTEffExtend(other);
  if (m) {
    if (eqType(eff, m.eff)) return m;
    else {
      const tail = rewriteEff(eff, m.rest);
      return { eff: tail.eff, rest: TEffExtend(m.eff, tail.rest) };
    }
  }
  if (other.tag === 'TMeta') {
    if (other.type) return rewriteEff(eff, other.type);
    const tv = freshTMeta('e');
    other.type = TEffExtend(eff, tv);
    return { eff, rest: tv };
  }
  return terr(`cannot rewriteEff: ${showType(eff)} in ${showType(other)}`);
};

const occursTMeta = (m: TMeta, type: Type): boolean => {
  if (type === m) return true;
  if (type.tag === 'TMeta' && type.type)
    return occursTMeta(m, type.type);
  if (type.tag === 'TApp')
    return occursTMeta(m, type.left) || occursTMeta(m, type.right);
  return false;
};

const bindTMeta = (m: TMeta, t: Type): void => {
  if (m.type) return unify(m.type, t);
  if (t.tag === 'TMeta') {
    if (!m.name && t.name) m.name = t.name;
    if (t.type) return unify(m, t.type);
    m.type = t;
    return;
  }
  if (occursTMeta(m, t))
    return terr(`${showType(m)} occurs in ${showType(t)}`);
  m.type = t;
};

export const unify = (a: Type, b: Type): void => {
  // console.log(`unify ${showType(a)} ~ ${showType(b)}`);
  if (a === b) return;
  if (a.tag === 'TMeta') return bindTMeta(a, b);
  if (b.tag === 'TMeta') return bindTMeta(b, a);
  const ea = matchTEffExtend(a);
  if (ea) {
    const rewr = rewriteEff(ea.eff, b);
    unify(ea.eff, rewr.eff);
    unify(ea.rest, rewr.rest);
    return;
  }
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(a.left, b.left);
    unify(a.right, b.right);
    return;
  }
  if (a.tag === 'TCon' && b.tag === 'TCon' && a.name === b.name)
    return;
  return terr(`unable to unify ${showType(a)} ~ ${showType(b)}`);
};
