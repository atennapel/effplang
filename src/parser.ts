import {
  Term,
  Var,
  App,
  abs,
  PVar,
  Hole,
  Pat,
  PWildcard,
  Ann,
  PAnn,
  Let,
} from './terms';
import {
  Type,
  TApp,
  TVar,
  TCon,
  tforall,
  tfunFrom,
  tFun,
} from './types';
import { KCon, Kind, kfunFrom } from './kinds';
import { Name } from './util';

const err = (msg: string) => { throw new SyntaxError(msg) };

const skipWhitespace = (ts: string[]): void => {
  const l = ts.length - 1;
  if (l < 0) return;
  let i = l;
  while (i >= 0 && /\s/.test(ts[i])) i--;
  if (i < l) ts.splice(i + 1);
};

const skipSymbol = (ts: string[], sym: string): boolean => {
  const l = ts.length - 1;
  if (l < 0) return false;
  if (ts[l] === sym) { ts.pop(); return true }
  return false;
};

const skipSymbol2 = (ts: string[], sym: string): boolean => {
  const l = ts.length - 1;
  if (l < 1) return false;
  if (ts[l] === sym[0] && ts[l - 1] === sym[1]) {
    ts.splice(-2);
    return true;
  }
  return false;
};

const parseName = (ts: string[]): string | null => {
  const l = ts.length - 1;
  if (l < 0) return null;
  let i = l;
  while (i >= 0 && /[a-z]/i.test(ts[i])) i--;
  if (i === l) return null;
  return ts.splice(i + 1).reverse().join('');
};

const parsePat = (ts: string[]): Pat[] | null => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '_')) {
    if (skipSymbol(ts, '_')) return err(`_ after _ in pattern`);
    if (parseName(ts)) return err(`hole not allowed in pattern`);
    return [PWildcard];
  }
  if (skipSymbol(ts, '(')) {
    const pats: Pat[] = [];
    let ty: Type | null = null;
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`unclosed ( in pattern`);
      if (skipSymbol(ts, ')')) break;
      if (skipSymbol(ts, ':')) {
        ts.push('(');
        ty = parseTypeR(ts);
        if (!ty) return err(`invalid type in pattern`);
        break;
      }
      const pats2 = parsePat(ts);
      if (!pats2) break;
      for (let i = 0, l = pats2.length; i < l; i++)
        pats.push(pats2[i]);
    }
    if (pats.length === 0) return err(`empty pattern`);
    if (!ty) return err(`expected type in pattern`);
    return pats.map(p => PAnn(p, ty as Type));
  }
  const x = parseName(ts);
  if (!x) return null;
  return [PVar(x)];
};

const patToVar = (pat: Pat): Term => {
  if (pat.tag === 'PVar') return Var(pat.name);
  if (pat.tag === 'PWildcard') return err(`invalid var: _`);
  return Ann(patToVar(pat.pat), pat.type);
};

const parseExpr = (ts: string[]): Term | null => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '(')) {
    const body = parseTermTop(ts);
    if (skipSymbol(ts, ')')) return body;
    else return err(`unclosed ( in app`);
  }
  if (skipSymbol(ts, '\\')) {
    const args: Pat[] = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`no -> after \\`);
      if (skipSymbol2(ts, '->')) break;
      const pats = parsePat(ts);
      if (!pats) break;
      for (let i = 0, l = pats.length; i < l; i++)
        args.push(pats[i]);
    }
    if (args.length === 0) return err(`no args after \\`);
    let parens = false;
    skipWhitespace(ts);
    if (skipSymbol(ts, '(')) {
      ts.push('(');
      parens = true;
    }
    const body = parseTermTop(ts);
    if (!parens && body.tag === 'Ann')
      return Ann(abs(args, body.term), body.type);
    return abs(args, body);
  }
  if (skipSymbol(ts, '_')) {
    const name = parseName(ts);
    if (!name) return err(`expected name after hole _`);
    return Hole(name);
  }
  const pats = parsePat(ts);
  if (!pats) return null;
  if (pats.length === 0) return err(`expected pattern`);
  if (pats.length > 1) return err(`too many patterns`);
  const pat = pats[0];
  skipWhitespace(ts);
  if (skipSymbol2(ts, '<-')) {
    const val = parseTermTop(ts, true);
    skipWhitespace(ts);
    if (!skipSymbol(ts, ';')) return err(`expected ; after <-`);
    const body = parseTermTop(ts);
    return Let(pat, val, body);
  }
  return patToVar(pat);
};

const parseAppTop = (ts: string[], underLet: boolean = false): Term => {
  skipWhitespace(ts);
  if (ts.length === 0) return err(`empty app`);
  let expr = parseExpr(ts);
  if (!expr) return err(`expected term in parseAppTop`);
  while (true) {
    skipWhitespace(ts);
    if (ts[ts.length - 1] === ')') break;
    if (skipSymbol(ts, ':')) {
      const ty = parseTypeTop(ts);
      return Ann(expr, ty);
    }
    if (!underLet && skipSymbol(ts, ';')) {
      const rest = parseTermTop(ts);
      return Let(PWildcard, expr, rest);
    }
    if (ts[ts.length - 1] === ';') break;
    const expr2 = parseExpr(ts);
    if (!expr2) break;
    expr = App(expr, expr2);
  }
  return expr;
};

