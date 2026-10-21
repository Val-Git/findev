//! One generated market update and its flat `i32` encoding.
//!
//! A batch is a flat array of `FIELDS_PER_UPDATE` integers per update, in the order of the
//! index constants below. The TypeScript side decodes it with the same indices.

pub const FIELDS_PER_UPDATE: usize = 7;

pub const INSTRUMENT: usize = 0;
pub const PRICE_CENTS: usize = 1;
pub const TRADE_QUANTITY: usize = 2;
pub const BID_CENTS: usize = 3;
pub const ASK_CENTS: usize = 4;
pub const BID_QUANTITY: usize = 5;
pub const ASK_QUANTITY: usize = 6;

/// A simulated trade together with the bid/ask snapshot it happened against.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MarketUpdate {
    pub instrument: u32,
    pub price_cents: i32,
    pub trade_quantity: i32,
    pub bid_cents: i32,
    pub ask_cents: i32,
    pub bid_quantity: i32,
    pub ask_quantity: i32,
}

impl MarketUpdate {
    pub fn write_to(&self, out: &mut [i32; FIELDS_PER_UPDATE]) {
        out[INSTRUMENT] = self.instrument as i32;
        out[PRICE_CENTS] = self.price_cents;
        out[TRADE_QUANTITY] = self.trade_quantity;
        out[BID_CENTS] = self.bid_cents;
        out[ASK_CENTS] = self.ask_cents;
        out[BID_QUANTITY] = self.bid_quantity;
        out[ASK_QUANTITY] = self.ask_quantity;
    }

    #[cfg(test)]
    pub fn read_from(fields: &[i32; FIELDS_PER_UPDATE]) -> Self {
        Self {
            instrument: fields[INSTRUMENT] as u32,
            price_cents: fields[PRICE_CENTS],
            trade_quantity: fields[TRADE_QUANTITY],
            bid_cents: fields[BID_CENTS],
            ask_cents: fields[ASK_CENTS],
            bid_quantity: fields[BID_QUANTITY],
            ask_quantity: fields[ASK_QUANTITY],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_through_flat_encoding() {
        let update = MarketUpdate {
            instrument: 3,
            price_cents: 10_200,
            trade_quantity: 30,
            bid_cents: 10_196,
            ask_cents: 10_200,
            bid_quantity: 600,
            ask_quantity: 400,
        };
        let mut fields = [0; FIELDS_PER_UPDATE];
        update.write_to(&mut fields);
        assert_eq!(fields, [3, 10_200, 30, 10_196, 10_200, 600, 400]);
        assert_eq!(MarketUpdate::read_from(&fields), update);
    }
}
