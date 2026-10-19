use wasm_bindgen::prelude::*;

/// Placeholder export that verifies the wasm-pack toolchain end to end.
/// Replaced by the `Generator` API in the next step.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_crate_version() {
        assert_eq!(version(), "0.1.0");
    }
}
