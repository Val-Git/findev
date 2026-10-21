import type { MarketRow } from '../producer.type';
import {
  createAccumulator,
  type InstrumentAccumulator,
  toMarketRow,
} from './instrument-accumulator.util';

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

export interface Instrument {
  readonly symbol: string;
  readonly totals: InstrumentAccumulator;
}

/** Unique ticker for an instrument index: `ALFA`, `BETA`, `GAMA`, etc. */
export function instrumentSymbol(index: number): string {
  const base = BASE_SYMBOLS[index % BASE_SYMBOLS.length] ?? 'INST';
  const round = Math.floor(index / BASE_SYMBOLS.length);
  return round === 0 ? base : `${base}${String(round + 1)}`;
}

/** Instruments of a fresh run: symbols by index and empty totals. */
export function createInstruments(count: number): Instrument[] {
  return Array.from({ length: count }, (_, index: number): Instrument => ({
    symbol: instrumentSymbol(index),
    totals: createAccumulator(),
  }));
}

/** Dashboard rows for the instruments' current totals, in instrument order. */
export function toMarketRows(instruments: readonly Instrument[]): MarketRow[] {
  return instruments.map(({ symbol, totals }: Instrument): MarketRow =>
    toMarketRow(symbol, totals),
  );
}
