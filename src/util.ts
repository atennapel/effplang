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
