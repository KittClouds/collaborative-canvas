// kittcore/src/embeddings/mod.rs
//
// Rust-native embedding pipeline for A/B testing against TypeScript implementation.
// Uses `tract-onnx` for pure-Rust ONNX inference (WASM-compatible).
//
// Supported models:
// - BGESmallENV15 (BAAI/bge-small-en-v1.5) - 384 dimensions, ~130MB
// - ModernBERTBase (nomic-ai/modernbert-embed-base) - 768 dimensions, ~350MB

pub mod config;
pub mod model;
pub mod tokenize;
pub mod chunker;

// Re-exports
pub use config::{EmbedConfig, OnnxModel, PoolingStrategy, SplittingStrategy};
pub use model::{EmbedModel, EmbedResult};
pub use chunker::{TextChunker, Chunk};

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// WASM-exposed embedding cortex for A/B testing
#[wasm_bindgen]
pub struct EmbedCortex {
    model: Option<EmbedModel>,
    config: EmbedConfig,
}

#[wasm_bindgen]
impl EmbedCortex {
    /// Create a new EmbedCortex with default configuration
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            model: None,
            config: EmbedConfig::default(),
        }
    }

    /// Create with specific model configuration
    #[wasm_bindgen(js_name = withConfig)]
    pub fn with_config(config_js: JsValue) -> Result<EmbedCortex, JsValue> {
        let config: EmbedConfig = serde_wasm_bindgen::from_value(config_js)
            .map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?;
        Ok(Self {
            model: None,
            config,
        })
    }

    /// Load model from ONNX bytes
    /// 
    /// # Arguments
    /// * `model_bytes` - ONNX model file contents
    /// * `tokenizer_json` - tokenizer.json contents  
    #[wasm_bindgen(js_name = loadModel)]
    pub fn load_model(&mut self, model_bytes: &[u8], tokenizer_json: &str) -> Result<(), JsValue> {
        let model = EmbedModel::from_bytes(model_bytes, tokenizer_json, self.config.clone())
            .map_err(|e| JsValue::from_str(&format!("Model load failed: {}", e)))?;
        self.model = Some(model);
        Ok(())
    }

    /// Check if model is loaded
    #[wasm_bindgen(js_name = isReady)]
    pub fn is_ready(&self) -> bool {
        self.model.is_some()
    }

    /// Embed a single text, returning the embedding vector
    #[wasm_bindgen(js_name = embedText)]
    pub fn embed_text(&self, text: &str) -> Result<Vec<f32>, JsValue> {
        let model = self.model.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;
        
        model.embed_single(text)
            .map_err(|e| JsValue::from_str(&format!("Embed failed: {}", e)))
    }

    /// Embed multiple texts, returning array of embedding vectors
    #[wasm_bindgen(js_name = embedTexts)]
    pub fn embed_texts(&self, texts: JsValue) -> Result<JsValue, JsValue> {
        let texts: Vec<String> = serde_wasm_bindgen::from_value(texts)
            .map_err(|e| JsValue::from_str(&format!("Invalid texts: {}", e)))?;
        
        let model = self.model.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;
        
        let embeddings = model.embed_batch(&texts)
            .map_err(|e| JsValue::from_str(&format!("Batch embed failed: {}", e)))?;
        
        serde_wasm_bindgen::to_value(&embeddings)
            .map_err(|e| JsValue::from_str(&format!("Serialize failed: {}", e)))
    }

    /// Chunk text and embed each chunk
    #[wasm_bindgen(js_name = chunkAndEmbed)]
    pub fn chunk_and_embed(&self, text: &str) -> Result<JsValue, JsValue> {
        let model = self.model.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;
        
        let chunker = TextChunker::new(
            self.config.chunk_size,
            self.config.chunk_overlap,
        );
        
        let chunks = chunker.chunk(text);
        let chunk_texts: Vec<&str> = chunks.iter().map(|c| c.text.as_str()).collect();
        
        let embeddings = model.embed_batch(&chunk_texts.iter().map(|s| s.to_string()).collect::<Vec<_>>())
            .map_err(|e| JsValue::from_str(&format!("Chunk embed failed: {}", e)))?;
        
        // Return chunks with embeddings
        let results: Vec<ChunkEmbedResult> = chunks.into_iter()
            .zip(embeddings.into_iter())
            .map(|(chunk, embedding)| ChunkEmbedResult {
                text: chunk.text,
                start: chunk.start,
                end: chunk.end,
                embedding,
            })
            .collect();
        
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Serialize failed: {}", e)))
    }

    /// Get model dimensions (embedding vector size)
    #[wasm_bindgen(js_name = getDimensions)]
    pub fn get_dimensions(&self) -> u32 {
        self.model.as_ref()
            .map(|m| m.dimensions() as u32)
            .unwrap_or(0)
    }

    /// Get current model name
    #[wasm_bindgen(js_name = getModelName)]
    pub fn get_model_name(&self) -> String {
        self.config.model.to_string()
    }
    
    /// Embed text with Matryoshka truncation
    /// 
    /// MRL models front-load signal, so truncation preserves quality.
    /// If dim >= full dimensions, returns full embedding.
    #[wasm_bindgen(js_name = embedTruncated)]
    pub fn embed_truncated(&self, text: &str, dim: usize) -> Result<Vec<f32>, JsValue> {
        let full = self.embed_text(text)?;
        if dim >= full.len() {
            return Ok(full);
        }
        Ok(full[..dim].to_vec())
    }
    
    /// Set truncation dimension for future embeddings
    #[wasm_bindgen(js_name = setTruncateDim)]
    pub fn set_truncate_dim(&mut self, dim: Option<usize>) {
        self.config.truncate_dim = dim;
    }
    
    /// Get effective embedding dimension (after truncation)
    #[wasm_bindgen(js_name = getEffectiveDim)]
    pub fn get_effective_dim(&self) -> usize {
        self.config.effective_dim()
    }
    
    /// Switch model (requires reload)
    #[wasm_bindgen(js_name = setModel)]
    pub fn set_model(&mut self, model_id: &str) -> Result<(), JsValue> {
        if self.set_model_internal(model_id) {
            Ok(())
        } else {
            Err(JsValue::from_str(&format!("Unknown model: {}", model_id)))
        }
    }
}

