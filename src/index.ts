import { tfun, tapp, TVar, TCon, showType, Scheme, PScheme } from './types';
import { Var, abs, app, showTerm, Con, Decon, Let } from './terms';
import { infer, inferDefs } from './inference';
import { list } from './list';
import { LTEnv, Entry, gtenv, showGTEnv } from './env';
import { Def, DLet, showDefs, DType } from './definitions';
import { compile, compileDefs } from './compilerJS';
import { kType, kfun } from './kinds';
import { setConfig } from './config';

const tInt = TCon('Int');
const tBool = TCon('Bool');
const tList = TCon('List');

const tv = TVar;
const v = Var;

gtenv.types.Int = { tcon: tInt, kind: kType };
gtenv.types.Bool = { tcon: tBool, kind: kType };
gtenv.types.List = { tcon: tList, kind: kfun(kType, kType) };

gtenv.vars.true = Scheme([], tBool);
gtenv.vars.zero = Scheme([], tInt);
gtenv.vars.inc = Scheme([], tfun(tInt, tInt));

const defs: Def[] = [
  DType('MyInt', [], PScheme([], tInt)),
  DType('IdF', [], PScheme([['t', null]], tfun(tv('t'), tv('t')))),
  DType('Id', [['t', null]], PScheme([], tv('t'))),
  DType('Pair', [['a', null], ['b', null]], PScheme([['r', null]], tfun(tfun(tv('a'), tv('b'), tv('r')), tv('r')))),
  DType('Phantom', [['p', null]], PScheme([], tInt)),
  DType('Nat', [], PScheme([['r', null]], tfun(tv('r'), tfun(TCon('Nat'), tv('r')), tv('r')))),
  DLet('id', abs(['x'], v('x'))),
  DLet('id', abs(['x'], v('x')), PScheme([['t', null]], tfun(tv('t'), tv('t')))),
  DLet('const', abs(['x', 'y'], v('x'))),
  // return /\(a:Type).return /\(b:Type). @Pair /\(r:Type).return \(f:a -> b -> r). x <- f a; f b
  DLet('Pair', abs(['a', 'b'], Con('Pair', abs(['f'], app(v('f'), v('a'), v('b')))))),
  DLet('test3', Let('myid', abs(['x'], v('x')), app(v('Pair'), app(v('myid'), v('zero')), app(v('myid'), v('true'))), PScheme([['t', null]], tfun(tv('t'), tv('t'))))),
  DLet('foldNat', abs(['n', 'z', 'f'], app(Decon('Nat', v('n')), v('z'), abs(['m'], app(v('f'), app(v('foldNat'), v('m'), v('z'), v('f')))))), PScheme([['r', null]], tfun(TCon('Nat'), tv('r'), tfun(tv('r'), tv('r')), tv('r')))),
  DLet('test', abs(['x'], Decon('IdF', v('x')))),
  DLet('test2', Con('IdF', v('id'))),
];

setConfig({ debug: true });

console.log(showDefs(defs));
inferDefs(defs);
console.log(showGTEnv());
console.log(compileDefs(defs, x => `const ${x}`));

/**
 * TODO:
 * - infer positions of type applications
 * - flatten Seqs
 * - CEK machine
 * - recursion without annotation
 */
