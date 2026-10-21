import type { ProducerCommand } from './producer.type';
import { ProducerRun, type ProducerRunDeps } from './producer-run.engine';

export type ProducerEngineDeps = ProducerRunDeps;

/**
 * Command dispatcher that runs inside the Web Worker:
 * keeps at most one current `ProducerRun` and forwards commands to it.
 */
export class ProducerEngine {
  private current: ProducerRun | null = null;

  constructor(private readonly deps: ProducerEngineDeps) {}

  handle(command: ProducerCommand): void {
    switch (command.type) {
      case 'start':
        this.current?.dispose();
        this.current = ProducerRun.start(command.runId, command.settings, this.deps);
        break;
      case 'pause':
        this.current?.pause();
        break;
      case 'resume':
        this.current?.resume();
        break;
      case 'stop':
        this.current?.stop();
        this.current = null;
        break;
    }
  }
}
