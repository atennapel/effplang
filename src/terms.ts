import { Name, impossible } from './util';
import { Annot, annotAny, showAnnot } from './types';

export type Term
  = Var
  | App
  | Abs
  | Let
  | Ann
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
export const app = (...ts: Term[]): Term =>
  appFrom(ts);
export const flattenApp = (t: Term): { fn: Term, args: Term[] } => {
  const args = [];
  let c = t;
  while (c.tag === 'App') {
    args.push(c.right);
    c = c.left;
  }
  return { fn: c, args: args.reverse() };
};

export interface Abs {
  readonly tag: 'Abs';
  readonly name: Name;
  readonly annot: Annot;
  readonly body: Term;
}
export const Abs = (name: Name, annot: Annot, body: Term): Abs =>
  ({ tag: 'Abs', name, annot, body });
export const abs = (ns: Name[], body: Term) =>
  ns.reduceRight((x, y) => Abs(y, annotAny, x), body);
export const absannot = (ns: [Name, Annot | null][], body: Term) =>
  ns.reduceRight((x, [n, t]) =>
    t ? Abs(n, t, x) : Abs(n, annotAny, x), body);

export interface Let {
  readonly tag: 'Let';
  readonly name: Name;
  readonly val: Term;
  readonly body: Term;
}
export const Let = (name: Name, val: Term, body: Term): Let =>
  ({ tag: 'Let', name, val, body });
export const lets = (ns: [Name, Term][], body: Term): Term =>
  ns.reduceRight((b, [n, t]) => Let(n, t, b), body);

export interface Ann {
  readonly tag: 'Ann';
  readonly term: Term;
  readonly annot: Annot;
}
export const Ann = (term: Term, annot: Annot): Ann =>
  ({ tag: 'Ann', term, annot });

export interface Lit {
  readonly tag: 'Lit';
  readonly val: number | string;
}
export const Lit = (val: number | string): Lit =>
  ({ tag: 'Lit', val });

export const showTerm = (t: Term): string => {
  if (t.tag === 'Var') return t.name;
  if (t.tag === 'Abs')
    return t.annot === annotAny ?
      `(\\${t.name} -> ${showTerm(t.body)})` :
      `(\\(${t.name} : ${showAnnot(t.annot)}) -> ${showTerm(t.body)})`;
  if (t.tag === 'App')
    return `(${showTerm(t.left)} ${showTerm(t.right)})`;
  if (t.tag === 'Ann')
    return `(${showTerm(t.term)} : ${showAnnot(t.annot)})`;
  if (t.tag === 'Let')
    return `(let ${t.name} = ${showTerm(t.val)} in ${showTerm(t.body)})`;
  if (t.tag === 'Lit')
    return typeof t.val === 'string' ?
      JSON.stringify(t.val) : `${t.val}`;
  return impossible('showTerm');
};

export const isAnnot = (t: Term): boolean =>
  (t.tag === 'Let' && isAnnot(t.body)) || t.tag === 'Ann';
