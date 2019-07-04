export type List<T> = Nil | Cons<T>;

export interface Nil {
  readonly tag: 'Nil';
}
export const Nil: Nil = { tag: 'Nil' };

export interface Cons<T> {
  readonly tag: 'Cons';
  readonly head: T;
  readonly tail: List<T>;
}
export const Cons = <T>(head: T, tail: List<T>): Cons<T> =>
  ({ tag: 'Cons', head, tail });

export const listFrom = <T>(vs: T[]): List<T> =>
  vs.reduceRight((x, y) => Cons(y, x), Nil as List<T>);
export const list = <T>(...vs: T[]): List<T> => listFrom(vs);

export const each = <T>(l: List<T>, fn: (val: T) => void): void => {
  while (l.tag === 'Cons') {
    fn(l.head);
    l = l.tail;
  }
};
