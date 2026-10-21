import {
  ASK_CENTS,
  ASK_QUANTITY,
  BID_CENTS,
  BID_QUANTITY,
  PRICE_CENTS,
  TRADE_QUANTITY,
} from '../market-update.const';
import type { MarketRow } from '../producer.type';

/**
 * Running totals for one instrument. Holds only what the metrics need, never the event
 * history, so memory stays constant however many trades arrive.
 */
export interface InstrumentAccumulator {
  lastPriceCents: number | null;
  bidCents: number | null;
  askCents: number | null;
  bidQuantity: number | null;
  askQuantity: number | null;
  /** Sum of trade quantities. */
  volume: number;
  /** Sum of `priceCents × tradeQuantity`; stays exact well beyond a day at the maximum rate. */
  notionalCents: number;
}

export function createAccumulator(): InstrumentAccumulator {
  return {
    lastPriceCents: null,
    bidCents: null,
    askCents: null,
    bidQuantity: null,
    askQuantity: null,
    volume: 0,
    notionalCents: 0,
  };
}

/** Applies the update that starts at `offset` in a flat batch. Each trade must be applied once. */
export function recordUpdate(acc: InstrumentAccumulator, batch: Int32Array, offset: number): void {
  const price = field(batch, offset + PRICE_CENTS);
  const quantity = field(batch, offset + TRADE_QUANTITY);
  acc.lastPriceCents = price;
  acc.bidCents = field(batch, offset + BID_CENTS);
  acc.askCents = field(batch, offset + ASK_CENTS);
  acc.bidQuantity = field(batch, offset + BID_QUANTITY);
  acc.askQuantity = field(batch, offset + ASK_QUANTITY);
  acc.volume += quantity;
  acc.notionalCents += price * quantity;
}

export function toMarketRow(symbol: string, acc: InstrumentAccumulator): MarketRow {
  return {
    symbol,
    lastPriceCents: acc.lastPriceCents,
    spreadCents:
      acc.askCents !== null && acc.bidCents !== null ? acc.askCents - acc.bidCents : null,
    volume: acc.volume,
    vwapCents: acc.volume > 0 ? acc.notionalCents / acc.volume : null,
    imbalance: imbalance(acc.bidQuantity, acc.askQuantity),
  };
}

function imbalance(bidQuantity: number | null, askQuantity: number | null): number | null {
  if (bidQuantity === null || askQuantity === null) {
    return null;
  }
  const total = bidQuantity + askQuantity;
  return total > 0 ? (bidQuantity - askQuantity) / total : null;
}

function field(batch: Int32Array, index: number): number {
  const value = batch[index];
  if (value === undefined) {
    throw new RangeError(`Batch has no field at index ${String(index)}`);
  }
  return value;
}
