import { LTEnv, globalenv } from './env';
import { Term, showTerm } from './terms';
import { Type, prune, showType, isTFun, tfunL, tfunR, freshTMeta, openTForall, TFun, tforall, tmetas, TMeta, TVar, tbinders, TCon, tfunFrom, tappFrom, tfun } from './types';
import { contextMark, contextDrop, contextAdd, ETVar, contextIndexOfTMeta, contextReplace2, contextAdd2, EMarker, showElem, showContext, resetContext } from './context';
import { Nil, extend, lookup } from './list';
import { log } from './config';
import { terr } from './util';
import { kType, Kind, eqKind, showKind, KMeta, freshKMeta, kfunFrom, kEffect } from './kinds';
import { Name, resetId, freshId } from './names';
import { subsume } from './subsumption';
import { inferKind, unifyKinds, pruneKindInType, pruneKindDefault } from './kindinference';
import { Def, showDefs } from './definitions';

const generalize = (m: EMarker, t: Type): Type => {
  log(() => `generalize ${showElem(m)} ${showType(t)} | ${showContext()}`);
  const dropped = contextDrop(m);
  const tms = tmetas(t, dropped.filter(t => t.tag === 'TMeta') as TMeta[]);
  const l = tms.length;
  if (l === 0) return t;
  const used = tbinders(t);
  const tvs: [Name, Kind][] = Array(l);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < l) {
    const x = tms[i].name;
    const v = x && !used[x] ? x :
      `${String.fromCharCode(k + 97)}${j > 0 ? j : ''}`;
    if (!used[v]) {
      used[v] = true;
      tms[i].type = TVar(v);
      tvs[i] = [v, tms[i].kind];
      i++;
    }
    k = (k + 1) % 26;
    if (k === 0) j++;
  }
  return tforall(tvs, prune(t));
};

export const infer = (term: Term): Type => {
  log(() => `infer ${showTerm(term)}`);
  resetId();
  resetContext();
  const m = contextMark();
  const ty = synth(Nil, term);
  return generalize(m, ty);
};

const synth = (env: LTEnv, term: Term): Type => {
  log(() => `synth ${showTerm(term)}`);
  if (term.tag === 'Var') {
    const lty = lookup(env, term.name);
    if (lty) return lty;
    const gty = globalenv.vars[term.name];
    if (!gty) return terr(`undefined var ${term.name}`);
    return gty.type;
  }
  if (term.tag === 'Ann') {
    const [kind, type] = inferKind(term.type);
    if (!eqKind(kind, kType))
      return terr(`type not of kind ${showKind(kType)} in ${showTerm(term)}`);
    check(env, term.term, type);
    let ty = type;
    for (let i = 0, l = term.ts.length; i < l; i++) {
      const [kc, c] = inferKind(term.ts[i]);
      if (ty.tag !== 'TForall')
        return terr(`not a forall in ${showTerm(term)}`);
      if (!eqKind(kc, ty.kind || kType))
        return terr(`kind mismatch (${showKind(ty.kind || kType)} != ${showKind(kc)}) in type application (${showType(ty)} @(${showType(c)})) in ${showTerm(term)}`);
      ty = openTForall(c, ty);
    }
    return ty;
  }
  if (term.tag === 'App') {
    const f = synth(env, term.left);
    return synthapp(env, f, term.right);
  }
  if (term.tag === 'Abs') {
    const a = freshTMeta(kType);
    const b = freshTMeta(kType);
    const m = contextMark();
    contextAdd2(a, b);
    check(extend(env, term.name, a), term.body, b);
    return generalize(m, TFun(a, b));
  }
  return terr(`cannot synth ${showTerm(term)}`);
};

const check = (env: LTEnv, term: Term, type: Type): void => {
  log(() => `check ${showTerm(term)} : ${showType(type)}`);
  if (type.tag === 'TForall') {
    const m = contextMark();
    contextAdd(ETVar(type.name, type.kind || kType));
    check(env, term, type.type);
    contextDrop(m);
    return;
  }
  if (term.tag === 'Abs' && isTFun(type)) {
    const m = contextMark();
    check(extend(env, term.name, tfunL(type)), term.body, tfunR(type));
    contextDrop(m);
    return;
  }
  const ty = synth(env, term);
  subsume(ty, type)
};

const synthapp = (env: LTEnv, type: Type, term: Term): Type => {
  log(() => `synthapp ${showType(type)} @ ${showTerm(term)}`);
  if (type.tag === 'TForall') {
    const tm = freshTMeta(type.kind || kType, type.name);
    contextAdd(tm);
    return synthapp(env, openTForall(tm, type), term);
  }
  if (isTFun(type)) {
    check(env, term, tfunL(type));
    return tfunR(type);
  }
  if (type.tag === 'TMeta') {
    if (type.type) return synthapp(env, type.type, term);
    const i = contextIndexOfTMeta(type);
    if (i < 0) return terr(`undefined tmeta ${showType(type)}`);
    const a = freshTMeta(kType);
    const b = freshTMeta(kType);
    contextReplace2(i, a, b);
    type.type = TFun(a, b);
    check(env, term, a);
    return b;
  }
  return terr(`cannot synthapp ${showType(type)} @ ${showTerm(term)}`);
};

const pickName = (xs: string[], x: string): string => {
  if (xs.indexOf(x) < 0) return x;
  let n = 0;
  while (true) {
    const xn = `${x}${n}`;
    if (xs.indexOf(xn) < 0) return xn;
    n++;
  }
};

