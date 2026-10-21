import { BehaviorSubject } from 'rxjs';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { DEFAULT_PRODUCER_SETTINGS } from '@core/producer/consts/producer-settings.const';
import type {
  MarketRow,
  ProducerCommand,
  ProducerEvent,
  ProducerSettings,
  ProducerStatus,
} from '@core/producer/producer.type';
import { createInstruments, toMarketRows } from '@core/producer/utils/instruments.util';
import { PRODUCER_WORKER_FACTORY, type ProducerWorker } from './worker-factory.token';

const WORKER_FAILURE_MESSAGE = 'Failed to start generator worker';

/**
 * The only owner of the producer worker.
 * Sends commands, drops events from replaced runs by `runId` and exposes the current run's state.
 */
@Injectable({ providedIn: 'root' })
export class MarketFeedService {
  private readonly settingsSubject = new BehaviorSubject<ProducerSettings>(
    DEFAULT_PRODUCER_SETTINGS,
  );
  private readonly statusSubject = new BehaviorSubject<ProducerStatus>('initializing');
  private readonly rowsSubject = new BehaviorSubject<readonly MarketRow[]>([]);
  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  /** Settings of the active run, not an unsaved form draft. */
  readonly settings$ = this.settingsSubject.asObservable();
  /** Status as confirmed by the worker. */
  readonly status$ = this.statusSubject.asObservable();
  readonly rows$ = this.rowsSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  private readonly worker: ProducerWorker = inject(PRODUCER_WORKER_FACTORY)();
  private runId = 0;

  constructor() {
    this.worker.addEventListener('message', ({ data }: MessageEvent<ProducerEvent>): void => {
      this.onEvent(data);
    });
    this.worker.addEventListener('error', (event: ErrorEvent): void => {
      this.onWorkerFailure(event.message);
    });
    this.worker.addEventListener('messageerror', (): void => {
      this.onWorkerFailure('');
    });
    inject(DestroyRef).onDestroy((): void => {
      this.send({ type: 'stop' });
      this.worker.terminate();
    });

    this.apply(DEFAULT_PRODUCER_SETTINGS);
  }

  /** Starts a new run: clears the previous run's values and totals, even when it was paused. */
  apply(settings: ProducerSettings): void {
    const runId = ++this.runId;
    this.settingsSubject.next(settings);
    this.rowsSubject.next(emptyRows(settings.instrumentCount));
    this.errorSubject.next(null);
    this.statusSubject.next('initializing');
    this.send({ type: 'start', runId, settings });
  }

  /** The status changes once the worker confirms it. */
  pause(): void {
    this.send({ type: 'pause' });
  }

  /** The status changes once the worker confirms it. */
  resume(): void {
    this.send({ type: 'resume' });
  }

  private onEvent(event: ProducerEvent): void {
    if (event.runId !== this.runId) {
      return;
    }
    switch (event.type) {
      case 'status':
        this.statusSubject.next(event.status);
        break;
      case 'snapshot':
        this.rowsSubject.next(event.rows);
        break;
      case 'error':
        // The worker follows up with `status: 'error'`.
        this.errorSubject.next(event.message);
        break;
    }
  }

  /** The worker script itself failed. Such errors belong to no run. */
  private onWorkerFailure(message: string): void {
    this.errorSubject.next(message || WORKER_FAILURE_MESSAGE);
    this.statusSubject.next('error');
  }

  private send(command: ProducerCommand): void {
    this.worker.postMessage(command);
  }
}

/** Rows shown before the first snapshot: the same symbols and unavailable values as the worker. */
function emptyRows(instrumentCount: number): readonly MarketRow[] {
  return toMarketRows(createInstruments(instrumentCount));
}
