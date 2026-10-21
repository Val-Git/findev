//! Per-instrument state and the simplified price model. All prices are integer cents.
//!
//! Each step:
//! 1. the bid does a small random walk with a weak pull back to its starting price;
//! 2. a fresh spread (at least one cent) puts the ask above the bid;
//! 3. book quantities random-walk around a base level;
//! 4. a trade hits the ask (buy) or the bid (sell), with buys more likely when the
//!    book leans to the bid side.

use crate::rng::Rng;
use crate::update::MarketUpdate;

pub const MIN_PRICE_CENTS: i64 = 100;
/// Keeps every price, including `bid + spread`, well inside `i32`.
pub const MAX_PRICE_CENTS: i64 = 10_000_000;
pub const MAX_BOOK_QUANTITY: i64 = 5_000;
pub const MAX_TRADE_QUANTITY: i64 = 100;

const INITIAL_PRICE_CENTS: (i64, i64) = (2_000, 50_000);
/// Largest single-step price move, as a share of the price (per uniform term).
const VOLATILITY: f64 = 0.0005;
/// Share of the distance to the starting price recovered on each step.
const PRICE_REVERSION: f64 = 0.001;
/// Largest spread, as a share of the price.
const MAX_SPREAD_RATIO: f64 = 0.001;

const BOOK_BASE_QUANTITY: i64 = 500;
const INITIAL_BOOK_QUANTITY: (i64, i64) = (100, 1_000);
const BOOK_STEP: i64 = 100;
const BOOK_REVERSION: f64 = 0.02;
/// How strongly book imbalance tilts trades: buy probability is `0.5 + bias * imbalance`.
const IMBALANCE_BIAS: f64 = 0.25;

pub struct InstrumentState {
    index: u32,
    anchor_cents: i64,
    bid_cents: i64,
    bid_quantity: i64,
    ask_quantity: i64,
}

impl InstrumentState {
    pub fn new(index: u32, rng: &mut Rng) -> Self {
        let price = rng.range_inclusive(INITIAL_PRICE_CENTS.0, INITIAL_PRICE_CENTS.1);
        Self {
            index,
            anchor_cents: price,
            bid_cents: price,
            bid_quantity: rng.range_inclusive(INITIAL_BOOK_QUANTITY.0, INITIAL_BOOK_QUANTITY.1),
            ask_quantity: rng.range_inclusive(INITIAL_BOOK_QUANTITY.0, INITIAL_BOOK_QUANTITY.1),
        }
    }

    pub fn step(&mut self, rng: &mut Rng) -> MarketUpdate {
        self.walk_price(rng);
        let bid = self.bid_cents;
        let ask = bid + rng.range_inclusive(1, max_spread(bid));

        self.bid_quantity = walk_book_quantity(self.bid_quantity, rng);
        self.ask_quantity = walk_book_quantity(self.ask_quantity, rng);

        let is_buy = rng.chance(buy_probability(self.bid_quantity, self.ask_quantity));
        let trade_quantity = rng.range_inclusive(1, MAX_TRADE_QUANTITY);

        MarketUpdate {
            instrument: self.index,
            price_cents: (if is_buy { ask } else { bid }) as i32,
            trade_quantity: trade_quantity as i32,
            bid_cents: bid as i32,
            ask_cents: ask as i32,
            bid_quantity: self.bid_quantity as i32,
            ask_quantity: self.ask_quantity as i32,
        }
    }

    fn walk_price(&mut self, rng: &mut Rng) {
        let step = price_step(self.bid_cents);
        // Sum of two uniforms: small moves are common, large ones rare.
        let noise = rng.range_inclusive(-step, step) + rng.range_inclusive(-step, step);
        let reversion =
            ((self.anchor_cents - self.bid_cents) as f64 * PRICE_REVERSION).round() as i64;
        self.bid_cents =
            (self.bid_cents + noise + reversion).clamp(MIN_PRICE_CENTS, MAX_PRICE_CENTS);
    }
}

/// Largest move of one uniform term for a given price; at least one cent so prices never freeze.
pub fn price_step(price_cents: i64) -> i64 {
    ((price_cents as f64 * VOLATILITY) as i64).max(1)
}

pub fn max_spread(price_cents: i64) -> i64 {
    ((price_cents as f64 * MAX_SPREAD_RATIO) as i64).max(1)
}

fn walk_book_quantity(quantity: i64, rng: &mut Rng) -> i64 {
    let reversion = ((BOOK_BASE_QUANTITY - quantity) as f64 * BOOK_REVERSION).round() as i64;
    (quantity + rng.range_inclusive(-BOOK_STEP, BOOK_STEP) + reversion).clamp(0, MAX_BOOK_QUANTITY)
}

fn buy_probability(bid_quantity: i64, ask_quantity: i64) -> f64 {
    let total = bid_quantity + ask_quantity;
    if total == 0 {
        return 0.5;
    }
    let imbalance = (bid_quantity - ask_quantity) as f64 / total as f64;
    0.5 + IMBALANCE_BIAS * imbalance
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(bid_quantity: i64, ask_quantity: i64) -> InstrumentState {
        InstrumentState {
            index: 0,
            anchor_cents: 10_000,
            bid_cents: 10_000,
            bid_quantity,
            ask_quantity,
        }
    }

    fn buy_share(bid_quantity: i64, ask_quantity: i64) -> f64 {
        let mut rng = Rng::new(11);
        let trials = 10_000;
        let buys = (0..trials)
            .filter(|_| {
                let update = state(bid_quantity, ask_quantity).step(&mut rng);
                update.price_cents == update.ask_cents
            })
            .count();
        buys as f64 / trials as f64
    }

    #[test]
    fn bid_heavy_book_favours_buys_at_ask() {
        assert!(buy_share(MAX_BOOK_QUANTITY, 0) > 0.65);
    }

    #[test]
    fn ask_heavy_book_favours_sells_at_bid() {
        assert!(buy_share(0, MAX_BOOK_QUANTITY) < 0.35);
    }

    #[test]
    fn buy_probability_matches_formula() {
        assert_eq!(buy_probability(0, 0), 0.5);
        assert_eq!(buy_probability(500, 500), 0.5);
        assert_eq!(buy_probability(600, 400), 0.5 + IMBALANCE_BIAS * 0.2);
        assert_eq!(buy_probability(1, 0), 0.5 + IMBALANCE_BIAS);
    }

    #[test]
    fn price_never_leaves_bounds_at_the_floor() {
        let mut rng = Rng::new(5);
        let mut instrument = InstrumentState {
            index: 0,
            anchor_cents: MIN_PRICE_CENTS,
            bid_cents: MIN_PRICE_CENTS,
            bid_quantity: 0,
            ask_quantity: 0,
        };
        for _ in 0..10_000 {
            let update = instrument.step(&mut rng);
            assert!(i64::from(update.bid_cents) >= MIN_PRICE_CENTS);
            assert!(update.bid_cents < update.ask_cents);
            assert!(update.bid_quantity >= 0 && update.ask_quantity >= 0);
        }
    }

    #[test]
    fn step_and_spread_are_at_least_one_cent() {
        assert_eq!(price_step(MIN_PRICE_CENTS), 1);
        assert_eq!(max_spread(MIN_PRICE_CENTS), 1);
        assert_eq!(price_step(100_000), 50);
        assert_eq!(max_spread(100_000), 100);
    }
}
