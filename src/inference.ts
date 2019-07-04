import { Nil } from './list';
import { Term } from './terms';
import { Type, prune, freshTMeta, TFun, generalize, instantiate, resetTMetaId, TMeta } from './types';
import { impossible, terr } from './util';
import { unify } from './unification';
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
  return impossible('synth');
};

export const infer = (term: Term, env: LTEnv = Nil): Type => {
  resetTMetaId();
  return prune(generalize(synth(env, term)));
};

export const inferDefs = (ds: Def[]): void => {
  resetTMetaId();
  const added: { [name: string]: TMeta } = {};
  for (const def of ds) {
    if (gtenv.vars[def.name])
      return terr(`${def.name} is already defined`);
    const tv = freshTMeta();
    added[def.name] = tv;
    gtenv.vars[def.name] = tv;
  }
  for (const def of ds)
    unify(added[def.name], synth(Nil, def.term));
  for (let name in added) {
    if (added[name]) {
      gtenv.vars[name] = prune(generalize(gtenv.vars[name]));
    }
  }
};
