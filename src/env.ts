import { VarName } from './terms';
import { Type, showType, TCon, TFunC, TVarName } from './types';
import { List, Cons } from './list';

export interface Entry { readonly name: VarName, readonly type: Type }
export const Entry = (name: VarName, type: Type): Entry =>
  ({ name, type });
export type LTEnv = List<Entry>;

export interface GTEnv {
  readonly cons: { [name: string]: {
    tcon: TCon,
    params: TVarName[],
    type: Type,
  } };
  readonly vars: { [name: string]: Type };
};
export const gtenv: GTEnv = {
  cons: {},
  vars: {},
};

export const extend = (env: LTEnv, name: VarName, type: Type): LTEnv =>
  Cons(Entry(name, type), env);
export const lookup = (env: LTEnv, key: VarName): Type | null => {
  while (env.tag === 'Cons') {
    const { name, type } = env.head;
    if (name === key) return type;
    env = env.tail;
  }
  return gtenv.vars[key] || null;
};

export const showGTEnv = (env: GTEnv = gtenv): string => {
  const r: string[] = [];
  for (let k in env.vars)
    r.push(`${k} : ${showType(env.vars[k])}`);
  return r.join('\n');
};
