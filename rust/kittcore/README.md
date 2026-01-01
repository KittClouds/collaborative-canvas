# ResoRank Core (Rust/WASM)

High-performance, resonance-based search ranking engine compiled to WebAssembly.

## Features
- **BM25F Implementation**: Field-weighted scoring
- **Proximity Ranking**: Boost scores when terms appear close to each other
    - Strategies: Global, Pairwise, IDF-Weighted, Per-Term
- **BM𝒳 Entropy Extension**: Using term entropy to detect meaningful keywords
- **Incremental Scoring**: Streaming API for real-time search during typing
- **Zero-Copy Serialization**: Efficient JS<->Rust communication via `serde-wasm-bindgen`

## Usage (TypeScript)

```typescript
import init, { ResoRankScorer, ResoRankConfig } from "resorank-core";

await init();

// 1. Configure
const config = {
    k1: 1.2,
    b: 0.75,
    proximity_strategy: "idf-weighted"
};

// 2. Initialize
const scorer = new ResoRankScorer(config, corpusStats);

// 3. Index Documents
scorer.indexDocument("doc1", metadata, tokens);

// 4. Search
const results = scorer.search(["query", "terms"], 10);
```

## Building
```bash
wasm-pack build --target web --release
```
