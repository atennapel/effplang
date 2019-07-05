import { VarName, Term, showTerm } from './terms';
import { impossible } from './util';
import { Type, showType, TConName, TVarName, Scheme, showScheme } from './types';
import { Kind, showKind } from './kinds';

export type Def
  = DLet
  | DType;

export interface DLet {
  readonly tag: 'DLet';
  readonly name: VarName;
  readonly term: Term;
  readonly type: Scheme | null;
}
export const DLet = (name: VarName, term: Term, type: Scheme | null = null): DLet =>
  ({ tag: 'DLet', name, term, type });

export interface DType {
  readonly tag: 'DType';
  readonly name: TConName;
  readonly params: [TVarName, Kind][];
  readonly type: Type;
}
export const DType = (name: TConName, params: [TVarName, Kind][], type: Type): DType =>
  ({ tag: 'DType', name, params, type });

export const showDef = (def: Def): string => {
  if (def.tag === 'DLet')
    return `let ${def.name}${def.type ? ` : ${showScheme(def.type)}` : ''} = ${showTerm(def.term)}`;
  if (def.tag === 'DType')
    return `type ${def.name}${def.params.length === 0 ? '' : ` ${def.params.map(([x, k]) => `(${x} : ${showKind(k)})`).join(' ')}`} = ${showType(def.type)}`;
  return impossible('showDef');
};
export const showDefs = (ds: Def[]): string =>
  ds.map(showDef).join('\n');
