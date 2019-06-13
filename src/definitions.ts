import { Name } from './names';
import { Term, showTerm } from './terms';
import { Type, showType } from './types';
import { impossible } from './util';

export type Def
  = DLet;

export interface DLet {
  readonly tag: 'DLet';
  readonly name: Name;
  readonly type: Type | null;
  readonly val: Term;
}
export const DLet = (name: Name, type: Type | null, val: Term): DLet =>
  ({ tag: 'DLet', name, type, val });

export const showDef = (d: Def): string => {
  if (d.tag === 'DLet')
    return `let ${d.name}${d.type ? ` : ${showType(d.type)}` : ''} = ${showTerm(d.val)}`;
  return impossible('showDef');
};
export const showDefs = (ds: Def[]): string =>
  ds.map(showDef).join('; ');