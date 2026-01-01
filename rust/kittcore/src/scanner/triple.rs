//! TripleCortex: Triple Syntax Extraction
//!
//! Extracts `[[source->predicate->target]]` triples from text.

use regex::Regex;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// =============================================================================
// Types
// =============================================================================

/// An extracted triple relationship
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExtractedTriple {
    pub source: String,
    pub predicate: String,
    pub target: String,
    pub start: usize,
    pub end: usize,
    pub raw_text: String,
}

// =============================================================================
// TripleCortex
// =============================================================================

/// Triple syntax extractor
#[wasm_bindgen]
pub struct TripleCortex {
    triple_regex: Regex,
}

impl Default for TripleCortex {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl TripleCortex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        // Pattern: [[source->predicate->target]]
        // Allow whitespace around arrows
        // Source/target can contain any chars except [] and arrows
        // Predicate is typically UPPERCASE_SNAKE_CASE but we allow flexibility
        let triple_regex = Regex::new(
            r"\[\[\s*([^\[\]>]+?)\s*->\s*([^\[\]>]+?)\s*->\s*([^\[\]>]+?)\s*\]\]"
        ).expect("Triple regex should compile");

        Self { triple_regex }
    }

    /// Extract and return as JsValue for WASM
    #[wasm_bindgen(js_name = extract)]
    pub fn js_extract(&self, text: &str) -> JsValue {
        let triples = self.extract(text);
        serde_wasm_bindgen::to_value(&triples).unwrap_or(JsValue::NULL)
    }
}

impl TripleCortex {
    /// Extract all triples from text
    pub fn extract(&self, text: &str) -> Vec<ExtractedTriple> {
        self.triple_regex
            .captures_iter(text)
            .filter_map(|cap| {
                let full_match = cap.get(0)?;
                let source = cap.get(1)?.as_str().trim();
                let predicate = cap.get(2)?.as_str().trim();
                let target = cap.get(3)?.as_str().trim();

                // Validate non-empty components
                if source.is_empty() || predicate.is_empty() || target.is_empty() {
                    return None;
                }

                Some(ExtractedTriple {
                    source: source.to_string(),
                    predicate: predicate.to_string(),
                    target: target.to_string(),
                    start: full_match.start(),
                    end: full_match.end(),
                    raw_text: full_match.as_str().to_string(),
                })
            })
            .collect()
    }
}

// =============================================================================
// Tests (TDD - written first!)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Requirement 1: Basic triple extraction
    // -------------------------------------------------------------------------
    #[test]
    fn test_basic_triple_extraction() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[Frodo->OWNS->Ring]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Frodo");
        assert_eq!(triples[0].predicate, "OWNS");
        assert_eq!(triples[0].target, "Ring");
    }

    // -------------------------------------------------------------------------
    // Requirement 2: Whitespace handling
    // -------------------------------------------------------------------------
    #[test]
    fn test_whitespace_around_components() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[ Frodo  ->  OWNS  ->  Ring ]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Frodo");
        assert_eq!(triples[0].predicate, "OWNS");
        assert_eq!(triples[0].target, "Ring");
    }

    // -------------------------------------------------------------------------
    // Requirement 3: Position tracking
    // -------------------------------------------------------------------------
    #[test]
    fn test_position_tracking() {
        let cortex = TripleCortex::new();
        let text = "Some text [[A->B->C]] more text";
        let triples = cortex.extract(text);

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].start, 10);
        assert_eq!(triples[0].end, 21);
        assert_eq!(&text[triples[0].start..triples[0].end], "[[A->B->C]]");
    }

    // -------------------------------------------------------------------------
    // Requirement 4: Multiple triples in same text
    // -------------------------------------------------------------------------
    #[test]
    fn test_multiple_triples() {
        let cortex = TripleCortex::new();
        let text = "[[Frodo->OWNS->Ring]] and [[Sam->FRIEND_OF->Frodo]]";
        let triples = cortex.extract(text);

        assert_eq!(triples.len(), 2);
        assert_eq!(triples[0].source, "Frodo");
        assert_eq!(triples[0].predicate, "OWNS");
        assert_eq!(triples[1].source, "Sam");
        assert_eq!(triples[1].predicate, "FRIEND_OF");
    }

    // -------------------------------------------------------------------------
    // Requirement 5: Multi-word entities
    // -------------------------------------------------------------------------
    #[test]
    fn test_multi_word_entities() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[Frodo Baggins->LIVES_IN->The Shire]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Frodo Baggins");
        assert_eq!(triples[0].target, "The Shire");
    }

    // -------------------------------------------------------------------------
    // Requirement 6: Empty text returns empty
    // -------------------------------------------------------------------------
    #[test]
    fn test_empty_text() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("");
        assert!(triples.is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 7: No triples returns empty
    // -------------------------------------------------------------------------
    #[test]
    fn test_no_triples() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("Just some regular text without triples");
        assert!(triples.is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 8: Malformed triples are ignored
    // -------------------------------------------------------------------------
    #[test]
    fn test_malformed_triples_ignored() {
        let cortex = TripleCortex::new();
        
        // Missing target
        assert!(cortex.extract("[[A->B]]").is_empty());
        
        // Only arrows
        assert!(cortex.extract("[[->->]]").is_empty());
        
        // Not closed
        assert!(cortex.extract("[[A->B->C").is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 9: Raw text preserved
    // -------------------------------------------------------------------------
    #[test]
    fn test_raw_text_preserved() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[ Frodo -> OWNS -> Ring ]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].raw_text, "[[ Frodo -> OWNS -> Ring ]]");
    }

    // -------------------------------------------------------------------------
    // Requirement 10: Case preserved in extraction
    // -------------------------------------------------------------------------
    #[test]
    fn test_case_preserved() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[FRODO->owns->Ring Of Power]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "FRODO");
        assert_eq!(triples[0].predicate, "owns");
        assert_eq!(triples[0].target, "Ring Of Power");
    }
}
