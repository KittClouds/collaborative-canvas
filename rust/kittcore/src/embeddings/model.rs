// kittcore/src/embeddings/model.rs
//
// ONNX model inference via tract

use crate::embeddings::config::{EmbedConfig, PoolingStrategy};
use crate::embeddings::tokenize::{EmbedTokenizer, TokenizedInput, TokenizerError};
use tract_onnx::prelude::*;
use tract_core::tract_data::TractResult;
use ndarray::{Array2, Array3, Axis};
use std::sync::Arc;

/// Type alias for the tract typed model
type TractModel = SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

/// Loaded embedding model ready for inference
pub struct EmbedModel {
    model: Arc<TractModel>,
    tokenizer: EmbedTokenizer,
    config: EmbedConfig,
    dimensions: usize,
}

/// Result of embedding operation
#[derive(Debug, Clone)]
pub struct EmbedResult {
    pub text: String,
    pub embedding: Vec<f32>,
}

/// Model loading and inference errors
#[derive(Debug)]
pub enum ModelError {
    LoadFailed(String),
    InferenceFailed(String),
    TokenizerError(TokenizerError),
    ShapeError(String),
}

impl std::fmt::Display for ModelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::LoadFailed(e) => write!(f, "Model load failed: {}", e),
            Self::InferenceFailed(e) => write!(f, "Inference failed: {}", e),
            Self::TokenizerError(e) => write!(f, "Tokenizer error: {}", e),
            Self::ShapeError(e) => write!(f, "Shape error: {}", e),
        }
    }
}

impl std::error::Error for ModelError {}

impl From<TokenizerError> for ModelError {
    fn from(e: TokenizerError) -> Self {
        Self::TokenizerError(e)
    }
}

impl EmbedModel {
    /// Load model from ONNX bytes and tokenizer JSON
    pub fn from_bytes(
        model_bytes: &[u8],
        tokenizer_json: &str,
        config: EmbedConfig,
    ) -> Result<Self, ModelError> {
        // Load ONNX model via tract
        let model = tract_onnx::onnx()
            .model_for_read(&mut std::io::Cursor::new(model_bytes))
            .map_err(|e| ModelError::LoadFailed(e.to_string()))?
            .into_optimized()
            .map_err(|e| ModelError::LoadFailed(e.to_string()))?
            .into_runnable()
            .map_err(|e| ModelError::LoadFailed(e.to_string()))?;
        
        // Load tokenizer
        let tokenizer = EmbedTokenizer::from_json(tokenizer_json, config.model.max_length())?;
        
        let dimensions = config.model.dimensions();
        
        Ok(Self {
            model: Arc::new(model),
            tokenizer,
            config,
            dimensions,
        })
    }
    
    /// Get embedding dimensions
    pub fn dimensions(&self) -> usize {
        self.dimensions
    }
    
    /// Embed a single text
    pub fn embed_single(&self, text: &str) -> Result<Vec<f32>, ModelError> {
        let embeddings = self.embed_batch(&[text.to_string()])?;
        embeddings.into_iter().next()
            .ok_or_else(|| ModelError::InferenceFailed("Empty result".to_string()))
    }
    
    /// Embed a batch of texts
    pub fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, ModelError> {
        if texts.is_empty() {
            return Ok(vec![]);
        }
        
        // Tokenize all texts
        let encoded = self.tokenizer.encode_batch(texts)?;
        let (padded, seq_len) = self.tokenizer.pad_batch(encoded);
        let batch_size = padded.len();
        
        // Build input tensors
        let input_ids = self.build_input_tensor(&padded, seq_len, |t| &t.input_ids)?;
        let attention_mask_tensor = self.build_input_tensor(&padded, seq_len, |t| &t.attention_mask)?;
        let token_type_ids = self.build_input_tensor(&padded, seq_len, |t| &t.token_type_ids)?;
        
        // Also build attention mask as ndarray for pooling
        let attention_mask_arr = self.build_attention_mask_array(&padded, seq_len)?;
        
        // Run inference
        let inputs: TVec<TValue> = tvec![
            input_ids.into(),
            attention_mask_tensor.into(),
            token_type_ids.into(),
        ];
        
        let outputs = self.model.run(inputs)
            .map_err(|e| ModelError::InferenceFailed(e.to_string()))?;
        
        // Extract embeddings from output
        // BERT models output: (batch_size, seq_len, hidden_size)
        let output_tensor = outputs[0]
            .to_array_view::<f32>()
            .map_err(|e| ModelError::ShapeError(e.to_string()))?;
        
        // Convert to 3D array
        let output_3d = output_tensor.to_owned()
            .into_dimensionality::<ndarray::Ix3>()
            .map_err(|e| ModelError::ShapeError(format!("Failed to convert to 3D: {}", e)))?;
        
        // Apply pooling
        let embeddings = self.pool_embeddings(&output_3d, &attention_mask_arr)?;
        
        // Normalize if configured
        let embeddings = if self.config.normalize {
            self.normalize_embeddings(embeddings)
        } else {
            embeddings
        };
        
        Ok(embeddings)
    }
    
