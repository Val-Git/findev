import { errorMessage } from '@shared/utils/errors.util';
import {
  createAccumulator,
  type InstrumentAccumulator,
  recordUpdate,
  toMarketRow,
} from './utils/instrument-accumulator.util';
import { instrumentSymbol } from './utils/instruments.util';
import { FIELDS_PER_UPDATE, INSTRUMENT } from './market-update.const';
import type { MarketRow, ProducerEvent, ProducerSettings, ProducerStatus } from './producer.type';
import type { BatchGenerator, GeneratorFactory } from './utils/wasm-generator.util';

export interface ProducerRunDeps {
  readonly createGenerator: GeneratorFactory;
  readonly createSeed: () => number;
  readonly post: (event: ProducerEvent) => void;
}

interface Instrument {
  readonly symbol: string;
  readonly totals: InstrumentAccumulator;
}

/**
 * Each state holds exactly the resources it owns: the generator exists only once created,
 * and the timer only while running. Leaving `running` always clears the timer, so a tick
 * never fires in any other state.
 */
type RunState =
  | { readonly kind: 'initializing'; pauseRequested: boolean }
  | {
      readonly kind: 'running';
      readonly generator: BatchGenerator;
      readonly timer: ReturnType<typeof setTimeout>;
    }
  | { readonly kind: 'paused'; readonly generator: BatchGenerator }
  | { readonly kind: 'disposed' };

/**
 * One producer run, from `start` until it is replaced, stopped or fails: owns the Wasm
 * generator, the batch timer and the per-instrument totals, and posts its own events.
 */
export class ProducerRun {
  private state: RunState = { kind: 'initializing', pauseRequested: false };
  private readonly instruments: readonly Instrument[];

  private constructor(
    private readonly runId: number,
    private readonly settings: ProducerSettings,
    private readonly deps: ProducerRunDeps,
  ) {
    this.instruments = Array.from(
      { length: settings.instrumentCount },
      (_: unknown, index: number): Instrument => ({
        symbol: instrumentSymbol(index),
        totals: createAccumulator(),
      }),
    );
  }

  /** Creates the run and starts loading its generator. */
  static start(runId: number, settings: ProducerSettings, deps: ProducerRunDeps): ProducerRun {
    const run = new ProducerRun(runId, settings, deps);
    run.postStatus('initializing');
    void run.init();
    return run;
  }

  pause(): void {
    switch (this.state.kind) {
      case 'initializing':
        // Reported by `init` once the generator is ready.
        this.state.pauseRequested = true;
        break;
      case 'running':
        clearTimeout(this.state.timer);
        this.state = { kind: 'paused', generator: this.state.generator };
        this.postStatus('paused');
        break;
      case 'paused':
      case 'disposed':
        break;
    }
  }

  resume(): void {
    switch (this.state.kind) {
      case 'initializing':
        this.state.pauseRequested = false;
        break;
      case 'paused':
        this.postStatus('running');
        // The paused interval is not caught up: the next batch comes one interval from now.
        this.schedule(this.state.generator);
        break;
      case 'running':
      case 'disposed':
        break;
    }
  }

  /** Ends the run and reports it, as requested by the app. */
  stop(): void {
    if (this.state.kind === 'disposed') {
      return;
    }
    this.dispose();
    this.postStatus('stopped');
  }

  /** Releases the timer and Wasm memory without posting events; used when a new run replaces this one. */
  dispose(): void {
    switch (this.state.kind) {
      case 'running':
        clearTimeout(this.state.timer);
        this.state.generator.free();
        break;
      case 'paused':
        this.state.generator.free();
        break;
      case 'initializing':
      case 'disposed':
        // A generator still being created is freed by `init` when it arrives.
        break;
    }
    this.state = { kind: 'disposed' };
  }

  private async init(): Promise<void> {
    let generator: BatchGenerator;
    try {
      generator = await this.deps.createGenerator(
        this.settings.instrumentCount,
        this.deps.createSeed(),
      );
    } catch (error) {
      if (this.state.kind === 'initializing') {
        this.fail(error);
      }
      return;
    }
    // The only asynchronous gap: the run may have been replaced or stopped meanwhile.
    if (this.state.kind !== 'initializing') {
      generator.free();
      return;
    }

    this.postSnapshot();
    if (this.state.pauseRequested) {
      this.state = { kind: 'paused', generator };
      this.postStatus('paused');
    } else {
      this.postStatus('running');
      this.schedule(generator);
    }
  }

  private schedule(generator: BatchGenerator): void {
    const timer = setTimeout((): void => {
      this.tick(generator);
    }, this.settings.batchIntervalMs);
    this.state = { kind: 'running', generator, timer };
  }

  private tick(generator: BatchGenerator): void {
    try {
      this.record(generator.nextBatch(this.settings.updatesPerBatch));
    } catch (error) {
      this.fail(error);
      return;
    }
    this.postSnapshot();
    // Scheduling after the work, not on a fixed interval, keeps slow batches from piling up.
    this.schedule(generator);
  }

  private record(batch: Int32Array): void {
    for (let offset = 0; offset < batch.length; offset += FIELDS_PER_UPDATE) {
      const index = batch[offset + INSTRUMENT] ?? -1;
      const instrument = this.instruments[index];
      if (!instrument) {
        throw new RangeError(`Generator returned unknown instrument index ${String(index)}`);
      }
      recordUpdate(instrument.totals, batch, offset);
    }
  }

  private fail(error: unknown): void {
    this.dispose();
    this.deps.post({ type: 'error', runId: this.runId, message: errorMessage(error) });
    this.postStatus('error');
  }

  private postSnapshot(): void {
    this.deps.post({
      type: 'snapshot',
      runId: this.runId,
      rows: this.instruments.map(({ symbol, totals }: Instrument): MarketRow =>
        toMarketRow(symbol, totals),
      ),
    });
  }

  private postStatus(status: ProducerStatus): void {
    this.deps.post({ type: 'status', runId: this.runId, status });
  }
}
