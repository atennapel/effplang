import { infer } from './inference';
import { TEnv, getInitialEnv } from './env';
import { showTerm, LitRecord, abs, PVar, Var, Term, PAnn, Lit, app } from './terms';
import { showTy, tforall, tfun, TVar, tapp, TRowExtends, tRecord } from './types';
import { parseTerm } from './parser';
import { fromArray } from './list';
import { kType, kRow } from './kinds';

const env: TEnv = getInitialEnv();
env.tcons.Float = kType;
env.global.getX = tforall([['t', kType], ['r', kRow]], tfun(tapp(tRecord, TRowExtends('x', TVar('t'), TVar('r'))), TVar('t')));
//const s = '\\x y -> x';
const term = app(Var('getX'), LitRecord(fromArray([['x', abs([PAnn(PVar('y'), tforall([['t', null]], tfun(TVar('t'), TVar('t'))))], Var('y'))]]))); //parseTerm(s);
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
