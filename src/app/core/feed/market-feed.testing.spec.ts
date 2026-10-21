import type { Provider } from '@angular/core';
import type { ProducerCommand, ProducerEvent } from '@core/producer/producer.type';
import { PRODUCER_WORKER_FACTORY, type ProducerWorker } from './worker-factory.token';

type Listener = (event: Event) => void;

/** Records posted commands and lets a test deliver worker events synchronously. */
export class FakeProducerWorker implements ProducerWorker {
  readonly posted: ProducerCommand[] = [];
  terminated = false;
  private readonly listeners = new Map<string, Listener[]>();

  postMessage(message: unknown): void {
    this.posted.push(message as ProducerCommand);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback: Listener =
      typeof listener === 'function'
        ? listener
        : (event: Event): void => {
            listener.handleEvent(event);
          };
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Delivers an event as if the worker had posted it. */
  emit(event: ProducerEvent): void {
    this.dispatch(new MessageEvent('message', { data: event }));
  }

  /** Simulates the worker script failing to load or crashing. */
  fail(message: string): void {
    this.dispatch(new ErrorEvent('error', { message }));
  }

  private dispatch(event: Event): void {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
  }
}

export function provideFakeProducerWorker(worker: FakeProducerWorker): Provider {
  return { provide: PRODUCER_WORKER_FACTORY, useValue: (): ProducerWorker => worker };
}
