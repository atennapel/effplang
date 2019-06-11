import { Name } from './names';

export type Term
  = Var;

export interface Var {
  readonly tag: 'Var';
  readonly name: Name;
}
export const Var = (name: Name): Var =>
  ({ tag: 'Var', name });

// abs
// app
// ann
