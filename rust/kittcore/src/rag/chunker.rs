//! Semantic Chunker
//!
//! Fast text chunking with sentence-boundary awareness.
//! Splits at semantic boundaries (sentences) with configurable size.

/// A text chunk with metadata
#[derive(Debug, Clone)]
pub struct Chunk {
    /// Chunk text content
    pub text: String,
    /// Start byte offset in original document
    pub start: usize,
    /// End byte offset in original document  
    pub end: usize,
    /// Chunk index within document
    pub index: usize,
}

/// Semantic chunker configuration
pub struct RagChunker {
    /// Target chunk size in bytes (~512 tokens ≈ 2048 bytes for English)
    target_size: usize,
    /// Overlap between chunks (for context continuity)
    overlap: usize,
}

impl Default for RagChunker {
    fn default() -> Self {
        Self {
            target_size: 2048,  // ~512 tokens
            overlap: 200,       // ~50 tokens overlap
        }
    }
}

impl RagChunker {
    /// Create a new chunker with custom settings
    pub fn new(target_size: usize, overlap: usize) -> Self {
        Self { target_size, overlap }
    }

    /// Chunk a document into semantic units
    ///
    /// Splits at sentence boundaries (., ?, !, \n) while respecting target size.
    pub fn chunk(&self, text: &str) -> Vec<Chunk> {
        if text.is_empty() {
            return vec![];
        }

        let bytes = text.as_bytes();
        let mut chunks = Vec::new();
        let mut chunk_start = 0;
        let mut last_boundary = 0;
        
        // Find sentence boundaries and build chunks
        for (i, &byte) in bytes.iter().enumerate() {
            // Check for sentence-ending punctuation
            let is_boundary = matches!(byte, b'.' | b'?' | b'!' | b'\n');
            
            if is_boundary {
                let potential_end = i + 1;
                
                // Check if adding this sentence exceeds target size
                if potential_end - chunk_start >= self.target_size && last_boundary > chunk_start {
                    // Use last boundary as chunk end
                    let chunk_text = &text[chunk_start..last_boundary];
                    chunks.push(Chunk {
                        text: chunk_text.to_string(),
                        start: chunk_start,
                        end: last_boundary,
                        index: chunks.len(),
                    });
                    chunk_start = last_boundary;
                }
                
                last_boundary = potential_end;
            }
        }

        // Handle remaining text
        if chunk_start < text.len() {
            let chunk_text = &text[chunk_start..];
            chunks.push(Chunk {
                text: chunk_text.to_string(),
                start: chunk_start,
                end: text.len(),
                index: chunks.len(),
            });
        }

        // Apply overlap if configured
        if self.overlap > 0 && chunks.len() > 1 {
            self.apply_overlap(&mut chunks, text);
        }

        chunks
    }

    /// Apply overlap to chunks for context continuity
    fn apply_overlap(&self, chunks: &mut [Chunk], original: &str) {
        for i in 1..chunks.len() {
            let curr_start = chunks[i].start;
            
            // Calculate overlap start (go back `overlap` bytes, but stay within bounds)
            let overlap_start = curr_start.saturating_sub(self.overlap);
            
            // Only add overlap if there's actually content to add
            if overlap_start < curr_start {
                // Find a good word boundary for overlap
                let overlap_start = self.find_word_boundary(original, overlap_start, true);
                
                if overlap_start < curr_start {
                    let overlap_text = &original[overlap_start..curr_start];
                    chunks[i].text = format!("{}{}", overlap_text, chunks[i].text);
                    chunks[i].start = overlap_start;
                }
            }
        }
    }

    /// Find nearest word boundary
    fn find_word_boundary(&self, text: &str, pos: usize, forward: bool) -> usize {
        let bytes = text.as_bytes();
        
        if forward {
            // Look forward for whitespace
            for i in pos..text.len().min(pos + 50) {
                if bytes[i] == b' ' || bytes[i] == b'\n' {
                    return i + 1;
                }
            }
        } else {
            // Look backward for whitespace
            for i in (pos.saturating_sub(50)..pos).rev() {
                if bytes[i] == b' ' || bytes[i] == b'\n' {
                    return i + 1;
                }
            }
        }
        
        pos
    }

    /// Get approximate token count for a chunk
    /// Rough estimate: 1 token ≈ 4 bytes for English text
    pub fn estimate_tokens(&self, chunk: &Chunk) -> usize {
        chunk.text.len() / 4
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_chunking() {
        let chunker = RagChunker::new(50, 0);
        let text = "Hello world. How are you? I'm doing great. Thanks for asking.";
        let chunks = chunker.chunk(text);
        
        assert!(!chunks.is_empty());
        println!("Chunks: {:?}", chunks);
    }

    #[test]
    fn test_empty_text() {
        let chunker = RagChunker::default();
        let chunks = chunker.chunk("");
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_small_text() {
        let chunker = RagChunker::default();
        let text = "Short text.";
        let chunks = chunker.chunk(text);
        
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, text);
    }

    #[test]
    fn test_long_text_chunking() {
        let chunker = RagChunker::new(100, 0);
        let text = "This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five. This is sentence six.";
        let chunks = chunker.chunk(text);
        
        println!("Chunks: {:?}", chunks);
        assert!(chunks.len() >= 1);
    }
}
