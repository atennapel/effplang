import { Nil, each } from './list';
import { Term, showTerm } from './terms';
import { Type, prune, freshTMeta, TFun, generalize, instantiate, resetTMetaId, TMeta, TCon, instantiateTVars, InstMap, tapp1, skolemize, SkolMap, occursSkol, showTypePruned } from './types';
import { impossible, terr } from './util';
import { unify, subsume } from './unification';
import { LTEnv, extend, lookup, gtenv } from './env';
import { Def } from './definitions';

const synth = (env: LTEnv, term: Term): Type => {
  if (term.tag === 'Var') {
    const type = lookup(env, term.name);
    if (!type) return terr(`undefined var ${term.name}`);
    return instantiate(type);
  }
  if (term.tag === 'Abs') {
    const tv = freshTMeta();
    const body = synth(extend(env, term.name, tv), term.body);
    return TFun(tv, body);
  }
  if (term.tag === 'App') {
    const fun = synth(env, term.left);
    const arg = synth(env, term.right);
    const tv = freshTMeta();
    unify(fun, TFun(arg, tv));
    return tv;
  }
  if (term.tag === 'Let') {
    const val = synth(env, term.val);
    if (term.type) {
      const skols: SkolMap = {};
      const itype = skolemize(term.type, skols);
      unify(val, itype, skols);
      each(env, ({ name, type }) => {
        if (occursSkol(skols, type))
          terr(`skolem escape in ${name} : ${showTypePruned(type)} in ${showTerm(term)}`);
      });
    }
    const type = term.type || val;
    return synth(extend(env, term.name, type), term.body);
  }
  if (term.tag === 'Con') {
    if (!gtenv.cons[term.con])
      return terr(`undefined constructor ${term.con} in ${showTerm(term)}`);
    const con = gtenv.cons[term.con];
    const arg = synth(env, term.body);
    const tms: InstMap = {};
    const type = instantiateTVars(con.params, con.type, tms);
    const skols: SkolMap = {};
    const itype = skolemize(type, skols);
    unify(arg, itype, skols);
    each(env, ({ name, type }) => {
      if (occursSkol(skols, type))
        terr(`skolem escape in ${name} : ${showTypePruned(type)} in ${showTerm(term)}`);
    });
    return tapp1(con.tcon, con.params.map(v => tms[v]));
  }
  if (term.tag === 'Decon') {
    if (!gtenv.cons[term.con])
      return terr(`undefined constructor ${term.con} in ${showTerm(term)}`);
    const con = gtenv.cons[term.con];
    const arg = synth(env, term.body);
    const tms: InstMap = {};
    const type = instantiateTVars(con.params, con.type, tms);
    unify(arg, tapp1(con.tcon, con.params.map(v => tms[v])));
    return instantiate(type);
  }
  return impossible('synth');
};

export const infer = (term: Term, env: LTEnv = Nil): Type => {
  resetTMetaId();
  return prune(generalize(synth(env, term)));
};

export const inferDefs = (ds: Def[]): void => {
  for (const def of ds) {
    if (def.tag === 'DType') {
      if (gtenv.cons[def.name])
        return terr(`${def.name} is already defined`);
      gtenv.cons[def.name] = {
        tcon: TCon(def.name),
        params: def.params,
        type: def.type,
      };
    }
  }
  for (const def of ds) {
    if (def.tag === 'DLet') {
      if (gtenv.vars[def.name])
        return terr(`${def.name} is already defined`);
      if (def.type)
        gtenv.vars[def.name] = def.type;
    }
  }
  for (const def of ds) {
    if (def.tag === 'DLet') {
      const type = infer(def.term);
      if (def.type)
        subsume(type, def.type);
      else
        gtenv.vars[def.name] = type;
    }
  }
};
