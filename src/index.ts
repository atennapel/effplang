import { infer } from './inference';
import { TEnv, getInitialEnv } from './env';
import { showTerm, abs, PVar, Var } from './terms';
import { showTy } from './types';

const env: TEnv = getInitialEnv();
const term = abs([PVar('x')], Var('x'));
console.log(showTerm(term));
const ty = infer(env, term);
console.log(showTy(ty));
