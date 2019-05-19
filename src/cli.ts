import { parseTerm } from './parser';
import { getInitialEnv } from './env';
import { infer } from './inference';
import { showTerm } from './terms';
import { showTy } from './types';

if (process.argv[2]) {
  try {
    const sc = require('fs').readFileSync(process.argv[2], 'utf8');
    const term = parseTerm(sc);
    console.log(showTerm(term));
    const tenv = getInitialEnv();
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
        const tenv = getInitialEnv();
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
