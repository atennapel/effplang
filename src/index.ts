import { app, Var, abs, showTerm, Ann, Let } from './terms';
import { tforall, tapp, TCon, TVar, tfun, showType, Type } from './types';
import { kfun, kType, showKind } from './kinds';
import { config } from './config';
import { infer, inferDefs } from './inference';
import { globalenv } from './env';
import { DLet, Def, showDefs, DType, DEffect } from './definitions';

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
globalenv.types.Int = { con: tInt, kind: kType };

const ds: Def[] = [
  DType('Unit', [], [['Unit', []]]),
  DType('Bool', [], [['True', []], ['False', []]]),
  //DType('List', [['t', null]], [['Nil', []], ['Cons', [tv('t'), tapp(TCon('List'), tv('t'))]]]),
  //DType('Fix', [['f', null]], [['Fix', [tapp(tv('f'), tapp(TCon('Fix'), tv('f')))]]]),
  //DType('Pair', [['a', null], ['b', null]], [['Pair', [tv('a'), tv('b')]]]),
  DEffect('Flip', [], [['flip', TCon('Unit'), TCon('Bool')]]),
  DEffect('State', [['t', null]], [['get', TCon('Unit'), tv('t')], ['put', tv('t'), TCon('Unit')]]),
  //DLet('idsynth', null, abs(['x'], v('x'))),
  //DLet('const', null, abs(['x', 'y'], v('x'))),
  //DLet('const2', null, app(v('const'), v('id'))),
  //DLet('id', tid, abs(['x'], v('x'))),
  //DLet('map', null, abs(['f', 'l'], app(v('?List'), v('l'), abs(['_'], v('Nil')), abs(['h', 't'], app(v('Cons'), app(v('f'), v('h')), app(v('map'), v('f'), v('t'))))))),
  //DLet('single', null, abs(['x'], app(v('Cons'), v('x'), v('Nil')))),
  //DLet('test', null, app(v('Fix'), v('Nil'))),
  //DLet('test2', null, Let('id', abs(['x'], v('x')), app(v('Pair'), app(v('id'), v('True')), app(v('id'), v('Unit'))))),
  //DLet('state', null, abs(['c'], app(v('!State'), v('c'), abs(['_', 'k', 's'], app(v('k'), v('s'), v('s'))), abs(['s', 'k', '_'], app(v('k'), v('Unit'), v('s'))), abs(['x', 's'], v('x'))))),
  DLet('testeff', null, abs(['_'], Let('x', app(v('#get'), v('Unit')), app(v('#flip'), v('Unit'))))),
];
console.log(showDefs(ds));
inferDefs(ds);
console.log(showDefs(ds));
for (let k in globalenv.types)
  console.log(`${k} :: ${showKind(globalenv.types[k].kind)}`);
for (let k in globalenv.vars)
  console.log(`${k} : ${showType(globalenv.vars[k].type)}`);

/**
 * - effects on function arrow
 * - check that generalization does not happen if there are effects
 * - opening effects
 * - closing effects
 * - propogating return type in application check (?)
 */