const parseTermTop = (ts: string[], underLet: boolean = false): Term => {
  skipWhitespace(ts);
  const term = parseAppTop(ts, underLet);
  // if (ts.length > 0) return err(`parse term premature end`);
  return term;
};

export const parseTerm = (str: string): Term => {
  return parseTermTop(str.split('').reverse());
};

// types
const parseTypePat = (ts: string[]): [Name, Kind | null][] => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '(')) {
    const pats: Name[] = [];
    let ki: Kind | null = null;
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`unclosed ( in pattern`);
      if (skipSymbol(ts, ')')) break;
      if (skipSymbol(ts, ':')) {
        ts.push('(');
        ki = parseKindR(ts);
        if (!ki) return err(`invalid kind in forall pattern`);
        break;
      }
      const arg = parseName(ts);
      if (!arg) return err(`expected name in forall pattern`);
      if (/[A-Z]/.test(arg[0])) return err(`constructor in forall`);
      pats.push(arg);
    }
    if (pats.length === 0) return err(`empty forall pattern`);
    if (!ki) return err(`expected kind in forall pattern`);
    return pats.map(x => [x, ki] as [Name, Kind]);
  }
  const x = parseName(ts);
  if (!x) return err(`expected a pattern`);
  if (/[A-Z]/.test(x[0])) return err(`constructor in forall`);
  return [[x, null]];
};

const parseTypeR = (ts: string[]): Type | null => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '(')) {
    const body = parseTypeTop(ts);
    if (skipSymbol(ts, ')')) return body;
    else return err(`unclosed ( in type`);
  }
  const name = parseName(ts);
  if (!name) return null;
  if (name === 'forall') {
    const args: [Name, Kind | null][] = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`no . after forall`);
      if (skipSymbol(ts, '.')) break;
      const arg = parseTypePat(ts);
      for (let i = 0, l = arg.length; i < l; i++)
        args.push(arg[i]);
    }
    if (args.length === 0) return err(`no args after forall`);
    const body = parseTypeTop(ts);
    return tforall(args, body);
  }
  return /[A-Z]/.test(name[0]) ? TCon(name) : TVar(name);
};

const parseTAppTop = (ts: string[]): Type => {
  skipWhitespace(ts);
  if (ts.length === 0) return err(`empty tapp`);
  let expr = parseTypeR(ts);
  if (!expr) return err(`expected identifier in parseTAppTop but got`);
  while (true) {
    skipWhitespace(ts);
    if (ts[ts.length - 1] === ')') break;
    if (ts[ts.length - 1] === '-' && ts[ts.length - 2] === '>') break;
    const expr2 = parseTypeR(ts);
    if (!expr2) break;
    expr = TApp(expr, expr2);
  }
  return expr;
};

const parseTypeTop = (ts: string[]): Type => {
  const tys: Type[] = [];
  let funLast = false;
  while (true) {
    skipWhitespace(ts);
    if (ts.length === 0) break;
    if (ts[ts.length - 1] === ')') break;
    if (skipSymbol2(ts, '->')) {
      funLast = true;
      if (tys.length === 0) return err(`nothing before ->`);
      continue;
    }
    const ty = parseTAppTop(ts);
    tys.push(ty);
    funLast = false;
  }
  if (tys.length === 0) return err(`empty type`);
  const tf = tfunFrom(tys);
  if (funLast) {
    if (tys.length === 0) return tFun;
    return TApp(tFun, tf);
  }
  return tf;
};

export const parseType = (str: string): Type => {
  return parseTypeTop(str.split('').reverse());
};

// kinds
const parseKCon = (ts: string[]): KCon | null => {
  const x = parseName(ts);
  if (!x || /[a-z]/.test(x[0])) return null;
  return KCon(x);
};

const parseKindR = (ts: string[]): Kind | null => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '(')) {
    const es: Kind[] = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`unclosed ( in kind`);
      if (skipSymbol(ts, ')')) break;
      const expr = parseKindTop(ts);
      es.push(expr);
    }
    if (es.length === 0) return err(`empty kind app`);
    if (es.length > 1) return err(`kind application does not exist`);
    return es[0];
  }
  return parseKCon(ts);
};

const parseKindTop = (ts: string[]): Kind => {
  skipWhitespace(ts);
  const ki = parseKindR(ts);
  if (!ki) return err(`expected kind`);
  const ks: Kind[] = [ki];
  while (true) {
    skipWhitespace(ts);
    if (ts.length === 0) break;
    if (ts[ts.length - 1] === ')') break;
    if (skipSymbol2(ts, '->')) {
      const ki = parseKindR(ts);
      if (!ki) return err(`expected kind after ->`);
      ks.push(ki);
    } else return err(`expected -> in kind`);
  }
  return kfunFrom(ks);
};

export const parseKind = (str: string): Kind => {
  return parseKindTop(str.split('').reverse());
};
