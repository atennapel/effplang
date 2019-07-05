import { VarName, Term, showTerm } from './terms';
import { impossible } from './util';
import { Type, showType, TConName, TVarName, Scheme, showScheme, PScheme, showPScheme } from './types';
import { Kind, showKind } from './kinds';

export type Def
  = DLet
  | DType;

export interface DLet {
  readonly tag: 'DLet';
  readonly name: VarName;
  readonly term: Term;
  readonly type: PScheme | null;
}
export const DLet = (name: VarName, term: Term, type: PScheme | null = null): DLet =>
  ({ tag: 'DLet', name, term, type });

export interface DType {
  readonly tag: 'DType';
  readonly name: TConName;
  readonly params: [TVarName, Kind | null][];
  readonly type: PScheme;
}
export const DType = (name: TConName, params: [TVarName, Kind | null][], type: PScheme): DType =>
  ({ tag: 'DType', name, params, type });

export const showDef = (def: Def): string => {
  if (def.tag === 'DLet')
    return `let ${def.name}${def.type ? ` : ${showPScheme(def.type)}` : ''} = ${showTerm(def.term)}`;
  if (def.tag === 'DType')
    return `type ${def.name}${def.params.length === 0 ? '' : ` ${def.params.map(([x, k]) => `(${x} : ${k ? showKind(k) : '?'})`).join(' ')}`} = ${showPScheme(def.type)}`;
  return impossible('showDef');
};
export const showDefs = (ds: Def[]): string =>
  ds.map(showDef).join('\n');
