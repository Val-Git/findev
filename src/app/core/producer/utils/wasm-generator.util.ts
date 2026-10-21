import initWasm, { fieldsPerUpdate, Generator } from '@wasm/market-gen/market_gen';
import { errorMessage } from '@shared/utils/errors.util';
import { FIELDS_PER_UPDATE } from '../market-update.const';

/** The part of the Wasm generator the engine depends on; tests substitute a fake. */
export interface BatchGenerator {
  /** Returns `count` updates as `count * FIELDS_PER_UPDATE` integers. */
  nextBatch(count: number): Int32Array;
  /** Releases the generator's Wasm memory. */
  free(): void;
}

export type GeneratorFactory = (instrumentCount: number, seed: number) => Promise<BatchGenerator>;

/**
 * Loads the Wasm module once (on first use) and creates generators from it.
 * A failed load is not cached, so a later run can retry.
 */
export function createWasmGeneratorFactory(wasmUrl: URL): GeneratorFactory {
  let ready: Promise<void> | null = null;

  return async (instrumentCount: number, seed: number): Promise<BatchGenerator> => {
    ready ??= loadModule(wasmUrl).catch((error: unknown): never => {
      ready = null;
      throw error;
    });
    await ready;
    try {
      return new Generator(instrumentCount, seed);
    } catch (error) {
      throw new Error(`Failed to create the market generator: ${errorMessage(error)}`, {
        cause: error,
      });
    }
  };
}

async function loadModule(wasmUrl: URL): Promise<void> {
  try {
    await initWasm({ module_or_path: wasmUrl });
  } catch (error) {
    throw new Error(`Failed to load the WebAssembly module: ${errorMessage(error)}`, {
      cause: error,
    });
  }
  const wasmFields = fieldsPerUpdate();
  if (wasmFields !== FIELDS_PER_UPDATE) {
    throw new Error(
      `WebAssembly module encodes ${String(wasmFields)} fields per update, expected ${String(FIELDS_PER_UPDATE)}.`,
    );
  }
}
