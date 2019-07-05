import { Nil, each } from './list';
import { Term, showTerm } from './terms';
import { Type, prune, freshTMeta, TFun, generalize, instantiate, resetTMetaId, TMeta, TCon, instantiateTVars, InstMap, tapp1, skolemize, SkolMap, occursSkol, showTypePruned, Scheme, pruneScheme, tvars, showScheme, showType } from './types';
import { impossible, terr } from './util';
import { unify, subsume } from './unification';
import { LTEnv, extend, lookup, gtenv, showLTEnv } from './env';
import { Def } from './definitions';
import { kType, resetKMetaId, kfunFrom, showKind, KMeta, freshKMeta, pruneKind } from './kinds';
import { log } from './config';
import { kindOf, inferKind, inferKindDef, unifyKinds } from './kindinference';

const synth = (env: LTEnv, term: Term): Type => {
  log(() => `synth ${showTerm(term)} in ${showLTEnv(env)}`);
  if (term.tag === 'Var') {
    const type = lookup(env, term.name);
    if (!type) return terr(`undefined var ${term.name}`);
    return instantiate(type);
  }
  if (term.tag === 'Abs') {
    const tv = freshTMeta(kType);
    const body = synth(extend(env, term.name, Scheme([], tv)), term.body);
    return TFun(tv, body);
  }
  if (term.tag === 'App') {
    const fun = synth(env, term.left);
    const arg = synth(env, term.right);
    const tv = freshTMeta(kType);
    unify(fun, TFun(arg, tv));
    return tv;
  }
  if (term.tag === 'Let') {
    let atype: Scheme | null = null;
    if (term.type) atype = inferKind(term.type);
    const nenv = atype ? extend(env, term.name, atype) : env;
    const val = synth(nenv, term.val);
    if (atype) {
      const skols: SkolMap = {};
      const itype = skolemize(atype, skols);
      unify(val, itype, skols);
      each(env, ({ name, scheme }) => {
        if (occursSkol(skols, scheme.type))
          terr(`skolem escape in ${name} : ${showTypePruned(scheme.type)} in ${showTerm(term)}`);
      });
    }
    const type = atype || Scheme([], val);
    return synth(extend(env, term.name, type), term.body);
  }
  if (term.tag === 'Con') {
    if (!gtenv.cons[term.con])
      return terr(`undefined constructor ${term.con} in ${showTerm(term)}`);
    const con = gtenv.cons[term.con];
    const typeinfo = gtenv.types[term.con];
    const arg = synth(env, term.body);
    const tms: InstMap = {};
    const type = instantiateTVars(con.params, con.type.type, tms);
    const skols: SkolMap = {};
    const itype = skolemize(Scheme(con.type.params, type), skols);
    unify(arg, itype, skols);
    each(env, ({ name, scheme }) => {
      if (occursSkol(skols, scheme.type))
        terr(`skolem escape in ${name} : ${showTypePruned(scheme.type)} in ${showTerm(term)}`);
    });
    return tapp1(typeinfo.tcon, con.params.map(v => tms[v[0]]));
  }
  if (term.tag === 'Decon') {
    if (!gtenv.cons[term.con])
      return terr(`undefined constructor ${term.con} in ${showTerm(term)}`);
    const con = gtenv.cons[term.con];
    const typeinfo = gtenv.types[term.con];
    const arg = synth(env, term.body);
    const tms: InstMap = {};
    const type = instantiateTVars(con.params, con.type.type, tms);
    unify(arg, tapp1(typeinfo.tcon, con.params.map(([v]) => tms[v])));
    return instantiate(Scheme(con.type.params, type));
  }
  return impossible('synth');
};

export const infer = (term: Term, env: LTEnv = Nil): Scheme => {
  log(() => `infer ${showTerm(term)}`);
  resetTMetaId();
  const type = synth(env, term);
  const kind = kindOf(type);
  if (kind !== kType)
    return terr(`infered a type not of kind ${showKind(kType)}: ${showTypePruned(type)} : ${showKind(kind)}`);
  return pruneScheme(generalize(type));
};

export const inferDefs = (ds: Def[]): void => {
  resetKMetaId();
  for (const def of ds) {
    if (def.tag === 'DType') {
      if (gtenv.types[def.name])
        return terr(`type ${def.name} is already defined`);
      const tcon = TCon(def.name);
      const kv = freshKMeta();
      gtenv.types[def.name] = {
        tcon,
        kind: kv,
      };
      const [params, scheme] = inferKindDef(def);
      const ks = params.map(([_, k]) => k);
      ks.push(kType);
      unifyKinds(kv, kfunFrom(ks));
      gtenv.types[def.name].kind = pruneKind(gtenv.types[def.name].kind);
      gtenv.cons[def.name] = {
        params: params,
        type: scheme,
      };
    }
  }
  for (const def of ds) {
    if (def.tag === 'DLet') {
      if (gtenv.vars[def.name])
        return terr(`${def.name} is already defined`);
      if (def.type) {
        const scheme = inferKind(def.type);
        gtenv.vars[def.name] = scheme;
      }
    }
  }
  for (const def of ds) {
    if (def.tag === 'DLet') {
      const type = infer(def.term);
      if (gtenv.vars[def.name])
        subsume(type, gtenv.vars[def.name]);
      else
        gtenv.vars[def.name] = type;
    }
  }
};
