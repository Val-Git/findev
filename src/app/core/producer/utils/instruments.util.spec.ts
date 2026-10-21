import { createAccumulator } from './instrument-accumulator.util';
import { createInstruments, instrumentSymbol, toMarketRows } from './instruments.util';

describe('instrumentSymbol', (): void => {
  it('starts with the familiar tickers', (): void => {
    expect(instrumentSymbol(0)).toBe('ALFA');
    expect(instrumentSymbol(1)).toBe('BETA');
  });

  it('gives unique symbols for the maximum instrument count', (): void => {
    const symbols = Array.from({ length: 50 }, (_: unknown, index: number): string =>
      instrumentSymbol(index),
    );

    expect(new Set(symbols).size).toBe(50);
  });
});

describe('createInstruments', (): void => {
  it('creates the requested number of instruments with symbols by index and empty totals', (): void => {
    expect(createInstruments(3)).toEqual([
      { symbol: 'ALFA', totals: createAccumulator() },
      { symbol: 'BETA', totals: createAccumulator() },
      { symbol: 'GAMA', totals: createAccumulator() },
    ]);
  });

  it('gives every instrument its own totals', (): void => {
    const [first, second] = createInstruments(2);

    expect(first?.totals).not.toBe(second?.totals);
  });
});

describe('toMarketRows', (): void => {
  it('shows fresh instruments as unavailable values and zero volume', (): void => {
    expect(toMarketRows(createInstruments(2))).toEqual([
      {
        symbol: 'ALFA',
        lastPriceCents: null,
        spreadCents: null,
        volume: 0,
        vwapCents: null,
        imbalance: null,
      },
      {
        symbol: 'BETA',
        lastPriceCents: null,
        spreadCents: null,
        volume: 0,
        vwapCents: null,
        imbalance: null,
      },
    ]);
  });
});
