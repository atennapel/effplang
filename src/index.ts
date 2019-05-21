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
 * - parser: syntax for rows
 * - parser: syntax for records and operations on them
 * - definitions
 * - recursive definitions
 * - recursive lets (?)
 * - flatten sequencing
 * - effect rows
 * - row-polymorphic variants
 * - parser: string unicode escape
 */
