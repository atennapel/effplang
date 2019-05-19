import {
  Term,
  Var,
  App,
  appFrom,
  abs,
  PVar,
  Hole,
  Pat,
  PWildcard,
  Ann,
  PAnn,
} from './terms';
import {
  Type,
  TApp,
  TVar,
  TCon,
  tappFrom,
  tforall,
} from './types';

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
const parseId = (ts: string[]): Var | null => {
  const x = parseName(ts);
  if (!x) return null;
  return Var(x);
};

const parsePat = (ts: string[]): Pat[] => {
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
      for (let i = 0, l = pats2.length; i < l; i++)
        pats.push(pats2[i]);
    }
    if (pats.length === 0) return err(`empty pattern`);
    if (!ty) return err(`expected type in pattern`);
    return pats.map(p => PAnn(p, ty as Type));
  }
  const x = parseName(ts);
  if (!x) return err(`expected a pattern`);
  return [PVar(x)];
};

const parseExpr = (ts: string[]): Term | null => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '(')) {
    const es = [];
    let ty: Type | null = null;
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`unclosed (`);
      if (skipSymbol(ts, ')')) break;
      if (skipSymbol(ts, ':')) {
        ts.push('(');
        ty = parseTypeR(ts);
        if (!ty) return err(`invalid type in annotation`);
        break;
      }
      const expr = parseExpr(ts);
      if (!expr) return err(`failed to parse expr in application`);
      es.push(expr);
    }
    if (es.length === 0) return err(`empty app`);
    return ty ? Ann(appFrom(es), ty) : appFrom(es);
  }
  if (skipSymbol(ts, '\\')) {
    const args: Pat[] = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`no -> after \\`);
      if (skipSymbol2(ts, '->')) break;
      const pats = parsePat(ts);
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
    const body = parseAppTop(ts);
    if (!parens && body.tag === 'Ann')
      return Ann(abs(args, body.term), body.type);
    return abs(args, body);
  }
  if (skipSymbol(ts, '_')) {
    const name = parseName(ts);
    if (!name) return err(`expected name after hole _`);
    return Hole(name);
  }
  return parseId(ts);
};

const parseAppTop = (ts: string[]): Term => {
  skipWhitespace(ts);
  if (ts.length === 0) return err(`empty app`);
  let expr = parseExpr(ts);
  if (!expr) return err(`expected term in parseAppTop`);
  while (true) {
    skipWhitespace(ts);
    if (skipSymbol(ts, ':')) {
      const ty = parseTypeTop(ts);
      return Ann(expr, ty);
    }
    const expr2 = parseExpr(ts);
    if (!expr2) return expr;
    expr = App(expr, expr2);
  }
};

const parseTermTop = (ts: string[]): Term => {
  skipWhitespace(ts);
  const term = parseAppTop(ts);
  // if (ts.length > 0) return err(`parse term premature end`);
  return term;
};

export const parseTerm = (str: string): Term => {
  return parseTermTop(str.split('').reverse());
};

// types
const parseTVar = (ts: string[]): TVar | null => {
  const x = parseName(ts);
  if (!x || /[A-Z]/.test(x[0])) return null;
  return TVar(x);
};
const parseTCon = (ts: string[]): TCon | null => {
  const x = parseName(ts);
  if (!x || /[a-z]/.test(x[0])) return null;
  return TCon(x);
};
const parseTypeId = (ts: string[]): TVar | TCon | null => {
  const x = parseName(ts);
  if (!x) return null;
  return /[A-Z]/.test(x[0]) ? TCon(x) : TVar(x);
};

const parseTypeR = (ts: string[]): Type | null => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '(')) {
    const es: Type[] = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`unclosed ( in type`);
      if (skipSymbol(ts, ')')) break;
      const expr = parseTypeR(ts);
      if (!expr) return err(`failed to parse type in type application`);
      es.push(expr);
    }
    if (es.length === 0) return err(`empty tapp`);
    return tappFrom(es);
  }
  const name = parseName(ts);
  if (!name) return null;
  if (name === 'forall') {
    const args: [string, null][] = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`no . after forall`);
      if (skipSymbol(ts, '.')) break;
      const arg = parseName(ts);
      if (!arg) return err(`invalid tvar in forall`);
      args.push([arg, null]);
    }
    if (args.length === 0) return err(`no args after forall`);
    const body = parseTAppTop(ts);
    return tforall(args, body);
  }
  return /[A-Z]/.test(name[0]) ? TCon(name) : TVar(name);
};

const parseTAppTop = (ts: string[]): Type => {
  skipWhitespace(ts);
  if (ts.length === 0) return err(`empty tapp`);
  let expr = parseTypeR(ts);
  if (!expr) return err(`expected identifier in parseTAppTop but got: ${ts[ts.length - 1]}`);
  while (true) {
    skipWhitespace(ts);
    const expr2 = parseTypeR(ts);
    if (!expr2) return expr;
    expr = TApp(expr, expr2);
  }
};

const parseTypeTop = (ts: string[]): Type => {
  skipWhitespace(ts);
  const ty = parseTAppTop(ts);
  // if (ts.length > 0) return err(`parse type premature end`);
  return ty;
};

export const parseType = (str: string): Type => {
  return parseTypeTop(str.split('').reverse());
};
