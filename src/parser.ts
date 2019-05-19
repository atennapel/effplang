import { Var, Term, App, appFrom, abs, PVar, Hole, Pat, PWildcard } from "./terms";

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

const parsePat = (ts: string[]): Pat => {
  if (skipSymbol(ts, '_')) {
    if (skipSymbol(ts, '_')) return err(`_ after _ in pattern`);
    if (parseName(ts)) return err(`hole not allowed in pattern`);
    return PWildcard;
  }
  const x = parseName(ts);
  if (!x) return err(`expected a pattern`);
  return PVar(x);
};

const parseExpr = (ts: string[]): Term | null => {
  skipWhitespace(ts);
  if (skipSymbol(ts, '(')) {
    const es = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`unclosed (`);
      if (skipSymbol(ts, ')')) break;
      const expr = parseExpr(ts);
      if (!expr) return err(`failed to parse expr in application`);
      es.push(expr);
    }
    if (es.length === 0) return err(`empty app`);
    return appFrom(es);
  }
  if (skipSymbol(ts, '\\')) {
    const args: Pat[] = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`no -> after \\`);
      if (skipSymbol2(ts, '->')) break;
      args.push(parsePat(ts));
    }
    if (args.length === 0) return err(`no args after \\`);
    const body = parseAppTop(ts);
    return abs(args, body)
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
  if (!expr) return err(`expected identifier in parseAppTop but got: ${ts[ts.length - 1]}`);
  while (true) {
    skipWhitespace(ts);
    const expr2 = parseExpr(ts);
    if (!expr2) return expr;
    expr = App(expr, expr2);
  }
}

const parseTermTop = (ts: string[]): Term => {
  skipWhitespace(ts);
  return parseAppTop(ts);
};

export const parseTerm = (str: string): Term => {
  return parseTermTop(str.split('').reverse());
};
