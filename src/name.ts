export type Name = string;

export type TMetaId = number;
let _tmetaid: TMetaId = 0;
export const freshTMetaId = (): TMetaId => _tmetaid++;
export const resetTMetaId = () => { _tmetaid = 0 };