export const inferDefs = (ds: Def[]): void => {
  log(() => `inferDefs ${showDefs(ds)}`);
  resetId();
  resetContext();

  const tvars: { [key: string]: [Name, Kind][] } = {};

  // add kinds of types/effects to env
  for (let d of ds) {
    if (d.tag !== 'DType' && d.tag !== 'DEffect') continue;
    if (globalenv.types[d.name]) return terr(`duplicate type ${d.name}`);
    const con = TCon(d.name);
    const tvs: [Name, Kind][] = [];
    const ks: Kind[] = d.params.map(([x, k]) => {
      const ki = k || freshKMeta();
      tvs.push([x, ki]);
      return ki;
    });
    tvars[d.name] = tvs;
    ks.push(d.tag === 'DType' ? kType : kEffect);
    const kind = kfunFrom(ks);
    globalenv.types[d.name] = { con, kind };
  }

  // infer constructors
  for (let d of ds) {
    if (d.tag === 'DType') {
      log(() => `inferType ${d.name}`);
      const cname = `?${d.name}`;
      if (globalenv.vars[cname]) return terr(`duplicate case function ${cname}`);
      const m = contextMark();
      for (let [x, k] of tvars[d.name]) contextAdd(ETVar(x, k));
      const tconapp = tappFrom([globalenv.types[d.name].con as Type].concat(tvars[d.name].map(([x, _]) => TVar(x))));
      for (let [c, ts] of d.cons) {
        if (globalenv.vars[c]) return terr(`duplicate constructor ${c}`);
        log(() => `inferCon ${c}`);
        const tys: Type[] = [];
        for (let t of ts) {
          const [k, ty] = inferKind(t);
          unifyKinds(k, kType);
          tys.push(ty);
        }
        tys.push(tconapp);
        globalenv.vars[c] = {
          type: tforall(tvars[d.name], tfunFrom(tys)),
        };
      }
      globalenv.types[d.name].kind = pruneKindDefault(globalenv.types[d.name].kind);
      for (let [c, _] of d.cons)
        globalenv.vars[c].type = pruneKindInType(globalenv.vars[c].type);
      const r = pickName(tvars[d.name].map(x => x[0]), 'r');
      const tr = TVar(r);
      const type = pruneKindInType(tforall(
        tvars[d.name].concat([[r, kType]]),
        tfunFrom([tconapp].concat(d.cons.map(([_, ts]) =>
          ts.length === 0 ? tfun(TCon('Unit'), tr) : tfunFrom(ts.concat(tr))
        ), tr)),
      ));
      globalenv.vars[cname] = { type };
      contextDrop(m);
    } else if (d.tag === 'DEffect') {
      log(() => `inferEffect ${d.name}`);
      const hname = `!${d.name}`;
      if (globalenv.vars[hname]) return terr(`duplicate handler function ${hname}`);
      const m = contextMark();
      for (let [x, k] of tvars[d.name]) contextAdd(ETVar(x, k));
      const tconapp = tappFrom([globalenv.types[d.name].con as Type].concat(tvars[d.name].map(([x, _]) => TVar(x))));
      for (let [c, t1, t2] of d.ops) {
        const opname = `#${c}`;
        if (globalenv.vars[opname]) return terr(`duplicate constructor ${opname}`);
        log(() => `inferOp ${c}`);
        const [k1, ty1] = inferKind(t1);
        unifyKinds(k1, kType);
        const [k2, ty2] = inferKind(t2);
        unifyKinds(k2, kType);
        globalenv.vars[opname] = {
          type: tforall(tvars[d.name], tfun(ty1, ty2)),
        };
      }
      globalenv.types[d.name].kind = pruneKindDefault(globalenv.types[d.name].kind);
      for (let [c, _] of d.ops) {
        const opname = `#${c}`;
        globalenv.vars[opname].type = pruneKindInType(globalenv.vars[opname].type);
      }
      const a = pickName(tvars[d.name].map(x => x[0]), 'a');
      const ta = TVar(a);
      const b = pickName(tvars[d.name].map(x => x[0]), 'b');
      const tb = TVar(b);
      const type = pruneKindInType(tforall(
        tvars[d.name].concat([[a, kType], [b, kType]]),
        tfunFrom([tfun(TCon('Unit'), ta)].concat(d.ops.map(([_, t1, t2]) =>
          tfun(t1, tfun(t2, tb), tb)
        ), tfun(ta, tb), tb)),
      ));
      globalenv.vars[hname] = { type };
      contextDrop(m);
    }
  }

  // add types to env
  for (let d of ds) {
    if (d.tag !== 'DLet') continue;
    if (globalenv.vars[d.name]) return terr(`duplicate let ${d.name}`);
    if (d.type) {
      const [kind, type] = inferKind(d.type);
      if (!eqKind(kind, kType))
        return terr(`type annotation for ${d.name} is not of kind ${showKind(kType)}`);
      globalenv.vars[d.name] = { type };
    }
  }

  // infer bodies
  for (let d of ds) {
    if (d.tag !== 'DLet') continue;
    log(() => `inferDef ${d.name}`);
    if (globalenv.vars[d.name]) {
      // check type
      const oldtype = globalenv.vars[d.name].type;
      const m = contextMark();
      check(Nil, d.val, oldtype);
      contextDrop(m);
    } else {
      // synth type
      const m = contextMark();
      const mv = freshTMeta(kType);
      contextAdd(mv);
      const ty = synth(extend(Nil, d.name, mv), d.val);
      const type = prune(generalize(m, ty));
      globalenv.vars[d.name] = { type };
    }
  }
};
