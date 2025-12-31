//! ResoRank: Resonance-Based Hybrid Scoring System
//!
//! A Quantum-BM25F implementation with IDF-weighted proximity and adaptive segmentation.
//! This is a 1:1 port from TypeScript for performance-critical WASM usage.
//!
//! # Architecture
//! - `config.rs` - Configuration types and defaults
//! - `types.rs` - Core data structures (TokenMetadata, DocumentMetadata, etc.)
//! - `math.rs` - Math utilities (IDF, TF normalization, saturation, popcount)
//! - `proximity.rs` - Proximity strategies (Global, PerTerm, Pairwise, IdfWeighted)
//! - `entropy.rs` - BM𝒳 entropy calculations and caching
//! - `scorer.rs` - Main ResoRankScorer implementation
//! - `incremental.rs` - Incremental scoring for streaming updates
//!
//! # Usage (WASM)
//! ```javascript
//! import init, { ResoRankScorer, ProximityStrategy } from 'resorank-core';
//!
//! await init();
//! const scorer = new ResoRankScorer(corpusStats);
//! scorer.indexDocument(docId, docMeta, tokens);
//! const results = scorer.search(query, 10);
//! ```

mod config;
mod entropy;
mod incremental;
mod math;
mod proximity;
mod scorer;
mod types;

pub use config::*;
pub use entropy::*;
pub use incremental::*;
pub use math::*;
pub use proximity::*;
pub use scorer::*;
pub use types::*;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn main() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Greet function for testing WASM binding
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! ResoRank WASM is ready.", name)
}
