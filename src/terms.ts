import { impossible } from './util';

export type Term
  = Var
  | Abs
  | App;

export type VarName = string;
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
}
export const Abs = (name: VarName, body: Term): Abs =>
  ({ tag: 'Abs', name, body });
export const abs = (ns: VarName[], body: Term): Term =>
  ns.reduceRight((x, y) => Abs(y, x), body);
export const flattenAbs = (term: Term): { ns: VarName[], body: Term } => {
  const ns = [];
  while (term.tag === 'Abs') {
    ns.push(term.name);
    term = term.body;
  }
  return { ns, body: term };
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
  const ret = [];
  while (term.tag === 'App') {
    ret.push(term.right);
    term = term.left;
  }
  ret.push(term);
  return ret.reverse();
};

const showTermParens = (b: boolean, term: Term) =>
  b ? `(${showTerm(term)})` : showTerm(term);
export const showTerm = (term: Term): string => {
  if (term.tag === 'Var') return term.name;
  if (term.tag === 'Abs') {
    const f = flattenAbs(term);
    return `\\${f.ns.join(' ')} -> ${showTerm(f.body)}`;
  }
  if (term.tag === 'App')
    return flattenApp(term)
      .map(t => showTermParens(t.tag === 'Abs' || t.tag === 'App', t))
      .join(' ');
  return impossible('showTerm');
};
