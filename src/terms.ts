import { Name } from './names';
import { Type, showType } from './types';
import { impossible } from './util';

export type Term
  = Var
  | Abs
  | App
  | Let
  | Ann;

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
  ns.reduceRight((x, y) => Abs(y, x), body);
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
export const flattenApp = (term: Term): Term[] => {
  let c = term;
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
export const lt = (ns: [Name, Term][], body: Term): Term =>
  ns.reduceRight((x, [n, v]) => Let(n, v, x), body);
export const flattenLet = (term: Term): { ns: [Name, Term][], body: Term } => {
  let c = term;
  const ns: [Name, Term][] = [];
  while (c.tag === 'Let') {
    ns.push([c.name, c.val]);
    c = c.body;
  }
  return { ns, body: c };
};

export interface Ann {
  readonly tag: 'Ann';
  readonly term: Term;
  readonly type: Type;
  readonly ts: Type[];
}
export const Ann = (term: Term, type: Type, ts: Type[] = []): Ann =>
  ({ tag: 'Ann', term, type, ts });

export const showTerm = (t: Term): string => {
  if (t.tag === 'Var') return `${t.name}`;
  if (t.tag === 'Abs') {
    const f = flattenAbs(t);
    return `λ${f.ns.join(' ')} -> ${showTerm(f.body)}`;
  }
  if (t.tag === 'App')
    return flattenApp(t)
      .map(t => t.tag === 'Abs' || t.tag === 'App' ?
        `(${showTerm(t)})` : showTerm(t))
      .join(' ');
  if (t.tag === 'Let')
    return `let ${t.name} = ${t.val.tag === 'Abs' ? `(${showTerm(t.val)})` :
      showTerm(t.val)} in ${showTerm(t.body)}`;
  if (t.tag === 'Ann') {
    const ts = t.ts.length === 0 ? '' :
      ` @${t.ts.map(t => `(${showType(t)})`).join(' @')}`;
    return `(${showTerm(t.term)} : ${showType(t.type)}${ts})`;
  }
  return impossible('showTerm');
};
