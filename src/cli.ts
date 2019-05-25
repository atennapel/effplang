import { TVar, TCon, tforall, tfun, tapp, tString, tFloat, showType, TEffsExtend, tEffsEmpty } from './types';
import { TEnv, initialEnv } from './env';
import { setConfig, config } from './config';
import { showTerm } from './terms';
import { parseTerm } from './parser';
import { infer } from './inference';
import { termToComp, showCComp, CVAbs, CCApp, CVVar, CCSeq, CCRet, CCAdd, CCAppend, CCEq, CCShow, CVPair, CCSelect, CVSum, CCCase } from './core';
import { runToVal, showMVal, MGEnv, MClos, MUnit, amountOfSteps } from './machine';
import { Nil } from './list';
import { optimizeComp } from './optimizer';
import { kType, kfun, kEff, kEffs } from './kinds';

const tv = TVar;

const tVoid = TCon('Void');
const tUnit = TCon('Unit');
const tPair = TCon('Pair');
const tSum = TCon('Sum');

const eFlip = TCon('Flip');

const tenv = initialEnv();

tenv.tcons.Flip = kEff;

tenv.tcons.Void = kType;
tenv.vars.void = tforall(['t'], tfun(tVoid, tv('t')));

tenv.tcons.Unit = kType;
tenv.vars.Unit = tUnit;

tenv.tcons.Pair = kfun(kType, kType, kType);
tenv.vars.Pair = tforall(['a', 'b'], tfun(tv('a'), tv('b'), tapp(tPair, tv('a'), tv('b'))));
tenv.vars.fst = tforall(['a', 'b'], tfun(tapp(tPair, tv('a'), tv('b')), tv('a')));
tenv.vars.snd = tforall(['a', 'b'], tfun(tapp(tPair, tv('a'), tv('b')), tv('b')));

tenv.tcons.Sum = kfun(kType, kType, kType);
tenv.vars.L = tforall(['a', 'b'], tfun(tv('a'), tapp(tSum, tv('a'), tv('b'))));
tenv.vars.R = tforall(['a', 'b'], tfun(tv('b'), tapp(tSum, tv('a'), tv('b'))));
tenv.vars.case = tforall(['a', 'b', 'r'], tfun(tapp(tSum, tv('a'), tv('b')), tfun(tv('a'), tv('r')), tfun(tv('b'), tv('r')), tv('r')));

tenv.vars.fix = tforall(['t'], tfun(tfun(tv('t'), tv('t')), tv('t')));

tenv.vars.add = tfun(tFloat, tFloat, tFloat);
tenv.vars.eq = tforall(['t'], tfun(tv('t'), tv('t'), tapp(tSum, tUnit, tUnit)));

tenv.vars.append = tfun(tString, tString, tString);
tenv.vars.show = tforall(['t'], tfun(tv('t'), tString));

const tEff = TCon('Eff');
tenv.tcons.Eff = kfun(kEffs, kType, kType);
tenv.vars.return = tforall(['t', ['e', kEffs]], tfun(tv('t'), tapp(tEff, tv('e'), tv('t'))));
tenv.vars.pure = tforall(['t'], tfun(tapp(tEff, tEffsEmpty, tv('t')), tv('t')));
tenv.vars.flip = tforall([['e', kEffs]], tapp(tEff, TEffsExtend(eFlip, tv('e')), tFloat));
tenv.vars.bind = tforall(['a', ['e', kEffs], 'b'], tfun(tfun(tv('a'), tapp(tEff, tv('e'), tv('b'))), tapp(tEff, tv('e'), tv('a')), tapp(tEff, tv('e'), tv('b'))));

const fixPart = CVAbs('x', CCApp(CVVar('f'), CVAbs('v', CCSeq('t', CCApp(CVVar('x'), CVVar('x')), CCApp(CVVar('t'), CVVar('v'))))));

const genv: MGEnv = {
  void: MClos(CVAbs('x', CCRet(CVVar('x'))), Nil),
  Unit: MUnit,

  fix: MClos(CVAbs('f', CCApp(fixPart, fixPart)), Nil),

  add: MClos(CVAbs('x', CCRet(CVAbs('y', CCAdd(CVVar('x'), CVVar('y'))))), Nil),
  append: MClos(CVAbs('x', CCRet(CVAbs('y', CCAppend(CVVar('x'), CVVar('y'))))), Nil),
  eq: MClos(CVAbs('x', CCRet(CVAbs('y', CCEq(CVVar('x'), CVVar('y'))))), Nil),
  show: MClos(CVAbs('x', CCShow(CVVar('x'))), Nil),

  Pair: MClos(CVAbs('x', CCRet(CVAbs('y', CCRet(CVPair(CVVar('x'), CVVar('y')))))), Nil),
  fst: MClos(CVAbs('p', CCSelect('fst', CVVar('p'))), Nil),
  snd: MClos(CVAbs('p', CCSelect('snd', CVVar('p'))), Nil),

  L: MClos(CVAbs('x', CCRet(CVSum('L', CVVar('x')))), Nil),
  R: MClos(CVAbs('x', CCRet(CVSum('R', CVVar('x')))), Nil),
  case: MClos(CVAbs('s', CCCase(CVVar('s'))), Nil),
};

setConfig({ debug: false, showKinds: true });

if (process.argv[2]) {
  try {
    const sc = require('fs').readFileSync(process.argv[2], 'utf8');
    const term = parseTerm(sc);
    console.log(showTerm(term));
    const ty = infer(tenv, term);
    console.log(showType(ty));
    const core = termToComp(term);
    console.log(showCComp(core));
    const coreopt = optimizeComp(core);
    console.log(showCComp(coreopt));
    const rest = runToVal(genv, coreopt);
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
    readline.question('> ', function(sc_: string) {
      const sc = sc_.trim();
      if (sc.length === 0) {
      } else if (sc === ':debug') {
        const d = !config.debug;
        setConfig({ debug: d });
        console.log(`debug: ${d}`);
      } else if (sc === ':kinds') {
        const k = !config.showKinds;
        setConfig({ showKinds: k });
        console.log(`kinds: ${k}`);
      } else if (sc === ':steps') {
        console.log(`steps: ${amountOfSteps}`);
      } else try {
        const term = parseTerm(sc);
        console.log(showTerm(term));
        const ty = infer(tenv, term);
        console.log(showType(ty));
        const core = termToComp(term);
        console.log(showCComp(core));
        const coreopt = optimizeComp(core);
        console.log(showCComp(coreopt));
        const rest = runToVal(genv, coreopt);
        console.log(showMVal(rest));
      } catch (err) {
        console.error(`${err}`);
      }   
      setImmediate(input, 0);
    });
  };
  input();
}
