pub mod core;
pub mod reflex;
pub mod syntax;
pub mod temporal;
pub mod relation;
pub mod implicit;
pub mod triple;
pub mod change;
pub mod incremental;
pub mod document;
pub mod conductor;
pub mod chunker;
pub mod attacher;
pub mod resolver;
pub mod dialogue;
pub mod narrative;
pub mod unified;      // NEW: Unified scanner (TDD)
pub mod constraints;  // NEW: Ref validation (TDD)
pub mod projections;  // NEW: Views & projections (TDD)
pub mod structured_relation;  // NEW: Phase 1 - Structure-based relation extraction (TDD)
pub mod relation_filter;      // NEW: Sidecar filter for relationship tuning

// Note: core::* removed to avoid ambiguous ScanResult/ScanStats re-export with document::*
// Use scanner::core::DocumentScanner directly if needed
pub use reflex::*;
pub use syntax::*;
pub use temporal::*;
pub use relation::*;
pub use implicit::*;
pub use triple::*;
pub use change::*;
pub use document::*;
pub use conductor::*;




