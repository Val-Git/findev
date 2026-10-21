//! Simulated market-update generator compiled to WebAssembly.
//!
//! The core (`MarketGenerator`) is plain Rust and is tested with `cargo test`.
//! `Generator` is the thin `wasm-bindgen` wrapper the Web Worker calls.

mod generator;
mod instrument;
mod rng;
mod update;

use wasm_bindgen::prelude::*;

pub use generator::{GeneratorError, MAX_BATCH_SIZE, MAX_INSTRUMENTS, MarketGenerator};
pub use update::{FIELDS_PER_UPDATE, MarketUpdate};

#[wasm_bindgen]
pub struct Generator {
    inner: MarketGenerator,
}

#[wasm_bindgen]
impl Generator {
    /// Creates a generator for `instrument_count` instruments. Equal seeds give equal output.
    #[wasm_bindgen(constructor)]
    pub fn new(instrument_count: u32, seed: u32) -> Result<Generator, JsError> {
        let inner = MarketGenerator::new(instrument_count, u64::from(seed))?;
        Ok(Self { inner })
    }

    #[wasm_bindgen(getter, js_name = instrumentCount)]
    pub fn instrument_count(&self) -> u32 {
        self.inner.instrument_count()
    }

    /// Returns `count` updates as a flat `Int32Array` of `count * fieldsPerUpdate()` values:
    /// `[instrument, priceCents, tradeQuantity, bidCents, askCents, bidQuantity, askQuantity, ...]`.
    #[wasm_bindgen(js_name = nextBatch)]
    pub fn next_batch(&mut self, count: u32) -> Result<Vec<i32>, JsError> {
        Ok(self.inner.next_batch(count)?)
    }
}

#[wasm_bindgen(js_name = fieldsPerUpdate)]
pub fn fields_per_update() -> u32 {
    FIELDS_PER_UPDATE as u32
}
