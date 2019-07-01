import { Type, showType } from './types';
import { impossible } from './util';

// names
export type VarName = string;

// terms
export type Term
  = Var
  | Abs
  | App
  | Ann;

export interface Var {
  readonly tag: 'Var';
  readonly name: VarName;
}
export const Var = (name: VarName): Var =>
  ({ tag: 'Var', name });

export interface Abs {
  readonly tag: 'Abs';
  readonly name: VarName;
  readonly body: Term;
  readonly type: Type | null;
}
export const Abs = (name: VarName, body: Term, type: Type | null = null): Abs =>
  ({ tag: 'Abs', name, body, type });
export const abs = (ns: VarName[], body: Term): Term =>
  ns.reduceRight((t, n) => Abs(n, t), body);
export const flattenAbs = (t: Term): { ns: VarName[], body: Term } => {
  const ns: VarName[] = [];
  while (t.tag === 'Abs') {
    ns.push(t.name);
    t = t.body;
  }
  return { ns, body: t };
};

export interface App {
  readonly tag: 'App';
  readonly left: Term;
  readonly right: Term;
}
export const App = (left: Term, right: Term): App =>
  ({ tag: 'App', left, right });
export const appFrom = (ts: Term[]): Term => ts.reduce(App);
export const app = (...ts: Term[]): Term => appFrom(ts);
export const flattenApp = (t: Term): { fn: Term, as: Term[] } => {
  const as: Term[] = [];
  while (t.tag === 'App') {
    as.push(t.right);
    t = t.left;
  }
  return { fn: t, as: as.reverse() };
};

export interface Ann {
  readonly tag: 'Ann';
  readonly term: Term;
  readonly type: Type;
}
export const Ann = (term: Term, type: Type): Ann =>
  ({ tag: 'Ann', term, type });

// methods
export const showTerm = (t: Term): string => {
  if (t.tag === 'Var') return t.name;
  if (t.tag === 'Abs')
    return t.type ? `(\\(${t.name} : ${showType(t.type)}) -> ${showTerm(t.body)})` : `(\\${t.name} -> ${showTerm(t.body)})`;
  if (t.tag === 'App')
    return `(${showTerm(t.left)} ${showTerm(t.right)})`;
  if (t.tag === 'Ann')
    return `(${showTerm(t.term)} : ${showType(t.type)})`;
  return impossible('showTerm');
};
