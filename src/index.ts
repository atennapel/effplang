import { abs, Var, showTerm, app, lets, Handle, HReturn, HOp } from './terms';
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
  effs: {
    Flip: { tcon: tFlip, ops: ['flip'] },
    State: { tcon: tState, ops: ['get', 'put'] },
  },
  ops: {
    flip: { eff: 'Flip', paramty: tUnit, returnty: tBool },
    get: { eff: 'State', paramty: tUnit, returnty: tBool },
    put: { eff: 'State', paramty: tBool, returnty: tUnit },
  },
  vars: {
    pair: tfun(tv('a'), tv('b'), tapp(tPair, tv('a'), tv('b'))),
    fst: tfun(tapp(tPair, tv('a'), tv('b')), tv('a')),
    snd: tfun(tapp(tPair, tv('a'), tv('b')), tv('b')),
    unit: tUnit,
    get: TFun(tUnit, TEffExtend(tState, tEffEmpty), tInt),
    put: TFun(tInt, TEffExtend(tState, tEffEmpty), tUnit),
    flip: TFun(tUnit, TEffExtend(tFlip, tEffEmpty), tBool),
    id: tfun(tv('t'), tv('t')),
    true: tBool,
  },
};

// const term = abs(['f', 'p'], app($('f'), app($('fst'), $('p')), app($('snd'), $('p')))); // uncurry
const term = abs(['t'], Handle(app($('t'), $('unit')), HOp('flip', 'x', 'k', app($('flip'), $('unit')), HReturn('x', $('x')))));
console.log(showTerm(term));
const { type, eff } = typecheck(genv, term);
console.log(`${showType(type)} | ${showType(eff)}`);

/**
 * TODO:
 * - effect closing should use flattenEffs
 * - effects type parameters
 * - kinds
 * - datatypes
 * - switch to bidirectional system to allow for proper type annotations
 */
