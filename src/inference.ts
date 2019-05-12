import { Type, prune, TFun, freshTMeta, TMeta, TApp, resetTMetaId, Free, freeTMeta, TVar, showType, TVarName, tEffEmpty, matchTFun, matchTEffExtend, TEffExtend, countTMeta, TMetaCount, flattenTEffExtend, teffExtendFrom, TCon, tEffExtend } from './types';
import { Term, Name, showTerm, Handler } from './terms';
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
const inst = (type: Type, map: { [key: string]: TMeta } = {}, canOpen: boolean = true): Type => {
  if (type.tag === 'TVar') {
    const name = type.name;
    if (map[name]) return map[name];
    const tv = freshTMeta(namePart(name));
    map[name] = tv;
    return tv;
  }
  if (type === tEffEmpty)
    return canOpen ? freshTMeta('e') : type;
  const m = matchTFun(type);
  if (m) {
    const l = inst(m.left, map, false);
    const r = inst(m.right, map, canOpen);
    const e = inst(m.effs, map, canOpen);
    return l === m.left && r === m.right && e === m.effs ? type :
      TFun(l, e, r);
  }
  const ex = matchTEffExtend(type);
  if (ex) {
    const e = inst(ex.eff, map, false);
    const r = inst(ex.rest, map, canOpen);
    return e === ex.eff && r === ex.rest ? type :
      TEffExtend(e, r);
  }
  if (type.tag === 'TApp') {
    const l = inst(type.left, map, false);
    const r = inst(type.right, map, false);
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
  const m = matchTFun(type);
  if (m) {
    const l = genR(m.left, free, count, map, names, false);
    const r = genR(m.right, free, count, map, names, canClose);
    const e = flattenTEffExtend(m.effs);
    const es = e.effs.map(t => genR(t, free, count, map, names, false));
    const et = e.rest.tag === 'TMeta' && canClose && count[e.rest.id] === 1 ?
      tEffEmpty :
      genR(e.rest, free, count, map, names, canClose);
    const ne = teffExtendFrom(es, et);
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

const inferHandler = (genv: GTEnv, handler: Handler, lenv: LTEnv, ret: TypeEff, ops: Name[] = []): TypeEff => {
  if (handler.tag === 'HOp') {
    if (ops.indexOf(handler.op) >= 0)
      return terr(`duplicate op in handler: ${handler.op}`);
    else ops.push(handler.op);
    const retty = inferHandler(genv, handler.rest, lenv, ret, ops);
    if (handler.op === 'flip') {
      const tunit = TCon('Unit');
      const tbool = TCon('Bool');
      const { type, eff } = infer(genv, handler.body, lenv);
      unify(eff, retty.eff);
      unify(type, TFun(tunit, tEffEmpty, TFun(TFun(tbool, retty.eff, retty.type), retty.eff, retty.type)));
      return retty;
    } else terr('only flip is supported');
    return retty;
  }
  if (handler.tag === 'HReturn') {
    if ((ops.length === 1 && ops[0] !== 'flip') || ops.length > 1)
      return terr('only support for flip atm');
    const { type, eff } = infer(genv, handler.body, lenv);
    const tv = freshTMeta();
    const te = freshTMeta();
    unify(ret.eff, TEffExtend(TCon('Flip'), te));
    unify(te, eff);
    unify(type, TFun(ret.type, te, tv));
    return { type: tv, eff: te };
  }
  return impossible('inferHandler');
};

export const infer = (genv: GTEnv, term: Term, lenv: LTEnv): TypeEff => {
  // console.log(`infer ${showTerm(term)} ${toString(lenv, ([x, t]) => `${x} : ${showType(t)}`)}`);
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
  if (term.tag === 'Handle') {
    const tyeff = infer(genv, term.term, lenv);
    return inferHandler(genv, term.handler, lenv, tyeff);
  }
  return impossible('infer');
};

export const typecheck = (genv: GTEnv, term: Term): { type: Type, eff: Type } => {
  resetTMetaId();
  const { type, eff } = infer(genv, term, Nil);
  const peff = prune(eff);
  return { type: gen(type, Nil), eff: peff };
};
