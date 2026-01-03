// kittcore/src/embeddings/tokenize.rs
//
// Tokenization wrapper for BERT-style models

use tokenizers::Tokenizer;
use std::sync::Arc;

/// Tokenizer wrapper for embedding models
pub struct EmbedTokenizer {
    tokenizer: Arc<Tokenizer>,
    max_length: usize,
}

/// Tokenized input ready for model inference
#[derive(Debug, Clone)]
pub struct TokenizedInput {
    pub input_ids: Vec<i64>,
    pub attention_mask: Vec<i64>,
    pub token_type_ids: Vec<i64>,
}

impl EmbedTokenizer {
    /// Create tokenizer from tokenizer.json contents
    pub fn from_json(tokenizer_json: &str, max_length: usize) -> Result<Self, TokenizerError> {
        let tokenizer = Tokenizer::from_bytes(tokenizer_json.as_bytes())
            .map_err(|e| TokenizerError::LoadFailed(e.to_string()))?;
        
        Ok(Self {
            tokenizer: Arc::new(tokenizer),
            max_length,
        })
    }
    
    /// Tokenize a single text
    pub fn encode(&self, text: &str) -> Result<TokenizedInput, TokenizerError> {
        let encoding = self.tokenizer.encode(text, true)
            .map_err(|e| TokenizerError::EncodeFailed(e.to_string()))?;
        
        let mut input_ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
        let mut attention_mask: Vec<i64> = encoding.get_attention_mask().iter().map(|&m| m as i64).collect();
        let mut token_type_ids: Vec<i64> = encoding.get_type_ids().iter().map(|&id| id as i64).collect();
        
        // Truncate if necessary
        if input_ids.len() > self.max_length {
            input_ids.truncate(self.max_length);
            attention_mask.truncate(self.max_length);
            token_type_ids.truncate(self.max_length);
        }
        
        Ok(TokenizedInput {
            input_ids,
            attention_mask,
            token_type_ids,
        })
    }
    
    /// Tokenize a batch of texts
    pub fn encode_batch(&self, texts: &[String]) -> Result<Vec<TokenizedInput>, TokenizerError> {
        texts.iter()
            .map(|text| self.encode(text))
            .collect()
    }
    
    /// Pad batch to uniform length
    pub fn pad_batch(&self, inputs: Vec<TokenizedInput>) -> (Vec<TokenizedInput>, usize) {
        if inputs.is_empty() {
            return (inputs, 0);
        }
        
        let max_len = inputs.iter()
            .map(|i| i.input_ids.len())
            .max()
            .unwrap_or(0);
        
        let padded: Vec<TokenizedInput> = inputs.into_iter()
            .map(|mut input| {
                let pad_len = max_len - input.input_ids.len();
                if pad_len > 0 {
                    input.input_ids.extend(vec![0i64; pad_len]);
                    input.attention_mask.extend(vec![0i64; pad_len]);
                    input.token_type_ids.extend(vec![0i64; pad_len]);
                }
                input
            })
            .collect();
        
        (padded, max_len)
    }
}

/// Tokenizer errors
#[derive(Debug)]
pub enum TokenizerError {
    LoadFailed(String),
    EncodeFailed(String),
}

impl std::fmt::Display for TokenizerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::LoadFailed(e) => write!(f, "Failed to load tokenizer: {}", e),
            Self::EncodeFailed(e) => write!(f, "Failed to encode text: {}", e),
        }
    }
}

impl std::error::Error for TokenizerError {}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require a tokenizer.json file
    // In practice, this would be loaded from HuggingFace Hub
    
    #[test]
    fn test_tokenized_input_structure() {
        let input = TokenizedInput {
            input_ids: vec![101, 7592, 2088, 102],
            attention_mask: vec![1, 1, 1, 1],
            token_type_ids: vec![0, 0, 0, 0],
        };
        
        assert_eq!(input.input_ids.len(), 4);
        assert_eq!(input.attention_mask.len(), 4);
    }
}
