export const impossible = (msg: string): never => {
  throw new Error(msg);
};
