import { parseTerm } from './parser';
import { getInitialEnv } from './env';
import { infer } from './inference';
import { showTerm } from './terms';
import { showTy, TCon, tforall, tfun, TVar, tapp } from './types';
import { kType, kfun } from './kinds';
import { setConfig } from './config';
import { termToComp, showCComp } from './core';
import { runToVal, showMVal } from './machine';

const tv = TVar;

const tVoid = TCon('Void');
const tUnit = TCon('Unit');
const tPair = TCon('Pair');
const tSum = TCon('Sum');
const tBool = TCon('Bool');
const tList = TCon('List');

const tenv = getInitialEnv();

tenv.tcons.Void = kType;
tenv.global.void = tforall([['t', kType]], tfun(tVoid, tv('t')));

tenv.tcons.Unit = kType;
tenv.global.Unit = tUnit;

tenv.tcons.Pair = kfun(kType, kType, kType);
tenv.global.pair = tforall([['a', kType], ['b', kType]], tfun(tv('a'), tv('b'), tapp(tPair, tv('a'), tv('b'))));
tenv.global.fst = tforall([['a', kType], ['b', kType]], tfun(tapp(tPair, tv('a'), tv('b')), tv('a')));
tenv.global.snd = tforall([['a', kType], ['b', kType]], tfun(tapp(tPair, tv('a'), tv('b')), tv('b')));

tenv.tcons.Sum = kfun(kType, kType, kType);
tenv.global.inl = tforall([['a', kType], ['b', kType]], tfun(tv('a'), tapp(tSum, tv('a'), tv('b'))));
tenv.global.inr = tforall([['a', kType], ['b', kType]], tfun(tv('b'), tapp(tSum, tv('a'), tv('b'))));
tenv.global.caseSum = tforall([['a', kType], ['b', kType], ['r', kType]], tfun(tapp(tSum, tv('a'), tv('b')), tfun(tv('a'), tv('r')), tfun(tv('b'), tv('r')), tv('r')));

tenv.tcons.Bool = kType;
tenv.global.True = tBool;
tenv.global.False = tBool;
tenv.global.cond = tforall([['t', kType]], tfun(tBool, tv('t'), tv('t'), tv('t')));

tenv.tcons.List = kfun(kType, kType);
tenv.global.Nil = tforall([['t', kType]], tapp(tList, tv('t')));
tenv.global.Cons = tforall([['t', kType]], tfun(tv('t'), tapp(tList, tv('t')), tapp(tList, tv('t'))));
tenv.global.caseList = tforall([['t', kType], ['r', kType]], tfun(tapp(tList, tv('t')), tv('r'), tfun(tv('t'), tapp(tList, tv('t')), tv('r')), tv('r')));

tenv.global.fix = tforall([['t', kType]], tfun(tfun(tv('t'), tv('t')), tv('t')));

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
    const rest = runToVal(core);
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
        const rest = runToVal(core);
        console.log(showMVal(rest));
      } catch (err) {
        console.error(`${err}`);
      }   
      setImmediate(input, 0);
    });
  };
  input();
}
