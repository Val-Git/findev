/**
 * Flat `Int32Array` layout of a generated batch. Mirrors `wasm/market-gen/src/update.rs`;
 * `createWasmGeneratorFactory` checks that both sides agree on the field count.
 */

export const FIELDS_PER_UPDATE = 7;

export const INSTRUMENT = 0;
export const PRICE_CENTS = 1;
export const TRADE_QUANTITY = 2;
export const BID_CENTS = 3;
export const ASK_CENTS = 4;
export const BID_QUANTITY = 5;
export const ASK_QUANTITY = 6;
