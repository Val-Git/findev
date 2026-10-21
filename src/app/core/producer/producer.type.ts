/**
 * Messages exchanged between the Angular app and the producer Web Worker.
 * Every worker event carries the `runId` of the run that produced it, so the app can
 * drop late results from a replaced run.
 */

export interface ProducerSettings {
  /** Number of fictional instruments, 1–50 */
  readonly instrumentCount: number;
  /** Total market updates per batch across all instruments, 1–1000 */
  readonly updatesPerBatch: number;
  /** Requested time between batches in milliseconds, 50–2000 */
  readonly batchIntervalMs: number;
}

export type ProducerStatus = 'initializing' | 'running' | 'paused' | 'stopped' | 'error';

/** Dashboard metrics for one instrument. `null` means the value is unavailable. */
export interface MarketRow {
  readonly symbol: string;
  readonly lastPriceCents: number | null;
  readonly spreadCents: number | null;
  /** Sum of trade quantities since the run started. */
  readonly volume: number;
  /** Not rounded: cents are rounded only for display. */
  readonly vwapCents: number | null;
  /** Between −1 and +1. */
  readonly imbalance: number | null;
}

export type ProducerCommand =
  | { readonly type: 'start'; readonly runId: number; readonly settings: ProducerSettings }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'stop' };

export type ProducerEvent =
  | { readonly type: 'status'; readonly runId: number; readonly status: ProducerStatus }
  | { readonly type: 'snapshot'; readonly runId: number; readonly rows: readonly MarketRow[] }
  | { readonly type: 'error'; readonly runId: number; readonly message: string };
