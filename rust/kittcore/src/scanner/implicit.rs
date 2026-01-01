//! ImplicitCortex: Entity Name Matching in Plain Text
//!
//! Uses Aho-Corasick for O(n) detection of entity names and aliases.
//! Designed to find implicit mentions like "Frodo" in prose text.

use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// =============================================================================
// Types
// =============================================================================

/// Entity definition for hydration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityDefinition {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub aliases: Vec<String>,
}

/// A detected implicit entity mention
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImplicitMention {
    pub entity_id: String,
    pub entity_label: String,
    pub entity_kind: String,
    pub matched_text: String,
    pub start: usize,
    pub end: usize,
    pub is_alias_match: bool,
}

/// Metadata for each pattern in the automaton
#[derive(Debug, Clone)]
struct PatternMeta {
    entity_id: String,
    entity_label: String,
    entity_kind: String,
    pattern_text: String,
    is_alias: bool,
}

// =============================================================================
// ImplicitCortex
// =============================================================================

/// Entity name matcher using Aho-Corasick
#[wasm_bindgen]
pub struct ImplicitCortex {
    automaton: Option<AhoCorasick>,
    pattern_meta: Vec<PatternMeta>,
    pending_patterns: Vec<String>,
    needs_rebuild: bool,
}

impl Default for ImplicitCortex {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl ImplicitCortex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            automaton: None,
            pattern_meta: Vec::new(),
            pending_patterns: Vec::new(),
            needs_rebuild: true,
        }
    }

    /// Get the number of patterns
    #[wasm_bindgen(js_name = patternCount)]
    pub fn pattern_count(&self) -> usize {
        self.pattern_meta.len()
    }
}

impl ImplicitCortex {
    /// Hydrate with entity definitions
    pub fn hydrate(&mut self, entities: Vec<EntityDefinition>) {
        self.pattern_meta.clear();
        self.pending_patterns.clear();

        for entity in entities {
            // Add primary label
            let label_lower = entity.label.to_lowercase();
            self.pattern_meta.push(PatternMeta {
                entity_id: entity.id.clone(),
                entity_label: entity.label.clone(),
                entity_kind: entity.kind.clone(),
                pattern_text: label_lower.clone(),
                is_alias: false,
            });
            self.pending_patterns.push(label_lower);

            // Add aliases
            for alias in &entity.aliases {
                let alias_lower = alias.to_lowercase();
                self.pattern_meta.push(PatternMeta {
                    entity_id: entity.id.clone(),
                    entity_label: entity.label.clone(),
                    entity_kind: entity.kind.clone(),
                    pattern_text: alias_lower.clone(),
                    is_alias: true,
                });
                self.pending_patterns.push(alias_lower);
            }
        }

        self.needs_rebuild = true;
    }

    /// Build the automaton
    pub fn build(&mut self) -> Result<(), String> {
        if self.pending_patterns.is_empty() {
            self.automaton = None;
            return Ok(());
        }

        let automaton = AhoCorasickBuilder::new()
            .match_kind(MatchKind::LeftmostLongest)
            .build(&self.pending_patterns)
            .map_err(|e| format!("Failed to build automaton: {}", e))?;

        self.automaton = Some(automaton);
        self.needs_rebuild = false;
        Ok(())
    }

    /// Find all implicit entity mentions in text
    pub fn find_mentions(&self, text: &str) -> Vec<ImplicitMention> {
        let automaton = match &self.automaton {
            Some(a) => a,
            None => return vec![],
        };

        if text.is_empty() {
            return vec![];
        }

        let text_lower = text.to_lowercase();
        let mut mentions: Vec<ImplicitMention> = Vec::new();

        for mat in automaton.find_iter(&text_lower) {
            let pattern_id = mat.pattern().as_usize();
            if let Some(meta) = self.pattern_meta.get(pattern_id) {
                mentions.push(ImplicitMention {
                    entity_id: meta.entity_id.clone(),
                    entity_label: meta.entity_label.clone(),
                    entity_kind: meta.entity_kind.clone(),
                    matched_text: text[mat.start()..mat.end()].to_string(),
                    start: mat.start(),
                    end: mat.end(),
                    is_alias_match: meta.is_alias,
                });
            }
        }

        // Dedupe overlapping matches (LeftmostLongest already handles most cases)
        self.dedupe_overlapping(mentions)
    }

