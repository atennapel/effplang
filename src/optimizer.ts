import { CComp, CVal, CVAbs, CCSeq, CVPair, CVSum, CCRet, CCAdd, CCAppend, CCApp, CCEq, CCShow, CCCase, CCSelect } from './core';

const optimizeValR = (v: CVal): CVal | null => {
  if (v.tag === 'CVAbs') {
    const b = optimizeCompR(v.body);
    return b ? CVAbs(v.name, b) : null;
  }
  if (v.tag === 'CVPair') {
    const a = optimizeValR(v.fst);
    const b = optimizeValR(v.snd);
    return a || b ? CVPair(a || v.fst, b || v.snd) : null;
  }
  if (v.tag === 'CVSum') {
    const a = optimizeValR(v.val);
    return a ? CVSum(v.label, a) : null;
  }
  return null;
};

const optimizeCompR = (c: CComp): CComp | null => {
  if (c.tag === 'CCRet') {
    const v = optimizeValR(c.val);
    return v ? CCRet(v) : null;
  }
  if (c.tag === 'CCAdd') {
    const a = optimizeValR(c.left);
    const b = optimizeValR(c.right);
    return a || b ? CCAdd(a || c.left, b || c.right) : null;
  }
  if (c.tag === 'CCAppend') {
    const a = optimizeValR(c.left);
    const b = optimizeValR(c.right);
    return a || b ? CCAppend(a || c.left, b || c.right) : null;
  }
  if (c.tag === 'CCApp') {
    const a = optimizeValR(c.left);
    const b = optimizeValR(c.right);
    return a || b ? CCApp(a || c.left, b || c.right) : null;
  }
  if (c.tag === 'CCEq') {
    const a = optimizeValR(c.left);
    const b = optimizeValR(c.right);
    return a || b ? CCEq(a || c.left, b || c.right) : null;
  }
  if (c.tag === 'CCShow') {
    const v = optimizeValR(c.val);
    return v ? CCShow(v) : null;
  }
  if (c.tag === 'CCCase') {
    const v = optimizeValR(c.val);
    return v ? CCCase(v) : null;
  }
  if (c.tag === 'CCSelect') {
    const v = optimizeValR(c.val);
    return v ? CCSelect(c.label, v) : null;
  }
  if (c.tag === 'CCSeq') {
    if (c.val.tag === 'CCSeq')
      return CCSeq(c.val.name, c.val.val, CCSeq(c.name, c.val.body, c.body));
    const a = optimizeCompR(c.val);
    const b = optimizeCompR(c.body);
    return a || b ? CCSeq(c.name, a || c.val, b || c.body) : null;
  }
  return null;
};

export const optimizeVal = (v: CVal): CVal => {
  let s: CVal | null = v;
  while (true) {
    const p: CVal = s;
    s = optimizeValR(s);
    if (!s) return p;
  }
};
export const optimizeComp = (c: CComp): CComp => {
  let s: CComp | null = c;
  while (true) {
    const p: CComp = s;
    s = optimizeCompR(s);
    if (!s) return p;
  }
};
