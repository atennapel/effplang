import { Env, Nil, tmetasEnv, each, lookup, extend } from './env';
import { Type, resetTMetaId, resetTSkolId, tmetas, TVar, freshTMetaId, tforall, prune, TSkol, hasAnyTSkol, showType, freshTMeta, isMono, TFun, isTMeta, isTFun, tfunL, tfunR } from './types';
import { Term, showTerm, flattenApp } from './terms';
import { terr } from './util';
import { log } from './config';
import { inst, skol, matchfun, subsume, unify } from './unification';

const generalize = (env: Env, t: Type): Type => {
  const tmsenv = tmetasEnv(env);
  const tms = tmetas(t, tmsenv);
  const l = tms.length;
  const tvs = Array(l);
  for (let i = 0; i < l; i++) {
    const c = tms[i];
    // TODO: fix naming
    const name = `t${freshTMetaId()}`;
    c.type = TVar(name);
    tvs[i] = name;
  }
  return tforall(tvs, prune(t));
};

const escapeCheckEnv = (sks: TSkol[], env: Env): void => {
  each(env, (k, v) => {
    if (hasAnyTSkol(sks, v))
      terr(`TSkol escaped in ${showType(v)} in ${k}`);
  });
};

export const infer = (t: Term, env: Env = Nil): Type => {
  resetTMetaId();
  resetTSkolId();
  return synth(env, t);
};

const synth = (env: Env, term: Term): Type => {
  log(() => `synth ${showTerm(term)}`);
  if (term.tag === 'Var') {
    const t = lookup(term.name, env);
    if (!t) return terr(`undefined var ${term.name}`);
    return t;
  }
  if (term.tag === 'Ann') {
    check(env, term.term, term.type);
    return term.type;
  }
  if (term.tag === 'App') {
    const f = flattenApp(term);
    const ty = synth(env, f.fn);
    const res = synthapp(env, ty, f.as);
    return generalize(env, res);
  }
  if (term.tag === 'Abs') {
    const a = term.type || freshTMeta();
    const ty = synth(extend(term.name, a, env), term.body);
    if (a.tag === 'TMeta' && a.type && !isMono(a.type))
      return terr(`poly type infered for abstraction argument ${showTerm(term)}: ${showType(a.type)}`);
    return generalize(env, TFun(a, inst(ty)));
  }
  return terr(`cannot synth ${showTerm(term)}`);
};
const check = (env: Env, term: Term, type: Type): void => {
  log(() => `check ${showTerm(term)} : ${showType(type)}`);
  if (term.tag === 'Abs' && !term.type) {
    const sks: TSkol[] = [];
    const itype = skol(type, sks);
    const m = matchfun(itype);
    check(extend(term.name, m.left, env), term.body, m.right);
    if (hasAnyTSkol(sks, type)) return terr(`TSkol escape in ${showTerm(term)} : ${showType(type)}`);
    escapeCheckEnv(sks, env);
    return;
  }
  if (term.tag === 'App') {
    const f = flattenApp(term);
    const ty = synth(env, f.fn);
    const res = synthapp(env, ty, f.as, type);
    subsume(res, type);
    return;
  }
  const ty = synth(env, term);
  subsume(ty, type);
};
const synthapp = (env: Env, type: Type, args: Term[], extype: Type | null = null): Type => {
  log(() => `synthapp ${showType(type)} @ [${args.map(showTerm).join(', ')}]${extype ? ` : ${showType(extype)}` : ''}`);
  if (args.length === 0) return type;
  const [pars, ret, resargs] = collectArgs(inst(type), args);
  if (extype && resargs.length === 0)
    (isTMeta(ret) ? unify : subsume)(ret, extype);
  while (pars.length > 0) {
    let found = false;
    for (let i = 0, l = pars.length; i < l; i++) {
      const [arg, party] = pars[i];
      if (!isTMeta(party)) {
        found = true;
        pars.splice(i, 1);
        check(env, arg, party);
        break;
      }
    }
    if (!found) {
      const [arg, party] = pars.shift() as [Term, Type];
      check(env, arg, party);
    }
  }
  return synthapp(env, ret, resargs);
};

const collectArgs = (f: Type, args: Term[], res: [Term, Type][] = []): [[Term, Type][], Type, Term[]] => {
  if (args.length === 0) return [res, f, args];
  if (f.tag === 'TMeta') {
    if (f.type) return collectArgs(f, args, res);
    const a = freshTMeta();
    const b = freshTMeta();
    f.type = TFun(a, b);
    const arg = args.shift();
    res.push([arg as Term, a]);
    return collectArgs(b, args, res);
  }
  if (isTFun(f)) {
    const arg = args.shift();
    res.push([arg as Term, tfunL(f)]);
    return collectArgs(tfunR(f), args, res);
  }
  return [res, f, args];
};
