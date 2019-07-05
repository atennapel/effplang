import { impossible } from './util';
import { TConName, Type, showType, Scheme, showScheme } from './types';

export type Term
  = Var
  | Abs
  | App
  | Let
  | Con
  | Decon;

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

export interface Let {
  readonly tag: 'Let';
  readonly name: VarName;
  readonly val: Term;
  readonly body: Term;
  readonly type: Scheme | null;
}
export const Let = (name: VarName, val: Term, body: Term, type: Scheme | null = null): Let =>
  ({ tag: 'Let', name, val, body, type });
export const lets = (defs: ([VarName, Term] | [VarName, Term, Scheme | null])[], body: Term): Term =>
  defs.reduceRight((t, d) => Let(d[0], d[1], t, d[2]), body);

export interface Con {
  readonly tag: 'Con';
  readonly con: TConName;
  readonly body: Term;
}
export const Con = (con: TConName, body: Term): Con =>
  ({ tag: 'Con', con, body });

export interface Decon {
  readonly tag: 'Decon';
  readonly con: TConName;
  readonly body: Term;
}
export const Decon = (con: TConName, body: Term): Decon =>
  ({ tag: 'Decon', con, body });

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
      .map(t => showTermParens(t.tag !== 'Var', t))
      .join(' ');
  if (term.tag === 'Let') {
    const v = term.val;
    return `let ${term.name}${term.type ? ` : ${showScheme(term.type)}` : ''} = ${showTermParens(v.tag === 'Let', v)} in ${showTerm(term.body)}`;
  }
  if (term.tag === 'Con' || term.tag === 'Decon') {
    const b = term.body;
    return `${term.tag === 'Con' ? '@' : '~'}${term.con} ${showTermParens(b.tag !== 'Var', b)}`;
  }
  return impossible('showTerm');
};
