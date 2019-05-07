import { abs, Var, showTerm, app, lets } from './terms';
import { typecheck, GTEnv } from './inference';
import { showType, tfun, TVar, tapp, TCon, TFun, TEffExtend, tEffEmpty } from './types';

const tUnit = TCon('Unit');
const tBool = TCon('Bool');
const tInt = TCon('Int');
const tState = TCon('State');
const tFlip = TCon('Flip');
const tPair = TCon('pair');

const $ = Var;
const tv = TVar;

const genv: GTEnv = {
  pair: tfun(tv('a'), tv('b'), tapp(tPair, tv('a'), tv('b'))),
  unit: tUnit,
  get: TFun(tUnit, TEffExtend(tState, tEffEmpty), tInt),
  flip: TFun(tUnit, TEffExtend(tFlip, tEffEmpty), tBool),
  id: tfun(tv('t'), tv('t')),
};

const term = abs(['x'], $('x'));
console.log(showTerm(term));
const { type, eff } = typecheck(genv, term);
console.log(`${showType(type)} | ${showType(eff)}`);

/**
 * effects type parameters
 */
