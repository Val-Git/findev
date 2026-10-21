import { ProducerEngine } from './producer.engine';
import type { MarketRow, ProducerEvent, ProducerSettings } from './producer.type';
import { encodeBatch, FakeGenerator } from './producer.testing.spec';
import type { BatchGenerator, GeneratorFactory } from './utils/wasm-generator.util';

const SETTINGS: ProducerSettings = { instrumentCount: 2, updatesPerBatch: 3, batchIntervalMs: 500 };

// ALFA: 10 @ $100 and 30 @ $102 → volume 40, VWAP 10150. BETA: 5 @ $50.
const BATCH = encodeBatch(
  {
    instrument: 0,
    priceCents: 10_000,
    tradeQuantity: 10,
    bidCents: 9_999,
    askCents: 10_000,
    bidQuantity: 500,
    askQuantity: 500,
  },
  {
    instrument: 1,
    priceCents: 5_000,
    tradeQuantity: 5,
    bidCents: 4_999,
    askCents: 5_000,
    bidQuantity: 100,
    askQuantity: 300,
  },
  {
    instrument: 0,
    priceCents: 10_200,
    tradeQuantity: 30,
    bidCents: 10_196,
    askCents: 10_200,
    bidQuantity: 600,
    askQuantity: 400,
  },
);

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res: (value: T) => void, rej: (error: unknown) => void): void => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ProducerEngine', (): void => {
  let events: ProducerEvent[];
  let generators: FakeGenerator[];
  let createGenerator: ReturnType<typeof vi.fn<GeneratorFactory>>;
  let engine: ProducerEngine;

  function createEngine(factory: GeneratorFactory): ProducerEngine {
    createGenerator = vi.fn<GeneratorFactory>(factory);
    return new ProducerEngine({
      createGenerator,
      createSeed: (): number => 42,
      post: (event: ProducerEvent): void => {
        events.push(event);
      },
    });
  }

  function statuses(): string[] {
    return events.flatMap((e: ProducerEvent): string[] =>
      e.type === 'status' ? [`${String(e.runId)}:${e.status}`] : [],
    );
  }

  function lastRows(): readonly MarketRow[] {
    const snapshot = events.filter((e: ProducerEvent): boolean => e.type === 'snapshot').at(-1);
    if (snapshot?.type !== 'snapshot') {
      throw new Error('no snapshot posted');
    }
    return snapshot.rows;
  }

  /** Lets the async generator creation settle and fires due timers. */
  async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
  }

  beforeEach((): void => {
    vi.useFakeTimers();
    events = [];
    generators = [];
    engine = createEngine((): Promise<BatchGenerator> => {
      const generator = new FakeGenerator([BATCH]);
      generators.push(generator);
      return Promise.resolve(generator);
    });
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  it('initializes, posts an empty snapshot and starts running', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(0);

    expect(createGenerator).toHaveBeenCalledExactlyOnceWith(2, 42);
    expect(statuses()).toEqual(['1:initializing', '1:running']);
    expect(lastRows()).toEqual([
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
    expect(generators[0]!.requestedCounts).toEqual([]);
  });

  it('generates one batch of the requested size per interval', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(499);
    expect(generators[0]!.requestedCounts).toEqual([]);

    await advance(1);
    expect(generators[0]!.requestedCounts).toEqual([3]);
    expect(lastRows()).toEqual([
      {
        symbol: 'ALFA',
        lastPriceCents: 10_200,
        spreadCents: 4,
        volume: 40,
        vwapCents: 10_150,
        imbalance: 0.2,
      },
      {
        symbol: 'BETA',
        lastPriceCents: 5_000,
        spreadCents: 1,
        volume: 5,
        vwapCents: 5_000,
        imbalance: -0.5,
      },
    ]);

    await advance(1_000);
    expect(generators[0]!.requestedCounts).toEqual([3, 3, 3]);
    expect(lastRows()[0]!.volume).toBe(120);
  });

  it('stops generating while paused and keeps totals on resume', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(500);
    engine.handle({ type: 'pause' });
    await advance(5_000);

    expect(generators[0]!.requestedCounts).toHaveLength(1);
    expect(statuses()).toEqual(['1:initializing', '1:running', '1:paused']);

    engine.handle({ type: 'resume' });
    await advance(500);

    expect(generators[0]!.requestedCounts).toHaveLength(2);
    expect(lastRows()[0]!.volume).toBe(80);
    expect(statuses().at(-1)).toBe('1:running');
  });

  it('ignores resume while running and pause while paused', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(0);
    engine.handle({ type: 'resume' });
    engine.handle({ type: 'pause' });
    engine.handle({ type: 'pause' });

    expect(statuses()).toEqual(['1:initializing', '1:running', '1:paused']);
  });

  it('resets totals and frees the old generator on a new start', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(500);
    events = [];

    engine.handle({ type: 'start', runId: 2, settings: { ...SETTINGS, instrumentCount: 1 } });
    await advance(0);

    expect(generators[0]!.freed).toBe(true);
    expect(events.every((e: ProducerEvent): boolean => e.runId === 2)).toBe(true);
    expect(lastRows()).toEqual([
      {
        symbol: 'ALFA',
        lastPriceCents: null,
        spreadCents: null,
        volume: 0,
        vwapCents: null,
        imbalance: null,
      },
    ]);
  });

  it('starts generating when a new run is applied while paused', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(0);
    engine.handle({ type: 'pause' });
    engine.handle({ type: 'start', runId: 2, settings: SETTINGS });
    await advance(500);

    expect(statuses().at(-1)).toBe('2:running');
    expect(generators[1]!.requestedCounts).toEqual([3]);
  });

  it('drops a generator created for a run that was replaced meanwhile', async (): Promise<void> => {
    const pending = [deferred<BatchGenerator>(), deferred<BatchGenerator>()];
    engine = createEngine(
      (): Promise<BatchGenerator> => pending[createGenerator.mock.calls.length - 1]!.promise,
    );
    const stale = new FakeGenerator([BATCH]);
    const fresh = new FakeGenerator([BATCH]);

    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    engine.handle({ type: 'start', runId: 2, settings: SETTINGS });
    pending[1]!.resolve(fresh);
    pending[0]!.resolve(stale);
    await advance(500);

    expect(stale.freed).toBe(true);
    expect(stale.requestedCounts).toEqual([]);
    expect(fresh.requestedCounts).toEqual([3]);
    expect(statuses()).toEqual(['1:initializing', '2:initializing', '2:running']);
  });

  it('honours a pause received while initializing', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    engine.handle({ type: 'pause' });
    await advance(5_000);

    expect(statuses()).toEqual(['1:initializing', '1:paused']);
    expect(generators[0]!.requestedCounts).toEqual([]);

    engine.handle({ type: 'resume' });
    await advance(500);
    expect(generators[0]!.requestedCounts).toEqual([3]);
  });

  it('reports a generator creation failure', async (): Promise<void> => {
    engine = createEngine((): Promise<BatchGenerator> =>
      Promise.reject(new Error('Failed to load the WebAssembly module')),
    );

    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(0);

    expect(events).toContainEqual({
      type: 'error',
      runId: 1,
      message: 'Failed to load the WebAssembly module',
    });
    expect(statuses()).toEqual(['1:initializing', '1:error']);
  });

  it('reports a batch failure, frees the generator and stops', async (): Promise<void> => {
    const broken = new FakeGenerator([]);
    engine = createEngine((): Promise<BatchGenerator> => Promise.resolve(broken));

    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(500);

    expect(events).toContainEqual({
      type: 'error',
      runId: 1,
      message: 'FakeGenerator has no batches',
    });
    expect(statuses().at(-1)).toBe('1:error');
    expect(broken.freed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects a batch with an unknown instrument index', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: { ...SETTINGS, instrumentCount: 1 } });
    await advance(500);

    expect(events).toContainEqual({
      type: 'error',
      runId: 1,
      message: 'Generator returned unknown instrument index 1',
    });
  });

  it('frees the generator and clears the timer on stop', async (): Promise<void> => {
    engine.handle({ type: 'start', runId: 1, settings: SETTINGS });
    await advance(0);
    engine.handle({ type: 'stop' });
    await advance(5_000);

    expect(generators[0]!.freed).toBe(true);
    expect(generators[0]!.requestedCounts).toEqual([]);
    expect(statuses().at(-1)).toBe('1:stopped');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores commands before the first start', (): void => {
    engine.handle({ type: 'pause' });
    engine.handle({ type: 'resume' });
    engine.handle({ type: 'stop' });

    expect(events).toEqual([]);
  });
});
