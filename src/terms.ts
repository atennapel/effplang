import { impossible } from './util';

export type Name = string;

export type Term
  = Var
  | Abs
  | App
  | Let

export interface Var {
  readonly tag: 'Var';
  readonly name: Name;
}
export const Var = (name: Name): Var =>
  ({ tag: 'Var', name });

export interface Abs {
  readonly tag: 'Abs';
  readonly name: Name;
  readonly body: Term;
}
export const Abs = (name: Name, body: Term): Abs =>
  ({ tag: 'Abs', name, body });
export const abs = (ns: Name[], body: Term): Term =>
  ns.reduceRight((t, n) => Abs(n, t), body);

export interface App {
  readonly tag: 'App';
  readonly left: Term;
  readonly right: Term;
}
export const App = (left: Term, right: Term): App =>
  ({ tag: 'App', left, right });
export const appFrom = (ts: Term[]): Term => ts.reduce(App);
export const app = (...ts: Term[]): Term => appFrom(ts);

export interface Let {
  readonly tag: 'Let';
  readonly name: Name;
  readonly val: Term;
  readonly body: Term;
}
export const Let = (name: Name, val: Term, body: Term): Let =>
  ({ tag: 'Let', name, val, body });
export const lets = (ns: [Name, Term][], body: Term): Term =>
  ns.reduceRight((t, [x, v]) => Let(x, v, t), body);

export const showTerm = (term: Term): string => {
  if (term.tag === 'Var') return `${term.name}`;
  if (term.tag === 'Abs') return `(\\${term.name} -> ${showTerm(term.body)})`;
  if (term.tag === 'App') return `(${showTerm(term.left)} ${showTerm(term.right)})`;
  if (term.tag === 'Let')
    return `(let ${term.name} = ${showTerm(term.val)} in ${showTerm(term.body)})`;
  return impossible('showTerm');
};
