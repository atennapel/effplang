import { tfun, tapp, TVar, TCon, showType, Scheme } from './types';
import { Var, abs, app, showTerm, Con, Decon, Let } from './terms';
import { infer, inferDefs } from './inference';
import { list } from './list';
import { LTEnv, Entry, gtenv, showGTEnv } from './env';
import { Def, DLet, showDefs, DType } from './definitions';
import { compile, compileDefs } from './compilerJS';
import { kType, kfun } from './kinds';

const tInt = TCon('Int');
const tBool = TCon('Bool');
const tList = TCon('List');

const tv = TVar;
const v = Var;

gtenv.types.Int = { tcon: tInt, kind: kType };
gtenv.types.Bool = { tcon: tBool, kind: kType };
gtenv.types.List = { tcon: tList, kind: kfun(kType, kType) };

gtenv.vars.true = Scheme([], tBool);
gtenv.vars.zero = Scheme([], tInt);
gtenv.vars.inc = Scheme([], tfun(tInt, tInt));

const defs: Def[] = [
  DType('MyInt', [], tInt),
  DType('IdF', [], tfun(tv('t'), tv('t'))),
  DType('Id', [['t', kType]], tv('t')),
  DType('Pair', [['a', kType], ['b', kType]], tfun(tfun(tv('a'), tv('b'), tv('r')), tv('r'))),
  DLet('Pair', abs(['a', 'b'], Con('Pair', abs(['f'], app(v('f'), v('a'), v('b')))))),
  DLet('id', abs(['x'], v('x'))),
  DLet('const', abs(['x', 'y'], v('x'))),
  DLet('test', abs(['x'], Decon('IdF', v('x')))),
  DLet('test2', Con('IdF', v('id'))),
  DLet('test3', Let('myid', abs(['x'], v('x')), app(v('Pair'), app(v('myid'), v('zero')), app(v('myid'), v('true'))), tfun(tv('t'), tv('t')))),
];

console.log(showDefs(defs));
inferDefs(defs);
console.log(showGTEnv());
console.log(compileDefs(defs, x => `const ${x}`));

/**
 * TODO:
 * - kinds
 * - kind inference
 * 
 * - recursion without annotation
 */
