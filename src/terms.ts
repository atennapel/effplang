import { Name, impossible } from './util';
import { Type, showTy } from './types';

export type Term
  = Var
  | App
  | Abs
  | Let
  | Ann
  | Hole
  | Lit;

export interface Var {
  readonly tag: 'Var';
  readonly name: Name;
}
export const Var = (name: Name): Var => ({ tag: 'Var', name });

export interface App {
  readonly tag: 'App';
  readonly left: Term;
  readonly right: Term;
}
export const App = (left: Term, right: Term): App =>
  ({ tag: 'App', left, right });
export const appFrom = (ts: Term[]): Term =>
  ts.reduce(App);

export interface Abs {
  readonly tag: 'Abs';
  readonly pat: Pat;
  readonly body: Term;
}
export const Abs = (pat: Pat, body: Term): Abs =>
  ({ tag: 'Abs', pat, body });
export const abs = (ns: Pat[], body: Term) =>
  ns.reduceRight((x, y) => Abs(y, x), body);

export interface Let {
  readonly tag: 'Let';
  readonly pat: Pat;
  readonly val: Term;
  readonly body: Term;
}
export const Let = (pat: Pat, val: Term, body: Term): Let =>
  ({ tag: 'Let', pat, val, body });

export interface Ann {
  readonly tag: 'Ann';
  readonly term: Term;
  readonly type: Type;
}
export const Ann = (term: Term, type: Type): Ann =>
  ({ tag: 'Ann', term, type });

export interface Hole {
  readonly tag: 'Hole';
  readonly name: string;
}
export const Hole = (name: string): Hole =>
  ({ tag: 'Hole', name });

export interface Lit {
  readonly tag: 'Lit';
  readonly val: number | string;
}
export const Lit = (val: number | string): Lit =>
  ({ tag: 'Lit', val });

export type Pat
  = PVar
  | PWildcard
  | PAnn;

export interface PVar {
  readonly tag: 'PVar';
  readonly name: Name;
}
export const PVar = (name: Name): PVar => ({ tag: 'PVar', name });

export interface PWildcard {
  readonly tag: 'PWildcard';
}
export const PWildcard: PWildcard = ({ tag: 'PWildcard' });

export interface PAnn {
  readonly tag: 'PAnn';
  readonly pat: Pat;
  readonly type: Type;
}
export const PAnn = (pat: Pat, type: Type): PAnn =>
  ({ tag: 'PAnn', pat, type });

export const showPat = (p: Pat): string => {
  if (p.tag === 'PVar') return p.name;
  if (p.tag === 'PWildcard') return '_';
  if (p.tag === 'PAnn')
    return `(${showPat(p.pat)} : ${showTy(p.type)})`;
  return impossible('showPat');
};

export const showTerm = (t: Term): string => {
  if (t.tag === 'Var') return t.name;
  if (t.tag === 'Abs')
    return `(\\${showPat(t.pat)} -> ${showTerm(t.body)})`;
  if (t.tag === 'App')
    return `(${showTerm(t.left)} ${showTerm(t.right)})`;
  if (t.tag === 'Ann')
    return `(${showTerm(t.term)} : ${showTy(t.type)})`;
  if (t.tag === 'Let')
    return `(let ${showPat(t.pat)} = ${showTerm(t.val)} in ${showTerm(t.body)})`;
  if (t.tag === 'Hole')
    return `_${t.name}`;
  if (t.tag === 'Lit')
    return typeof t.val === 'string' ?
      JSON.stringify(t.val) : `${t.val}`;
  return impossible('showTerm');
};
