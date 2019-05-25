import { List } from './list';
import { Name } from './util';
import { Type } from './types';
import { Kind, kfun, kType, kEffs, kEff } from './kinds';

export interface LTEnvEntry { name: Name, type: Type };
export const LTEnvEntry = (name: Name, type: Type) => ({ name, type });
export type LTEnv = List<LTEnvEntry>;
export const lookupLTEnv = (name: Name, env: LTEnv): Type | null => {
  let l = env;
  while (l.tag === 'Cons') {
    const c = l.head;
    if (c.name === name) return c.type;
    l = l.tail;
  }
  return null;
};

export interface TEnv {
  tcons: { [key: string]: Kind };
  vars: { [key: string]: Type };
};
export const lookupTCon = (name: Name, genv: TEnv): Kind | null =>
  genv.tcons[name] || null;
export const lookupTEnv = (name: Name, genv: TEnv): Type | null =>
  genv.vars[name] || null;

export const initialEnv = (): TEnv => ({
  tcons: {
    '->': kfun(kType, kType, kType),
    Float: kType,
    String: kType,
    '<>': kEffs,
    '|': kfun(kEff, kEffs, kEffs),
  },
  vars: {},
});
