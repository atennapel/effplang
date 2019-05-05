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
export const Cons = <T>(head: T, tail: List<T>): List<T> =>
  ({ tag: 'Cons', head, tail });

export const toString = <T>(l: List<T>, fn: (val: T) => string = x => `${x}`): string => {
  const r: string[] = [];
  let c = l;
  while (c.tag === 'Cons') {
    r.push(fn(c.head));
    c = c.tail;
  }
  return `[${r.join(', ')}]`;
};

export const filter = <T>(l: List<T>, fn: (val: T) => boolean): List<T> =>
  l.tag === 'Cons' ? (fn(l.head) ? Cons(l.head, filter(l.tail, fn)) : filter(l.tail, fn)) : l;
export const first = <T>(l: List<T>, fn: (val: T) => boolean): T | null => {
  let c = l;
  while (c.tag === 'Cons') {
    if (fn(c.head)) return c.head;
    c = c.tail;
  }
  return null;
};
export const each = <T>(l: List<T>, fn: (val: T) => void): void => {
  let c = l;
  while (c.tag === 'Cons') {
    fn(c.head);
    c = c.tail;
  }
};

export const toArray = <T, R>(l: List<T>, fn: (val: T) => R): R[] => {
  let c = l;
  const r = [];
  while (c.tag === 'Cons') {
    r.push(fn(c.head));
    c = c.tail;
  }
  return r;
};

export const append = <T>(a: List<T>, b: List<T>): List<T> =>
  a.tag === 'Cons' ? Cons(a.head, append(a.tail, b)) : b;

export const map = <T, R>(l: List<T>, fn: (val: T) => R): List<R> =>
  l.tag === 'Cons' ? Cons(fn(l.head), map(l.tail, fn)) : l;

export const index = <T>(l: List<T>, i: number): T | null => {
  while (l.tag === 'Cons') {
    if (i-- === 0) return l.head;
    l = l.tail;
  }
  return null;
};

export const extend = <T>(name: string, val: T, rest: List<[string, T]>): List<[string, T]> =>
  Cons([name, val] as [string, T], rest);
export const lookup = <T>(l: List<[string, T]>, name: string): T | null => {
  while (l.tag === 'Cons') {
    const h = l.head;
    if (h[0] === name) return h[1];
    l = l.tail;
  }
  return null;
};
