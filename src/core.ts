import { Name, impossible, freshId } from './util';
import { Term, Pat } from './terms';

export type CVal = CVVar | CVAbs;
export type CComp = CCRet | CCApp | CCSeq;

export interface CVVar {
  readonly tag: 'CVVar';
  readonly name: Name;
}
export const CVVar = (name: Name): CVVar =>
  ({ tag: 'CVVar', name });

export interface CVAbs {
  readonly tag: 'CVAbs';
  readonly name: Name;
  readonly body: CComp;
}
export const CVAbs = (name: Name, body: CComp): CVAbs =>
  ({ tag: 'CVAbs', name, body });

export interface CCRet {
  readonly tag: 'CCRet';
  readonly val: CVal;
}
export const CCRet = (val: CVal): CCRet =>
  ({ tag: 'CCRet', val });

export interface CCApp {
  readonly tag: 'CCApp';
  readonly left: CVal;
  readonly right: CVal;
}
export const CCApp = (left: CVal, right: CVal): CCApp =>
  ({ tag: 'CCApp', left, right });

export interface CCSeq {
  readonly tag: 'CCSeq';
  readonly name: Name;
  readonly val: CComp;
  readonly body: CComp;
}
export const CCSeq = (
  name: Name,
  val: CComp,
  body: CComp,
): CCSeq =>
  ({ tag: 'CCSeq', name, val, body });

export const showCVal = (c: CVal): string => {
  if (c.tag === 'CVVar') return c.name;
  if (c.tag === 'CVAbs')
    return `\\${c.name} -> ${showCComp(c.body)}`;
  return impossible('showCVal');
};
export const showCComp = (c: CComp): string => {
  if (c.tag === 'CCRet') return `return ${showCVal(c.val)}`;
  if (c.tag === 'CCApp')
    return `(${showCVal(c.left)}) ${showCVal(c.right)}`;
  if (c.tag === 'CCSeq')
    return `(${c.name} <- ${showCComp(c.val)}; ${showCComp(c.body)})`;
  return impossible('showCComp');
};

const freshName = () => `_${freshId()}`;

export const isComp = (t: Term): boolean =>
  t.tag === 'Ann' ? isComp(t.term) :
  t.tag === 'App' || t.tag === 'Let';
export const isVal = (t: Term): boolean =>
  t.tag === 'Var' || t.tag === 'Abs'
export const patToCore = (p: Pat): Name => {
  if (p.tag === 'PWildcard') return '_';
  if (p.tag === 'PAnn') return patToCore(p.pat);
  if (p.tag === 'PVar') return p.name;
  return impossible('patToCore');
};
export const termToVal = (t: Term): CVal => {
  if (t.tag === 'Var') return CVVar(t.name);
  if (t.tag === 'Abs')
    return CVAbs(patToCore(t.pat), termToComp(t.body));
  return impossible('termToVal');
};
export const termToComp = (t: Term): CComp => {
  if (t.tag === 'Ann') return termToComp(t.term);
  if (isVal(t)) return CCRet(termToVal(t));
  if (t.tag === 'Let') {
    const x = patToCore(t.pat);
    const a = termToComp(t.val);
    const b = termToComp(t.body);
    return CCSeq(x, a, b);
  }
  if (t.tag === 'App') {
    if (isVal(t.left)) {
      if (isVal(t.right)) {
        const a = termToVal(t.left);
        const b = termToVal(t.right);
        return CCApp(a, b);
      } else {
        const a = termToVal(t.left);
        const b = termToComp(t.right);
        const x = freshName();
        return CCSeq(x, b, CCApp(a, CVVar(x)));
      }
    } else if (isVal(t.right)) {
      const a = termToComp(t.left);
      const b = termToVal(t.right);
      const x = freshName();
      return CCSeq(x, a, CCApp(CVVar(x), b));
    } else {
      const a = termToComp(t.left);
      const b = termToComp(t.right);
      const x = freshName();
      const y = freshName();
      return CCSeq(x, a, CCSeq(y, b, CCApp(CVVar(x), CVVar(y))));
    }
  }
  return impossible('termToComp');
};
