import { List, Cons, Nil, toString } from './list';
import { Name, impossible } from './util';
import { CVAbs, CComp, CVal, showCVal, CCRet, CVFloat, showCComp, CVEmbed, CVVar, CCApp, CVSum, CVUnit, CVString } from './core';
import { log } from './config';

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

export type MVal = MClos | MUnit | MFloat | MString | MPair | MSum;

export interface MClos {
  readonly tag: 'MClos';
  readonly abs: CVAbs;
  readonly env: MLEnv;
}
export const MClos = (abs: CVAbs, env: MLEnv): MClos =>
  ({ tag: 'MClos', abs, env });

export interface MUnit {
  readonly tag: 'MUnit';
}
export const MUnit: MUnit = { tag: 'MUnit' };

export interface MFloat {
  readonly tag: 'MFloat';
  readonly val: number;
}
export const MFloat = (val: number): MFloat =>
  ({ tag: 'MFloat', val });

export interface MString {
  readonly tag: 'MString';
  readonly val: string;
}
export const MString = (val: string): MString =>
  ({ tag: 'MString', val });
  

export interface MPair {
  readonly tag: 'MPair';
  readonly fst: MVal;
  readonly snd: MVal;
}
export const MPair = (fst: MVal, snd: MVal): MPair =>
  ({ tag: 'MPair', fst, snd });

export interface MSum {
  readonly tag: 'MSum';
  readonly label: 'L' | 'R';
  readonly val: MVal;
}
export const MSum = (label: 'L' | 'R', val: MVal): MSum =>
  ({ tag: 'MSum', label, val });

export const showMVal = (val: MVal): string => {
  if (val.tag === 'MClos')
    return `(${showCVal(val.abs)}, ${showMLEnv(val.env)})`;
  if (val.tag === 'MUnit') return 'Unit';
  if (val.tag === 'MFloat') return `${val.val}`;
  if (val.tag === 'MString') return JSON.stringify(val.val);
  if (val.tag === 'MPair')
    return `(${showMVal(val.fst)}, ${showMVal(val.snd)})`;
  if (val.tag === 'MSum')
    return `(${val.label} ${showMVal(val.val)})`;
  return impossible('showMVal');
};

export const eqMVal = (a: MVal, b: MVal): boolean => {
  if (a.tag === 'MClos') return false;
  if (a.tag === 'MUnit') return b.tag === 'MUnit';
  if (a.tag === 'MFloat') return b.tag === 'MFloat' && a.val === b.val;
  if (a.tag === 'MString') return b.tag === 'MString' && a.val === b.val;
  if (a.tag === 'MPair')
    return b.tag === 'MPair' && eqMVal(a.fst, b.fst) &&
      eqMVal(a.snd, b.snd);
  if (a.tag === 'MSum')
    return b.tag === 'MSum' && a.label === b.label &&
      eqMVal(a.val, b.val);
  return false;
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

const showMCont = (cont: MCont): string => {
  if (cont.tag === 'MTop') return 'Top';
  if (cont.tag === 'MSeq')
    return `Seq(${cont.name}, ${showCComp(cont.body)}, ${showMLEnv(cont.env)}) : ${showMCont(cont.rest)}`;
  return impossible('showMCont');
};

interface MState {
  readonly comp: CComp;
  readonly env: MLEnv;
  readonly cont: MCont;
}
const MState = (comp: CComp, env: MLEnv, cont: MCont): MState =>
  ({ comp, env, cont });

const showMState = (st: MState): string =>
  `(${showCComp(st.comp)}, ${showMLEnv(st.env)}, ${showMCont(st.cont)})`;

const reifyVal = (genv: MGEnv, env: MLEnv, val: CVal): MVal | null => {
  if (val.tag === 'CVVar')
    return lookup(val.name, env) || genv[val.name] || null;
  if (val.tag === 'CVAbs') return MClos(val, env);
  if (val.tag === 'CVUnit') return MUnit;
  if (val.tag === 'CVFloat') return MFloat(val.val);
  if (val.tag === 'CVString') return MString(val.val);
  if (val.tag === 'CVPair') {
    const a = reifyVal(genv, env, val.fst);
    if (!a) return null;
    const b = reifyVal(genv, env, val.snd);
    if (!b) return null;
    return MPair(a, b);
  }
  if (val.tag === 'CVSum') {
    const v = reifyVal(genv, env, val.val);
    if (!v) return null;
    return MSum(val.label, v);
  }
  if (val.tag === 'CVEmbed') return val.val;
  return null;
};
const step = (genv: MGEnv, st: MState): MState | null => {
  const { comp, env, cont } = st;

  if (comp.tag === 'CCRet' && cont.tag === 'MSeq') {
    const v = reifyVal(genv, env, comp.val);
    if (!v) return null;
    return MState(cont.body, extend(cont.name, v, cont.env), cont.rest);
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
    return MState(CCRet(CVEmbed(MFloat(a.val + b.val))), env, cont);
  }
  if (comp.tag === 'CCAppend') {
    const a = reifyVal(genv, env, comp.left);
    if (!a || a.tag !== 'MString') return null;
    const b = reifyVal(genv, env, comp.right);
    if (!b || b.tag !== 'MString') return null;
    return MState(CCRet(CVEmbed(MString(a.val + b.val))), env, cont);
  }
  if (comp.tag === 'CCEq') {
    const a = reifyVal(genv, env, comp.left);
    if (!a) return null;
    const b = reifyVal(genv, env, comp.right);
    if (!b) return null;
    return MState(
      CCRet(
        CVEmbed(MSum(eqMVal(a, b) ? 'L' : 'R', MUnit))), env, cont);
  }
  if (comp.tag === 'CCSelect') {
    const v = reifyVal(genv, env, comp.val);
    if (!v || v.tag !== 'MPair') return null;
    const x = comp.label === 'fst' ? v.fst : v.snd;
    return MState(CCRet(CVEmbed(x)), env, cont);
  }
  if (comp.tag === 'CCCase') {
    const v = reifyVal(genv, env, comp.val);
    if (!v || v.tag !== 'MSum') return null;
    const x = v.label === 'L' ?
      MClos(CVAbs('x',
        CCRet(CVAbs('y', CCApp(CVVar('x'), CVEmbed(v.val))))), Nil) :
      MClos(CVAbs('x',
        CCRet(CVAbs('y', CCApp(CVVar('y'), CVEmbed(v.val))))), Nil);
    return MState(CCRet(CVEmbed(x)), env, cont);
  }
  return null;
};
const steps = (genv: MGEnv, st: MState): MState => {
  let s: MState | null = st;
  while (true) {
    const p: MState = s;
    log(() => showMState(p));
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
