export type Id = number;
let _id: Id = 0;
export const freshId = (): Id => _id++;
export const resetId = () => { _id = 0 };

export type Name = string;
