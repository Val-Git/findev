/// <reference lib="webworker" />

import { ProducerEngine } from './producer.engine';
import type { ProducerCommand, ProducerEvent } from './producer.type';
import { createWasmGeneratorFactory } from './utils/wasm-generator.util';

// The build copies the binary to `<base>/wasm/` (see angular.json assets), next to the worker bundle.
const wasmUrl = new URL('wasm/market_gen_bg.wasm', self.location.href);

const engine = new ProducerEngine({
  createGenerator: createWasmGeneratorFactory(wasmUrl),
  createSeed: (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
  post: (event: ProducerEvent): void => {
    postMessage(event);
  },
});

addEventListener('message', ({ data }: MessageEvent<ProducerCommand>): void => {
  engine.handle(data);
});
