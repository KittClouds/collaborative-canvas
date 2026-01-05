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
    /// Optional: entity kind for source (if explicit syntax used)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<String>,
    /// Optional: entity kind for target (if explicit syntax used)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_kind: Option<String>,
}

// =============================================================================
// TripleCortex
// =============================================================================

/// Triple syntax extractor - supports multiple syntaxes
#[wasm_bindgen]
pub struct TripleCortex {
    // Pattern 1: [[source->predicate->target]] (wiki-style)
    wiki_regex: Regex,
    // Pattern 2: [KIND|Label] (RELATION) [KIND|Label] (parenthesized)
    paren_regex: Regex,
    // Pattern 3: [KIND|Label] ->RELATION-> [KIND|Label] (arrow with kinds)
    arrow_kind_regex: Regex,
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
        // Pattern 1: [[source->predicate->target]]
        let wiki_regex = Regex::new(
            r"\[\[\s*([^\[\]>]+?)\s*->\s*([^\[\]>]+?)\s*->\s*([^\[\]>]+?)\s*\]\]"
        ).expect("Wiki triple regex should compile");

        // Pattern 2: [KIND|Label] (RELATION) [KIND|Label]
        // Captures: kind1, label1, relation, kind2, label2
        let paren_regex = Regex::new(
            r"\[([A-Z_]+)\|([^\]]+)\]\s*\(([A-Z_]+)\)\s*\[([A-Z_]+)\|([^\]]+)\]"
        ).expect("Parenthesized triple regex should compile");

        // Pattern 3: [KIND|Label] ->RELATION-> [KIND|Label]
        let arrow_kind_regex = Regex::new(
            r"\[([A-Z_]+)\|([^\]]+)\]\s*->([A-Z_]+)->\s*\[([A-Z_]+)\|([^\]]+)\]"
        ).expect("Arrow kind triple regex should compile");

        Self { wiki_regex, paren_regex, arrow_kind_regex }
    }

    /// Extract and return as JsValue for WASM
    #[wasm_bindgen(js_name = extract)]
    pub fn js_extract(&self, text: &str) -> JsValue {
        let triples = self.extract(text);
        serde_wasm_bindgen::to_value(&triples).unwrap_or(JsValue::NULL)
    }
}

impl TripleCortex {
    /// Extract all triples from text using all supported syntaxes
    pub fn extract(&self, text: &str) -> Vec<ExtractedTriple> {
        let mut triples = Vec::new();

        // Pattern 1: [[source->pred->target]]
        for cap in self.wiki_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_wiki_triple(&cap) {
                triples.push(triple);
            }
        }

        // Pattern 2: [KIND|Label] (RELATION) [KIND|Label]
        for cap in self.paren_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_paren_triple(&cap) {
                triples.push(triple);
            }
        }

        // Pattern 3: [KIND|Label] ->RELATION-> [KIND|Label]
        for cap in self.arrow_kind_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_arrow_kind_triple(&cap) {
                triples.push(triple);
            }
        }

        // Sort by position
        triples.sort_by_key(|t| t.start);
        triples
    }

    fn extract_wiki_triple(cap: &regex::Captures) -> Option<ExtractedTriple> {
        let full_match = cap.get(0)?;
        let source = cap.get(1)?.as_str().trim();
        let predicate = cap.get(2)?.as_str().trim();
        let target = cap.get(3)?.as_str().trim();

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
            source_kind: None,
            target_kind: None,
        })
    }

    fn extract_paren_triple(cap: &regex::Captures) -> Option<ExtractedTriple> {
        let full_match = cap.get(0)?;
        let source_kind = cap.get(1)?.as_str().trim();
        let source = cap.get(2)?.as_str().trim();
        let predicate = cap.get(3)?.as_str().trim();
        let target_kind = cap.get(4)?.as_str().trim();
        let target = cap.get(5)?.as_str().trim();

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
            source_kind: Some(source_kind.to_string()),
            target_kind: Some(target_kind.to_string()),
        })
    }

    fn extract_arrow_kind_triple(cap: &regex::Captures) -> Option<ExtractedTriple> {
        let full_match = cap.get(0)?;
        let source_kind = cap.get(1)?.as_str().trim();
        let source = cap.get(2)?.as_str().trim();
        let predicate = cap.get(3)?.as_str().trim();
        let target_kind = cap.get(4)?.as_str().trim();
        let target = cap.get(5)?.as_str().trim();

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
            source_kind: Some(source_kind.to_string()),
            target_kind: Some(target_kind.to_string()),
        })
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

    // -------------------------------------------------------------------------
    // Requirement 11: Parenthesized triple syntax
    // [KIND|Label] (RELATION) [KIND|Label]
    // -------------------------------------------------------------------------
    #[test]
    fn test_parenthesized_triple() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[EVENT|Wano Arc] (TAKES_PLACE_IN) [LOCATION|Wano Country]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Wano Arc");
        assert_eq!(triples[0].predicate, "TAKES_PLACE_IN");
        assert_eq!(triples[0].target, "Wano Country");
        assert_eq!(triples[0].source_kind, Some("EVENT".to_string()));
        assert_eq!(triples[0].target_kind, Some("LOCATION".to_string()));
    }

    #[test]
    fn test_parenthesized_triple_character_defeats() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[CHARACTER|Luffy] (DEFEATS) [CHARACTER|Kaido]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Luffy");
        assert_eq!(triples[0].predicate, "DEFEATS");
        assert_eq!(triples[0].target, "Kaido");
    }

    // -------------------------------------------------------------------------
    // Requirement 12: Arrow triple with kinds
    // [KIND|Label] ->RELATION-> [KIND|Label]
    // -------------------------------------------------------------------------
    #[test]
    fn test_arrow_kind_triple() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[CHARACTER|Frodo] ->OWNS-> [ITEM|Ring]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Frodo");
        assert_eq!(triples[0].predicate, "OWNS");
        assert_eq!(triples[0].target, "Ring");
        assert_eq!(triples[0].source_kind, Some("CHARACTER".to_string()));
        assert_eq!(triples[0].target_kind, Some("ITEM".to_string()));
    }

    // -------------------------------------------------------------------------
    // Requirement 13: Mixed syntax in same document
    // -------------------------------------------------------------------------
    #[test]
    fn test_mixed_triple_syntaxes() {
        let cortex = TripleCortex::new();
        let text = r#"
            [[Gandalf->MENTORS->Frodo]]
            [CHARACTER|Aragorn] (LOVES) [CHARACTER|Arwen]
            [LOCATION|Mordor] ->CONTAINS-> [ITEM|Ring]
        "#;
        
        let triples = cortex.extract(text);

        assert_eq!(triples.len(), 3);
        
        // Wiki style
        assert_eq!(triples[0].source, "Gandalf");
        assert!(triples[0].source_kind.is_none()); // Wiki style has no kind
        
        // Parenthesized
        assert_eq!(triples[1].source, "Aragorn");
        assert_eq!(triples[1].source_kind, Some("CHARACTER".to_string()));
        
        // Arrow with kinds
        assert_eq!(triples[2].source, "Mordor");
        assert_eq!(triples[2].source_kind, Some("LOCATION".to_string()));
    }
}

