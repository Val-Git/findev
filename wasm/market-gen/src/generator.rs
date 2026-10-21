//! Stateful batch generator: owns the RNG and every instrument's state between calls.

use std::fmt;

use crate::instrument::InstrumentState;
use crate::rng::Rng;
use crate::update::FIELDS_PER_UPDATE;

/// Safety limits against accidental huge allocations. The UI enforces the task's own limits.
pub const MAX_INSTRUMENTS: u32 = 1_000;
pub const MAX_BATCH_SIZE: u32 = 100_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GeneratorError {
    InvalidInstrumentCount(u32),
    InvalidBatchSize(u32),
}

impl fmt::Display for GeneratorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInstrumentCount(count) => {
                write!(
                    f,
                    "instrument count must be between 1 and {MAX_INSTRUMENTS}, got {count}"
                )
            }
            Self::InvalidBatchSize(count) => {
                write!(
                    f,
                    "batch size must be between 1 and {MAX_BATCH_SIZE}, got {count}"
                )
            }
        }
    }
}

impl std::error::Error for GeneratorError {}

pub struct MarketGenerator {
    rng: Rng,
    instruments: Vec<InstrumentState>,
}

impl MarketGenerator {
    pub fn new(instrument_count: u32, seed: u64) -> Result<Self, GeneratorError> {
        if !(1..=MAX_INSTRUMENTS).contains(&instrument_count) {
            return Err(GeneratorError::InvalidInstrumentCount(instrument_count));
        }
        let mut rng = Rng::new(seed);
        let instruments = (0..instrument_count)
            .map(|index| InstrumentState::new(index, &mut rng))
            .collect();
        Ok(Self { rng, instruments })
    }

    pub fn instrument_count(&self) -> u32 {
        self.instruments.len() as u32
    }

