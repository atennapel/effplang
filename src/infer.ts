import { resetTMetaId, Name } from './name';
import { Term } from './terms';
import { Type, prune, freshTMeta, TFun, TMeta, tRowEmpty, TApp, TRow, isTFun, tfunLeft, tfunRight, tfunEff, isTRow, trowType, trowLabel, trowRest, freeTMeta, Free, TMetaCount, TVar, countTMeta, flattenTRow, trow, Label } from './types';
import { List, lookup, extend, Nil, each } from './list';
import { impossible, terr } from './util';
import { unify } from './unify';

export interface TypeEff { type: Type, eff: Type };
const TypeEff = (type: Type, eff: Type): TypeEff =>
  ({ type, eff });

type LTEnv = List<[Name, Type]>;

const namePart = (name: Name): Name => {
  const d = name.match(/[0-9]$/);
  if (!d) return name;
  return name.slice(0, -d[0].length);
};
const inst = (type: Type, map: { [key: string]: TMeta } = {}, canOpen: boolean = true): Type => {
  if (type.tag === 'TVar') {
    const name = type.name;
    if (map[name]) return map[name];
    const tv = freshTMeta(namePart(name));
    map[name] = tv;
    return tv;
  }
  if (type === tRowEmpty)
    return canOpen ? freshTMeta('e') : type;
  if (isTFun(type)) {
    const l = inst(tfunLeft(type), map, false);
    const r = inst(tfunRight(type), map, canOpen);
    const e = inst(tfunEff(type), map, canOpen);
    return TFun(l, e, r);
  }
  if (isTRow(type)) {
    const e = inst(trowType(type), map, false);
    const r = inst(trowRest(type), map, canOpen);
    return TRow(trowLabel(type), e, r);
  }
  if (type.tag === 'TApp') {
    const l = inst(type.left, map, false);
    const r = inst(type.right, map, false);
    return TApp(l, r);
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
  count: TMetaCount,
  map: { [key: string]: TVar } = {},
  names: { [key: string]: number } = {},
  canClose: boolean = true,
): Type => {
  if (type.tag === 'TMeta') {
    if (type.type) return genR(type.type, free, count, map, names, canClose);
    if (free[type.id]) return type;
    if (map[type.id]) return map[type.id];
    const tv = TVar(genName(type, names));
    map[type.id] = tv;
    return tv;
  }
  if (isTFun(type)) {
    const l = genR(tfunLeft(type), free, count, map, names, false);
    const r = genR(tfunRight(type), free, count, map, names, canClose);
    const e = flattenTRow(tfunEff(type));
    const es: [Label, Type][] = e.labels.map(([l, t]) =>
      [l, genR(t, free, count, map, names, false)]);
    const et = e.rest.tag === 'TMeta' && canClose && count[e.rest.id] === 1 ?
      tRowEmpty :
      genR(e.rest, free, count, map, names, canClose);
    const ne = trow(es, et);
    return TFun(l, ne, r);
  }
  if (type.tag === 'TApp') {
    const l = genR(type.left, free, count, map, names, false);
    const r = genR(type.right, free, count, map, names, false);
    return l === type.left && r === type.right ? type :
      TApp(l, r);
  }
  return type;
};
const gen = (type: Type, lenv: LTEnv): Type => {
  // console.log(`gen ${showType(type)}`);
  const free = freeTMetaInLTEnv(lenv);
  const ty = prune(type);
  const count = countTMeta(ty);
  return genR(ty, free, count);
};

export const infer = (lenv: LTEnv, term: Term): TypeEff => {
  // console.log(`infer ${showTerm(term)} ${toString(lenv, ([x, t]) => `${x} : ${showType(t)}`)}`);
  if (term.tag === 'Var') {
    const ty = lookup(lenv, term.name);
    if (!ty) return terr(`undefined var ${term.name}`);
    const i = inst(ty);
    return TypeEff(i, freshTMeta('e'));
  }
  if (term.tag === 'Abs') {
    const tv = freshTMeta();
    const { type, eff } = infer(extend(term.name, tv, lenv), term.body);
    return TypeEff(TFun(tv, eff, type), freshTMeta('e'));
  }
  if (term.tag === 'App') {
    const { type: tleft, eff: effleft } = infer(lenv, term.left);
    const { type: tright, eff: effright } = infer(lenv, term.right);
    const tv = freshTMeta();
    unify(effleft, effright);
    unify(tleft, TFun(tright, effright, tv));
    return TypeEff(tv, effleft);
  }
  if (term.tag === 'Let') {
    const tv = freshTMeta();
    const { type, eff } = infer(extend(term.name, tv, lenv), term.val);
    unify(tv, type);
    const res = infer(extend(term.name, prune(tv), lenv), term.body);
    unify(res.eff, eff);
    return res;
  }
  return impossible('infer');
};

export const typecheck = (term: Term): TypeEff => {
  resetTMetaId();
  const { type, eff } = infer(Nil, term);
  const gtype = gen(type, Nil);
  return TypeEff(gtype, prune(eff));
};
