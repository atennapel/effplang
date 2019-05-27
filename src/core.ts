import { Name, impossible, freshId } from './util';
import { Term } from './terms';
import { MVal, showMVal } from './machine';

export type CVal
  = CVVar
  | CVAbs
  | CVEmbed
  | CVUnit
  | CVFloat
  | CVString
  | CVPair
  | CVSum;
export type CComp
  = CCRet
  | CCApp
  | CCSeq
  | CCAdd
  | CCAppend
  | CCSelect
  | CCCase
  | CCEq
  | CCShow;

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

export interface CVString {
  readonly tag: 'CVString';
  readonly val: string;
}
export const CVString = (val: string): CVString =>
  ({ tag: 'CVString', val });

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

export interface CCAppend {
  readonly tag: 'CCAppend';
  readonly left: CVal;
  readonly right: CVal;
}
export const CCAppend = (left: CVal, right: CVal): CCAppend =>
  ({ tag: 'CCAppend', left, right });

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

export interface CCShow {
  readonly tag: 'CCShow';
  readonly val: CVal;
}
export const CCShow = (val: CVal): CCShow =>
  ({ tag: 'CCShow', val });

export const showCVal = (c: CVal): string => {
  if (c.tag === 'CVVar') return c.name;
  if (c.tag === 'CVAbs')
    return `(\\${c.name} -> ${showCComp(c.body)})`;
  if (c.tag === 'CVUnit') return 'Unit';
  if (c.tag === 'CVFloat') return `${c.val}`;
  if (c.tag === 'CVString') return JSON.stringify(c.val);
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
  if (c.tag === 'CCAppend')
    return `(${showCVal(c.left)} ++ ${showCVal(c.right)})`;
  if (c.tag === 'CCEq')
    return `(${showCVal(c.left)} == ${showCVal(c.right)})`;
  if (c.tag === 'CCSelect')
    return `(.${c.label} ${showCVal(c.val)})`;
  if (c.tag === 'CCCase')
    return `(? ${showCVal(c.val)})`;
  if (c.tag === 'CCShow')
    return `(#show ${showCVal(c.val)})`;
  return impossible('showCComp');
};

export type Free = { [key: string]: boolean };
export const freeCVal = (c: CVal, f: Free = {}): Free => {
  if (c.tag === 'CVVar') { f[c.name] = true; return f }
  if (c.tag === 'CVAbs') {
    freeCComp(c.body, f);
    f[c.name] = false;
    return f;
  }
  if (c.tag === 'CVUnit') return f;
  if (c.tag === 'CVFloat') return f;
  if (c.tag === 'CVString') return f;
  if (c.tag === 'CVPair') return freeCVal(c.snd, freeCVal(c.fst, f));
  if (c.tag === 'CVSum') return freeCVal(c.val, f);
  if (c.tag === 'CVEmbed') return f;
  return impossible('freeCVal');
};
export const freeCComp = (c: CComp, f: Free = {}): Free => {
  if (c.tag === 'CCRet') return freeCVal(c.val, f);
  if (c.tag === 'CCApp') return freeCVal(c.right, freeCVal(c.left, f));
  if (c.tag === 'CCSeq') return freeCComp(c.body, freeCComp(c.val, f));
  if (c.tag === 'CCAdd') return freeCVal(c.right, freeCVal(c.left, f));
  if (c.tag === 'CCAppend') return freeCVal(c.right, freeCVal(c.left, f));
  if (c.tag === 'CCEq') return freeCVal(c.right, freeCVal(c.left, f));
  if (c.tag === 'CCSelect') return freeCVal(c.val, f);
  if (c.tag === 'CCCase') return freeCVal(c.val, f);
  if (c.tag === 'CCShow') return freeCVal(c.val, f);
  return impossible('freeCComp');
};

const freshName = () => `_${freshId()}`;

export const isComp = (t: Term): boolean =>
  t.tag === 'Ann' ? isComp(t.term) :
  t.tag === 'App' || t.tag === 'Let';
export const isVal = (t: Term): boolean =>
  t.tag === 'Ann' ? isVal(t.term) :
  t.tag === 'Var' || t.tag === 'Abs' || t.tag === 'Lit';
export const termToVal = (t: Term): CVal => {
  if (t.tag === 'Ann') return termToVal(t.term);
  if (t.tag === 'Var') return CVVar(t.name);
  if (t.tag === 'Abs')
    return CVAbs(t.name, termToComp(t.body));
  if (t.tag === 'Lit')
    return typeof t.val === 'string' ? CVString(t.val) : CVFloat(t.val);
  return impossible('termToVal');
};
export const termToComp = (t: Term): CComp => {
  if (t.tag === 'Ann') return termToComp(t.term);
  if (isVal(t)) return CCRet(termToVal(t));
  if (t.tag === 'Let') {
    const x = t.name;
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
