// kittcore/src/embeddings/config.rs
//
// Configuration types for the embedding pipeline

use serde::{Deserialize, Serialize};
use std::fmt;

/// Supported ONNX models
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OnnxModel {
    /// BAAI/bge-small-en-v1.5 - 384 dimensions, fast
    #[serde(rename = "bge-small-en-v1.5")]
    BGESmallENV15,
    
    /// nomic-ai/modernbert-embed-base - 768 dimensions, high quality
    #[serde(rename = "modernbert-embed-base")]
    ModernBERTBase,
    
    /// all-MiniLM-L6-v2 - 384 dimensions, lightweight
    #[serde(rename = "all-minilm-l6-v2")]
    AllMiniLML6V2,
}

impl Default for OnnxModel {
    fn default() -> Self {
        Self::BGESmallENV15
    }
}

impl fmt::Display for OnnxModel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::BGESmallENV15 => write!(f, "bge-small-en-v1.5"),
            Self::ModernBERTBase => write!(f, "modernbert-embed-base"),
            Self::AllMiniLML6V2 => write!(f, "all-minilm-l6-v2"),
        }
    }
}

impl OnnxModel {
    /// Get the expected embedding dimensions for this model
    pub fn dimensions(&self) -> usize {
        match self {
            Self::BGESmallENV15 => 384,
            Self::ModernBERTBase => 768,
            Self::AllMiniLML6V2 => 384,
        }
    }
    
    /// Get the maximum sequence length for this model
    pub fn max_length(&self) -> usize {
        match self {
            Self::BGESmallENV15 => 512,
            Self::ModernBERTBase => 8192,
            Self::AllMiniLML6V2 => 512,
        }
    }
    
    /// Get HuggingFace model ID
    pub fn hf_model_id(&self) -> &'static str {
        match self {
            Self::BGESmallENV15 => "BAAI/bge-small-en-v1.5",
            Self::ModernBERTBase => "nomic-ai/modernbert-embed-base",
            Self::AllMiniLML6V2 => "sentence-transformers/all-MiniLM-L6-v2",
        }
    }
    
    /// Check if model supports Matryoshka Representation Learning (MRL)
    /// MRL models front-load signal, so truncation preserves quality
    pub fn supports_matryoshka(&self) -> bool {
        matches!(self, Self::BGESmallENV15 | Self::ModernBERTBase)
    }
}

/// Pooling strategy for converting token embeddings to sentence embedding
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum PoolingStrategy {
    /// Mean pooling over all tokens (most common)
    #[default]
    Mean,
    
    /// Use [CLS] token embedding
    Cls,
    
    /// Max pooling over tokens
    Max,
}

/// Text splitting strategy for chunking
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SplittingStrategy {
    /// Split on sentence boundaries
    #[default]
    Sentence,
    
    /// Split on paragraph boundaries
    Paragraph,
    
    /// Split by character count only
    Character,
}

/// Embedding pipeline configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbedConfig {
    /// Which model to use
    pub model: OnnxModel,
    
    /// Matryoshka truncation dimension (None = full dimensions)
    /// Only effective for models that support MRL
    pub truncate_dim: Option<usize>,
    
    /// Batch size for processing multiple texts
    pub batch_size: usize,
    
    /// Chunk size for long documents (in characters)
    pub chunk_size: usize,
    
    /// Chunk overlap ratio (0.0-0.5)
    pub chunk_overlap: f32,
    
    /// Pooling strategy
    pub pooling: PoolingStrategy,
    
    /// Text splitting strategy
    pub splitting: SplittingStrategy,
    
    /// Whether to normalize embeddings (L2)
    pub normalize: bool,
}

impl Default for EmbedConfig {
    fn default() -> Self {
        Self {
            model: OnnxModel::default(),
            truncate_dim: None,
            batch_size: 32,
            chunk_size: 512,
            chunk_overlap: 0.1,
            pooling: PoolingStrategy::default(),
            splitting: SplittingStrategy::default(),
            normalize: true,
        }
    }
}

impl EmbedConfig {
    /// Create config for BGE Small
    pub fn bge_small() -> Self {
        Self {
            model: OnnxModel::BGESmallENV15,
            ..Default::default()
        }
    }
    
    /// Create config for ModernBERT
    pub fn modernbert() -> Self {
        Self {
            model: OnnxModel::ModernBERTBase,
            chunk_size: 1024, // Can handle longer sequences
            ..Default::default()
        }
    }
    
    /// Builder: set batch size
    pub fn with_batch_size(mut self, size: usize) -> Self {
        self.batch_size = size;
        self
    }
    
    /// Builder: set chunk size
    pub fn with_chunk_size(mut self, size: usize) -> Self {
        self.chunk_size = size;
        self
    }
    
    /// Builder: set truncation dimension (Matryoshka)
    pub fn with_truncate_dim(mut self, dim: usize) -> Self {
        self.truncate_dim = Some(dim);
        self
    }
    
    /// Get effective embedding dimension (after truncation)
    pub fn effective_dim(&self) -> usize {
        self.truncate_dim.unwrap_or_else(|| self.model.dimensions())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_dimensions() {
        assert_eq!(OnnxModel::BGESmallENV15.dimensions(), 384);
        assert_eq!(OnnxModel::ModernBERTBase.dimensions(), 768);
    }

    #[test]
    fn test_default_config() {
        let config = EmbedConfig::default();
        assert_eq!(config.model, OnnxModel::BGESmallENV15);
        assert!(config.normalize);
        assert_eq!(config.truncate_dim, None);
    }
    
    #[test]
    fn test_matryoshka_support() {
        assert!(OnnxModel::BGESmallENV15.supports_matryoshka());
        assert!(OnnxModel::ModernBERTBase.supports_matryoshka());
        assert!(!OnnxModel::AllMiniLML6V2.supports_matryoshka());
    }
    
    #[test]
    fn test_truncate_dim_builder() {
        let config = EmbedConfig::default().with_truncate_dim(128);
        assert_eq!(config.truncate_dim, Some(128));
        assert_eq!(config.effective_dim(), 128);
    }
    
    #[test]
    fn test_effective_dim_full() {
        let config = EmbedConfig::default();
        assert_eq!(config.effective_dim(), 384); // BGE-small full = 384
        
        let config_modern = EmbedConfig::modernbert();
        assert_eq!(config_modern.effective_dim(), 768); // ModernBERT full = 768
    }
    
    #[test]
    fn test_effective_dim_truncated() {
        let config = EmbedConfig::modernbert().with_truncate_dim(256);
        assert_eq!(config.effective_dim(), 256);
    }
}
