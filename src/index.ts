import { tfun, tapp, TVar, TCon, showType } from './types';
import { Var, abs, app, showTerm, Con, Decon, Let } from './terms';
import { infer, inferDefs } from './inference';
import { list } from './list';
import { LTEnv, Entry, gtenv, showGTEnv } from './env';
import { Def, DLet, showDefs, DType } from './definitions';
import { compile, compileDefs } from './compilerJS';

const tInt = TCon('Int');
const tBool = TCon('Bool');
const tList = TCon('List');

const tv = TVar;
const v = Var;

gtenv.vars.true = tBool;
gtenv.vars.zero = tInt;
gtenv.vars.inc = tfun(tInt, tInt);

const defs: Def[] = [
  DType('MyInt', [], tInt),
  DType('IdF', [], tfun(tv('t'), tv('t'))),
  DType('Id', ['t'], tv('t')),
  DType('Pair', ['a', 'b'], tfun(tfun(tv('a'), tv('b'), tv('r')), tv('r'))),
  DLet('Pair', abs(['a', 'b'], Con('Pair', abs(['f'], app(v('f'), v('a'), v('b')))))),
  DLet('id', abs(['x'], v('x'))),
  DLet('test', abs(['x'], Decon('IdF', v('x')))),
  DLet('test2', Con('IdF', v('id'))),
  DLet('test3', Let('myid', abs(['x'], v('x')), app(v('Pair'), app(v('myid'), v('zero')), app(v('myid'), v('true'))), tfun(tv('t'), tv('t')))),
];

console.log(showDefs(defs));
inferDefs(defs);
console.log(showGTEnv());
console.log(compileDefs(defs, x => `const ${x}`));
