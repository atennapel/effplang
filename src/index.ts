import { app, Var, abs, showTerm, Ann } from './terms';
import { tforall, tapp, TCon, TVar, tfun, showType, Type } from './types';
import { kfun, kType } from './kinds';
import { config } from './config';
import { infer } from './inference';
import { initialGTEnv } from './env';

config.debug = true;
config.showKinds = true;

const v = Var;
const tv = TVar;

const tInt = TCon('Int');
const tList = TCon('List');

const tid = tforall([['t', kType]], tfun(tv('t'), tv('t')));

const env = initialGTEnv();
const tenv: { [key: string]: Type } = {
  zero: tInt,
  single: tforall([['t', kType]], tfun(tv('t'), tapp(tList, tv('t')))),
  nil: tforall([['t', kType]], tapp(tList, tv('t'))),
  id: tid,
};
for (let k in tenv) env.vars[k] = { type: tenv[k] };

const term = abs(['x', 'y', 'z', 'a', 'b'], v('x'));
console.log(showTerm(term));
const ty = infer(env, term);
console.log(showTerm(term));
console.log(showType(ty));
