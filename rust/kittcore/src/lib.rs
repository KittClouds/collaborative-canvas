//! KittCore: Document Scanner + ResoRank Search Engine
//!
//! A Rust/WASM implementation of the KittClouds document analysis pipeline.
//!
//! # Architecture
//!
//! ## Scanner Components (Entity System 5.0)
//! - `document.rs` - DocumentCortex: **Unified scanner** - single scan() for all extraction
//! - `relation.rs` - RelationCortex: Relationship extraction (260+ patterns, bidirectional)
//! - `implicit.rs` - ImplicitCortex: Entity name matching via Aho-Corasick
//! - `triple.rs` - TripleCortex: Triple [[A->B->C]] syntax extraction
//! - `change.rs` - ChangeDetector: Content-addressable skip detection
//! - `syntax.rs` - SyntaxCortex: Document syntax patterns (wikilinks, tags, entities)
//! - `temporal.rs` - TemporalCortex: Temporal expression detection (126+ patterns)
//! - `reflex.rs` - ReflexCortex: Entity name matching (legacy)
//!
//! ## Search Components (ResoRank)
//! - `config.rs` - Configuration types and defaults
//! - `types.rs` - Core data structures (TokenMetadata, DocumentMetadata, etc.)
//! - `scorer.rs` - Main ResoRankScorer implementation
//!
//! # Usage (WASM)
//! ```javascript,ignore
//! import init, { DocumentCortex } from 'kittcore';
//!
//! await init();
//!
//! // Create unified scanner
//! const cortex = new DocumentCortex();
//!
//! // Hydrate with entities for implicit matching
//! cortex.hydrate_entities([
//!   { id: 'e1', label: 'Frodo', kind: 'CHARACTER', aliases: ['Mr. Frodo'] }
//! ]);
//!
//! // Single scan call - extracts everything
//! const result = cortex.scan(
//!   "Frodo is brother of Sam. [[Frodo->OWNS->Ring]]",
//!   [{ label: 'Frodo', start: 0, end: 5 }, { label: 'Sam', start: 20, end: 23 }]
//! );
//!
//! // Result contains: relations, triples, implicit mentions, timings
//! console.log(result.relations);  // Bidirectional: Frodo<->Sam
//! console.log(result.triples);    // Frodo->OWNS->Ring
//! console.log(result.implicit);   // Frodo mentions
//! console.log(result.stats);      // Timing per phase
//! ```

// Scanner modules (Entity System 5.0)
pub mod scanner;
pub mod resorank;

// Public exports - Scanner
pub use scanner::*;

// Public exports - ResoRank
pub use resorank::*;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator for smaller WASM bundle size.
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
    format!("Hello, {}! KittCore WASM is ready.", name)
}

/// Get version information
#[wasm_bindgen]
pub fn version() -> String {
    format!("kittcore v{}", env!("CARGO_PKG_VERSION"))
}
