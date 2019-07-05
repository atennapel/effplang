import { Nil, each } from './list';
import { Term, showTerm, freshVarName } from './terms';
import { Type, prune, freshTMeta, TFun, generalize, instantiate, resetTMetaId, TMeta, TCon, instantiateTVars, InstMap, tapp1, skolemize, SkolMap, occursSkol, showTypePruned, Scheme, pruneScheme, tvars, showScheme, showType, freshTVarName, TVar } from './types';
import { impossible, terr } from './util';
import { unify, subsume } from './unification';
import { LTEnv, extend, lookup, gtenv, showLTEnv } from './env';
import { Def } from './definitions';
import { kType, resetKMetaId, kfunFrom, showKind, KMeta, freshKMeta, pruneKind } from './kinds';
import { log } from './config';
import { kindOf, inferKind, inferKindDef, unifyKinds, TVarKinds } from './kindinference';
import { CComp, CReturn, CVar, CAbs, CApp, CSeq, CCon, CDecon, CAbsT, showCore, CVal } from './core';
import { translateType, translateScheme, translateKind } from './translation';

const synth = (env: LTEnv, term: Term): [Type, () => CComp] => {
  log(() => `synth ${showTerm(term)} in ${showLTEnv(env)}`);
  if (term.tag === 'Var') {
    const type = lookup(env, term.name);
    if (!type) return terr(`undefined var ${term.name}`);
    return [instantiate(type), () => CReturn(CVar(term.name))];
  }
  if (term.tag === 'Abs') {
    const tv = freshTMeta(kType);
    const [tbody, body] = synth(extend(env, term.name, Scheme([], tv)), term.body);
    return [
      TFun(tv, tbody),
      () => CReturn(CAbs(term.name, translateType(tv), body())),
    ];
  }
  if (term.tag === 'App') {
    const [tfun, fun] = synth(env, term.left);
    const [targ, arg] = synth(env, term.right);
    const tv = freshTMeta(kType);
    unify(tfun, TFun(targ, tv));
    return [
      tv,
      () => {
        const l = fun();
        const r = arg();
        if (l.tag === 'CReturn' && r.tag === 'CReturn')
          return CApp(l.val, r.val);
        const x = freshVarName();
        if (l.tag === 'CReturn')
          return CSeq(x, r, CApp(l.val, CVar(x)));
        if (r.tag === 'CReturn')
          return CSeq(x, l, CApp(CVar(x), r.val));
        const y = freshVarName();
        return CSeq(x, l, CSeq(y, r, CApp(CVar(x), CVar(y))));
      },
    ];
  }
  if (term.tag === 'Let') {
    let atype: Scheme | null = null;
    if (term.type) atype = inferKind(term.type);
    const nenv = atype ? extend(env, term.name, atype) : env;
    const [tval, val] = synth(nenv, term.val);
    if (atype) {
      const skols: SkolMap = {};
      const itype = skolemize(atype, skols);
      unify(tval, itype, skols);
      each(env, ({ name, scheme }) => {
        if (occursSkol(skols, scheme.type))
          terr(`skolem escape in ${name} : ${showTypePruned(scheme.type)} in ${showTerm(term)}`);
      });
    }
    const type = atype || Scheme([], tval);
    const [tbody, body] = synth(extend(env, term.name, type), term.body);
    return [
      tbody,
      () => {
        const v = val();
        const b = body();
        const ty = translateScheme(type);
        if (v.tag === 'CReturn')
          return CApp(CAbs(term.name, ty, b), v.val);
        const x = freshVarName();
        return CSeq(x, v, CApp(CAbs(term.name, ty, b), CVar(x)));
      },
    ];
  }
  if (term.tag === 'Con') {
    if (!gtenv.cons[term.con])
      return terr(`undefined constructor ${term.con} in ${showTerm(term)}`);
    const con = gtenv.cons[term.con];
    const typeinfo = gtenv.types[term.con];
    const [targ, arg] = synth(env, term.body);
    const tms: InstMap = {};
    const type = instantiateTVars(con.params, con.type.type, tms);
    const skols: SkolMap = {};
    const itype = skolemize(Scheme(con.type.params, type), skols);
    unify(targ, itype, skols);
    each(env, ({ name, scheme }) => {
      if (occursSkol(skols, scheme.type))
        terr(`skolem escape in ${name} : ${showTypePruned(scheme.type)} in ${showTerm(term)}`);
    });
    return [
      tapp1(typeinfo.tcon, con.params.map(v => tms[v[0]])),
      () => {
        const ns: TVarKinds = {};
        for (let k in skols) skols[k].type = TVar(freshTVarName(ns, skols[k].name));
        const v = arg();
        if (v.tag === 'CReturn') 
          return CCon(term.con, con.type.params.reduce((p, [x, k]) => CAbsT(x, translateKind(k), CReturn(p)), v.val));
        const x = freshVarName();
        return CSeq(x, v, CCon(term.con, con.type.params.reduce((p, [x, k]) => CAbsT(x, translateKind(k), CReturn(p)), CVar(x) as CVal)));
      },
    ];
  }
  if (term.tag === 'Decon') {
    if (!gtenv.cons[term.con])
      return terr(`undefined constructor ${term.con} in ${showTerm(term)}`);
    const con = gtenv.cons[term.con];
    const typeinfo = gtenv.types[term.con];
    const [targ, arg] = synth(env, term.body);
    const tms: InstMap = {};
    const type = instantiateTVars(con.params, con.type.type, tms);
    unify(targ, tapp1(typeinfo.tcon, con.params.map(([v]) => tms[v])));
    return [
      instantiate(Scheme(con.type.params, type)),
      () => {
        const v = arg();
        if (v.tag === 'CReturn') return CDecon(term.con, v.val);
        const x = freshVarName();
        return CSeq(x, v, CDecon(term.con, CVar(x)));
      },
    ];
  }
  return impossible('synth');
};

export const infer = (term: Term, env: LTEnv = Nil): [Scheme, CComp] => {
  log(() => `infer ${showTerm(term)}`);
  resetTMetaId();
  const [type, cterm] = synth(env, term);
  const kind = kindOf(type);
  if (kind !== kType)
    return terr(`infered a type not of kind ${showKind(kType)}: ${showTypePruned(type)} : ${showKind(kind)}`);
  const scheme = pruneScheme(generalize(type));
  const comp = scheme.params.reduceRight((c, [x, k]) =>
    CReturn(CAbsT(x, translateKind(k), c)), cterm());
  return [scheme, comp];
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
      const [type, core] = infer(def.term);
      if (gtenv.vars[def.name])
        subsume(type, gtenv.vars[def.name]);
      else
        gtenv.vars[def.name] = type;
      log(() => `=> ${def.name}`);
      log(() => `=> ${showScheme(type)}`);
      log(() => `=> ${showCore(core)}`);
    }
  }
};
