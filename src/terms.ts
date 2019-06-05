import { impossible } from './util';
import { Name } from './name';
import { Label } from './types';

export type Term
  = Var
  | Abs
  | App
  | Let
  | OpCall
  | Select
  | Inject
  | Restrict
  | Embed
  | Extend;

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

export interface OpCall {
  readonly tag: 'OpCall';
  readonly op: Name;
  readonly val: Term;
}
export const OpCall = (op: Name, val: Term): OpCall =>
  ({ tag: 'OpCall', op, val });

export interface Select {
  readonly tag: 'Select';
  readonly label: Label;
  readonly val: Term;
}
export const Select = (label: Label, val: Term): Select =>
  ({ tag: 'Select', label, val });

export interface Inject {
  readonly tag: 'Inject';
  readonly label: Label;
  readonly val: Term;
}
export const Inject = (label: Label, val: Term): Inject =>
  ({ tag: 'Inject', label, val });

export interface Restrict {
  readonly tag: 'Restrict';
  readonly label: Label;
  readonly val: Term;
}
export const Restrict = (label: Label, val: Term): Restrict =>
  ({ tag: 'Restrict', label, val });

export interface Embed {
  readonly tag: 'Embed';
  readonly label: Label;
  readonly val: Term;
}
export const Embed = (label: Label, val: Term): Embed =>
  ({ tag: 'Embed', label, val });

export interface Extend {
  readonly tag: 'Extend';
  readonly label: Label;
  readonly val: Term;
  readonly term: Term;
}
export const Extend = (label: Label, val: Term, term: Term): Extend =>
  ({ tag: 'Extend', label, val, term });

export const showTerm = (term: Term): string => {
  if (term.tag === 'Var') return `${term.name}`;
  if (term.tag === 'Abs') {
    const fl = flattenAbs(term);
    return `\\${fl.ns.join(' ')} -> ${showTerm(fl.body)}`;
  }
  if (term.tag === 'App') {
    const ts = flattenApp(term);
    return ts.map(t => t.tag !== 'Var' ? `(${showTerm(t)})` : showTerm(t)).join(' ');
  }
  if (term.tag === 'Let')
    return `let ${term.name} = ${showTerm(term.val)} in ${showTerm(term.body)}`;
  if (term.tag === 'OpCall') return `#${term.op} ${showTerm(term.val)}`;
  if (term.tag === 'Select') {
    const t = term.val;
    const ts = t.tag !== 'Var' && t.tag !== 'Select' && t.tag !== 'Restrict' ? `(${showTerm(t)})` : showTerm(t);
    return `${ts}.${term.label}`;
  }
  if (term.tag === 'Inject') {
    const t = term.val;
    const ts = t.tag !== 'Var' && t.tag !== 'Abs' ? `(${showTerm(t)})` : showTerm(t);
    return `@${term.label} ${ts}`;
  }
  if (term.tag === 'Restrict') {
    const t = term.val;
    const ts = t.tag !== 'Var' && t.tag !== 'Select' && t.tag !== 'Restrict' ? `(${showTerm(t)})` : showTerm(t);
    return `${ts}.-${term.label}`;
  }
  if (term.tag === 'Embed') {
    const t = term.val;
    const ts = t.tag !== 'Var' && t.tag !== 'Abs' ? `(${showTerm(t)})` : showTerm(t);
    return `@+${term.label} ${ts}`;
  }
  if (term.tag === 'Extend')
    return `{${showTerm(term.term)} | ${term.label} += ${showTerm(term.val)}}`;
  return impossible('showTerm');
};
