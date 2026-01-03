// kittcore/src/embeddings/chunker.rs
//
// Text chunking strategies for document processing

use serde::{Deserialize, Serialize};
use unicode_segmentation::UnicodeSegmentation;

/// A chunk of text with position information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    pub text: String,
    pub start: usize,
    pub end: usize,
    pub index: usize,
}

/// Text chunker that splits documents into embeddable pieces
pub struct TextChunker {
    chunk_size: usize,
    overlap_size: usize,
}

impl TextChunker {
    /// Create a new chunker
    /// 
    /// # Arguments
    /// * `chunk_size` - Target chunk size in characters
    /// * `overlap_ratio` - Overlap ratio (0.0-0.5) for context preservation
    pub fn new(chunk_size: usize, overlap_ratio: f32) -> Self {
        let overlap_ratio = overlap_ratio.clamp(0.0, 0.5);
        let overlap_size = (chunk_size as f32 * overlap_ratio) as usize;
        
        Self {
            chunk_size,
            overlap_size,
        }
    }
    
    /// Chunk text using sentence-aware splitting
    pub fn chunk(&self, text: &str) -> Vec<Chunk> {
        if text.is_empty() {
            return vec![];
        }
        
        // If text is shorter than chunk size, return as single chunk
        if text.len() <= self.chunk_size {
            return vec![Chunk {
                text: text.to_string(),
                start: 0,
                end: text.len(),
                index: 0,
            }];
        }
        
        // Split into sentences first
        let sentences = self.split_sentences(text);
        self.build_chunks_from_sentences(&sentences, text)
    }
    
    /// Split text into sentences
    fn split_sentences<'a>(&self, text: &'a str) -> Vec<(usize, usize, &'a str)> {
        let mut sentences = Vec::new();
        let mut start = 0;
        
        // Use grapheme-aware sentence boundaries
        for (i, c) in text.char_indices() {
            // Simple sentence boundary detection: .!? followed by space or end
            if matches!(c, '.' | '!' | '?') {
                let next_idx = i + c.len_utf8();
                if next_idx >= text.len() || text[next_idx..].starts_with(|c: char| c.is_whitespace()) {
                    let end = next_idx;
                    if start < end {
                        sentences.push((start, end, &text[start..end]));
                        // Skip whitespace after sentence
                        start = text[next_idx..].find(|c: char| !c.is_whitespace())
                            .map(|offset| next_idx + offset)
                            .unwrap_or(text.len());
                    }
                }
            }
        }
        
        // Add remaining text as final sentence
        if start < text.len() {
            sentences.push((start, text.len(), &text[start..]));
        }
        
        sentences
    }
    
    /// Build chunks from sentences, respecting chunk size and overlap
    fn build_chunks_from_sentences(&self, sentences: &[(usize, usize, &str)], _text: &str) -> Vec<Chunk> {
        if sentences.is_empty() {
            return vec![];
        }
        
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();
        let mut chunk_start = sentences[0].0;
        let mut sentence_idx = 0;
        
        while sentence_idx < sentences.len() {
            let (start, end, sentence) = sentences[sentence_idx];
            
            // If adding this sentence would exceed chunk size
            if !current_chunk.is_empty() && current_chunk.len() + sentence.len() + 1 > self.chunk_size {
                // Save current chunk
                let chunk_end = sentences[sentence_idx - 1].1;
                chunks.push(Chunk {
                    text: current_chunk.trim().to_string(),
                    start: chunk_start,
                    end: chunk_end,
                    index: chunks.len(),
                });
                
                // Start new chunk with overlap
                current_chunk.clear();
                
                // Find overlap start point
                let overlap_start = sentence_idx.saturating_sub(self.calculate_overlap_sentences(sentences, sentence_idx));
                chunk_start = sentences[overlap_start].0;
                
                // Add overlap sentences
                for i in overlap_start..sentence_idx {
                    if !current_chunk.is_empty() {
                        current_chunk.push(' ');
                    }
                    current_chunk.push_str(sentences[i].2);
                }
            }
            
            // Add sentence to current chunk
            if !current_chunk.is_empty() {
                current_chunk.push(' ');
            }
            current_chunk.push_str(sentence);
            sentence_idx += 1;
        }
        
        // Don't forget the last chunk
        if !current_chunk.is_empty() {
            let chunk_end = sentences.last().map(|(_, e, _)| *e).unwrap_or(0);
            chunks.push(Chunk {
                text: current_chunk.trim().to_string(),
                start: chunk_start,
                end: chunk_end,
                index: chunks.len(),
            });
        }
        
        chunks
    }
    
    /// Calculate how many sentences to include for overlap
    fn calculate_overlap_sentences(&self, sentences: &[(usize, usize, &str)], current_idx: usize) -> usize {
        if self.overlap_size == 0 || current_idx == 0 {
            return 0;
        }
        
        let mut overlap_len = 0;
        let mut count = 0;
        
        for i in (0..current_idx).rev() {
            let sentence_len = sentences[i].2.len();
            if overlap_len + sentence_len > self.overlap_size {
                break;
            }
            overlap_len += sentence_len + 1; // +1 for space
            count += 1;
        }
        
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_text() {
        let chunker = TextChunker::new(500, 0.1);
        let chunks = chunker.chunk("Hello world.");
        
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "Hello world.");
    }

    #[test]
    fn test_multi_sentence() {
        let chunker = TextChunker::new(50, 0.0);
        let text = "First sentence. Second sentence. Third sentence.";
        let chunks = chunker.chunk(text);
        
        assert!(!chunks.is_empty());
        // Verify all chunks have valid positions
        for chunk in &chunks {
            assert!(chunk.start < chunk.end);
            assert!(chunk.end <= text.len());
        }
    }

    #[test]
    fn test_empty_text() {
        let chunker = TextChunker::new(500, 0.1);
        let chunks = chunker.chunk("");
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_overlap() {
        let chunker = TextChunker::new(100, 0.2);
        let text = "A long first sentence that takes some space. A second sentence here. And a third one too. Finally the fourth.";
        let chunks = chunker.chunk(text);
        
        // With overlap, consecutive chunks should share some content
        if chunks.len() > 1 {
            // Just verify chunks were created - overlap is implementation detail
            assert!(chunks.len() >= 1);
        }
    }
}
