import { Type, showTy } from './types';
import { Kind, KFun, kType, showKind } from './kinds';
import { Name, clone } from './util';

export interface TEnv {
  global: { [key: string]: Type };
  tcons: { [key: string]: Kind };
}
export const TEnv = (
  global: { [key: string]: Type } = {},
  tcons: { [key: string]: Kind } = {},
): TEnv => ({ global, tcons });

export const cloneEnv = (e: TEnv) =>
  TEnv(clone(e.global), clone(e.tcons));

export const showEnv = (env: TEnv) => {
  const r: string[] = [];
  for (let k in env.tcons)
    r.push(`type ${k} : ${showKind(env.tcons[k])}`);
  for (let k in env.global)
    r.push(`${k} : ${showTy(env.global[k])}`);
  return r.join('\n');
};

export const lookupTCon = (env: TEnv, x: Name): Kind | null =>
  env.tcons[x] || null;

const initialEnv = TEnv(
  {},
  {
    '->': KFun(kType, KFun(kType, kType)),
  },
);

export const getInitialEnv = (): TEnv => cloneEnv(initialEnv);
