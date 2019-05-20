import { Name, impossible, freshId } from './util';
import { Term, Pat } from './terms';
import { MVal, showMVal } from './machine';

export type CVal
  = CVVar
  | CVAbs
  | CVEmbed
  | CVUnit
  | CVFloat
  | CVPair
  | CVSum;
export type CComp
  = CCRet
  | CCApp
  | CCSeq
  | CCAdd
  | CCSelect
  | CCCase
  | CCEq;

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

export interface CVEmbed {
  readonly tag: 'CVEmbed';
  readonly val: MVal;
}
export const CVEmbed = (val: MVal): CVEmbed =>
  ({ tag: 'CVEmbed', val });

export interface CVUnit {
  readonly tag: 'CVUnit';
}
export const CVUnit: CVUnit = { tag: 'CVUnit' };

export interface CVFloat {
  readonly tag: 'CVFloat';
  readonly val: number;
}
export const CVFloat = (val: number): CVFloat =>
  ({ tag: 'CVFloat', val });

export interface CVPair {
  readonly tag: 'CVPair';
  readonly fst: CVal;
  readonly snd: CVal;
}
export const CVPair = (fst: CVal, snd: CVal): CVPair =>
  ({ tag: 'CVPair', fst, snd });

export interface CVSum {
  readonly tag: 'CVSum';
  readonly label: 'L' | 'R';
  readonly val: CVal;
}
export const CVSum = (label: 'L' | 'R', val: CVal): CVSum =>
  ({ tag: 'CVSum', label, val });

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

export interface CCAdd {
  readonly tag: 'CCAdd';
  readonly left: CVal;
  readonly right: CVal;
}
export const CCAdd = (left: CVal, right: CVal): CCAdd =>
  ({ tag: 'CCAdd', left, right });

export interface CCSelect {
  readonly tag: 'CCSelect';
  readonly label: 'fst' | 'snd';
  readonly val: CVal;
}
export const CCSelect = (label: 'fst' | 'snd', val: CVal): CCSelect =>
  ({ tag: 'CCSelect', label, val });

export interface CCCase {
  readonly tag: 'CCCase';
  readonly val: CVal;
}
export const CCCase = (val: CVal): CCCase =>
  ({ tag: 'CCCase', val });

export interface CCEq {
  readonly tag: 'CCEq';
  readonly left: CVal;
  readonly right: CVal;
}
export const CCEq = (left: CVal, right: CVal): CCEq =>
  ({ tag: 'CCEq', left, right });

export const showCVal = (c: CVal): string => {
  if (c.tag === 'CVVar') return c.name;
  if (c.tag === 'CVAbs')
    return `(\\${c.name} -> ${showCComp(c.body)})`;
  if (c.tag === 'CVUnit') return 'Unit';
  if (c.tag === 'CVFloat') return `${c.val}`;
  if (c.tag === 'CVPair')
    return `(${showCVal(c.fst)}, ${showCVal(c.snd)})`;
  if (c.tag === 'CVSum') return `(${c.label} ${showCVal(c.val)})`;
  if (c.tag === 'CVEmbed') return `(#embed ${showMVal(c.val)})`;
  return impossible('showCVal');
};
export const showCComp = (c: CComp): string => {
  if (c.tag === 'CCRet') return `(return ${showCVal(c.val)})`;
  if (c.tag === 'CCApp')
    return `(${showCVal(c.left)} ${showCVal(c.right)})`;
  if (c.tag === 'CCSeq')
    return `(${c.name} <- ${showCComp(c.val)}; ${showCComp(c.body)})`;
  if (c.tag === 'CCAdd')
    return `(${showCVal(c.left)} + ${showCVal(c.right)})`;
  if (c.tag === 'CCEq')
    return `(${showCVal(c.left)} == ${showCVal(c.right)})`;
  if (c.tag === 'CCSelect')
    return `(.${c.label} ${showCVal(c.val)})`;
  if (c.tag === 'CCCase')
    return `(? ${showCVal(c.val)})`;
  return impossible('showCComp');
};

const freshName = () => `_${freshId()}`;

export const isComp = (t: Term): boolean =>
  t.tag === 'Ann' ? isComp(t.term) :
  t.tag === 'App' || t.tag === 'Let';
export const isVal = (t: Term): boolean =>
  t.tag === 'Var' || t.tag === 'Abs' || t.tag === 'Lit';
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
  if (t.tag === 'Lit')
    return CVFloat(t.val);
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
