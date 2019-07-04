import { tfun, tapp, TVar, TCon, showType } from './types';
import { Var, abs, app, showTerm, Con, Decon } from './terms';
import { infer, inferDefs } from './inference';
import { list } from './list';
import { LTEnv, Entry, gtenv, showGTEnv } from './env';
import { Def, DLet, showDefs, DType } from './definitions';

const tInt = TCon('Int');
const tBool = TCon('Bool');
const tList = TCon('List');

const tv = TVar;
const v = Var;

gtenv.vars.zero = tInt;
gtenv.vars.inc = tfun(tInt, tInt);

const defs: Def[] = [
  DType('MyInt', [], tInt),
  DType('IdF', [], tfun(tv('t'), tv('t'))),
  DType('Id', ['t'], tv('t')),
  DLet('id', abs(['x'], v('x'))),
  DLet('test', abs(['x'], Decon('IdF', v('x')))),
  DLet('test2', Con('IdF', v('id'))),
];

console.log(showDefs(defs));
inferDefs(defs);
console.log(showGTEnv());
