import { Type, showType, TMeta, TApp, TForall } from './types';
import { Kind, kType, KFun, freshKMeta, KMeta, pruneKind, showKind, hasKMeta } from './kinds';
import { terr, impossible } from './util';
import { type } from 'os';
import { contextGetTVar, contextMark, contextAdd, ETVar, contextDrop, showContext } from './context';
import { globalenv } from './env';
import { log } from './config';

const unifyKMeta = (m: KMeta, k: Kind): void => {
  if (m.kind) return unifyKinds(m.kind, k);
  if (k.tag === 'KMeta' && k.kind) return unifyKMeta(m, k.kind);
  if (hasKMeta(m, k))
    return terr(`occurs check failed in kind ${showKind(m)} in ${showKind(k)}`);
  m.kind = k;
};
const unifyKinds = (a: Kind, b: Kind): void => {
  log(() => `unifyKinds ${showKind(a)} ~ ${showKind(b)}`);
  if (a === b) return;
  if (a.tag === 'KCon' && b.tag === 'KCon' && a.name === b.name) return;
  if (a.tag === 'KFun' && b.tag === 'KFun') {
    unifyKinds(a.left, b.left);
    unifyKinds(a.right, b.right);
    return;
  }
  if (a.tag === 'KMeta') return unifyKMeta(a, b);
  if (b.tag === 'KMeta') return unifyKMeta(b, a);
  return terr(`cannot unify kinds ${showKind(a)} ~ ${showKind(b)}`);
};

export const wfKind = (k: Kind): void => {
  if (k.tag === 'KMeta') {
    if (k.kind) return wfKind(k.kind);
    return;
  }
  if (k.tag === 'KCon') {
    const info = globalenv.kinds[k.name];
    if (!info) return terr(`undefined kcon ${k.name}`);
    return;
  }
  if (k.tag === 'KFun') {
    wfKind(k.left);
    wfKind(k.right);
    return;
  }
  return impossible(`wfKind`);
};

export const inferKindR = (t: Type, kmetas: KMeta[]): [Kind, Type] => {
  log(() => `inferKindR ${showType(t)} | ${showContext()}`);
  if (t.tag === 'TMeta') return [t.kind, t];
  if (t.tag === 'TCon') {
    const info = globalenv.types[t.name];
    if (!info) return terr(`undefined tcon ${t.name}`);
    return [info.kind, t];
  }
  if (t.tag === 'TVar') {
    const info = contextGetTVar(t);
    if (!info) return terr(`undefined tvar ${t.name}`);
    return [info.kind, t];
  }
  if (t.tag === 'TApp') {
    const [kl, l] = inferKindR(t.left, kmetas);
    const [kr, r] = inferKindR(t.right, kmetas);
    const kv = freshKMeta();
    unifyKinds(kl, KFun(kr, kv));
    kmetas.push(kv);
    return [kv, l === t.left && r === t.right ? t : TApp(l, r)];
  }
  if (t.tag === 'TForall') {
    const m = contextMark();
    let kv;
    if (t.kind) {
      wfKind(t.kind);
      kv = t.kind;
    } else {
      kv = freshKMeta();
      kmetas.push(kv);
    }
    contextAdd(ETVar(t.name, kv));
    const [k, body] = inferKindR(t.type, kmetas);
    contextDrop(m);
    return [
      k,
      kv === t.kind && body === t.type ? t : TForall(t.name, kv, body),
    ];
  }
  return impossible('inferKindR');
};

const pruneKindInType = (t: Type): Type => {
  if (t.tag === 'TApp') {
    const l = pruneKindInType(t.left);
    const r = pruneKindInType(t.right);
    return l === t.left && r === t.right ? t : TApp(l, r);
  }
  if (t.tag === 'TForall') {
    const k = t.kind ? pruneKind(t.kind) : kType;
    const b = pruneKindInType(t.type);
    return k === t.kind && b === t.type ? t : TForall(t.name, k, b);
  }
  return t;
};

export const inferKind = (t: Type): [Kind, Type] => {
  log(() => `inferKind ${showType(t)}`);
  const kmetas: KMeta[] = [];
  const [k, t2] = inferKindR(t, kmetas);
  for (let i = 0, l = kmetas.length; i < l; i++) {
    const c = pruneKind(kmetas[i]);
    if (c.tag === 'KMeta' && !c.kind) c.kind = kType;
  }
  return [pruneKind(k), pruneKindInType(t2)];
};

export const kindOf = (t: Type): Kind => {
  if (t.tag === 'TMeta') return t.kind;
  if (t.tag === 'TCon') {
    const info = globalenv.types[t.name];
    if (!info) return terr(`undefined tcon ${t.name}`);
    return info.kind;
  }
  if (t.tag === 'TVar') {
    const info = contextGetTVar(t);
    if (!info) return terr(`undefined tvar ${t.name}`);
    return info.kind;
  }
  if (t.tag === 'TApp') {
    const l = kindOf(t.left);
    if (l.tag !== 'KFun')
      return terr(`not a kind function in ${showType(t)}`);
    return l.right;
  }
  if (t.tag === 'TForall') {
    const m = contextMark();
    contextAdd(ETVar(type.name, t.kind || kType));
    const k = kindOf(t.type);
    contextDrop(m);
    return k;
  }
  return impossible('kindOf');
};
