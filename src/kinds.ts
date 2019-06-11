import { Name, Id, freshId } from './names';
import { impossible } from './util';

export type Kind
  = KCon
  | KMeta
  | KFun;

export interface KCon {
  readonly tag: 'KCon';
  readonly name: Name;
}
export const KCon = (name: Name): KCon =>
  ({ tag: 'KCon', name });

export interface KMeta {
  readonly tag: 'KMeta';
  readonly id: Id;
  kind: Kind | null;
}
export const KMeta = (id: Id): KMeta =>
  ({ tag: 'KMeta', id, kind: null });
export const freshKMeta = (): KMeta => KMeta(freshId());

export interface KFun {
  readonly tag: 'KFun';
  readonly left: Kind;
  readonly right: Kind;
}
export const KFun = (left: Kind, right: Kind): Kind =>
  ({ tag: 'KFun', left, right });
export const kfunFrom = (ks: Kind[]): Kind =>
  ks.reduceRight((x, y) => KFun(y, x));
export const kfun = (...ks: Kind[]): Kind => kfunFrom(ks);
export const flattenKFun = (k: Kind): Kind[] => {
  let c = k;
  const r: Kind[] = [];
  while (c.tag === 'KFun') {
    r.push(c.left);
    c = c.right;
  }
  r.push(c);
  return r;
};

export const kType = KCon('Type');

export const showKind = (k: Kind): string => {
  if (k.tag === 'KCon') return `${k.name}`;
  if (k.tag === 'KMeta') return `?${k.id}`;
  if (k.tag === 'KFun')
    return flattenKFun(k)
      .map(t => t.tag === 'KFun' ? `(${showKind(t)})` : showKind(t))
      .join(' -> ');
  return impossible('showKind');
};

export const pruneKind = (k: Kind): Kind => {
  if (k.tag === 'KMeta') {
    if (!k.kind) return k;
    return k.kind = pruneKind(k.kind);
  }
  if (k.tag === 'KFun') {
    const l = pruneKind(k.left);
    const r = pruneKind(k.right);
    return l === k.left && r === k.right ? k : KFun(l, r);
  }
  return k;
};
