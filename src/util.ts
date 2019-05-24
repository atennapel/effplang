export const impossible = (msg: string) => {
  throw new Error(`impossible: ${msg}`);
};
export const terr = (msg: string) => { throw new TypeError(msg) };

export type Name = string;

export type Id = number;
let _id = 0;
export const resetId = () => { _id = 0 };
export const freshId = (): Id => _id++;

export const clone = <T>(
  o: { [key: string]: T },
): { [key: string] : T } => {
  const n: { [key: string]: T} = {};
  for (let k in o) n[k] = o[k];
  return n;
};

export const zip = <A, B>(a: A[], b: B[]): [A, B][] => {
  const l = Math.min(a.length, b.length);
  const r = Array(l);
  for (let i = 0; i < l; i++)
    r[i] = [a[i], b[i]];
  return r;
};

export const indexOf = <T>(a: T[], f: (v: T) => boolean): number => {
  for (let i = 0, l = a.length; i < l; i++) {
    if (f(a[i])) return i;
  }
  return -1;
};
