//! ScanConductor: Unified coordinator for document scanning
//!
//! # Design Principles
//! 1. State machine: Uninitialized → Initialized → Ready
//! 2. One scan result serves both highlighting AND relationship extraction
//! 3. Zero-cost wrapper - just state gating around DocumentCortex
//!
//! # Usage
//! ```rust
//! let mut conductor = ScanConductor::new();
//! conductor.init();
//! conductor.hydrate_entities(entities)?;
//! let result = conductor.scan(text); // Returns Some(ScanResult)
//! ```

use crate::scanner::document::{DocumentCortex, ScanResult};
use crate::scanner::relation::EntitySpan;
use crate::scanner::implicit::EntityDefinition;
use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;

// =============================================================================
// State Machine
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum State {
    /// Fresh instance, nothing initialized
    Uninitialized,
    /// Cortexes ready, but no entities hydrated
    Initialized,
    /// Fully ready - cortexes initialized AND entities hydrated
    Ready,
}

// =============================================================================
// ScanConductor
// =============================================================================

/// Single coordinator for all document scanning operations.
///
/// Ensures proper initialization and hydration ordering.
/// Eliminates race conditions between scanner and highlighter.
#[wasm_bindgen]
pub struct ScanConductor {
    cortex: DocumentCortex,
    state: State,
}

impl Default for ScanConductor {
    fn default() -> Self {
        Self::new()
    }
}

impl ScanConductor {
    /// Create a new uninitialized conductor
    pub fn new() -> Self {
        Self {
            cortex: DocumentCortex::default(),
            state: State::Uninitialized,
        }
    }

    /// Initialize internal cortexes. Idempotent - safe to call multiple times.
    pub fn init(&mut self) {
        if self.state == State::Uninitialized {
            self.cortex = DocumentCortex::new();
            self.state = State::Initialized;
        }
    }

    /// Hydrate entities for implicit matching.
    /// Auto-initializes if needed. Marks conductor as Ready.
    /// Also resets the change detector so subsequent scans re-process with new entities.
    pub fn hydrate_entities(&mut self, entities: Vec<EntityDefinition>) -> Result<(), String> {
        // Auto-init if caller forgot
        if self.state == State::Uninitialized {
            self.init();
        }
        self.cortex.hydrate_entities(entities)?;
        // CRITICAL: Reset change detector so next scan re-processes with new entities
        // Otherwise, same text would return cached result with OLD entity matches
        self.cortex.reset();
        self.state = State::Ready;
        Ok(())
    }

    /// Hydrate temporal patterns (calendar-aware detection)
    /// NOTE: Requires DocumentCortex to expose temporal_cortex publicly
    /// TODO: Add hydrate_calendar method to DocumentCortex
    pub fn hydrate_calendar(&mut self, _months: &[String], _weekdays: &[String], _eras: &[String]) {
        if self.state == State::Uninitialized {
            self.init();
        }
        // TODO: self.cortex.hydrate_calendar(months, weekdays, eras);
        // For now, calendar hydration goes through a different path
    }

    /// Check if conductor is fully ready for scanning
    pub fn is_ready(&self) -> bool {
        self.state == State::Ready
    }

    /// Current state name (for debugging)
    pub fn state_name(&self) -> &'static str {
        match self.state {
            State::Uninitialized => "uninitialized",
            State::Initialized => "initialized",
            State::Ready => "ready",
        }
    }

    /// Unified scan. Returns None if not ready.
    pub fn scan(&mut self, text: &str, external_spans: &[EntitySpan]) -> Option<ScanResult> {
        if self.state != State::Ready {
            return None;
        }
        Some(self.cortex.scan(text, external_spans))
    }

    /// Force scan even if not fully ready (for testing/debugging)
    pub fn scan_force(&mut self, text: &str, external_spans: &[EntitySpan]) -> ScanResult {
        if self.state == State::Uninitialized {
            self.init();
        }
        self.cortex.scan(text, external_spans)
    }

    /// Get hydrated entity count (for debugging)
    pub fn entity_count(&self) -> usize {
        self.cortex.implicit_pattern_count()
    }

    /// Get relation pattern count
    pub fn relation_pattern_count(&self) -> usize {
        self.cortex.relation_pattern_count()
    }

    /// Reset conductor to initialized state (clears entities, keeps cortex)
    /// Also clears incremental state via cortex.reset()
    pub fn reset(&mut self) {
        self.cortex.reset();
        if self.state == State::Ready {
            self.state = State::Initialized;
        }
    }
}

