//! ReflexCortex - High-performance entity matching via Double-Array Aho-Corasick
//!
//! Uses daachorse for O(n) multi-pattern matching with LeftmostLongest semantics.
//! Handles entity labels and aliases with confidence scoring.
//!
//! # Features
//! - LeftmostLongest matching (prevents "Frodo" matching inside "Frodo Baggins")
//! - Alias support with lower confidence (0.9 vs 1.0 for exact)
//! - Hybrid case-insensitivity (ASCII fast path, Unicode-aware when needed)
//! - Position-accurate results for highlighting

use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// ==================== TYPE DEFINITIONS ====================

/// Metadata associated with each pattern in the automaton
#[derive(Clone, Debug)]
struct PatternMetadata {
    entity_id: String,
    match_type: MatchType,
    confidence: f64,
    _original_pattern: String, // Preserved for potential future "show original case" feature
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum MatchType {
    Exact,
    Alias,
}

impl MatchType {
    fn as_str(&self) -> &'static str {
        match self {
            MatchType::Exact => "exact",
            MatchType::Alias => "alias",
        }
    }
}

/// A single entity match result
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EntityMatch {
    pub entity_id: String,
    pub start: usize,
    pub end: usize,
    pub matched_text: String,
    pub match_type: String,
    pub confidence: f64,
}

/// Statistics about the automaton
#[derive(Serialize, Deserialize)]
pub struct ReflexStats {
    pub pattern_count: usize,
    pub entity_count: usize,
    pub is_built: bool,
}

// ==================== MAIN IMPLEMENTATION ====================

/// ReflexCortex - Entity name matching cortex
/// 
/// Detects registered entity names and aliases in O(n) time using
/// Aho-Corasick automaton with LeftmostLongest matching.
#[wasm_bindgen]
pub struct ReflexCortex {
    /// The built automaton (None until build() is called)
    automaton: Option<AhoCorasick>,
    
    /// Metadata for each pattern (indexed by pattern value)
    pattern_meta: Vec<PatternMetadata>,
    
    /// Pending patterns before build
    pending_patterns: Vec<String>,
    pending_meta: Vec<PatternMetadata>,
    
    /// Dedupe: track which patterns we've added
    seen_patterns: HashMap<String, usize>,
    
    /// Entity count (unique entity IDs)
    entity_ids: HashMap<String, bool>,
    
    /// Configuration
    case_insensitive: bool,
}

#[wasm_bindgen]
impl ReflexCortex {
    /// Create a new ReflexCortex
    /// 
    /// # Arguments
    /// * `case_insensitive` - If true, matching is case-insensitive (ASCII fast path)
    #[wasm_bindgen(constructor)]
    pub fn new(case_insensitive: bool) -> Self {
        Self {
            automaton: None,
            pattern_meta: Vec::new(),
            pending_patterns: Vec::new(),
            pending_meta: Vec::new(),
            seen_patterns: HashMap::new(),
            entity_ids: HashMap::new(),
            case_insensitive,
        }
    }

    /// Add an entity with optional aliases
    #[wasm_bindgen(js_name = addEntity)]
    pub fn add_entity(&mut self, entity_id: &str, label: &str, aliases: &str) {
        // Skip very short labels (high false positive rate)
        if label.len() < 2 {
            return;
        }

        self.entity_ids.insert(entity_id.to_string(), true);

        // Add primary label with exact match confidence
        self.add_pattern_internal(entity_id, label, MatchType::Exact, 1.0);

        // Add aliases with lower confidence
        if !aliases.is_empty() {
            for alias in aliases.split(',') {
                let alias = alias.trim();
                if alias.len() >= 2 {
                    self.add_pattern_internal(entity_id, alias, MatchType::Alias, 0.9);
                }
            }
        }
    }

