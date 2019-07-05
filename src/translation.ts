import { Kind, showKind } from './kinds';
import { CKCon, CKFun, CKind, CType, CTCon, CTVar, CTApp, CTForall } from './core';
import { terr, impossible } from './util';
import { Type, showType, Scheme } from './types';

export const translateKind = (k: Kind): CKind => {
  if (k.tag === 'KCon') return CKCon(k.name);
  if (k.tag === 'KMeta') {
    if (k.kind) return translateKind(k.kind);
    return terr(`KMeta ${showKind(k)} in translateKind`);
  }
  if (k.tag === 'KFun')
    return CKFun(translateKind(k.left), translateKind(k.right));
  return impossible('translateKind');
};

export const translateType = (t: Type): CType => {
  if (t.tag === 'TCon') return CTCon(t.name);
  if (t.tag === 'TVar') return CTVar(t.name);
  if (t.tag === 'TMeta') {
    if (t.type) return translateType(t.type);
    return terr(`TMeta ${showType(t)} in translateType`);
  }
  if (t.tag === 'TApp')
    return CTApp(translateType(t.left), translateType(t.right));
  return impossible('translateType');

};

export const translateScheme = (s: Scheme): CType =>
  s.params.reduceRight((t, [x, k]) => CTForall(x, translateKind(k), t),
    translateType(s.type));