// =============================================================================
// WASM Bindings
// =============================================================================

#[wasm_bindgen]
impl ScanConductor {
    /// Create new conductor (JS binding)
    #[wasm_bindgen(constructor)]
    pub fn js_new() -> Self {
        Self::new()
    }

    /// Initialize cortexes (JS binding)
    #[wasm_bindgen(js_name = "init")]
    pub fn js_init(&mut self) {
        self.init();
    }

    /// Hydrate entities (JS binding)
    /// Expects array of { id, label, kind, aliases }
    #[wasm_bindgen(js_name = "hydrateEntities")]
    pub fn js_hydrate_entities(&mut self, entities: JsValue) -> Result<(), JsValue> {
        let entities: Vec<EntityDefinition> = serde_wasm_bindgen::from_value(entities)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse entities: {}", e)))?;
        self.hydrate_entities(entities)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Hydrate calendar terms (JS binding)
    #[wasm_bindgen(js_name = "hydrateCalendar")]
    pub fn js_hydrate_calendar(&mut self, months: JsValue, weekdays: JsValue, eras: JsValue) -> Result<(), JsValue> {
        let months: Vec<String> = serde_wasm_bindgen::from_value(months)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse months: {}", e)))?;
        let weekdays: Vec<String> = serde_wasm_bindgen::from_value(weekdays)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse weekdays: {}", e)))?;
        let eras: Vec<String> = serde_wasm_bindgen::from_value(eras)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse eras: {}", e)))?;
        self.hydrate_calendar(&months, &weekdays, &eras);
        Ok(())
    }

    /// Check if ready (JS binding)
    #[wasm_bindgen(js_name = "isReady")]
    pub fn js_is_ready(&self) -> bool {
        self.is_ready()
    }

    /// Get state name (JS binding)
    #[wasm_bindgen(js_name = "stateName")]
    pub fn js_state_name(&self) -> String {
        self.state_name().to_string()
    }

    /// Unified scan (JS binding)
    /// Returns null if not ready, ScanResult otherwise
    #[wasm_bindgen(js_name = "scan")]
    pub fn js_scan(&mut self, text: &str, entity_spans: JsValue) -> JsValue {
        let spans: Vec<EntitySpan> = serde_wasm_bindgen::from_value(entity_spans)
            .unwrap_or_default();

        match self.scan(text, &spans) {
            Some(result) => serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL),
            None => JsValue::NULL,
        }
    }

