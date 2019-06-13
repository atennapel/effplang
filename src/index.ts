import { app, Var, abs, showTerm, Ann } from './terms';
import { tforall, tapp, TCon, TVar, tfun, showType, Type } from './types';
import { kfun, kType, showKind } from './kinds';
import { config } from './config';
import { infer, inferDefs } from './inference';
import { globalenv } from './env';
import { DLet, Def, showDefs, DType } from './definitions';

config.debug = true;
config.showKinds = true;

const v = Var;
const tv = TVar;

const tInt = TCon('Int');

const tid = tforall([['t', kType]], tfun(tv('t'), tv('t')));

const tenv: { [key: string]: Type } = {
  zero: tInt,
};
for (let k in tenv) globalenv.vars[k] = { type: tenv[k] };

/*
const term = Ann(abs(['x'], v('x')), tforall([['f', null], ['t', null]], tfun(tapp(tv('f'), tv('t')), tapp(tv('f'), tv('t')))));
console.log(showTerm(term));
const ty = infer(term);
console.log(showTerm(term));
console.log(showType(ty));
*/

const ds: Def[] = [
  DType('Bool', [], [['True', []], ['False', []]]),
  DType('List', [['t', null]], [['Nil', []], ['Cons', [tv('t'), tapp(TCon('List'), tv('t'))]]]),
  DType('Fix', [['f', null]], [['Fix', [tapp(tv('f'), tapp(TCon('Fix'), tv('f')))]]]),
  DLet('const', null, abs(['x', 'y'], v('x'))),
  DLet('const2', null, app(v('const'), v('id'))),
  DLet('id', tid, abs(['x'], v('x'))),
  DLet('map', null, abs(['f', 'l'], app(v('?List'), v('l'), v('Nil'), abs(['h', 't'], app(v('Cons'), app(v('f'), v('h')), app(v('map'), v('f'), v('t'))))))),
  DLet('single', null, abs(['x'], app(v('Cons'), v('x'), v('Nil')))),
  DLet('test', null, app(v('Fix'), v('Nil'))),
];
console.log(showDefs(ds));
inferDefs(ds);
console.log(showDefs(ds));
for (let k in globalenv.types)
  console.log(`${k} :: ${showKind(globalenv.types[k].kind)}`);
for (let k in globalenv.vars)
  console.log(`${k} : ${showType(globalenv.vars[k].type)}`);
