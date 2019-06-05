export interface Name {
  name: string;
  module: string | null;
}
export const Name = (name: string, module: string | null = null): Name =>
  ({ name, module });

export const showName = (n: Name): string =>
  `${n.module ? `${n.module}.` : ''}${n.name}`;

export type Id = number;
let id: Id = 0;
export const freshId = (): Id => id++;
export const resetId = () => { id = 0 };
