//! RAG Pipeline - Retrieval-Augmented Generation for KittClouds
//!
//! A production-grade RAG pipeline built on:
//! - memchunk: 1TB/s SIMD semantic chunking
//! - ruvector: HNSW vector index
//! - EmbedCortex: ONNX embedding inference
//!
//! # Architecture
//! ```text
//! Document → memchunk (512 tokens) → EmbedCortex → HNSW Index
//!                                                      ↓
//! Query → EmbedCortex → HNSW Search → Top-K Results
//! ```

mod chunker;
mod index;
mod pipeline;

pub use chunker::{RagChunker, Chunk};
pub use index::{VectorIndex, SearchResult};
pub use pipeline::RagPipeline;