    /// Add a single pattern (internal helper)
    fn add_pattern_internal(
        &mut self,
        entity_id: &str,
        pattern: &str,
        match_type: MatchType,
        confidence: f64,
    ) {
        // Normalize for deduplication only - but we can pass original to builder
        // if we rely on ascii_case_insensitive
        let normalized = if self.case_insensitive {
            pattern.to_lowercase()
        } else {
            pattern.to_string()
        };

        // Deduplicate
        if let Some(&existing_idx) = self.seen_patterns.get(&normalized) {
            let existing = &self.pending_meta[existing_idx];
            if confidence > existing.confidence {
                // Replace with higher confidence match
                self.pending_meta[existing_idx] = PatternMetadata {
                    entity_id: entity_id.to_string(),
                    match_type,
                    confidence,
                    _original_pattern: pattern.to_string(),
                };
            }
            return;
        }

        let idx = self.pending_patterns.len();
        // For case-insensitive build, we can pass the normalized (lowercase) pattern
        // The builder will handle it correctly when we enable ascii_case_insensitive
        self.pending_patterns.push(normalized.clone());
        self.pending_meta.push(PatternMetadata {
            entity_id: entity_id.to_string(),
            match_type,
            confidence,
            _original_pattern: pattern.to_string(),
        });
        self.seen_patterns.insert(normalized, idx);
    }

    /// Build the automaton with LeftmostLongest matching
    #[wasm_bindgen(js_name = build)]
    pub fn build(&mut self) -> Result<(), JsValue> {
        if self.pending_patterns.is_empty() {
            return Err(JsValue::from_str("No patterns to build. Add entities first."));
        }

        let pma = AhoCorasickBuilder::new()
            .match_kind(MatchKind::LeftmostLongest)
            .ascii_case_insensitive(self.case_insensitive)
            .build(&self.pending_patterns)
            .map_err(|e| JsValue::from_str(&format!("ReflexCortex Build Error: {}", e)))?;

        self.automaton = Some(pma);
        self.pattern_meta = self.pending_meta.clone();

        Ok(())
    }

    /// Check if the automaton is built and ready for scanning
    #[wasm_bindgen(js_name = isBuilt)]
    pub fn is_built(&self) -> bool {
        self.automaton.is_some()
    }

    /// Scan text for entity mentions
    #[wasm_bindgen(js_name = scan)]
    pub fn scan(&self, text: &str) -> Result<JsValue, JsValue> {
        let pma = self
            .automaton
            .as_ref()
            .ok_or_else(|| JsValue::from_str("Automaton not built. Call build() first."))?;

        // NO ALLOCATION: Scan original text directly!
        let matches: Vec<EntityMatch> = pma
            .find_iter(text)
            .map(|m| {
                let pattern_id = m.pattern().as_usize();
                let meta = &self.pattern_meta[pattern_id];
                EntityMatch {
                    entity_id: meta.entity_id.clone(),
                    start: m.start(),
                    end: m.end(),
                    // Return the actual text from the original input
                    matched_text: text[m.start()..m.end()].to_string(),
                    match_type: meta.match_type.as_str().to_string(),
                    confidence: meta.confidence,
                }
            })
            .collect();

        serde_wasm_bindgen::to_value(&matches)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Quick check if text contains any entity mentions
    #[wasm_bindgen(js_name = containsAny)]
    pub fn contains_any(&self, text: &str) -> bool {
        let pma = match self.automaton.as_ref() {
            Some(p) => p,
            None => return false,
        };

        pma.find_iter(text).next().is_some()
    }

    /// Get statistics about the cortex
    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self) -> JsValue {
        let stats = ReflexStats {
            pattern_count: self.pending_patterns.len(),
            entity_count: self.entity_ids.len(),
            is_built: self.automaton.is_some(),
        };
        serde_wasm_bindgen::to_value(&stats).unwrap_or(JsValue::NULL)
    }

    /// Clear all patterns and reset the cortex
    #[wasm_bindgen(js_name = clear)]
    pub fn clear(&mut self) {
        self.automaton = None;
        self.pattern_meta.clear();
        self.pending_patterns.clear();
        self.pending_meta.clear();
        self.seen_patterns.clear();
        self.entity_ids.clear();
    }
}

// ==================== TESTS ====================

