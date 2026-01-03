//! Dialogue Attributor - Phase 4 of NarrativeGraph
//!
//! Identifies speakers for dialogue chunks.
//!
//! # Heuristics
//! 1. **Quote Before**: `"Run!" shouted Gandalf.`
//! 2. **Quote After**: `Frodo said, "No."`
//! 3. **Implicit**: Uses context/turn-taking if no explicit attribution found.

use crate::scanner::chunker::{Chunk, ChunkKind, ChunkResult};
use crate::scanner::resolver::{NarrativeContext, EntityId, Resolver};
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// =============================================================================
// DialogueAttributor
// =============================================================================

#[wasm_bindgen]
pub struct DialogueAttributor;

impl Default for DialogueAttributor {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl DialogueAttributor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        DialogueAttributor
    }

    /// Attribute dialogue to a speaker (naive implementation for Phase 1)
    /// In a real system, this would take the full dependency graph.
    /// Here we operate on Chunks + Context.
    pub fn attribute(
        _chunks_js: JsValue,
        _context_js: JsValue // Using full NarrativeContext object from JS might be complex due to serialization
    ) -> Result<JsValue, JsValue> {
        // Placeholder for WASM interface
        Ok(JsValue::NULL)
    }
}

// Native API
impl DialogueAttributor {
    /// Attempt to identify the speaker of a dialogue segment
    /// 
    /// `chunks`: The chunks of the *surrounding* narration (before/after the quote)
    /// `quote_idx`: The index of the quote concept (omitted here, we assume checks are passed separately)
    /// For this exercise, we'll verify attribution logic given a sentence with dialogue.
    pub fn attribute_speaker(
        chunks: &[Chunk], 
        quote_position: QuotePosition, 
        resolver: &mut Resolver
    ) -> Option<EntityId> {
        match quote_position {
            QuotePosition::After => {
                // `Frodo said, "No."`
                // Look for Subject + Verbum Dicendi (speaking verb) BEFORE the quote
                // Simplified: Find last NP before end of chunks that is a character
                Self::find_speaker_in_chunks(chunks, resolver)
            },
            QuotePosition::Before => {
                // `"Run!" shouted Gandalf.`
                // Look for Verbum Dicendi + Subject AFTER the quote
                Self::find_speaker_in_chunks(chunks, resolver)
            }
        }
    }

    fn find_speaker_in_chunks(chunks: &[Chunk], resolver: &mut Resolver) -> Option<EntityId> {
        // Search for a NounPhrase that resolves to an ENTITY
        // Ideally we check for "said", "shouted" (VP check), but for now just finding the entity is 80% there
        
        for chunk in chunks {
            if chunk.kind == ChunkKind::NounPhrase {
                // Try to resolve this NP to an entity
                // We need the raw text to resolve. 
                // Since Chunk struct doesn't own text, we'd need it passed in. 
                // For this TDD, we'll assume we can match by some other means or skip proper resolution logic here
                // and rely on the test setup mocking the resolver results.
                
                // WAIT: The resolver requires text string input.
                // We need to refactor `attribute_speaker` to take text + chunks.
            }
        }
        None 
    }
    
    // Better API for TDD:
    pub fn attribute_simple(
        text: &str,
        chunks: &[Chunk],
        quote_pos: QuotePosition,
        resolver: &mut Resolver
    ) -> Option<EntityId> {
         // Valid speaking verbs (simplified list)
         let _speaking_verbs = ["said", "asked", "shouted", "replied", "whispered"];
         
         // Strategy:
         // 1. Find all NPs
         // 2. Filter NPs that look like Candidates (Subject-ish)
         // 3. Resolve them
         // 4. Return first resolved Entity
         
         for chunk in chunks {
             if chunk.kind == ChunkKind::NounPhrase {
                 let np_text = chunk.text(text);
                 if let Some(id) = resolver.resolve(np_text) {
                     return Some(id);
                 }
             }
         }
         
         None
    }
}

pub enum QuotePosition {
    Before, // Quote comes before Narration ("Run," he said)
    After,  // Quote comes after Narration (He said, "Run")
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scanner::chunker::{Chunker, TextRange};
    use crate::scanner::resolver::{Gender, Resolver};

    fn setup() -> (Chunker, Resolver) {
        let chunker = Chunker::new();
        let mut resolver = Resolver::new();
        resolver.register_entity("e1", "Gandalf", Gender::Male, vec![]);
        resolver.register_entity("e2", "Frodo", Gender::Male, vec![]);
        (chunker, resolver)
    }

    #[test]
    fn test_quote_after_subject() {
        // Frodo said ...
        let (chunker, mut resolver) = setup();
        let text = "Frodo said";
        let res = chunker.chunk_native(text);
        
        let speaker = DialogueAttributor::attribute_simple(
            text, 
            &res.chunks, 
            QuotePosition::After, 
            &mut resolver
        );
        
        assert_eq!(speaker.as_deref(), Some("e2"));
    }

    #[test]
    fn test_quote_before_subject() {
        // ... shouted Gandalf
        let (chunker, mut resolver) = setup();
        let text = "shouted Gandalf";
        let res = chunker.chunk_native(text);
        
        let speaker = DialogueAttributor::attribute_simple(
            text, 
            &res.chunks, 
            QuotePosition::Before, 
            &mut resolver
        );
        
        assert_eq!(speaker.as_deref(), Some("e1"));
    }

    #[test]
    fn test_pronoun_attribution() {
        // He asked ...
        let (chunker, mut resolver) = setup();
        
        // Context: Gandalf just mentioned
        resolver.observe_mention("e1");
        
        let text = "He asked";
        let res = chunker.chunk_native(text);
        
        let speaker = DialogueAttributor::attribute_simple(
            text, 
            &res.chunks, 
            QuotePosition::After, 
            &mut resolver
        );
        
        assert_eq!(speaker.as_deref(), Some("e1"), "Should resolve 'He' to Gandalf");
    }
}
