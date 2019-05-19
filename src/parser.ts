// AST
const Var = name => ({ tag: 'Var', name });
const App = (left, right) => ({ tag: 'App', left, right });
const app = es => es.reduce(App);
const Abs = (name, body) => ({ tag: 'Abs', name, body });
const abs = (ns, body) => ns.reduceRight((x, y) => Abs(y, x), body);

const showTerm = t => {
  if (t.tag === 'Var') return t.name;
  if (t.tag === 'App') return `(${showTerm(t.left)} ${showTerm(t.right)})`;
  if (t.tag === 'Abs') return `(\\${t.name} -> ${showTerm(t.body)})`;
}

// parsing
function err(msg) { throw new SyntaxError(msg) }

function skipWhitespace(ts) {
  const l = ts.length - 1;
  if (l < 0) return;
  let i = l;
  while (i >= 0 && /\s/.test(ts[i])) i--;
  if (i < l) ts.splice(i + 1);
}

function skipSymbol(ts, sym) {
  const l = ts.length - 1;
  if (l < 0) return false;
  if (ts[l] === sym) { ts.pop(); return true }
  return false;
}

function skipSymbol2(ts, sym) {
  const l = ts.length - 1;
  if (l < 1) return false;
  if (ts[l] === sym[0] && ts[l - 1] === sym[1]) {
    ts.splice(-2);
    return true;
  }
  return false;
}

function parseName(ts) {
  const l = ts.length - 1;
  if (l < 0) return null;
  let i = l;
  while (i >= 0 && /[a-z]/i.test(ts[i])) i--;
  if (i === l) return null;
  return ts.splice(i + 1).reverse().join('');
}
function parseId(ts) {
  const x = parseName(ts);
  if (!x) return x;
  return Var(x);
}

function parseExpr(ts) {
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
    return app(es);
  }
  if (skipSymbol(ts, '\\')) {
    const args = [];
    while (true) {
      skipWhitespace(ts);
      if (ts.length === 0) return err(`no -> after \\`);
      if (skipSymbol2(ts, '->')) break;
      const id = parseName(ts);
      if (!id) return err(`failed to parse id after \\`);
      args.push(id);
    }
    if (args.length === 0) return err(`no args after \\`);
    const body = parseAppTop(ts);
    return abs(args, body)
  }
  return parseId(ts);
}

function parseAppTop(ts) {
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

function parse(ts) {
  skipWhitespace(ts);
  return parseAppTop(ts);
}

function start(str) {
  return parse(str.split('').reverse());
}

// testing
const s = 'f  g (\\ a b c -> x f)';
console.log(s);
const t = start(s);
console.log(t);
console.log(showTerm(t));
