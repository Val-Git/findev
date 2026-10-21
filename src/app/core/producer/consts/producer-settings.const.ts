import type { ProducerSettings } from '../producer.type';

/** Settings the application starts with. */
export const DEFAULT_PRODUCER_SETTINGS: ProducerSettings = {
  instrumentCount: 5,
  updatesPerBatch: 100,
  batchIntervalMs: 500,
};
