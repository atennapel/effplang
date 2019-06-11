import { GTEnv } from './env';
import { Type, showType } from './types';
import { Kind, kType } from './kinds';
import { terr, impossible } from './util';
import { type } from 'os';
import { contextGetTVar, contextMark, contextAdd, ETVar, contextDrop } from './context';

// TODO: implement kind inference and unification

export const kindOf = (genv: GTEnv, t: Type): Kind => {
  if (t.tag === 'TMeta') return t.kind;
  if (t.tag === 'TCon') {
    const info = genv.types[t.name];
    if (!info) return terr(`undefined tcon ${t.name}`);
    return info.kind;
  }
  if (t.tag === 'TVar') {
    const info = contextGetTVar(t);
    if (!info) return terr(`undefined tvar ${t.name}`);
    return info.kind;
  }
  if (t.tag === 'TApp') {
    const l = kindOf(genv, t.left);
    if (l.tag !== 'KFun')
      return terr(`not a kind function in ${showType(t)}`);
    return l.right;
  }
  if (t.tag === 'TForall') {
    const m = contextMark();
    contextAdd(ETVar(type.name, t.kind || kType));
    const k = kindOf(genv, t.type);
    contextDrop(m);
    return k;
  }
  return impossible('kindOf');
};
