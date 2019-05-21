import { infer } from './inference';
import { TEnv, getInitialEnv } from './env';
import { showTerm } from './terms';
import { showTy } from './types';
import { parseTerm } from './parser';

const env: TEnv = getInitialEnv();
const s = '\\x y -> x';
const term = parseTerm(s);
console.log(showTerm(term));
const ty = infer(env, term);
console.log(showTy(ty));

/**
 * TODO:
 * - definitions
 * - recursive definitions
 * - recursive lets (?)
 * - parser: string unicode escape
 * - effect rows
 * - record rows
 */
