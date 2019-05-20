import { List, Cons, Nil, toString } from './List';
import { Name, impossible } from './util';
import { CVAbs, CComp, CVal, showCComp, showCVal } from './core';

type KV = { name: Name, val: MVal };
const KV = (name: Name, val: MVal): KV => ({ name, val });
type MLEnv = List<KV>;
const lookup = (name: Name, env: MLEnv): MVal | null => {
  let l = env;
  while (l.tag === 'Cons') {
    const c = l.head;
    if (c.name === name) return c.val;
    l = l.tail;
  }
  return null;
};
const extend = (name: Name, val: MVal, env: MLEnv) =>
  Cons(KV(name, val), env);

export const showMLEnv = (env: MLEnv): string =>
  toString(env, ({ name, val }) => `${name} = ${showMVal(val)}`);

type MVal = MClos;

interface MClos {
  readonly tag: 'MClos';
  readonly abs: CVAbs;
  readonly env: MLEnv;
}
const MClos = (abs: CVAbs, env: MLEnv): MClos =>
  ({ tag: 'MClos', abs, env });

export const showMVal = (val: MVal): string => {
  if (val.tag === 'MClos')
    return `(${showCVal(val.abs)}, ${showMLEnv(val.env)})`;
  return impossible('showMVal');
};

type MCont = MTop | MSeq;

interface MTop {
  readonly tag: 'MTop';
}
const MTop: MTop = { tag: 'MTop' };

interface MSeq {
  readonly tag: 'MSeq';
  readonly name: Name;
  readonly body: CComp;
  readonly env: MLEnv;
  readonly rest: MCont;
}
const MSeq = (name: Name, body: CComp, env: MLEnv, rest: MCont): MSeq =>
  ({ tag: 'MSeq', name, body, env, rest });

interface MState {
  readonly comp: CComp;
  readonly env: MLEnv;
  readonly cont: MCont;
}
const MState = (comp: CComp, env: MLEnv, cont: MCont): MState =>
  ({ comp, env, cont });

const reifyVal = (env: MLEnv, val: CVal): MVal | null => {
  if (val.tag === 'CVVar') return lookup(val.name, env);
  if (val.tag === 'CVAbs') return MClos(val, env);
  return null;
};
const step = (st: MState): MState | null => {
  const { comp, env, cont } = st;
  if (comp.tag === 'CCRet' && cont.tag === 'MSeq') {
    const v = reifyVal(env, comp.val);
    if (!v) return null;
    return MState(cont.body, extend(cont.name, v, env), cont.rest);
  }
  if (comp.tag === 'CCApp') {
    const f = reifyVal(env, comp.left);
    if (!f || f.tag !== 'MClos') return null;
    const a = reifyVal(env, comp.right);
    if (!a) return null;
    return MState(f.abs.body, extend(f.abs.name, a, f.env), cont);
  }
  if (comp.tag === 'CCSeq')
    return MState(comp.val, env, MSeq(comp.name, comp.body, env, cont));
  return null;
};
const steps = (st: MState): MState => {
  let s: MState | null = st;
  while (true) {
    const p = s;
    s = step(s);
    if (!s) return p; 
  }
};

const initial = (comp: CComp): MState => MState(comp, Nil, MTop);

export const runToVal = (comp: CComp): MVal => {
  const st = initial(comp);
  const final = steps(st);
  if (final.comp.tag === 'CCRet' && final.cont.tag === 'MTop') {
    const v = reifyVal(final.env, final.comp.val);
    if (!v) throw new Error('got stuck');
    return v;
  }
  throw new Error('got stuck');
};
