import { TestBed } from '@angular/core/testing';
import { type Observable, take } from 'rxjs';
import { DEFAULT_PRODUCER_SETTINGS } from '@core/producer/consts/producer-settings.const';
import type { MarketRow, ProducerSettings } from '@core/producer/producer.type';
import { MarketFeedService } from './market-feed.service';
import { FakeProducerWorker, provideFakeProducerWorker } from './market-feed.testing.spec';

const NEW_SETTINGS: ProducerSettings = {
  instrumentCount: 2,
  updatesPerBatch: 10,
  batchIntervalMs: 100,
};

function emptyRow(symbol: string): MarketRow {
  return {
    symbol,
    lastPriceCents: null,
    spreadCents: null,
    volume: 0,
    vwapCents: null,
    imbalance: null,
  };
}

function tradedRow(symbol: string): MarketRow {
  return {
    symbol,
    lastPriceCents: 10_200,
    spreadCents: 4,
    volume: 40,
    vwapCents: 10_150,
    imbalance: 0.2,
  };
}

/** Reads the current value of a BehaviorSubject-backed stream. */
function current<T>(source: Observable<T>): T {
  let result: { readonly value: T } | undefined;
  source.pipe(take(1)).subscribe((value: T): void => {
    result = { value };
  });
  if (!result) {
    throw new Error('Stream has no current value');
  }
  return result.value;
}

describe('MarketFeedService', (): void => {
  let worker: FakeProducerWorker;
  let feed: MarketFeedService;

  beforeEach((): void => {
    worker = new FakeProducerWorker();
    TestBed.configureTestingModule({ providers: [provideFakeProducerWorker(worker)] });
    feed = TestBed.inject(MarketFeedService);
  });

  it('starts the first run with the default settings', (): void => {
    expect(worker.posted).toEqual([
      { type: 'start', runId: 1, settings: DEFAULT_PRODUCER_SETTINGS },
    ]);
    expect(current(feed.settings$)).toEqual(DEFAULT_PRODUCER_SETTINGS);
    expect(current(feed.status$)).toBe('initializing');
    expect(current(feed.error$)).toBeNull();
    expect(current(feed.rows$)).toEqual(
      ['ALFA', 'BETA', 'GAMA', 'DLTA', 'EPSN'].map((symbol: string): MarketRow => emptyRow(symbol)),
    );
  });

  it('applies snapshots and statuses of the current run', (): void => {
    worker.emit({ type: 'status', runId: 1, status: 'running' });
    worker.emit({ type: 'snapshot', runId: 1, rows: [tradedRow('ALFA')] });

    expect(current(feed.status$)).toBe('running');
    expect(current(feed.rows$)).toEqual([tradedRow('ALFA')]);
  });

  it('apply starts a new run and clears the previous values immediately', (): void => {
    worker.emit({ type: 'snapshot', runId: 1, rows: [tradedRow('ALFA')] });
    worker.emit({ type: 'error', runId: 1, message: 'boom' });

    feed.apply(NEW_SETTINGS);

    expect(worker.posted.at(-1)).toEqual({ type: 'start', runId: 2, settings: NEW_SETTINGS });
    expect(current(feed.settings$)).toEqual(NEW_SETTINGS);
    expect(current(feed.status$)).toBe('initializing');
    expect(current(feed.error$)).toBeNull();
    expect(current(feed.rows$)).toEqual([emptyRow('ALFA'), emptyRow('BETA')]);
  });

  it('apply starts generation even when the previous run was paused', (): void => {
    worker.emit({ type: 'status', runId: 1, status: 'paused' });

    feed.apply(NEW_SETTINGS);
    worker.emit({ type: 'status', runId: 2, status: 'running' });

    expect(worker.posted.at(-1)).toEqual({ type: 'start', runId: 2, settings: NEW_SETTINGS });
    expect(current(feed.status$)).toBe('running');
  });

  it('ignores events from a replaced run', (): void => {
    feed.apply(NEW_SETTINGS);

    worker.emit({ type: 'snapshot', runId: 1, rows: [tradedRow('ALFA')] });
    worker.emit({ type: 'status', runId: 1, status: 'running' });
    worker.emit({ type: 'error', runId: 1, message: 'late failure' });

    expect(current(feed.rows$)).toEqual([emptyRow('ALFA'), emptyRow('BETA')]);
    expect(current(feed.status$)).toBe('initializing');
    expect(current(feed.error$)).toBeNull();
  });

  it('pause and resume send commands and wait for the worker to confirm', (): void => {
    worker.emit({ type: 'status', runId: 1, status: 'running' });

    feed.pause();
    expect(worker.posted.at(-1)).toEqual({ type: 'pause' });
    expect(current(feed.status$)).toBe('running');

    worker.emit({ type: 'status', runId: 1, status: 'paused' });
    expect(current(feed.status$)).toBe('paused');

    feed.resume();
    expect(worker.posted.at(-1)).toEqual({ type: 'resume' });
    worker.emit({ type: 'status', runId: 1, status: 'running' });
    expect(current(feed.status$)).toBe('running');
  });

  it('keeps values received before a pause', (): void => {
    worker.emit({ type: 'snapshot', runId: 1, rows: [tradedRow('ALFA')] });
    feed.pause();
    worker.emit({ type: 'status', runId: 1, status: 'paused' });
    feed.resume();

    expect(current(feed.rows$)).toEqual([tradedRow('ALFA')]);
  });

  it('reports run errors from the worker', (): void => {
    worker.emit({ type: 'error', runId: 1, message: 'Wasm failed to load' });
    worker.emit({ type: 'status', runId: 1, status: 'error' });

    expect(current(feed.error$)).toBe('Wasm failed to load');
    expect(current(feed.status$)).toBe('error');
  });

  it('reports a failure of the worker script itself', (): void => {
    worker.fail('Script error');

    expect(current(feed.error$)).toBe('Script error');
    expect(current(feed.status$)).toBe('error');
  });

  it('falls back to a generic message when the worker error has none', (): void => {
    worker.fail('');

    expect(current(feed.error$)).toBe('Failed to start generator worker');
  });

  it('stops and terminates the worker when destroyed', (): void => {
    TestBed.resetTestingModule();

    expect(worker.posted.at(-1)).toEqual({ type: 'stop' });
    expect(worker.terminated).toBe(true);
  });
});
