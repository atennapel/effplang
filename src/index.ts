import { TFun, TVar, trow, tapp, TCon, tfun, showType } from './types';
import { Name } from './name';

const t = Name('t');
const e = Name('e');
const tList = Name('List');

const tv = TVar;

const ty = TFun(tv(t), trow([['get', tfun(tv(t), tv(t))]], tv(e)), tapp(TCon(tList), tv(t)));
console.log(showType(ty));
