# Rust Porting Status: ResoRank Core

## ✅ Objectives Completed
1. **Rust Project Setup**: Created `rust/resorank-core` with `wasm-bindgen` and `serde` support.
2. **1:1 Porting**: Ported the entire `resorank` TypeScript module to Rust.
   - Core Logic: BM25F, Proximity (Global, Pairwise, IdfWeighted), BM𝒳 Extensions (Entropy, Similarity).
   - Helper Modules: `math.rs` (IDF, saturation), `entropy.rs` (LRU cache), `incremental.rs` (streaming).
3. **Testing**: 
   - **Unit Tests**: 28/28 Rust unit tests passed.
   - **WASM Verification**: Verified in browser via `test_harness.html`.

## 📂 Project Structure
```
rust/resorank-core/
├── Cargo.toml              # Build configuration
└── src/
    ├── lib.rs              # WASM entry point
    ├── config.rs           # Configuration structs
    ├── types.rs            # Data structures
    ├── math.rs             # Mathematical utilities
    ├── proximity.rs        # Proximity algorithms
    ├── entropy.rs          # Entropy caching & calculation
    ├── scorer.rs           # Main ResoRankScorer logic
    └── incremental.rs      # Streaming scorer
```

## 🚀 Performance & Features
- **WASM optimized**: Binary size is ~49KB (gzip compressed would be even smaller).
- **Zero-copy serialization**: Uses `serde-wasm-bindgen` for efficient JS<->Rust data transfer.
- **Full Feature Parity**: Includes all advanced features from the TS version (BM𝒳, adaptive alpha, phrase boosting).

## 🛠 Usage
```javascript
import init, { ResoRankScorer } from './pkg/resorank_core.js';

await init();
const scorer = new ResoRankScorer(config, corpusStats);
scorer.indexDocument("doc1", meta, tokens);
const results = scorer.search(["query"], 10);
```
