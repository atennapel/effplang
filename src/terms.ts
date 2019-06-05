import { impossible } from './util';
import { Name } from './name';

export type Term
  = Var
  | Abs
  | App
  | Let;

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
export const flattenAbs = (term: Term): { ns: Name[], body: Term } => {
  let c = term;
  const ns: Name[] = [];
  while (c.tag === 'Abs') {
    ns.push(c.name);
    c = c.body;
  }
  return { ns, body: c };
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
export const flattenApp = (type: Term): Term[] => {
  let c = type;
  const r: Term[] = [];
  while (c.tag === 'App') {
    r.push(c.right);
    c = c.left;
  }
  r.push(c);
  return r.reverse();
};

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
  if (term.tag === 'Abs') {
    const fl = flattenAbs(term);
    return `\\${fl.ns.join(' ')} -> ${showTerm(fl.body)}`;
  }
  if (term.tag === 'App') {
    const ts = flattenApp(term);
    return ts.map(t => t.tag === 'Abs' || t.tag === 'App' || t.tag === 'Let' ? `(${showTerm(t)})` : showTerm(t)).join(' ');
  }
  if (term.tag === 'Let')
    return `let ${term.name} = ${showTerm(term.val)} in ${showTerm(term.body)}`;
  return impossible('showTerm');
};
