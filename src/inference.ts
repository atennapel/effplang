import { Type, prune, TFun, freshTMeta, TMeta, TApp, resetTMetaId, Free, freeTMeta, TVar, showType, TVarName, tEffEmpty } from './types';
import { Term, Name, showTerm } from './terms';
import { impossible, terr } from './util';
import { List, Nil, lookup, extend, each, toString } from './List';
import { unify } from './unification';

export interface TypeEff { type: Type, eff: Type };

export type GTEnv = { [key: string]: Type };
type LTEnv = List<[Name, Type]>;

const namePart = (name: TVarName): TVarName => {
  const d = name.match(/[0-9]$/);
  if (!d) return name;
  return name.slice(0, -d[0].length);
};
const inst = (type: Type, map: { [key: string]: TMeta } = {}): Type => {
  if (type.tag === 'TVar') {
    const name = type.name;
    if (map[name]) return map[name];
    const tv = freshTMeta(namePart(name));
    map[name] = tv;
    return tv;
  }
  if (type.tag === 'TApp') {
    const l = inst(type.left, map);
    const r = inst(type.right, map);
    return l === type.left && r === type.right ? type :
      TApp(l, r);
  }
  return type;
};

const freeTMetaInLTEnv = (lenv: LTEnv, map: Free = {}): Free => {
  each(lenv, ([_, t]) => freeTMeta(t, map));
  return map;
};
const genName = (m: TMeta, names: { [key: string]: number } = {}): string => {
  const name = m.name || 't';
  const i = names[name] || 0;
  names[name] = i + 1;
  return `${name}${i === 0 ? '' : `${i - 1}`}`;
};
const genR = (
  type: Type,
  free: Free,
  map: { [key: string]: TVar } = {},
  names: { [key: string]: number } = {},
): Type => {
  if (type.tag === 'TMeta') {
    if (type.type) return genR(type.type, free, map, names);
    if (free[type.id]) return type;
    if (map[type.id]) return map[type.id];
    const tv = TVar(genName(type, names));
    map[type.id] = tv;
    return tv;
  }
  if (type.tag === 'TApp') {
    const l = genR(type.left, free, map, names);
    const r = genR(type.right, free, map, names);
    return l === type.left && r === type.right ? type :
      TApp(l, r);
  }
  return type;
};
const gen = (type: Type, lenv: LTEnv): Type => {
  // console.log(`gen ${showType(type)}`);
  const free = freeTMetaInLTEnv(lenv);
  return genR(type, free);
};

export const infer = (genv: GTEnv, term: Term, lenv: LTEnv): TypeEff => {
  console.log(`infer ${showTerm(term)} ${toString(lenv, ([x, t]) => `${x} : ${showType(t)}`)}`);
  if (term.tag === 'Var') {
    const ty = lookup(lenv, term.name) || genv[term.name];
    if (!ty) return terr(`undefined var ${term.name}`);
    const i = inst(ty);
    return { type: i, eff: freshTMeta('e') };
  }
  if (term.tag === 'Abs') {
    const tv = freshTMeta();
    const { type, eff } = infer(genv, term.body, extend(term.name, tv, lenv));
    return { type: TFun(tv, eff, type), eff: freshTMeta('e') };
  }
  if (term.tag === 'App') {
    const { type: tleft, eff: effleft } = infer(genv, term.left, lenv);
    const { type: tright, eff: effright } = infer(genv, term.right, lenv);
    const tv = freshTMeta();
    unify(effleft, effright);
    unify(tleft, TFun(tright, effright, tv));
    return { type: tv, eff: effleft };
  }
  if (term.tag === 'Let') {
    const tv = freshTMeta();
    const { type, eff } = infer(genv, term.val, extend(term.name, tv, lenv));
    unify(tv, type);
    const gty = gen(type, lenv);
    const res = infer(genv, term.body, extend(term.name, gty, lenv));
    unify(res.eff, eff);
    return res;
  }
  return impossible('infer');
};

export const typecheck = (genv: GTEnv, term: Term): { type: Type, eff: Type } => {
  resetTMetaId();
  const { type, eff } = infer(genv, term, Nil);
  return { type: gen(prune(type), Nil), eff: prune(eff) };
};
