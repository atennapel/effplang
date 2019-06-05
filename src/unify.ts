import { Type, showType, isTRow, TMeta, trowLabel, Label, TRow, trowType, trowRest, freshTMeta, occursTMeta, prune } from './types';
import { terr } from './util';

const rewriteTRow = (l: Label, row: Type): TRow => {
  if (isTRow(row)) {
    if (l === trowLabel(row)) return row;
    const rest = rewriteTRow(l, trowRest(row));
    return TRow(l, trowType(rest), TRow(trowLabel(row), trowType(row), trowRest(rest)));
  }
  if (row.tag === 'TMeta') {
    if (row.type) return rewriteTRow(l, row.type);
    const tt = freshTMeta();
    const tr = freshTMeta();
    const nrow = TRow(l, tt, tr);
    unifyTMeta(row, nrow);
    return nrow;
  }
  return terr(`cannot find label ${l} in ${showType(row)}`);
};

const unifyTMeta = (m: TMeta, t: Type): void => {
  if (m.type) return unify(m.type, t);
  if (t.tag === 'TMeta') {
    if (!m.name && t.name) m.name = t.name;
    if (m.name && !t.name) t.name = m.name;
    if (t.type) return unify(m, t.type);
    m.type = t;
    return;
  }
  if (occursTMeta(m, t))
    return terr(`${showType(m)} occurs in ${showType(t)}`);
  m.type = t;
};
export const unify = (a: Type, b: Type): void => {
  console.log(`unify ${showType(prune(a))} ~ ${showType(prune(b))}`);
  if (a === b) return;
  if (a.tag === 'TMeta') return unifyTMeta(a, b);
  if (b.tag === 'TMeta') return unifyTMeta(b, a);
  if (isTRow(a) && isTRow(b)) {
    const br = rewriteTRow(trowLabel(a), b);
    unify(trowType(a), trowType(br));
    unify(trowRest(a), trowRest(br));
    return;
  }
  if (a.tag === 'TApp' && b.tag === 'TApp') {
    unify(a.left, b.left);
    unify(a.right, b.right);
    return;
  }
  return terr(`cannot unify ${showType(a)} ~ ${showType(b)}`);
};
