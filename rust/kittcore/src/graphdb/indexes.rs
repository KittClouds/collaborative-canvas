//! Graph Index Layer
//!
//! In-memory indexes for fast graph lookups.
//! Used by GraphDB to provide O(1) access by kind, label, etc.

use std::collections::{HashMap, HashSet};

// =============================================================================
// KindIndex
// =============================================================================

/// Index for looking up entities by their kind (e.g., "CHARACTER", "LOCATION")
#[derive(Debug, Default)]
pub struct KindIndex {
    /// Maps kind → set of entity IDs
    index: HashMap<String, HashSet<String>>,
}

impl KindIndex {
    /// Create a new empty index
    pub fn new() -> Self {
        Self::default()
    }

    /// Add an entity to the index
    pub fn add(&mut self, entity_id: &str, kind: &str) {
        self.index
            .entry(kind.to_string())
            .or_default()
            .insert(entity_id.to_string());
    }

    /// Remove an entity from the index
    pub fn remove(&mut self, entity_id: &str, kind: &str) {
        if let Some(set) = self.index.get_mut(kind) {
            set.remove(entity_id);
            if set.is_empty() {
                self.index.remove(kind);
            }
        }
    }

    /// Get all entity IDs of a given kind
    pub fn get(&self, kind: &str) -> Vec<String> {
        self.index
            .get(kind)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Get count of entities for a kind
    pub fn count(&self, kind: &str) -> usize {
        self.index.get(kind).map(|s| s.len()).unwrap_or(0)
    }

    /// Get all kinds in the index
    pub fn kinds(&self) -> Vec<String> {
        self.index.keys().cloned().collect()
    }
}

// =============================================================================
// LabelIndex
// =============================================================================

/// Index for looking up entities by their label
#[derive(Debug, Default)]
pub struct LabelIndex {
    /// Maps label → set of entity IDs (exact match)
    index: HashMap<String, HashSet<String>>,
    /// Maps lowercase label → set of entity IDs (case-insensitive)
    index_lower: HashMap<String, HashSet<String>>,
}

impl LabelIndex {
    /// Create a new empty index
    pub fn new() -> Self {
        Self::default()
    }

    /// Add an entity to the index
    pub fn add(&mut self, entity_id: &str, label: &str) {
        // Exact match index
        self.index
            .entry(label.to_string())
            .or_default()
            .insert(entity_id.to_string());

        // Case-insensitive index
        self.index_lower
            .entry(label.to_lowercase())
            .or_default()
            .insert(entity_id.to_string());
    }

    /// Remove an entity from the index
    pub fn remove(&mut self, entity_id: &str, label: &str) {
        if let Some(set) = self.index.get_mut(label) {
            set.remove(entity_id);
            if set.is_empty() {
                self.index.remove(label);
            }
        }

        let lower = label.to_lowercase();
        if let Some(set) = self.index_lower.get_mut(&lower) {
            set.remove(entity_id);
            if set.is_empty() {
                self.index_lower.remove(&lower);
            }
        }
    }

    /// Get all entity IDs with exact label match
    pub fn get(&self, label: &str) -> Vec<String> {
        self.index
            .get(label)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Get all entity IDs with case-insensitive label match
    pub fn get_insensitive(&self, label: &str) -> Vec<String> {
        self.index_lower
            .get(&label.to_lowercase())
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod index_tests {
    use super::*;

    // === KindIndex Tests ===

    #[test]
    fn kind_index_empty_returns_empty() {
        let idx = KindIndex::new();
        assert!(idx.get("CHARACTER").is_empty());
    }

    #[test]
    fn kind_index_add_single() {
        let mut idx = KindIndex::new();
        idx.add("e1", "CHARACTER");
        assert_eq!(idx.get("CHARACTER"), vec!["e1"]);
    }

    #[test]
    fn kind_index_add_multiple_same_kind() {
        let mut idx = KindIndex::new();
        idx.add("e1", "CHARACTER");
        idx.add("e2", "CHARACTER");
        let result = idx.get("CHARACTER");
        assert!(result.contains(&"e1".to_string()));
        assert!(result.contains(&"e2".to_string()));
    }

    #[test]
    fn kind_index_remove() {
        let mut idx = KindIndex::new();
        idx.add("e1", "CHARACTER");
        idx.remove("e1", "CHARACTER");
        assert!(idx.get("CHARACTER").is_empty());
    }

    // === LabelIndex Tests ===

    #[test]
    fn label_index_exact_match() {
        let mut idx = LabelIndex::new();
        idx.add("e1", "Frodo Baggins");
        assert_eq!(idx.get("Frodo Baggins"), vec!["e1"]);
    }

    #[test]
    fn label_index_case_insensitive() {
        let mut idx = LabelIndex::new();
        idx.add("e1", "Frodo");
        assert_eq!(idx.get_insensitive("frodo"), vec!["e1"]);
    }

    #[test]
    fn label_index_case_insensitive_mixed() {
        let mut idx = LabelIndex::new();
        idx.add("e1", "Frodo");
        idx.add("e2", "FRODO");
        let result = idx.get_insensitive("FrOdO");
        assert!(result.contains(&"e1".to_string()));
        assert!(result.contains(&"e2".to_string()));
    }

    #[test]
    fn label_index_remove() {
        let mut idx = LabelIndex::new();
        idx.add("e1", "Frodo");
        idx.remove("e1", "Frodo");
        assert!(idx.get("Frodo").is_empty());
        assert!(idx.get_insensitive("frodo").is_empty());
    }
}
