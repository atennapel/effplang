import { VarName, Term, showTerm } from './terms';
import { impossible } from './util';

export type Def
  = DLet;

export interface DLet {
  readonly tag: 'DLet';
  readonly name: VarName;
  readonly term: Term;
}
export const DLet = (name: VarName, term: Term): DLet =>
  ({ tag: 'DLet', name, term });

export const showDef = (def: Def): string => {
  if (def.tag === 'DLet') return `let ${def.name} = ${showTerm(def.term)}`;
  return impossible('showDef');
};
export const showDefs = (ds: Def[]): string =>
  ds.map(showDef).join('\n');
