import type { BatchGenerator } from './utils/wasm-generator.util';

/** One update in the flat field order of `consts/market-update.const.ts`. */
export interface TestUpdate {
  readonly instrument: number;
  readonly priceCents: number;
  readonly tradeQuantity: number;
  readonly bidCents: number;
  readonly askCents: number;
  readonly bidQuantity: number;
  readonly askQuantity: number;
}

export function encodeBatch(...updates: readonly TestUpdate[]): Int32Array {
  return Int32Array.from(
    updates.flatMap((u: TestUpdate): number[] => [
      u.instrument,
      u.priceCents,
      u.tradeQuantity,
      u.bidCents,
      u.askCents,
      u.bidQuantity,
      u.askQuantity,
    ]),
  );
}

/** Returns queued batches in order, then repeats the last one. Records calls and `free`. */
export class FakeGenerator implements BatchGenerator {
  readonly requestedCounts: number[] = [];
  freed = false;

  constructor(private readonly batches: readonly Int32Array[]) {}

  nextBatch(count: number): Int32Array {
    if (this.freed) {
      throw new Error('nextBatch called after free');
    }
    this.requestedCounts.push(count);
    const batch = this.batches[Math.min(this.requestedCounts.length, this.batches.length) - 1];
    if (!batch) {
      throw new Error('FakeGenerator has no batches');
    }
    return batch;
  }

  free(): void {
    this.freed = true;
  }
}
