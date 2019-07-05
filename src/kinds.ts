import { impossible } from './util';

export type Kind
  = KCon
  | KMeta
  | KFun;

export type KConName = string;
export interface KCon {
  readonly tag: 'KCon';
  readonly name: KConName;
}
export const KCon = (name: KConName): KCon =>
  ({ tag: 'KCon', name });

type KMetaId = number;
let kmetaId: KMetaId = 0;
const freshKMetaId = (): KMetaId => kmetaId++;
export const resetKMetaId = () => { kmetaId = 0 }
export interface KMeta {
  readonly tag: 'KMeta';
  readonly id: KMetaId;
  kind: Kind | null;
}
export const KMeta = (id: KMetaId): KMeta =>
  ({ tag: 'KMeta', id, kind: null });
export const freshKMeta = () => KMeta(freshKMetaId());

export interface KFun {
  readonly tag: 'KFun';
  readonly left: Kind;
  readonly right: Kind;
}
export const KFun = (left: Kind, right: Kind): KFun =>
  ({ tag: 'KFun', left, right });
export const kfunFrom = (ks: Kind[]): Kind =>
  ks.reduceRight((x, y) => KFun(y, x));
export const kfun = (...ks: Kind[]): Kind => kfunFrom(ks);

export const kType = KCon('Type');

const showKindParens = (b: boolean, kind: Kind) =>
  b ? `(${showKind(kind)})` : showKind(kind);
export const showKind = (kind: Kind): string => {
  if (kind.tag === 'KCon') return kind.name;
  if (kind.tag === 'KMeta')
    return `?${kind.id}${kind.kind ? `{${showKind(kind.kind)}}` : ''}`;
  if (kind.tag === 'KFun') {
    const l = kind.left;
    const r = kind.right;
    return `${showKindParens(l.tag === 'KFun', l)} -> ${showKind(r)}`;
  }
  return impossible('showKind');
};

export const eqKind = (a: Kind, b: Kind): boolean => {
  if (a === b) return true;
  if (a.tag === 'KCon') return b.tag === 'KCon' && a.name === b.name;
  if (a.tag === 'KFun')
    return b.tag === 'KFun' && eqKind(a.left, b.left) && eqKind(a.right, b.right);
  return false;
};

export const pruneKind = (kind: Kind): Kind => {
  if (kind.tag === 'KMeta') {
    if (!kind.kind) return kind;
    return kind.kind = pruneKind(kind.kind);
  }
  if (kind.tag === 'KFun') {
    const l = pruneKind(kind.left);
    const r = pruneKind(kind.right);
    return l === kind.left && r === kind.right ? kind : KFun(l, r);
  }
  return kind;
};
export const showKindPruned = (kind: Kind): string =>
  showKind(pruneKind(kind));

export const occursKMeta = (x: KMeta, kind: Kind): boolean => {
  if (x === kind) return true;
  if (kind.tag === 'KMeta')
    return kind.kind ? occursKMeta(x, kind.kind) : false;
  if (kind.tag === 'KFun')
    return occursKMeta(x, kind.left) || occursKMeta(x, kind.right);
  return false;
};
