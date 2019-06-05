import { TFun, TVar, trow, tapp, TCon, tfun, showType } from './types';
import { Name } from './name';
import { abs, Var, showTerm, OpCall, Let, Select, Inject, Restrict, Embed } from './terms';
import { typecheck, GTEnv } from './infer';

const t = 't';
const e = 'e';
const x = 'x';

const tBool = TCon('Bool');

const tv = TVar;

const v = Var;

const env: GTEnv = {
  True: tBool,
  False: tBool,
};

const term = abs(['x'], Embed('l', v('x')));
console.log(showTerm(term));
try {
  const ty = typecheck(env, term);
  console.log(`${showType(ty.type)} ; ${showType(ty.eff)}`);
} catch (err) {
  console.log(err);
}
