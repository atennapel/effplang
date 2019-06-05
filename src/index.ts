import { TFun, TVar, trow, tapp, TCon, tfun, showType } from './types';
import { Name } from './name';
import { abs, Var, showTerm } from './terms';
import { typecheck } from './infer';

const t = 't';
const e = 'e';
const x = 'x';

const tv = TVar;

const v = Var;

const term = abs([x], v(x));
console.log(showTerm(term));
try {
  const ty = typecheck(term);
  console.log(`${showType(ty.type)} ; ${showType(ty.eff)}`);
} catch (err) {
  console.log(err);
}
