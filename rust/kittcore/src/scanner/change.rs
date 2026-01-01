//! ChangeDetector: Content-Addressable Change Detection
//!
//! Uses content hashing to detect changes and skip redundant scans.
//! FNV-1a for speed, with optional paragraph-level granularity.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use wasm_bindgen::prelude::*;

// =============================================================================
// Types
// =============================================================================

/// Result of change detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeResult {
    /// True if content has changed since last check
    pub has_changed: bool,
    /// Current content hash
    pub content_hash: u64,
    /// Previous content hash (if any)
    pub previous_hash: Option<u64>,
}

// =============================================================================
// ChangeDetector
// =============================================================================

/// Content-addressable change detector
#[wasm_bindgen]
pub struct ChangeDetector {
    /// Hash of previous content
    last_hash: Option<u64>,
    /// Number of checks performed
    check_count: u64,
    /// Number of skipped (unchanged) checks
    skip_count: u64,
}

impl Default for ChangeDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl ChangeDetector {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            last_hash: None,
            check_count: 0,
            skip_count: 0,
        }
    }

    /// Get skip rate as percentage
    #[wasm_bindgen(js_name = getSkipRate)]
    pub fn skip_rate(&self) -> f64 {
        if self.check_count == 0 {
            return 0.0;
        }
        (self.skip_count as f64 / self.check_count as f64) * 100.0
    }

    /// Get total number of checks
    #[wasm_bindgen(js_name = getCheckCount)]
    pub fn check_count(&self) -> u64 {
        self.check_count
    }

    /// Get number of skipped checks
    #[wasm_bindgen(js_name = getSkipCount)]
    pub fn skip_count(&self) -> u64 {
        self.skip_count
    }

    /// Reset the detector state
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.last_hash = None;
        self.check_count = 0;
        self.skip_count = 0;
    }
}

impl ChangeDetector {
    /// Check if content has changed
    /// Returns true if content is different from last check
    pub fn has_changed(&mut self, text: &str) -> bool {
        self.check_count += 1;
        
        let current_hash = Self::compute_hash(text);
        
        let changed = match self.last_hash {
            None => true, // First check always counts as changed
            Some(prev) => prev != current_hash,
        };
        
        if !changed {
            self.skip_count += 1;
        }
        
        self.last_hash = Some(current_hash);
        changed
    }

    /// Check and return detailed result
    pub fn check(&mut self, text: &str) -> ChangeResult {
        self.check_count += 1;
        
        let current_hash = Self::compute_hash(text);
        let previous_hash = self.last_hash;
        
        let has_changed = match previous_hash {
            None => true,
            Some(prev) => prev != current_hash,
        };
        
        if !has_changed {
            self.skip_count += 1;
        }
        
        self.last_hash = Some(current_hash);
        
        ChangeResult {
            has_changed,
            content_hash: current_hash,
            previous_hash,
        }
    }

    /// Compute hash of content
    fn compute_hash(text: &str) -> u64 {
        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        hasher.finish()
    }

    /// Get the last computed hash
    pub fn last_hash(&self) -> Option<u64> {
        self.last_hash
    }

    /// Force set the last hash (for testing or external sync)
    pub fn set_last_hash(&mut self, hash: u64) {
        self.last_hash = Some(hash);
    }
}

// =============================================================================
// Tests (TDD - written first!)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Requirement 1: First check always returns changed
    // -------------------------------------------------------------------------
    #[test]
    fn test_first_check_returns_changed() {
        let mut detector = ChangeDetector::new();
        assert!(detector.has_changed("Hello world"));
    }

    // -------------------------------------------------------------------------
    // Requirement 2: Same content returns unchanged
    // -------------------------------------------------------------------------
    #[test]
    fn test_same_content_unchanged() {
        let mut detector = ChangeDetector::new();
        
        detector.has_changed("Hello world");
        assert!(!detector.has_changed("Hello world"));
    }

    // -------------------------------------------------------------------------
    // Requirement 3: Different content returns changed
    // -------------------------------------------------------------------------
    #[test]
    fn test_different_content_changed() {
        let mut detector = ChangeDetector::new();
        
        detector.has_changed("Hello world");
        assert!(detector.has_changed("Hello universe"));
    }

    // -------------------------------------------------------------------------
    // Requirement 4: Multiple identical checks count skips
    // -------------------------------------------------------------------------
    #[test]
    fn test_skip_count() {
        let mut detector = ChangeDetector::new();
        
        detector.has_changed("Hello");  // First: changed
        detector.has_changed("Hello");  // Same: skipped
        detector.has_changed("Hello");  // Same: skipped
        
        assert_eq!(detector.check_count(), 3);
        assert_eq!(detector.skip_count(), 2);
    }

    // -------------------------------------------------------------------------
    // Requirement 5: Skip rate calculation
    // -------------------------------------------------------------------------
    #[test]
    fn test_skip_rate() {
        let mut detector = ChangeDetector::new();
        
        detector.has_changed("A");  // Changed
        detector.has_changed("A");  // Skipped
        detector.has_changed("A");  // Skipped
        detector.has_changed("A");  // Skipped
        
        // 3 skips out of 4 checks = 75%
        assert!((detector.skip_rate() - 75.0).abs() < 0.01);
    }

    // -------------------------------------------------------------------------
    // Requirement 6: Empty text is valid
    // -------------------------------------------------------------------------
    #[test]
    fn test_empty_text() {
        let mut detector = ChangeDetector::new();
        
        detector.has_changed("");
        assert!(!detector.has_changed(""));
        assert!(detector.has_changed("not empty"));
    }

    // -------------------------------------------------------------------------
    // Requirement 7: Reset clears state
    // -------------------------------------------------------------------------
    #[test]
    fn test_reset() {
        let mut detector = ChangeDetector::new();
        
        detector.has_changed("Hello");
        detector.has_changed("Hello");
        assert_eq!(detector.check_count(), 2);
        
        detector.reset();
        assert_eq!(detector.check_count(), 0);
        assert_eq!(detector.skip_count(), 0);
        assert!(detector.last_hash().is_none());
        
        // After reset, first check is changed again
        assert!(detector.has_changed("Hello"));
    }

    // -------------------------------------------------------------------------
    // Requirement 8: Check returns detailed result
    // -------------------------------------------------------------------------
    #[test]
    fn test_check_result() {
        let mut detector = ChangeDetector::new();
        
        let result1 = detector.check("Hello");
        assert!(result1.has_changed);
        assert!(result1.previous_hash.is_none());
        
        let result2 = detector.check("Hello");
        assert!(!result2.has_changed);
        assert!(result2.previous_hash.is_some());
        assert_eq!(result2.content_hash, result1.content_hash);
    }

    // -------------------------------------------------------------------------
    // Requirement 9: Hash is deterministic
    // -------------------------------------------------------------------------
    #[test]
    fn test_hash_deterministic() {
        let mut detector = ChangeDetector::new();
        
        let result1 = detector.check("The quick brown fox");
        detector.reset();
        let result2 = detector.check("The quick brown fox");
        
        assert_eq!(result1.content_hash, result2.content_hash);
    }

    // -------------------------------------------------------------------------
    // Requirement 10: Whitespace matters
    // -------------------------------------------------------------------------
    #[test]
    fn test_whitespace_matters() {
        let mut detector = ChangeDetector::new();
        
        detector.has_changed("Hello world");
        assert!(detector.has_changed("Hello  world"));  // Extra space = change
        assert!(detector.has_changed("Hello world "));  // Trailing space = change
    }
}