    /// Generates exactly `count` updates, each for a uniformly chosen instrument, encoded as
    /// `count * FIELDS_PER_UPDATE` integers.
    pub fn next_batch(&mut self, count: u32) -> Result<Vec<i32>, GeneratorError> {
        if !(1..=MAX_BATCH_SIZE).contains(&count) {
            return Err(GeneratorError::InvalidBatchSize(count));
        }
        let last_index = self.instruments.len() as i64 - 1;
        let mut out = vec![0; count as usize * FIELDS_PER_UPDATE];
        for fields in out.as_chunks_mut::<FIELDS_PER_UPDATE>().0 {
            let index = self.rng.range_inclusive(0, last_index) as usize;
            self.instruments[index].step(&mut self.rng).write_to(fields);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instrument::{MAX_PRICE_CENTS, MAX_TRADE_QUANTITY, MIN_PRICE_CENTS};
    use crate::update::MarketUpdate;

    fn decode(batch: &[i32]) -> Vec<MarketUpdate> {
        batch
            .as_chunks::<FIELDS_PER_UPDATE>()
            .0
            .iter()
            .map(MarketUpdate::read_from)
            .collect()
    }

    fn assert_valid(update: &MarketUpdate, instrument_count: u32) {
        assert!(update.instrument < instrument_count, "{update:?}");
        assert!(i64::from(update.bid_cents) >= MIN_PRICE_CENTS, "{update:?}");
        assert!(
            i64::from(update.ask_cents) <= MAX_PRICE_CENTS * 2,
            "{update:?}"
        );
        assert!(update.bid_cents < update.ask_cents, "{update:?}");
        assert!(
            update.price_cents == update.bid_cents || update.price_cents == update.ask_cents,
            "{update:?}"
        );
        assert!(
            (1..=MAX_TRADE_QUANTITY).contains(&i64::from(update.trade_quantity)),
            "{update:?}"
        );
        assert!(
            update.bid_quantity >= 0 && update.ask_quantity >= 0,
            "{update:?}"
        );
    }

    #[test]
    fn returns_exactly_the_requested_batch_size() {
        let mut generator = MarketGenerator::new(5, 1).unwrap();
        for count in [1, 100, 1_000] {
            assert_eq!(
                generator.next_batch(count).unwrap().len(),
                count as usize * FIELDS_PER_UPDATE
            );
        }
    }

    #[test]
    fn rejects_invalid_sizes() {
        assert_eq!(
            MarketGenerator::new(0, 1).err(),
            Some(GeneratorError::InvalidInstrumentCount(0))
        );
        assert!(MarketGenerator::new(MAX_INSTRUMENTS + 1, 1).is_err());
        let mut generator = MarketGenerator::new(5, 1).unwrap();
        assert_eq!(
            generator.next_batch(0),
            Err(GeneratorError::InvalidBatchSize(0))
        );
        assert!(generator.next_batch(MAX_BATCH_SIZE + 1).is_err());
    }

    #[test]
    fn accepts_boundary_sizes() {
        assert_eq!(MarketGenerator::new(1, 1).unwrap().instrument_count(), 1);
        assert_eq!(
            MarketGenerator::new(MAX_INSTRUMENTS, 1)
                .unwrap()
                .instrument_count(),
            MAX_INSTRUMENTS
        );
    }

    #[test]
    fn error_messages_are_readable() {
        assert_eq!(
            GeneratorError::InvalidBatchSize(0).to_string(),
            "batch size must be between 1 and 100000, got 0"
        );
    }

    #[test]
    fn generated_values_are_valid() {
        for seed in 0..10 {
            let mut generator = MarketGenerator::new(7, seed).unwrap();
            for update in decode(&generator.next_batch(10_000).unwrap()) {
                assert_valid(&update, 7);
            }
        }
    }

    #[test]
    fn single_instrument_receives_every_update() {
        let mut generator = MarketGenerator::new(1, 3).unwrap();
        assert!(
            decode(&generator.next_batch(100).unwrap())
                .iter()
                .all(|u| u.instrument == 0)
        );
    }

    #[test]
    fn every_instrument_appears_in_a_large_batch() {
        let mut generator = MarketGenerator::new(5, 2).unwrap();
        let updates = decode(&generator.next_batch(1_000).unwrap());
        for index in 0..5 {
            assert!(
                updates.iter().any(|u| u.instrument == index),
                "instrument {index} missing"
            );
        }
    }

    #[test]
    fn prices_evolve_continuously_across_batches() {
        let mut generator = MarketGenerator::new(3, 4).unwrap();
        let mut last_bid: [Option<i64>; 3] = [None; 3];
        // Many small batches, so consecutive updates of an instrument often span two calls.
        for _ in 0..1_000 {
            for update in decode(&generator.next_batch(10).unwrap()) {
                let bid = i64::from(update.bid_cents);
                let slot = &mut last_bid[update.instrument as usize];
                if let Some(previous) = *slot {
                    let max_move = (previous / 100).max(5);
                    assert!(
                        (bid - previous).abs() <= max_move,
                        "bid jumped from {previous} to {bid}"
                    );
                }
                *slot = Some(bid);
            }
        }
    }

    #[test]
    fn same_seed_reproduces_batches() {
        let mut a = MarketGenerator::new(5, 99).unwrap();
        let mut b = MarketGenerator::new(5, 99).unwrap();
        for _ in 0..10 {
            assert_eq!(a.next_batch(100).unwrap(), b.next_batch(100).unwrap());
        }
    }

    #[test]
    fn different_seeds_produce_different_batches() {
        let mut a = MarketGenerator::new(5, 1).unwrap();
        let mut b = MarketGenerator::new(5, 2).unwrap();
        assert_ne!(a.next_batch(100).unwrap(), b.next_batch(100).unwrap());
    }

    #[test]
    fn long_run_stays_within_price_bounds() {
        let mut generator = MarketGenerator::new(10, 8).unwrap();
        for _ in 0..1_000 {
            for update in decode(&generator.next_batch(1_000).unwrap()) {
                assert_valid(&update, 10);
                assert!(i64::from(update.bid_cents) <= MAX_PRICE_CENTS);
            }
        }
    }
}
