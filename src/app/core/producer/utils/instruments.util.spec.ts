import { instrumentSymbol } from './instruments.util';

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
