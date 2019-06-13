import { app, Var, abs, showTerm, Ann } from './terms';
import { tforall, tapp, TCon, TVar, tfun, showType, Type } from './types';
import { kfun, kType } from './kinds';
import { config } from './config';
import { infer, inferDefs } from './inference';
import { globalenv } from './env';
import { DLet, Def, showDefs } from './definitions';

config.debug = true;
config.showKinds = true;

const v = Var;
const tv = TVar;

const tInt = TCon('Int');
const tList = TCon('List');

const tid = tforall([['t', kType]], tfun(tv('t'), tv('t')));

globalenv.types.List = {
  con: tList,
  kind: kfun(kType, kType),
};
const tenv: { [key: string]: Type } = {
  zero: tInt,
  single: tforall([['t', kType]], tfun(tv('t'), tapp(tList, tv('t')))),
  nil: tforall([['t', kType]], tapp(tList, tv('t'))),
  cons: tforall([['t', kType]], tfun(tv('t'), tapp(tList, tv('t')), tapp(tList, tv('t')))),
  //id: tid,
  caseList: tforall([['t', kType], ['r', kType]], tfun(tapp(tList, tv('t')), tv('r'), tfun(tv('t'), tapp(tList, tv('t')), tv('r')), tv('r'))),
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
  DLet('const', null, abs(['x', 'y'], v('x'))),
  DLet('const2', null, app(v('const'), v('id'))),
  DLet('id', tid, abs(['x'], v('x'))),
  DLet('map', null, abs(['f', 'l'], app(v('caseList'), v('l'), v('nil'), abs(['h', 't'], app(v('cons'), app(v('f'), v('h')), app(v('map'), v('f'), v('t'))))))),
];
console.log(showDefs(ds));
inferDefs(ds);
console.log(showDefs(ds));
for (let k in globalenv.vars)
  console.log(`${k} : ${showType(globalenv.vars[k].type)}`);