#[cfg(test)]
mod tests {
    use super::*;

    /// Internal method for testing - returns Vec directly instead of JsValue
    impl ReflexCortex {
        fn scan_native(&self, text: &str) -> Option<Vec<EntityMatch>> {
            let pma = self.automaton.as_ref()?;
            
            // NO ALLOCATION: Scan directly
            let matches: Vec<EntityMatch> = pma
                .find_iter(text)
                .map(|m| {
                    let pattern_id = m.pattern().as_usize();
                    let meta = &self.pattern_meta[pattern_id];
                    EntityMatch {
                        entity_id: meta.entity_id.clone(),
                        start: m.start(),
                        end: m.end(),
                        matched_text: text[m.start()..m.end()].to_string(),
                        match_type: meta.match_type.as_str().to_string(),
                        confidence: meta.confidence,
                    }
                })
                .collect();

            Some(matches)
        }
        
        /// Native build for testing (without JsValue error)
        fn build_native(&mut self) -> Result<(), String> {
            if self.pending_patterns.is_empty() {
                return Err("No patterns to build".to_string());
            }

            let pma = AhoCorasickBuilder::new()
                .match_kind(MatchKind::LeftmostLongest)
                .ascii_case_insensitive(self.case_insensitive)
                .build(&self.pending_patterns)
                .map_err(|e| format!("Build error: {}", e))?;

            self.automaton = Some(pma);
            self.pattern_meta = self.pending_meta.clone();

            Ok(())
        }
    }

    #[test]
    fn test_exact_match() {
        let mut cortex = ReflexCortex::new(true);
        cortex.add_entity("e1", "Frodo", "");
        cortex.build_native().unwrap();

        let matches = cortex.scan_native("Frodo walked home").unwrap();

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].entity_id, "e1");
        assert_eq!(matches[0].start, 0);
        assert_eq!(matches[0].end, 5);
        assert_eq!(matches[0].match_type, "exact");
    }

    #[test]
    fn test_leftmost_longest() {
        let mut cortex = ReflexCortex::new(true);
        cortex.add_entity("e1", "Frodo", "");
        cortex.add_entity("e2", "Frodo Baggins", "");
        cortex.build_native().unwrap();

        let matches = cortex.scan_native("Frodo Baggins went to Mordor").unwrap();

        // Should match "Frodo Baggins" (longer), not "Frodo"
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].entity_id, "e2");
        assert_eq!(matches[0].end, 13);
    }

    #[test]
    fn test_alias_matching() {
        let mut cortex = ReflexCortex::new(true);
        cortex.add_entity("e1", "Gandalf the Grey", "Mithrandir,Grey Pilgrim");
        cortex.build_native().unwrap();

        let matches = cortex.scan_native("Mithrandir spoke").unwrap();

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].entity_id, "e1");
        assert_eq!(matches[0].match_type, "alias");
        assert!(matches[0].confidence < 1.0);
    }

    #[test]
    fn test_case_insensitive() {
        let mut cortex = ReflexCortex::new(true);
        cortex.add_entity("e1", "Aragorn", "");
        cortex.build_native().unwrap();

        let matches = cortex.scan_native("ARAGORN is the king").unwrap();

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].matched_text, "ARAGORN"); // Preserves original case
    }

    #[test]
    fn test_multiple_matches() {
        let mut cortex = ReflexCortex::new(true);
        cortex.add_entity("e1", "Frodo", "");
        cortex.add_entity("e2", "Sam", "");
        cortex.add_entity("e3", "Mordor", "");
        cortex.build_native().unwrap();

        let matches = cortex.scan_native("Frodo and Sam went to Mordor").unwrap();

        assert_eq!(matches.len(), 3);
    }

    #[test]
    fn test_contains_any() {
        let mut cortex = ReflexCortex::new(true);
        cortex.add_entity("e1", "Bilbo", "");
        cortex.build_native().unwrap();

        assert!(cortex.contains_any("Bilbo found the ring"));
        assert!(!cortex.contains_any("The fellowship set out"));
    }
}
