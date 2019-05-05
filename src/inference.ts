import { Type, prune, TFun, freshTMeta, TMeta, TApp } from './types';
import { Term, Name } from './terms';
import { impossible, terr } from './util';
import { List, Nil, lookup, extend } from './List';
import { unify } from './unification';

export type GTEnv = { [key: string]: Type };
type LTEnv = List<[Name, Type]>;

const inst = (type: Type, map: { [key: string]: TMeta } = {}): Type => {
  if (type.tag === 'TVar') {
    const name = type.name;
    if (map[name]) return map[name];
    const tv = freshTMeta(name);
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

export const infer = (genv: GTEnv, term: Term, lenv: LTEnv): Type => {
  if (term.tag === 'Var') {
    const ty = lookup(lenv, term.name) || genv[term.name];
    if (!ty) return terr(`undefined var ${term.name}`);
    return inst(ty);
  }
  if (term.tag === 'Abs') {
    const tv = freshTMeta();
    const ty = infer(genv, term.body, extend(term.name, tv, lenv));
    return TFun(tv, ty);
  }
  if (term.tag === 'App') {
    const left = infer(genv, term.left, lenv);
    const right = infer(genv, term.right, lenv);
    const tv = freshTMeta();
    unify(left, TFun(right, tv));
    return tv;
  }
  if (term.tag === 'Let') {
    const ty = infer(genv, term.val, lenv);
    return infer(genv, term.body, extend(term.name, ty, lenv));
  }
  return impossible('infer');
};

export const typecheck = (genv: GTEnv, term: Term): Type => {
  const ty = infer(genv, term, Nil);
  return prune(ty);
};
