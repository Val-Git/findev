const BASE_SYMBOLS = [
  'ALFA',
  'BETA',
  'GAMA',
  'DLTA',
  'EPSN',
  'ZETA',
  'ETAX',
  'THTA',
  'IOTA',
  'KAPA',
  'LMDA',
  'MUXX',
  'NUXX',
  'XIXX',
  'OMCR',
  'PIXX',
  'RHOX',
  'SGMA',
  'TAUX',
  'UPSL',
  'PHIX',
  'CHIX',
  'PSIX',
  'OMGA',
] as const;

/** Unique ticker for an instrument index: `ALFA`, `BETA`, …, then `ALFA2`, `BETA2`, … */
export function instrumentSymbol(index: number): string {
  const base = BASE_SYMBOLS[index % BASE_SYMBOLS.length] ?? 'INST';
  const round = Math.floor(index / BASE_SYMBOLS.length);
  return round === 0 ? base : `${base}${String(round + 1)}`;
}
