import { InjectionToken } from '@angular/core';

/** The part of `Worker` the feed uses. */
export type ProducerWorker = Pick<Worker, 'postMessage' | 'addEventListener' | 'terminate'>;

export const PRODUCER_WORKER_FACTORY = new InjectionToken<() => ProducerWorker>(
  'PRODUCER_WORKER_FACTORY',
  {
    providedIn: 'root',
    factory: (): (() => ProducerWorker) => (): ProducerWorker =>
      new Worker(new URL('../producer/producer.worker', import.meta.url), { type: 'module' }),
  },
);
