import { app, Var, abs, showTerm, Ann } from './terms';
import { tforall, tapp, TCon, TVar, tfun } from './types';
import { kfun, kType } from './kinds';
import { config } from './config';

const v = Var;
const tv = TVar;

config.showKinds = true;

const term = Ann(app(v('f'), abs(['x', 'y'], v('x')), app(v('g'), v('h'))), tforall([['t', kfun(kfun(kType, kType), kType, kType)]], tfun(tapp(TCon('F'), tv('t')), tv('t'))));
console.log(showTerm(term));
