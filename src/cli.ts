import { parseTerm } from './parser';
import { getInitialEnv } from './env';
import { infer } from './inference';
import { showTerm } from './terms';
import { showTy, TCon, tforall, tfun, TVar, tapp } from './types';
import { kType, kfun } from './kinds';

const tv = TVar;

const tVoid = TCon('Void');
const tUnit = TCon('Unit');
const tBool = TCon('Bool');
const tList = TCon('List');

const tenv = getInitialEnv();

tenv.tcons.Void = kType;
tenv.global.void = tforall([['t', kType]], tfun(tVoid, tv('t')));

tenv.tcons.Unit = kType;
tenv.global.Unit = tUnit;

tenv.tcons.Bool = kType;
tenv.global.True = tBool;
tenv.global.False = tBool;
tenv.global.cond = tforall([['t', kType]], tfun(tBool, tv('t'), tv('t'), tv('t')));

tenv.tcons.List = kfun(kType, kType);
tenv.global.Nil = tforall([['t', kType]], tapp(tList, tv('t')));
tenv.global.Cons = tforall([['t', kType]], tfun(tv('t'), tapp(tList, tv('t')), tapp(tList, tv('t'))));
tenv.global.caseList = tforall([['t', kType], ['r', kType]], tfun(tapp(tList, tv('t')), tv('r'), tfun(tv('t'), tapp(tList, tv('t')), tv('r')), tv('r')));

tenv.global.fix = tforall([['t', kType]], tfun(tfun(tv('t'), tv('t')), tv('t')));

if (process.argv[2]) {
  try {
    const sc = require('fs').readFileSync(process.argv[2], 'utf8');
    const term = parseTerm(sc);
    console.log(showTerm(term));
    const ty = infer(tenv, term);
    console.log(showTy(ty));
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
      } catch (err) {
        console.error(`${err}`);
      }   
      setImmediate(input, 0);
    });
  };
  input();
}
