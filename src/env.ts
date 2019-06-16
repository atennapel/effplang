import { Kind, KCon, kType, kfun, kEffect, kEffectRow } from './kinds';
import { Type, TCon, tFun } from './types';
import { List } from './list';
import { Name } from './names';

export type LTEnv = List<[Name, Type]>;

export interface KindInfo {
  readonly con: KCon;
}
export interface TypeInfo {
  readonly con: TCon;
  kind: Kind;
}
export interface VarInfo {
  type: Type;
}

export interface GTEnv {
  readonly kinds: { [key: string]: KindInfo };
  readonly types: { [key: string]: TypeInfo };
  readonly vars: { [key: string]: VarInfo };
}
export const initialGTEnv = (): GTEnv => ({
  kinds: {
    Type: { con: kType },
    Effect: { con: kEffect },
    EffectRow: { con: kEffectRow },
  },
  types: {
    '->': { con: tFun, kind: kfun(kType, kType, kType) },
  },
  vars: {},
});

export let globalenv = initialGTEnv();
