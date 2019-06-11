import { Kind, KCon, kType, kfun } from './kinds';
import { Type, TCon, tFun } from './types';
import { List } from './list';
import { Name } from './names';

export type LTEnv = List<[Name, Type]>;

export interface KindInfo {
  readonly con: KCon;
}
export interface TypeInfo {
  readonly con: TCon;
  readonly kind: Kind;
}
export interface VarInfo {
  readonly type: Type;
}

export interface GTEnv {
  readonly kinds: { [key: string]: KindInfo };
  readonly types: { [key: string]: TypeInfo };
  readonly vars: { [key: string]: VarInfo };
}
export const initialGTEnv = (): GTEnv => ({
  kinds: {
    Type: { con: kType },
  },
  types: {
    '->': { con: tFun, kind: kfun(kType, kType, kType) },
  },
  vars: {},
});
