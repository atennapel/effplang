export const impossible = (msg: string): never => {
  throw new Error(msg);
};

export const terr = (msg: string): never => {
  throw new TypeError(msg);
};
