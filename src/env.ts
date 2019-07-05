import { VarName } from './terms';
import { Type, showType, TCon, TFunC, TVarName, Scheme, showScheme } from './types';
import { List, Cons, toArray } from './list';
import { Kind, kfun, kType, showKind } from './kinds';

export interface Entry { readonly name: VarName, readonly scheme: Scheme }
export const Entry = (name: VarName, scheme: Scheme): Entry =>
  ({ name, scheme });
export type LTEnv = List<Entry>;

export const showEntry = (entry: Entry) =>
  `${entry.name} : ${showScheme(entry.scheme)}`;
export const showLTEnv = (env: LTEnv) =>
  `[${toArray(env).map(showEntry).join(', ')}]`;

export interface GTEnv {
  readonly types: { [name: string]: {
    tcon: TCon,
    kind: Kind,
  } };
  readonly cons: { [name: string]: {
    params: [TVarName, Kind][],
    type: Scheme,
  } };
  readonly vars: { [name: string]: Scheme };
};
export const gtenv: GTEnv = {
  types: {
    '->': { tcon: TFunC, kind: kfun(kType, kType, kType) },
  },
  cons: {},
  vars: {},
};

export const extend = (env: LTEnv, name: VarName, scheme: Scheme): LTEnv =>
  Cons(Entry(name, scheme), env);
export const lookup = (env: LTEnv, key: VarName): Scheme | null => {
  while (env.tag === 'Cons') {
    const { name, scheme } = env.head;
    if (name === key) return scheme;
    env = env.tail;
  }
  return gtenv.vars[key] || null;
};

export const showGTEnv = (env: GTEnv = gtenv): string => {
  const r: string[] = [];
  for (let k in env.types)
    r.push(`type ${k} : ${showKind(env.types[k].kind)}`);
  for (let k in env.cons) {
    const info = env.cons[k];
    r.push(`con ${k} ${info.params.map(([x, k]) => `(${x} : ${showKind(k)})`).join(' ')} = ${showScheme(info.type)}`);
  }
  for (let k in env.vars)
    r.push(`${k} : ${showScheme(env.vars[k])}`);
  return r.join('\n');
};
