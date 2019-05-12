import { impossible } from './util';

export type Name = string;

export type Term
  = Var
  | Abs
  | App
  | Let
  | Handle;

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

export interface Handle {
  readonly tag: 'Handle';
  readonly term: Term;
  readonly handler: Handler;
}
export const Handle = (term: Term, handler: Handler): Handle =>
  ({ tag: 'Handle', term, handler });

export type Handler = HOp | HReturn;

export interface HOp {
  readonly tag: 'HOp';
  readonly op: Name;
  readonly body: Term;
  readonly rest: Handler;
}
export const HOp = (op: Name, body: Term, rest: Handler): HOp =>
  ({ tag: 'HOp', op, body, rest });

export interface HReturn {
  readonly tag: 'HReturn';
  readonly body: Term;
}
export const HReturn = (body: Term): HReturn =>
  ({ tag: 'HReturn', body });

export const showHandler = (handler: Handler): string => {
  if (handler.tag === 'HOp') return `${handler.op} -> ${showTerm(handler.body)}, ${showHandler(handler.rest)}`;
  if (handler.tag === 'HReturn') return `return -> ${showTerm(handler.body)}`
  return impossible('showHandler');
};

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
  if (term.tag === 'Handle')
    return `handle ${showTerm(term.term)} { ${showHandler(term.handler)} }`;
  return impossible('showTerm');
};
