import { abs, Var, showTerm, app, lets } from './terms';
import { typecheck, GTEnv } from './inference';
import { showType, tfun, TVar, tapp, TCon } from './types';

const genv: GTEnv = {
  pair: tfun(TVar('a'), TVar('b'), tapp(TCon('Pair'), TVar('a'), TVar('b'))),
};

const term = lets([['diag', abs(['x'], app(Var('pair'), Var('x'), Var('x')))]], abs(['x'], app(Var('diag'), app(Var('diag'), Var('x')))));
console.log(showTerm(term));
const ty = typecheck(genv, term);
console.log(showType(ty));

/**
 * TODO:
 *  Fix the above (problem with unification?)
 *  add generalization
 */
