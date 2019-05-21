import { parseTerm } from './parser';
import { getInitialEnv } from './env';
import { infer, tFloat, tString } from './inference';
import { showTerm } from './terms';
import { showTy, TCon, tforall, tfun, TVar, tapp } from './types';
import { kType, kfun } from './kinds';
import { setConfig } from './config';
import { termToComp, showCComp, CVAbs, CCRet, CCAdd, CVVar, CVPair, CCSelect, CVSum, CCCase, CCApp, CCSeq, CCEq, CCAppend } from './core';
import { runToVal, showMVal, MGEnv, MFloat, MClos, MUnit } from './machine';
import { Nil } from './list';

const tv = TVar;

const tVoid = TCon('Void');
const tUnit = TCon('Unit');
const tPair = TCon('Pair');
const tSum = TCon('Sum');

const tenv = getInitialEnv();

tenv.tcons.Void = kType;
tenv.global.void = tforall([['t', kType]], tfun(tVoid, tv('t')));

tenv.tcons.Unit = kType;
tenv.global.Unit = tUnit;

tenv.tcons.Pair = kfun(kType, kType, kType);
tenv.global.Pair = tforall([['a', kType], ['b', kType]], tfun(tv('a'), tv('b'), tapp(tPair, tv('a'), tv('b'))));
tenv.global.fst = tforall([['a', kType], ['b', kType]], tfun(tapp(tPair, tv('a'), tv('b')), tv('a')));
tenv.global.snd = tforall([['a', kType], ['b', kType]], tfun(tapp(tPair, tv('a'), tv('b')), tv('b')));

tenv.tcons.Sum = kfun(kType, kType, kType);
tenv.global.L = tforall([['a', kType], ['b', kType]], tfun(tv('a'), tapp(tSum, tv('a'), tv('b'))));
tenv.global.R = tforall([['a', kType], ['b', kType]], tfun(tv('b'), tapp(tSum, tv('a'), tv('b'))));
tenv.global.case = tforall([['a', kType], ['b', kType], ['r', kType]], tfun(tapp(tSum, tv('a'), tv('b')), tfun(tv('a'), tv('r')), tfun(tv('b'), tv('r')), tv('r')));

tenv.global.fix = tforall([['t', kType]], tfun(tfun(tv('t'), tv('t')), tv('t')));

tenv.tcons.Float = kType;
tenv.global.add = tfun(tFloat, tFloat, tFloat);
tenv.global.eq = tforall([['t', kType]], tfun(tv('t'), tv('t'), tapp(tSum, tUnit, tUnit)));

tenv.tcons.String = kType;
tenv.global.append = tfun(tString, tString, tString);

const fixPart = CVAbs('x', CCApp(CVVar('f'), CVAbs('v', CCSeq('t', CCApp(CVVar('x'), CVVar('x')), CCApp(CVVar('t'), CVVar('v'))))));

const genv: MGEnv = {
  void: MClos(CVAbs('x', CCRet(CVVar('x'))), Nil),
  Unit: MUnit,

  fix: MClos(CVAbs('f', CCApp(fixPart, fixPart)), Nil),

  add: MClos(CVAbs('x', CCRet(CVAbs('y', CCAdd(CVVar('x'), CVVar('y'))))), Nil),
  append: MClos(CVAbs('x', CCRet(CVAbs('y', CCAppend(CVVar('x'), CVVar('y'))))), Nil),
  eq: MClos(CVAbs('x', CCRet(CVAbs('y', CCEq(CVVar('x'), CVVar('y'))))), Nil),

  Pair: MClos(CVAbs('x', CCRet(CVAbs('y', CCRet(CVPair(CVVar('x'), CVVar('y')))))), Nil),
  fst: MClos(CVAbs('p', CCSelect('fst', CVVar('p'))), Nil),
  snd: MClos(CVAbs('p', CCSelect('snd', CVVar('p'))), Nil),

  L: MClos(CVAbs('x', CCRet(CVSum('L', CVVar('x')))), Nil),
  R: MClos(CVAbs('x', CCRet(CVSum('R', CVVar('x')))), Nil),
  case: MClos(CVAbs('s', CCCase(CVVar('s'))), Nil),
};

setConfig({ showKinds: true });

if (process.argv[2]) {
  try {
    const sc = require('fs').readFileSync(process.argv[2], 'utf8');
    const term = parseTerm(sc);
    console.log(showTerm(term));
    const ty = infer(tenv, term);
    console.log(showTy(ty));
    const core = termToComp(term);
    console.log(showCComp(core));
    const rest = runToVal(genv, core);
    console.log(showMVal(rest));
  } catch (err) {
    console.error(err);
    process.exit();
  }
} else {
  const readline = require('readline').createInterface(process.stdin, process.stdout);
  console.log('REPL');
  process.stdin.setEncoding('utf8');
  function input() {
    readline.question('> ', function(sc: string) {
      try {
        const term = parseTerm(sc);
        console.log(showTerm(term));
        const ty = infer(tenv, term);
        console.log(showTy(ty));
        const core = termToComp(term);
        console.log(showCComp(core));
        const rest = runToVal(genv, core);
        console.log(showMVal(rest));
      } catch (err) {
        console.error(`${err}`);
      }   
      setImmediate(input, 0);
    });
  };
  input();
}