    /// Build input tensor from tokenized inputs
    fn build_input_tensor<F>(
        &self,
        inputs: &[TokenizedInput],
        seq_len: usize,
        extractor: F,
    ) -> Result<Tensor, ModelError>
    where
        F: Fn(&TokenizedInput) -> &[i64],
    {
        let batch_size = inputs.len();
        let mut data = Vec::with_capacity(batch_size * seq_len);
        
        for input in inputs {
            data.extend_from_slice(extractor(input));
        }
        
        // Create tensor directly from shape and data
        let tensor = Tensor::from_shape(&[batch_size, seq_len], &data)
            .map_err(|e| ModelError::ShapeError(e.to_string()))?;
        
        Ok(tensor)
    }
    
    /// Build attention mask as ndarray for pooling calculations
    fn build_attention_mask_array(
        &self,
        inputs: &[TokenizedInput],
        seq_len: usize,
    ) -> Result<Array2<i64>, ModelError> {
        let batch_size = inputs.len();
        let mut data = Vec::with_capacity(batch_size * seq_len);
        
        for input in inputs {
            data.extend_from_slice(&input.attention_mask);
        }
        
        Array2::from_shape_vec((batch_size, seq_len), data)
            .map_err(|e| ModelError::ShapeError(e.to_string()))
    }
    
    /// Apply pooling strategy to token embeddings
    fn pool_embeddings(
        &self,
        output: &Array3<f32>,
        attention_mask: &Array2<i64>,
    ) -> Result<Vec<Vec<f32>>, ModelError> {
        let batch_size = output.shape()[0];
        let mut embeddings = Vec::with_capacity(batch_size);
        
        for i in 0..batch_size {
            let token_embeddings = output.index_axis(Axis(0), i);
            let mask = attention_mask.index_axis(Axis(0), i);
            
            let embedding = match self.config.pooling {
                PoolingStrategy::Mean => {
                    // Mean pooling: sum(embeddings * mask) / sum(mask)
                    let hidden_size = token_embeddings.shape()[1];
                    let mut sum = vec![0.0f32; hidden_size];
                    let mut count = 0.0f32;
                    
                    for (j, &m) in mask.iter().enumerate() {
                        if m > 0 {
                            for (k, val) in token_embeddings.row(j).iter().enumerate() {
                                sum[k] += val;
                            }
                            count += 1.0;
                        }
                    }
                    
                    if count > 0.0 {
                        sum.iter_mut().for_each(|v| *v /= count);
                    }
                    
                    sum
                }
                PoolingStrategy::Cls => {
                    // [CLS] token is at position 0
                    token_embeddings.row(0).to_vec()
                }
                PoolingStrategy::Max => {
                    // Max pooling over tokens
                    let hidden_size = token_embeddings.shape()[1];
                    let mut max_vals = vec![f32::NEG_INFINITY; hidden_size];
                    
                    for (j, &m) in mask.iter().enumerate() {
                        if m > 0 {
                            for (k, val) in token_embeddings.row(j).iter().enumerate() {
                                if *val > max_vals[k] {
                                    max_vals[k] = *val;
                                }
                            }
                        }
                    }
                    
                    max_vals
                }
            };
            
            embeddings.push(embedding);
        }
        
        Ok(embeddings)
    }
    
    /// L2 normalize embeddings
    fn normalize_embeddings(&self, embeddings: Vec<Vec<f32>>) -> Vec<Vec<f32>> {
        embeddings.into_iter()
            .map(|mut emb| {
                let norm: f32 = emb.iter().map(|x| x * x).sum::<f32>().sqrt();
                if norm > 0.0 {
                    emb.iter_mut().for_each(|x| *x /= norm);
                }
                emb
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_error_display() {
        let err = ModelError::LoadFailed("test".to_string());
        assert!(err.to_string().contains("test"));
    }

    #[test]
    fn test_normalize() {
        let embeddings = vec![vec![3.0, 4.0]]; // norm = 5.0
        let _model_config = EmbedConfig {
            normalize: true,
            ..Default::default()
        };
        
        // Simulate normalization logic
        let normalized: Vec<Vec<f32>> = embeddings.into_iter()
            .map(|mut emb| {
                let norm: f32 = emb.iter().map(|x| x * x).sum::<f32>().sqrt();
                if norm > 0.0 {
                    emb.iter_mut().for_each(|x| *x /= norm);
                }
                emb
            })
            .collect();
        
        assert!((normalized[0][0] - 0.6).abs() < 0.001);
        assert!((normalized[0][1] - 0.8).abs() < 0.001);
    }
}
