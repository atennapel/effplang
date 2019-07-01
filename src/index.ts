import { TVar, tforall, tfun, TCon, showType, tapp } from './types';
import { abs, app, Abs, Ann, showTerm, Var } from './terms';
import { infer } from './inference';
import { list, Env } from './env';
import { setConfig } from './config';

const v = Var;
const tv = TVar;
const [t, a, b] = ['t', 'a', 'b'].map(TVar);

const tid = tforall(['t'], tfun(t, t));
const List = TCon('List');
const Bool = TCon('Bool');
const Nat = TCon('Nat');
const Pair = TCon('Pair');
const ST = TCon('ST');

const env: Env = list(
  ['true', Bool],
  ['zero', Nat],
  ['single', tforall(['t'], tfun(t, tapp(List, t)))],
  ['const', tforall(['a', 'b'], tfun(a, b, a))],
  ['id', tid],
  ['ids', tapp(List, tid)],
  ['Nil', tforall(['t'], tapp(List, t))],
  ['Cons', tforall(['t'], tfun(t, tapp(List, t), tapp(List, t)))],
  ['snoc', tforall(['t'], tfun(tapp(List, t), t, tapp(List, t)))],
  ['choose', tforall(['t'], tfun(t, t, t))],
  ['auto', tfun(tid, tid)],
  ['auto2', tforall(['t'], tfun(tid, t, t))],
  ['f', tforall(['t'], tfun(tfun(t, t), tapp(List, t), t))],
  ['poly', tfun(tid, tapp(Pair, Nat, Bool))],
  ['Pair', tforall(['a', 'b'], tfun(a, b, tapp(Pair, a, b)))],
  ['head', tforall(['t'], tfun(tapp(List, t), t))],
  ['length', tforall(['t'], tfun(tapp(List, t), Nat))],
  ['tail', tforall(['t'], tfun(tapp(List, t), tapp(List, t)))],
  ['append', tforall(['t'], tfun(tapp(List, t), tapp(List, t), tapp(List, t)))],
  ['inc', tfun(Nat, Nat)],
  ['g', tforall(['t'], tfun(tapp(List, t), tapp(List, t), t))],
  ['map', tforall(['a', 'b'], tfun(tfun(a, b), tapp(List, a), tapp(List, b)))],
  ['app', tforall(['a', 'b'], tfun(tfun(a, b), a, b))],
  ['revapp', tforall(['a', 'b'], tfun(a, tfun(a, b), b))],
  ['runST', tforall(['t'], tfun(tforall(['a'], tapp(ST, a, t)), t))],
  ['argST', tforall(['t'], tapp(ST, t, Nat))],
  ['h', tfun(Nat, tforall(['t'], tfun(t, t)))],
  ['k', tforall(['t'], tfun(t, tapp(List, t), t))],
  ['lst', tapp(List, tforall(['t'], tfun(Nat, t, t)))],
  ['r', tfun(tforall(['t'], tfun(t, tforall(['a'], tfun(a, a)))), Nat)],
);

const terms = [
  // A
  abs(['x'], v('x')),
  abs(['x', 'y'], v('x')),
  app(v('choose'), v('id')),
  app(v('choose'), v('Nil'), v('ids')),
  Abs('x', app(v('x'), v('x')), tid),
  app(v('id'), v('auto')),
  app(v('id'), v('auto2')),
  app(v('choose'), v('id'), v('auto')),
  app(v('choose'), v('id'), v('auto2')),
  app(v('choose'), Ann(v('id'), tfun(tid, tid)), v('auto2')), // ?
  app(v('f'), app(v('choose'), v('id')), v('ids')),
  app(v('f'), Ann(app(v('choose'), v('id')), tfun(tid, tid)), v('ids')),
  app(v('poly'), v('id')),
  app(v('poly'), abs(['x'], v('x'))),
  app(v('id'), v('poly'), abs(['x'], v('x'))),
  // B
  abs(['f'], app(v('Pair'), app(v('f'), v('zero')), app(v('f'), v('true')))),
  Abs('f', app(v('Pair'), app(v('f'), v('zero')), app(v('f'), v('true'))), tid),
  abs(['xs'], app(v('poly'), app(v('head'), v('xs')))),
  Abs('xs', app(v('poly'), app(v('head'), v('xs'))), tapp(List, tid)),
  // C
  app(v('length'), v('ids')),
  app(v('tail'), v('ids')),
  app(v('head'), v('ids')),
  app(v('single'), v('ids')),
  app(v('Cons'), v('id'), v('ids')), // X
  app(v('snoc'), v('ids'), v('id')),
  app(v('Cons'), abs(['x'], v('x')), v('ids')), // X
  app(v('snoc'), v('ids'), abs(['x'], v('x'))),
  app(v('append'), app(v('single'), v('inc')), app(v('single'), v('id'))),
  app(v('g'), app(v('single'), v('id')), v('ids')),
  app(v('map'), v('poly'), app(v('single'), v('id'))),
  app(v('map'), v('head'), app(v('single'), v('ids'))),
  // D
  app(v('app'), v('poly'), v('id')),
  app(v('revapp'), v('id'), v('poly')), // X
  app(v('runST'), v('argST')),
  app(v('app'), v('runST'), v('argST')),
  app(v('revapp'), v('argST'), v('runST')), // X
  // E
  app(v('k'), v('h'), v('lst')),
  app(v('k'), abs(['x'], app(v('h'), v('x'))), v('lst')), // X
  app(v('r'), abs(['x', 'y'], v('y'))),
];

setConfig({ debug: false });
terms.forEach(t => {
  try {
    console.log(`${showTerm(t)} => ${showType(infer(t, env))}`);
  } catch (err) {
    console.log(`${showTerm(t)} => ${err}`);
  }
});