    /// Remove overlapping matches, keeping longer ones
    fn dedupe_overlapping(&self, mut mentions: Vec<ImplicitMention>) -> Vec<ImplicitMention> {
        if mentions.len() <= 1 {
            return mentions;
        }

        // Sort by start position, then by length (longer first)
        mentions.sort_by(|a, b| {
            a.start.cmp(&b.start)
                .then_with(|| (b.end - b.start).cmp(&(a.end - a.start)))
        });

        let mut result: Vec<ImplicitMention> = Vec::new();
        let mut last_end = 0;

        for mention in mentions {
            // Only add if it doesn't overlap with previous
            if mention.start >= last_end {
                last_end = mention.end;
                result.push(mention);
            }
        }

        result
    }

    /// Add a single entity (for incremental updates)
    pub fn add_entity(&mut self, entity: EntityDefinition) {
        let label_lower = entity.label.to_lowercase();
        self.pattern_meta.push(PatternMeta {
            entity_id: entity.id.clone(),
            entity_label: entity.label.clone(),
            entity_kind: entity.kind.clone(),
            pattern_text: label_lower.clone(),
            is_alias: false,
        });
        self.pending_patterns.push(label_lower);

        for alias in &entity.aliases {
            let alias_lower = alias.to_lowercase();
            self.pattern_meta.push(PatternMeta {
                entity_id: entity.id.clone(),
                entity_label: entity.label.clone(),
                entity_kind: entity.kind.clone(),
                pattern_text: alias_lower.clone(),
                is_alias: true,
            });
            self.pending_patterns.push(alias_lower);
        }

        self.needs_rebuild = true;
    }

    /// Clear all patterns
    pub fn clear(&mut self) {
        self.pattern_meta.clear();
        self.pending_patterns.clear();
        self.automaton = None;
        self.needs_rebuild = true;
    }
}

