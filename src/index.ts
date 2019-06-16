import { app, Var, abs, showTerm, Ann } from './terms';
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
  DType('List', [['t', null]], [['Nil', []], ['Cons', [tv('t'), tapp(TCon('List'), tv('t'))]]]),
  DType('Fix', [['f', null]], [['Fix', [tapp(tv('f'), tapp(TCon('Fix'), tv('f')))]]]),
  DEffect('Flip', [], [['flip', TCon('Unit'), TCon('Bool')]]),
  DEffect('State', [['t', null]], [['get', TCon('Unit'), tv('t')], ['put', tv('t'), TCon('Unit')]]),
  DLet('const', null, abs(['x', 'y'], v('x'))),
  DLet('const2', null, app(v('const'), v('id'))),
  DLet('id', tid, abs(['x'], v('x'))),
  DLet('map', null, abs(['f', 'l'], app(v('?List'), v('l'), abs(['_'], v('Nil')), abs(['h', 't'], app(v('Cons'), app(v('f'), v('h')), app(v('map'), v('f'), v('t'))))))),
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

/**
 * effects on function arrow
 */