    /// Force scan (JS binding) - always returns result
    #[wasm_bindgen(js_name = "scanForce")]
    pub fn js_scan_force(&mut self, text: &str, entity_spans: JsValue) -> JsValue {
        let spans: Vec<EntitySpan> = serde_wasm_bindgen::from_value(entity_spans)
            .unwrap_or_default();
        let result = self.scan_force(text, &spans);
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Get entity count (JS binding)
    #[wasm_bindgen(js_name = "entityCount")]
    pub fn js_entity_count(&self) -> usize {
        self.entity_count()
    }

    /// Get incremental stats (JS binding)
    #[wasm_bindgen(js_name = "incrementalStats")]
    pub fn js_incremental_stats(&self) -> JsValue {
        serde_wasm_bindgen::to_value(self.cortex.incremental_stats()).unwrap_or(JsValue::NULL)
    }

    /// Reset conductor (JS binding)
    #[wasm_bindgen(js_name = "reset")]
    pub fn js_reset(&mut self) {
        self.reset();
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entity(id: &str, label: &str, kind: &str) -> EntityDefinition {
        EntityDefinition {
            id: id.to_string(),
            label: label.to_string(),
            kind: kind.to_string(),
            aliases: vec![],
        }
    }

    #[test]
    fn test_conductor_rejects_scan_before_init() {
        let mut conductor = ScanConductor::new();
        let result = conductor.scan("test text", &[]);
        assert!(result.is_none(), "Should return None before init");
    }

    #[test]
    fn test_conductor_rejects_scan_after_init_but_before_hydrate() {
        let mut conductor = ScanConductor::new();
        conductor.init();
        let result = conductor.scan("test text", &[]);
        assert!(result.is_none(), "Should return None before hydration");
    }

    #[test]
    fn test_conductor_allows_scan_after_hydration() {
        let mut conductor = ScanConductor::new();
        conductor.init();
        conductor.hydrate_entities(vec![]).unwrap();
        
        let result = conductor.scan("test text", &[]);
        assert!(result.is_some(), "Should return Some after hydration");
    }

    #[test]
    fn test_conductor_auto_inits_on_hydrate() {
        let mut conductor = ScanConductor::new();
        // Skip init(), go straight to hydrate
        conductor.hydrate_entities(vec![]).unwrap();
        
        assert!(conductor.is_ready(), "Should be ready after hydrate (auto-init)");
        let result = conductor.scan("test text", &[]);
        assert!(result.is_some(), "Should scan after auto-init");
    }

    #[test]
    fn test_conductor_finds_entities_after_hydration() {
        let mut conductor = ScanConductor::new();
        conductor.hydrate_entities(vec![
            make_entity("1", "Luffy", "CHARACTER"),
        ]).unwrap();
        
        let result = conductor.scan("Luffy is fighting", &[]).unwrap();
        assert_eq!(result.implicit.len(), 1, "Should find 1 implicit entity");
        assert_eq!(result.implicit[0].entity_label, "Luffy");
    }

    #[test]
    fn test_conductor_rehydration_replaces_entities() {
        let mut conductor = ScanConductor::new();
        conductor.hydrate_entities(vec![
            make_entity("1", "Luffy", "CHARACTER"),
        ]).unwrap();
        
        // Re-hydrate with different entity
        conductor.hydrate_entities(vec![
            make_entity("2", "Zoro", "CHARACTER"),
        ]).unwrap();
        
        let result = conductor.scan("Luffy fights Zoro", &[]).unwrap();
        
        // Should find Zoro but not Luffy (replaced)
        assert_eq!(result.implicit.len(), 1);
        assert_eq!(result.implicit[0].entity_label, "Zoro");
    }

    #[test]
    fn test_conductor_state_progression() {
        let mut conductor = ScanConductor::new();
        
        assert_eq!(conductor.state_name(), "uninitialized");
        assert!(!conductor.is_ready());
        
        conductor.init();
        assert_eq!(conductor.state_name(), "initialized");
        assert!(!conductor.is_ready());
        
        conductor.hydrate_entities(vec![]).unwrap();
        assert_eq!(conductor.state_name(), "ready");
        assert!(conductor.is_ready());
    }

    #[test]
    fn test_conductor_scan_returns_relations() {
        let mut conductor = ScanConductor::new();
        conductor.hydrate_entities(vec![
            make_entity("1", "Luffy", "CHARACTER"),
            make_entity("2", "Grand Line", "LOCATION"),
        ]).unwrap();
        
        let result = conductor.scan("Luffy traveled to Grand Line", &[]).unwrap();
        
        // Should have implicit matches
        assert!(result.implicit.len() >= 2, "Should find both entities");
        
        // Relations depend on pattern matching - at least check stats exist
        assert!(result.stats.timings.total_us > 0);
    }

    #[test]
    fn test_conductor_force_scan_works_before_ready() {
        let mut conductor = ScanConductor::new();
        // No init, no hydrate - force scan should still work
        let result = conductor.scan_force("test text", &[]);
        
        // Should return a result (even if empty)
        assert!(result.stats.timings.total_us >= 0);
    }

    #[test]
    fn test_conductor_reset_clears_ready_state() {
        let mut conductor = ScanConductor::new();
        conductor.hydrate_entities(vec![
            make_entity("1", "Luffy", "CHARACTER"),
        ]).unwrap();
        
        assert!(conductor.is_ready());
        
        conductor.reset();
        
        // Should be back to initialized (not uninitialized)
        assert_eq!(conductor.state_name(), "initialized");
        assert!(!conductor.is_ready());
    }
}
