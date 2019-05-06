import { abs, Var, showTerm, app, lets } from './terms';
import { typecheck, GTEnv } from './inference';
import { showType, tfun, TVar, tapp, TCon, TFun, TEffExtend } from './types';

const tUnit = TCon('Unit');
const tBool = TCon('Bool');
const tState = TCon('State');
const tFlip = TCon('Flip');
const tPair = TCon('pair');

const $ = Var;

const genv: GTEnv = {
  pair: TFun(TVar('a'), TVar('e1'), TFun(TVar('b'), TVar('e2'), tapp(tPair, TVar('a'), TVar('b')))),
  unit: tUnit,
  get: TFun(tUnit, TEffExtend(tState, TVar('e')), tBool),
  flip: TFun(tUnit, TEffExtend(tFlip, TVar('e')), tBool),
};

const term = abs(['x'], app($('get'), $('x')));
console.log(showTerm(term));
const { type, eff } = typecheck(genv, term);
console.log(`${showType(type)} | ${showType(eff)}`);

/**
 * opening/closing effects
 * effects type parameters
 */
