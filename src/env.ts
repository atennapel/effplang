import { VarName } from './terms';
import { Type, TMeta, tmetas } from './types';

export type List<T> = Nil | Cons<T>;

export interface Nil { readonly tag: 'Nil' }
export const Nil: Nil = { tag: 'Nil' };

export interface Cons<T> {
  readonly tag: 'Cons';
  readonly head: T;
  readonly tail: List<T>;
}
export const Cons = <T>(head: T, tail: List<T>): Cons<T> =>
  ({ tag: 'Cons', head, tail });

export const listFrom = <T>(a: T[]) =>
  a.reduceRight((x, y) => Cons(y, x), Nil as List<T>);
export const list = <T>(...a: T[]) => listFrom(a);

export type Env = List<[VarName, Type]>;

export const extend = (k: VarName, v: Type, l: Env): Env =>
  Cons([k, v], l);
export const lookup = (k: VarName, l: Env): Type | null => {
  let c = l;
  while (c.tag === 'Cons') {
    const [k2, v] = c.head;
    if (k === k2) return v;
    c = c.tail;
  }
  return null;
};

export const each = (l: Env, f: (k: VarName, v: Type) => void): void => {
  let c = l;
  while (c.tag === 'Cons') {
    f(c.head[0], c.head[1]);
    c = c.tail;
  }
};

export const tmetasEnv = (env: Env, tms: TMeta[] = []): TMeta[] => {
  each(env, (_, v) => tmetas(v, [], tms));
  return tms;
};
