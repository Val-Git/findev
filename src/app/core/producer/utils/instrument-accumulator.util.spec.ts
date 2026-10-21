import {
  createAccumulator,
  type InstrumentAccumulator,
  recordUpdate,
  toMarketRow,
} from './instrument-accumulator.util';
import { FIELDS_PER_UPDATE } from '../market-update.const';
import { encodeBatch, type TestUpdate } from '../producer.testing.spec';

function update(overrides: Partial<TestUpdate>): TestUpdate {
  return {
    instrument: 0,
    priceCents: 10_000,
    tradeQuantity: 1,
    bidCents: 9_999,
    askCents: 10_000,
    bidQuantity: 100,
    askQuantity: 100,
    ...overrides,
  };
}

function recordAll(accumulators: readonly InstrumentAccumulator[], batch: Int32Array): void {
  for (let offset = 0; offset < batch.length; offset += FIELDS_PER_UPDATE) {
    recordUpdate(accumulators[batch[offset]!]!, batch, offset);
  }
}

describe('instrument accumulator', (): void => {
  it('computes the worked example from the task', (): void => {
    const acc = createAccumulator();
    recordAll(
      [acc],
      encodeBatch(
        update({ priceCents: 10_000, tradeQuantity: 10 }),
        update({
          priceCents: 10_200,
          tradeQuantity: 30,
          bidCents: 10_196,
          askCents: 10_200,
          bidQuantity: 600,
          askQuantity: 400,
        }),
      ),
    );

    expect(toMarketRow('ALFA', acc)).toEqual({
      symbol: 'ALFA',
      lastPriceCents: 10_200,
      spreadCents: 4,
      volume: 40,
      vwapCents: 10_150,
      imbalance: 0.2,
    });
  });

  it('reports unavailable values and zero volume before any trade', (): void => {
    expect(toMarketRow('ALFA', createAccumulator())).toEqual({
      symbol: 'ALFA',
      lastPriceCents: null,
      spreadCents: null,
      volume: 0,
      vwapCents: null,
      imbalance: null,
    });
  });

  it('reports unavailable imbalance when both book quantities are zero', (): void => {
    const acc = createAccumulator();
    recordAll([acc], encodeBatch(update({ bidQuantity: 0, askQuantity: 0 })));

    expect(toMarketRow('ALFA', acc).imbalance).toBeNull();
  });

  it('reports full imbalance when one side of the book is empty', (): void => {
    const acc = createAccumulator();
    recordAll([acc], encodeBatch(update({ bidQuantity: 0, askQuantity: 300 })));

    expect(toMarketRow('ALFA', acc).imbalance).toBe(-1);
  });

  it('uses only trade quantities for volume, not book quantities', (): void => {
    const acc = createAccumulator();
    recordAll([acc], encodeBatch(update({ tradeQuantity: 7, bidQuantity: 900, askQuantity: 50 })));

    expect(acc.volume).toBe(7);
  });

  it('keeps instruments in the same batch isolated', (): void => {
    const alfa = createAccumulator();
    const beta = createAccumulator();
    recordAll(
      [alfa, beta],
      encodeBatch(
        update({ instrument: 0, priceCents: 100, tradeQuantity: 10 }),
        update({ instrument: 1, priceCents: 5_000, tradeQuantity: 2 }),
        update({ instrument: 0, priceCents: 102, tradeQuantity: 30 }),
      ),
    );

    expect(toMarketRow('ALFA', alfa)).toMatchObject({
      lastPriceCents: 102,
      volume: 40,
      vwapCents: 101.5,
    });
    expect(toMarketRow('BETA', beta)).toMatchObject({
      lastPriceCents: 5_000,
      volume: 2,
      vwapCents: 5_000,
    });
  });

  it('accumulates totals across batches', (): void => {
    const acc = createAccumulator();
    recordAll([acc], encodeBatch(update({ priceCents: 10_000, tradeQuantity: 10 })));
    recordAll([acc], encodeBatch(update({ priceCents: 10_200, tradeQuantity: 30 })));

    expect(toMarketRow('ALFA', acc)).toMatchObject({ volume: 40, vwapCents: 10_150 });
  });

  it('keeps VWAP unrounded', (): void => {
    const acc = createAccumulator();
    recordAll(
      [acc],
      encodeBatch(
        update({ priceCents: 100, tradeQuantity: 1 }),
        update({ priceCents: 101, tradeQuantity: 2 }),
      ),
    );

    expect(toMarketRow('ALFA', acc).vwapCents).toBeCloseTo(302 / 3, 10);
  });
});
