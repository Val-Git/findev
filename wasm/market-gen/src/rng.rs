//! Small deterministic pseudo-random number generator.
//!
//! SplitMix64 scrambles the seed into the initial state, then xorshift64* produces the
//! sequence. It is fast, has no dependencies and is fully reproducible for a given seed,
//! which keeps generator tests deterministic. It is not cryptographically secure.

pub struct Rng {
    state: u64,
}

impl Rng {
    pub fn new(seed: u64) -> Self {
        let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        // xorshift gets stuck on an all-zero state, so never start from it.
        let state = if z == 0 { 0x9E37_79B9_7F4A_7C15 } else { z };
        Self { state }
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.state = x;
        x.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    /// Uniform value in `[0, 1)` built from the top 53 bits.
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// Uniform integer in `[lo, hi]`. The modulo bias is negligible for the small spans used here.
    pub fn range_inclusive(&mut self, lo: i64, hi: i64) -> i64 {
        debug_assert!(lo <= hi, "empty range {lo}..={hi}");
        let span = hi.abs_diff(lo) + 1;
        lo + (self.next_u64() % span) as i64
    }

    /// `true` with probability `p`.
    pub fn chance(&mut self, p: f64) -> bool {
        self.next_f64() < p
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sequence(seed: u64, len: usize) -> Vec<u64> {
        let mut rng = Rng::new(seed);
        (0..len).map(|_| rng.next_u64()).collect()
    }

    #[test]
    fn same_seed_gives_same_sequence() {
        assert_eq!(sequence(42, 100), sequence(42, 100));
    }

    #[test]
    fn different_seeds_give_different_sequences() {
        assert_ne!(sequence(1, 100), sequence(2, 100));
    }

    #[test]
    fn zero_seed_does_not_degenerate() {
        let values = sequence(0, 100);
        assert!(values.iter().all(|&v| v != 0));
        assert!(values.windows(2).all(|w| w[0] != w[1]));
    }

    #[test]
    fn range_stays_in_bounds_and_hits_both_ends() {
        let mut rng = Rng::new(7);
        let values: Vec<i64> = (0..10_000).map(|_| rng.range_inclusive(-3, 3)).collect();
        assert!(values.iter().all(|v| (-3..=3).contains(v)));
        assert!(values.contains(&-3));
        assert!(values.contains(&3));
    }

    #[test]
    fn single_value_range_returns_that_value() {
        let mut rng = Rng::new(7);
        assert!((0..100).all(|_| rng.range_inclusive(5, 5) == 5));
    }

    #[test]
    fn f64_is_in_unit_interval() {
        let mut rng = Rng::new(9);
        assert!(
            (0..10_000)
                .map(|_| rng.next_f64())
                .all(|v| (0.0..1.0).contains(&v))
        );
    }

    #[test]
    fn chance_respects_extremes() {
        let mut rng = Rng::new(3);
        assert!((0..1_000).all(|_| !rng.chance(0.0)));
        assert!((0..1_000).all(|_| rng.chance(1.0)));
    }
}
