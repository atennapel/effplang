import { List, Cons, Nil, toString } from './list';
import { Name, impossible } from './util';
import { CVAbs, CComp, CVal, showCVal, CCRet, CVFloat } from './core';

export type MGEnv = { [key: string]: MVal };

export type KV = { name: Name, val: MVal };
export const KV = (name: Name, val: MVal): KV => ({ name, val });
export type MLEnv = List<KV>;
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

export type MVal = MClos | MFloat;

export interface MClos {
  readonly tag: 'MClos';
  readonly abs: CVAbs;
  readonly env: MLEnv;
}
export const MClos = (abs: CVAbs, env: MLEnv): MClos =>
  ({ tag: 'MClos', abs, env });

export interface MFloat {
  readonly tag: 'MFloat';
  readonly val: number;
}
export const MFloat = (val: number): MFloat =>
  ({ tag: 'MFloat', val });

export const showMVal = (val: MVal): string => {
  if (val.tag === 'MClos')
    return `(${showCVal(val.abs)}, ${showMLEnv(val.env)})`;
  if (val.tag === 'MFloat') return `${val.val}`;
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

const reifyVal = (genv: MGEnv, env: MLEnv, val: CVal): MVal | null => {
  if (val.tag === 'CVVar')
    return lookup(val.name, env) || genv[val.name] || null;
  if (val.tag === 'CVAbs') return MClos(val, env);
  if (val.tag === 'CVFloat') return MFloat(val.val);
  return null;
};
const step = (genv: MGEnv, st: MState): MState | null => {
  const { comp, env, cont } = st;
  if (comp.tag === 'CCRet' && cont.tag === 'MSeq') {
    const v = reifyVal(genv, env, comp.val);
    if (!v) return null;
    return MState(cont.body, extend(cont.name, v, env), cont.rest);
  }
  if (comp.tag === 'CCApp') {
    const f = reifyVal(genv, env, comp.left);
    if (!f || f.tag !== 'MClos') return null;
    const a = reifyVal(genv, env, comp.right);
    if (!a) return null;
    return MState(f.abs.body, extend(f.abs.name, a, f.env), cont);
  }
  if (comp.tag === 'CCSeq')
    return MState(comp.val, env, MSeq(comp.name, comp.body, env, cont));
  if (comp.tag === 'CCAdd') {
    const a = reifyVal(genv, env, comp.left);
    if (!a || a.tag !== 'MFloat') return null;
    const b = reifyVal(genv, env, comp.right);
    if (!b || b.tag !== 'MFloat') return null;
    return MState(CCRet(CVFloat(a.val + b.val)), env, cont);
  }
  return null;
};
const steps = (genv: MGEnv, st: MState): MState => {
  let s: MState | null = st;
  while (true) {
    const p = s;
    s = step(genv, s);
    if (!s) return p; 
  }
};

const initial = (comp: CComp): MState => MState(comp, Nil, MTop);

export const runToVal = (genv: MGEnv, comp: CComp): MVal => {
  const st = initial(comp);
  const final = steps(genv, st);
  if (final.comp.tag === 'CCRet' && final.cont.tag === 'MTop') {
    const v = reifyVal(genv, final.env, final.comp.val);
    if (!v) throw new Error('got stuck');
    return v;
  }
  throw new Error('got stuck');
};