// =============================================================================
// Tests (TDD - written first!)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn entity(id: &str, label: &str, kind: &str, aliases: Vec<&str>) -> EntityDefinition {
        EntityDefinition {
            id: id.to_string(),
            label: label.to_string(),
            kind: kind.to_string(),
            aliases: aliases.into_iter().map(|s| s.to_string()).collect(),
        }
    }

    // -------------------------------------------------------------------------
    // Requirement 1: Hydrate and find single entity
    // -------------------------------------------------------------------------
    #[test]
    fn test_hydrate_and_find_single_entity() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![entity("char_001", "Frodo", "CHARACTER", vec![])]);
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("Frodo went to the market");
        assert_eq!(mentions.len(), 1);
        assert_eq!(mentions[0].entity_id, "char_001");
        assert_eq!(mentions[0].entity_label, "Frodo");
        assert_eq!(mentions[0].entity_kind, "CHARACTER");
        assert_eq!(mentions[0].start, 0);
        assert_eq!(mentions[0].end, 5);
        assert!(!mentions[0].is_alias_match);
    }

    // -------------------------------------------------------------------------
    // Requirement 2: Case-insensitive matching
    // -------------------------------------------------------------------------
    #[test]
    fn test_case_insensitive_matching() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![entity("char_001", "Gandalf", "CHARACTER", vec![])]);
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("GANDALF spoke to gandalf");
        assert_eq!(mentions.len(), 2);
        assert_eq!(mentions[0].entity_id, "char_001");
        assert_eq!(mentions[1].entity_id, "char_001");
    }

    // -------------------------------------------------------------------------
    // Requirement 3: Alias matching with is_alias_match flag
    // -------------------------------------------------------------------------
    #[test]
    fn test_alias_matching() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![entity(
            "char_001",
            "Aragorn",
            "CHARACTER",
            vec!["Strider", "Elessar"],
        )]);
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("Strider is also known as Aragorn");
        assert_eq!(mentions.len(), 2);

        let alias_match = mentions.iter().find(|m| m.matched_text.to_lowercase() == "strider");
        assert!(alias_match.is_some());
        assert!(alias_match.unwrap().is_alias_match);

        let label_match = mentions.iter().find(|m| m.matched_text.to_lowercase() == "aragorn");
        assert!(label_match.is_some());
        assert!(!label_match.unwrap().is_alias_match);
    }

    // -------------------------------------------------------------------------
    // Requirement 4: Overlapping matches - keep longer
    // -------------------------------------------------------------------------
    #[test]
    fn test_overlapping_keeps_longer() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![
            entity("loc_001", "New York", "LOCATION", vec![]),
            entity("loc_002", "York", "LOCATION", vec![]),
        ]);
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("I visited New York yesterday");
        // Should only get "New York", not "York" inside it
        assert_eq!(mentions.len(), 1);
        assert_eq!(mentions[0].entity_id, "loc_001");
        assert_eq!(mentions[0].matched_text, "New York");
    }

    // -------------------------------------------------------------------------
    // Requirement 5: Multiple entities in same text
    // -------------------------------------------------------------------------
    #[test]
    fn test_multiple_entities_same_text() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![
            entity("char_001", "Frodo", "CHARACTER", vec![]),
            entity("char_002", "Sam", "CHARACTER", vec![]),
        ]);
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("Frodo and Sam went on an adventure");
        assert_eq!(mentions.len(), 2);

        let frodo = mentions.iter().find(|m| m.entity_id == "char_001");
        let sam = mentions.iter().find(|m| m.entity_id == "char_002");
        assert!(frodo.is_some());
        assert!(sam.is_some());
    }

    // -------------------------------------------------------------------------
    // Requirement 6: Empty text returns empty
    // -------------------------------------------------------------------------
    #[test]
    fn test_empty_text() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![entity("char_001", "Frodo", "CHARACTER", vec![])]);
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("");
        assert!(mentions.is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 7: No match returns empty
    // -------------------------------------------------------------------------
    #[test]
    fn test_no_match() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![entity("char_001", "Frodo", "CHARACTER", vec![])]);
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("No entities here");
        assert!(mentions.is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 8: Pattern count reflects all labels + aliases
    // -------------------------------------------------------------------------
    #[test]
    fn test_pattern_count() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![
            entity("char_001", "Aragorn", "CHARACTER", vec!["Strider", "Elessar"]),
            entity("char_002", "Gandalf", "CHARACTER", vec!["Mithrandir"]),
        ]);
        cortex.build().unwrap();

        // Aragorn + 2 aliases + Gandalf + 1 alias = 5
        assert_eq!(cortex.pattern_count(), 5);
    }

    // -------------------------------------------------------------------------
    // Requirement 9: Incremental add_entity
    // -------------------------------------------------------------------------
    #[test]
    fn test_add_entity_incremental() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![entity("char_001", "Frodo", "CHARACTER", vec![])]);
        cortex.build().unwrap();

        // Add new entity
        cortex.add_entity(entity("char_002", "Sam", "CHARACTER", vec![]));
        cortex.build().unwrap();

        let mentions = cortex.find_mentions("Frodo and Sam");
        assert_eq!(mentions.len(), 2);
    }

    // -------------------------------------------------------------------------
    // Requirement 10: Clear removes all patterns
    // -------------------------------------------------------------------------
    #[test]
    fn test_clear() {
        let mut cortex = ImplicitCortex::new();
        cortex.hydrate(vec![entity("char_001", "Frodo", "CHARACTER", vec![])]);
        cortex.build().unwrap();

        cortex.clear();
        
        assert_eq!(cortex.pattern_count(), 0);
        let mentions = cortex.find_mentions("Frodo");
        assert!(mentions.is_empty());
    }
}
