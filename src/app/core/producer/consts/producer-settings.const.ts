import type { ProducerSettings } from '../producer.type';

export const DEFAULT_PRODUCER_SETTINGS: ProducerSettings = {
  instrumentCount: 5,
  updatesPerBatch: 100,
  batchIntervalMs: 500,
};

export interface IntegerRange {
  readonly min: number;
  readonly max: number;
}

/** Inclusive integer range allowed for each setting. */
export const PRODUCER_SETTINGS_LIMITS: { readonly [K in keyof ProducerSettings]: IntegerRange } = {
  instrumentCount: { min: 1, max: 50 },
  updatesPerBatch: { min: 1, max: 1000 },
  batchIntervalMs: { min: 50, max: 2000 },
};
