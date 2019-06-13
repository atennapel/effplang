import { Name } from './names';
import { Term, showTerm } from './terms';
import { Type, showType } from './types';
import { impossible } from './util';
import { Kind, showKind } from './kinds';
import { config } from './config';

export type Def
  = DType
  | DLet;

export interface DType {
  readonly tag: 'DType';
  readonly name: Name;
  readonly params: [Name, Kind | null][];
  readonly cons: [Name, Type[]][];
}
export const DType = (name: Name, params: [Name, Kind | null][], cons: [Name, Type[]][]): DType =>
  ({ tag: 'DType', name, params, cons });

export interface DLet {
  readonly tag: 'DLet';
  readonly name: Name;
  readonly type: Type | null;
  readonly val: Term;
}
export const DLet = (name: Name, type: Type | null, val: Term): DLet =>
  ({ tag: 'DLet', name, type, val });

export const showDef = (d: Def): string => {
  if (d.tag === 'DType')
    return `type ${d.name}${d.params.length > 0 ? ` ${d.params.map(([tv, k]) =>
      config.showKinds ?
        `(${tv} : ${k ? showKind(k) : '?'})` :
        `${tv}`).join(' ')}` : ''}${d.cons.length > 0 ? ` = ${d.cons.map(([c, ts]) =>
          `${c}${ts.length > 0 ? ` ${ts.map(t => `(${showType(t)})`).join(' ')}` : ''}`).join(' | ')}` : ''}`;
  if (d.tag === 'DLet')
    return `let ${d.name}${d.type ? ` : ${showType(d.type)}` : ''} = ${showTerm(d.val)}`;
  return impossible('showDef');
};
export const showDefs = (ds: Def[]): string =>
  ds.map(showDef).join('; ');
