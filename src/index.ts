import { tfun, tapp, TVar, TCon, showType } from './types';
import { Var, abs, app, showTerm } from './terms';
import { infer, inferDefs } from './inference';
import { list } from './list';
import { LTEnv, Entry, gtenv, showGTEnv } from './env';
import { Def, DLet, showDefs } from './definitions';

const tInt = TCon('Int');
const tBool = TCon('Bool');
const tList = TCon('List');

const tv = TVar;
const v = Var;

gtenv.vars.zero = tInt;
gtenv.vars.inc = tfun(tInt, tInt);

const defs: Def[] = [
  DLet('id', abs(['x'], v('x'))),
  DLet('test1', app(v('id'), v('zero'))),
];

console.log(showDefs(defs));
inferDefs(defs);
console.log(showGTEnv());
