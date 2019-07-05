import { TConName, TVarName } from './types';
import { KConName } from './kinds';
import { VarName } from './terms';
import { impossible } from './util';

export type CKind = CKCon | CKFun;
export type CType = CTCon | CTVar | CTApp | CTForall;
export type CVal = CVar | CAbs | CAbsT;
export type CComp = CReturn | CApp | CAppT | CSeq | CCon | CDecon;

export interface CKCon { readonly tag: 'CKCon'; readonly name: KConName }
export const CKCon = (name: KConName): CKCon => ({ tag: 'CKCon', name });
export interface CKFun { readonly tag: 'CKFun'; readonly left: CKind; readonly right: CKind }
export const CKFun = (left: CKind, right: CKind): CKFun => ({ tag: 'CKFun', left, right });

export interface CTCon { readonly tag: 'CTCon'; readonly name: TConName }
export const CTCon = (name: TConName): CTCon => ({ tag: 'CTCon', name });
export interface CTVar { readonly tag: 'CTVar'; readonly name: TVarName }
export const CTVar = (name: TVarName): CTVar => ({ tag: 'CTVar', name });
export interface CTApp { readonly tag: 'CTApp'; readonly left: CType; readonly right: CType }
export const CTApp = (left: CType, right: CType): CTApp => ({ tag: 'CTApp', left, right });
export interface CTForall { readonly tag: 'CTForall'; readonly name: TVarName; readonly kind: CKind; readonly type: CType }
export const CTForall = (name: TVarName, kind: CKind, type: CType): CTForall => ({ tag: 'CTForall', name, kind, type });

export interface CVar { readonly tag: 'CVar'; readonly name: VarName }
export const CVar = (name: VarName): CVar => ({ tag: 'CVar', name });
export interface CAbs { readonly tag: 'CAbs'; readonly name: VarName; readonly type: CType; readonly body: CComp }
export const CAbs = (name: VarName, type: CType, body: CComp): CAbs => ({ tag: 'CAbs', name, type, body });
export interface CAbsT { readonly tag: 'CAbsT'; readonly name: TVarName; readonly kind: CKind; readonly body: CComp }
export const CAbsT = (name: TVarName, kind: CKind, body: CComp): CAbsT => ({ tag: 'CAbsT', name, kind, body });

export interface CReturn { readonly tag: 'CReturn'; readonly val: CVal }
export const CReturn = (val: CVal): CReturn => ({ tag: 'CReturn', val });
export interface CApp { readonly tag: 'CApp'; readonly left: CVal; readonly right: CVal }
export const CApp = (left: CVal, right: CVal): CApp => ({ tag: 'CApp', left, right });
export interface CAppT { readonly tag: 'CAppT'; readonly left: CVal; readonly right: CType }
export const CAppT = (left: CVal, right: CType): CAppT => ({ tag: 'CAppT', left, right });
export interface CSeq { readonly tag: 'CSeq'; readonly name: VarName; readonly val: CComp; readonly body: CComp }
export const CSeq = (name: VarName, val: CComp, body: CComp): CSeq => ({ tag: 'CSeq', name, val, body });
export interface CCon { readonly tag: 'CCon'; readonly con: TConName; readonly val: CVal }
export const CCon = (con: TConName, val: CVal): CCon => ({ tag: 'CCon', con, val });
export interface CDecon { readonly tag: 'CDecon'; readonly con: TConName; readonly val: CVal }
export const CDecon = (con: TConName, val: CVal): CDecon => ({ tag: 'CDecon', con, val });

export const showCore = (core: CKind | CType | CVal | CComp): string => {
  if (core.tag === 'CKCon') return core.name;
  if (core.tag === 'CKFun') return `(${showCore(core.left)} -> ${showCore(core.right)})`;
  
  if (core.tag === 'CTCon') return core.name;
  if (core.tag === 'CTVar') return core.name;
  if (core.tag === 'CTApp') return `(${showCore(core.left)} ${showCore(core.right)})`;
  if (core.tag === 'CTForall') return `(forall (${core.name} : ${showCore(core.kind)}). ${showCore(core.type)})`;
  
  if (core.tag === 'CVar') return core.name;
  if (core.tag === 'CAbs') return `(\\(${core.name} : ${showCore(core.type)}). ${showCore(core.body)})`;
  if (core.tag === 'CAbsT') return `(/\\(${core.name} : ${showCore(core.kind)}). ${showCore(core.body)})`;
  
  if (core.tag === 'CReturn') return `(return ${showCore(core.val)})`;
  if (core.tag === 'CApp') return `(${showCore(core.left)} ${showCore(core.right)})`;
  if (core.tag === 'CAppT') return `(${showCore(core.left)} [${showCore(core.right)}])`;
  if (core.tag === 'CSeq') return `(${core.name} <- ${showCore(core.val)}; ${showCore(core.body)})`;
  if (core.tag === 'CCon') return `(@${core.con} ${showCore(core.val)})`;
  if (core.tag === 'CDecon') return `(~${core.con} ${showCore(core.val)})`;

  return impossible('showCore');
};