// Non-WASM methods
impl EmbedCortex {
    /// Internal model setter (returns false for unknown model)
    pub fn set_model_internal(&mut self, model_id: &str) -> bool {
        let new_model = match model_id {
            "bge-small" | "bge-small-en-v1.5" => OnnxModel::BGESmallENV15,
            "modernbert-base" | "modernbert-embed-base" => OnnxModel::ModernBERTBase,
            "all-minilm-l6-v2" => OnnxModel::AllMiniLML6V2,
            _ => return false,
        };
        self.config.model = new_model;
        self.model = None; // Require reload
        true
    }
    
    /// Check if model supports Matryoshka truncation
    pub fn supports_mrl(&self) -> bool {
        self.config.model.supports_matryoshka()
    }

    /// Embed a batch of texts (internal Rust usage)
    pub fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        let model = self.model.as_ref().ok_or("Model not loaded")?;
        model.embed_batch(texts).map_err(|e| e.to_string())
    }
}

impl Default for EmbedCortex {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of chunked embedding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkEmbedResult {
    pub text: String,
    pub start: usize,
    pub end: usize,
    pub embedding: Vec<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cortex_creation() {
        let cortex = EmbedCortex::new();
        assert!(!cortex.is_ready());
    }
    
    #[test]
    fn test_set_truncate_dim() {
        let mut cortex = EmbedCortex::new();
        assert_eq!(cortex.get_effective_dim(), 384); // BGE-small default
        
        cortex.set_truncate_dim(Some(128));
        assert_eq!(cortex.get_effective_dim(), 128);
        
        cortex.set_truncate_dim(None);
        assert_eq!(cortex.get_effective_dim(), 384);
    }
    
    #[test]
    fn test_set_model() {
        let mut cortex = EmbedCortex::new();
        assert_eq!(cortex.get_model_name(), "bge-small-en-v1.5");
        
        assert!(cortex.set_model_internal("modernbert-base"));
        assert_eq!(cortex.get_model_name(), "modernbert-embed-base");
        assert!(!cortex.is_ready()); // Model was unloaded
        assert_eq!(cortex.get_effective_dim(), 768); // ModernBERT dims
    }
    
    #[test]
    fn test_set_model_invalid() {
        let mut cortex = EmbedCortex::new();
        let result = cortex.set_model_internal("unknown-model");
        assert!(!result); // Should return false for unknown
    }
    
    #[test]
    fn test_supports_matryoshka() {
        let mut cortex = EmbedCortex::new();
        assert!(cortex.supports_mrl()); // BGE-small supports MRL
        
        cortex.set_model_internal("all-minilm-l6-v2");
        assert!(!cortex.supports_mrl()); // MiniLM does not
    }
}

