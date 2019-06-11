import { Kind, showKind } from './kinds';
import { Name, freshId, Id } from './names';
import { TMeta, showType, TVar } from './types';
import { impossible } from './util';

export interface ETVar {
  readonly tag: 'ETVar';
  readonly name: Name;
  readonly kind: Kind;
}
export const ETVar = (name: Name, kind: Kind): ETVar =>
  ({ tag: 'ETVar', name, kind });

export interface EMarker {
  readonly tag: 'EMarker';
  readonly id: Id;
}
export const EMarker = (id: Id): EMarker =>
  ({ tag: 'EMarker', id });
export const freshEMarker = () => EMarker(freshId());

export type Elem
  = TMeta
  | ETVar
  | EMarker;

export const showElem = (e: Elem): string => {
  if (e.tag === 'ETVar') return `${e.name} : ${showKind(e.kind)}`;
  if (e.tag === 'EMarker') return `|>${e.id}`;
  if (e.tag === 'TMeta')
    return `${showType(e)} : ${showKind(e.kind)}${e.type ? ` = ${showType(e.type)}` : ''}`;
  return impossible('showElem');
};

export type Context = Elem[];

let _context: Context = [];
export const resetContext = () => { _context = [] };

export const showContext = (c: Context = _context): string =>
  `[${c.map(showElem).join(', ')}]`;

export const contextAdd = (e: Elem) => { _context.push(e) };
export const contextMark = () => {
  const m = freshEMarker();
  contextAdd(m);
  return m;
};
export const contextRemove = (i: number) => _context.splice(i, 1);
export const contextReplace2 = (i: number, a: Elem, b: Elem) =>
  _context.splice(i, 1, a, b);
export const contextIndexOf = (x: Elem): number => {
  for (let i = _context.length - 1; i >= 0; i--)
    if (_context[i] === x) return i;
  return -1;
};
export const contextDrop = (m: EMarker): Elem[] =>
  _context.splice(contextIndexOf(m), _context.length);

export const contextIndexOfTMeta = (x: TMeta): number =>
  contextIndexOf(x);
export const contextIndexOfTVar = (t: TVar): number => {
  const x = t.name;
  for (let i = _context.length - 1; i >= 0; i--) {
    const c = _context[i];
    if (c.tag === 'ETVar' && c.name === x) return i;
  }
  return -1;
};
