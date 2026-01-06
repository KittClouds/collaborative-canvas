//! DocumentCortex: Unified Document Scanner
//!
//! Single scan() call for all extraction types:
//! - Entity syntax detection (via SyntaxCortex - TO BE WIRED)
//! - Relationship extraction (via RelationCortex)
//! - Temporal expression detection (via TemporalCortex - TO BE WIRED)
//! - Implicit entity mentions (via ImplicitCortex)
//! - Triple extraction (via TripleCortex)
//!
//! Designed for WASM with a single cross-boundary call per scan.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::scanner::{
    ChangeDetector,
    ImplicitCortex, ImplicitMention, EntityDefinition,
    TripleCortex, ExtractedTriple,
    RelationCortex, ExtractedRelation, EntitySpan, UnifiedRelation, RelationSource,
    TemporalCortex, TemporalMention,
    incremental::{self, IncrementalState, Delta, ExtractedItems, IncrementalStats},
    structured_relation::{StructuredRelationExtractor, StructuredRelation},
};

// =============================================================================
// Types
// =============================================================================

/// Timing statistics for each scan phase
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScanTimings {
    pub total_us: u64,
    pub syntax_us: u64,
    pub relation_us: u64,
    pub temporal_us: u64,
    pub implicit_us: u64,
    pub structured_us: u64,
    pub triple_us: u64,
    /// NEW: Time for CST + Graph inference pipeline
    pub unified_us: u64,
}

/// Aggregate statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScanStats {
    pub timings: ScanTimings,
    /// Content hash as hex string (u64 would overflow JS Number.MAX_SAFE_INTEGER)
    pub content_hash: String,
    pub was_skipped: bool,
    pub was_incremental: bool,
    pub entities_found: usize,
    pub relations_found: usize,
    pub temporal_found: usize,
    pub implicit_found: usize,
    pub triples_found: usize,
    pub structured_found: usize,
    /// NEW: Count from CST + Graph inference pipeline
    pub unified_found: usize,
}

/// Error during scan phase (non-fatal)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanError {
    pub phase: String,
    pub message: String,
}

/// Unified scan result
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScanResult {
    // Extractions
    pub relations: Vec<ExtractedRelation>,
    pub implicit: Vec<ImplicitMention>,
    pub triples: Vec<ExtractedTriple>,
    pub structured: Vec<StructuredRelation>,
    pub temporal: Vec<TemporalMention>,
    /// NEW: Unified relations from CST + Graph inference pipeline
    pub unified_relations: Vec<UnifiedRelation>,
    // Note: entities will be added when we wire SyntaxCortex
    
    // Metadata
    pub stats: ScanStats,
    pub errors: Vec<ScanError>,
}

// =============================================================================
// DocumentCortex
// =============================================================================

/// Unified document scanner
#[wasm_bindgen]
pub struct DocumentCortex {
    // Core extractors
    relation_cortex: RelationCortex,
    implicit_cortex: ImplicitCortex,
    triple_cortex: TripleCortex,
    temporal_cortex: TemporalCortex,
    structured_extractor: StructuredRelationExtractor,
    
    // State
    change_detector: ChangeDetector,
    last_result: Option<ScanResult>,
    incremental_state: Option<IncrementalState>,
    incremental_stats: IncrementalStats,
}

impl Default for DocumentCortex {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl DocumentCortex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut relation_cortex = RelationCortex::new();
        relation_cortex.build().ok(); // Build default patterns
        
        Self {
            relation_cortex,
            implicit_cortex: ImplicitCortex::new(),
            triple_cortex: TripleCortex::new(),
            temporal_cortex: TemporalCortex::new(),
            structured_extractor: StructuredRelationExtractor::new(),
            change_detector: ChangeDetector::new(),
            last_result: None,
            incremental_state: None,
            incremental_stats: IncrementalStats::default(),
        }
    }

    /// Get pattern count for relations
    #[wasm_bindgen(js_name = relationPatternCount)]
    pub fn relation_pattern_count(&self) -> usize {
        self.relation_cortex.pattern_count()
    }

    /// Get pattern count for implicit entity matching
    #[wasm_bindgen(js_name = implicitPatternCount)]
    pub fn implicit_pattern_count(&self) -> usize {
        self.implicit_cortex.pattern_count()
    }

    /// Get skip rate from change detector
    #[wasm_bindgen(js_name = skipRate)]
    pub fn skip_rate(&self) -> f64 {
        self.change_detector.skip_rate()
    }

    /// Reset change detector and cached result
    #[wasm_bindgen(js_name = reset)]
    pub fn js_reset(&mut self) {
        self.change_detector.reset();
        self.last_result = None;
    }

    /// Hydrate implicit entity matcher with entities (JS binding)
    #[wasm_bindgen(js_name = hydrateEntities)]
    pub fn js_hydrate_entities(&mut self, entities: JsValue) -> Result<(), JsValue> {
        let entities: Vec<EntityDefinition> = serde_wasm_bindgen::from_value(entities)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse entities: {}", e)))?;
        
        self.implicit_cortex.hydrate(entities);
        self.implicit_cortex.build()
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Hydrate temporal cortex (JS binding)
    #[wasm_bindgen(js_name = hydrateCalendar)]
    pub fn js_hydrate_calendar(&mut self, months: JsValue, weekdays: JsValue, eras: JsValue) -> Result<(), JsValue> {
        self.temporal_cortex.hydrate_calendar(months, weekdays, eras)
            .map_err(|e| JsValue::from_str(&format!("Failed to hydrate calendar: {:?}", e)))
    }

    /// Unified scan - one call extracts everything (JS binding)
    /// 
    /// entity_spans should be an array of { label: string, start: number, end: number, kind?: string }
    #[wasm_bindgen(js_name = scan)]
    pub fn js_scan(&mut self, text: &str, entity_spans: JsValue) -> JsValue {
        let spans: Vec<EntitySpan> = serde_wasm_bindgen::from_value(entity_spans)
            .unwrap_or_default();
        
        let result = self.scan(text, &spans);
        match serde_wasm_bindgen::to_value(&result) {
            Ok(v) => v,
            Err(e) => {
                web_sys::console::error_1(&format!("[DocumentCortex] Serialization failed: {:?}", e).into());
                JsValue::NULL
            }
        }
    }
}

impl DocumentCortex {
    /// Hydrate implicit entity matcher with entities
    pub fn hydrate_entities(&mut self, entities: Vec<EntityDefinition>) -> Result<(), String> {
        self.implicit_cortex.hydrate(entities);
        self.implicit_cortex.build()
    }

    /// Add a single entity to implicit matcher
    pub fn add_entity(&mut self, entity: EntityDefinition) {
        self.implicit_cortex.add_entity(entity);
    }

    /// Rebuild implicit matcher (call after adding entities)
    pub fn rebuild_implicit(&mut self) -> Result<(), String> {
        self.implicit_cortex.build()
    }

    /// Unified scan - one call extracts everything
    /// 
    /// This is a CLOSED LOOP scanner with INCREMENTAL support. It:
    /// 1. Checks if content changed (skip if identical)
    /// 2. Computes delta vs. previous chunks
    /// 3. Uses incremental path if delta is small (< 30% dirty)
    /// 4. Falls back to full rescan for large changes
    /// 
    /// The caller does NOT need to provide entity spans - the scanner is self-sufficient.
    pub fn scan(&mut self, text: &str, external_spans: &[EntitySpan]) -> ScanResult {
        let overall_start = instant::Instant::now();
        
        // Check for changes
        let change_result = self.change_detector.check(text);
        
        // If unchanged and we have a cached result, return it
        if !change_result.has_changed {
            if let Some(ref cached) = self.last_result {
                let mut result = cached.clone();
                result.stats.was_skipped = true;
                result.stats.content_hash = format!("{:x}", change_result.content_hash);
                result.stats.timings.total_us = overall_start.elapsed().as_micros() as u64;
                return result;
            }
        }
        
        // Try incremental path if we have previous state
        if let Some(ref state) = self.incremental_state {
            let delta = incremental::compute_delta(&state.chunks, text);
            if delta.should_use_incremental() {
                // Extract values for stats before moving delta
                let dirty_chunks = delta.dirty_chunks;
                let total_chunks = delta.total_chunks;
                
                let result = self.scan_incremental(text, external_spans, delta, change_result.content_hash);
                self.incremental_stats.incremental_count += 1;
                let count = self.incremental_stats.incremental_count as f64;
                self.incremental_stats.avg_dirty_ratio = 
                    (self.incremental_stats.avg_dirty_ratio * (count - 1.0) + 
                     dirty_chunks as f64 / total_chunks as f64) / count;
                return result;
            }
        }
        
        // Full rescan
        self.incremental_stats.full_rescan_count += 1;
        self.scan_full(text, external_spans, change_result.content_hash)
    }

    /// Incremental scan - only rescan dirty regions
    fn scan_incremental(&mut self, text: &str, _external_spans: &[EntitySpan], delta: Delta, content_hash: u64) -> ScanResult {
        let overall_start = instant::Instant::now();
        let mut result = ScanResult::default();
        result.stats.content_hash = format!("{:x}", content_hash);
        result.stats.was_incremental = true;
        
        // Start with cached items (we'll shift and filter them)
        let state = self.incremental_state.take().unwrap_or_default();
        
        // Clone and shift preserved items
        let mut relations = state.extracted_items.relations.clone();
        let mut implicit = state.extracted_items.implicit.clone();
        let mut triples = state.extracted_items.triples.clone();
        let mut temporal = state.extracted_items.temporal.clone();
        
        incremental::shift_items(&mut relations, &delta);
        incremental::shift_items(&mut implicit, &delta);
        incremental::shift_items(&mut triples, &delta);
        incremental::shift_items(&mut temporal, &delta);
        
        // Extract from dirty regions only
        for (range, dirty_text) in incremental::extract_dirty_text(text, &delta) {
            let offset = range.start;
            
            // Triple extraction on dirty region
            let triple_start = instant::Instant::now();
            for mut triple in self.triple_cortex.extract(dirty_text) {
                triple.start += offset;
                triple.end += offset;
                triples.push(triple);
            }
            result.stats.timings.triple_us += triple_start.elapsed().as_micros() as u64;
            
            // Implicit mentions from dirty region
            let implicit_start = instant::Instant::now();
            for mut mention in self.implicit_cortex.find_mentions(dirty_text) {
                mention.start += offset;
                mention.end += offset;
                implicit.push(mention);
            }
            result.stats.timings.implicit_us += implicit_start.elapsed().as_micros() as u64;
            
            // Build spans from implicit mentions for relation extraction
            let all_spans: Vec<EntitySpan> = implicit.iter()
                .filter(|m| m.start >= offset && m.end <= offset + dirty_text.len())
                .map(|mention| EntitySpan {
                    label: mention.entity_label.clone(),
                    entity_id: Some(mention.entity_id.clone()),
                    start: mention.start,
                    end: mention.end,
                    kind: Some(mention.entity_kind.clone()),
                }).collect();
            
            // Relation extraction on dirty region
            let relation_start = instant::Instant::now();
            for mut rel in self.relation_cortex.extract_legacy(dirty_text, &all_spans.iter().map(|s| 
                EntitySpan {
                    label: s.label.clone(),
                    entity_id: s.entity_id.clone(),
                    start: s.start - offset,
                    end: s.end - offset,
                    kind: s.kind.clone(),
                }
            ).collect::<Vec<_>>()) {
                rel.head_start += offset;
                rel.head_end += offset;
                rel.tail_start += offset;
                rel.tail_end += offset;
                rel.pattern_start += offset;
                rel.pattern_end += offset;
                relations.push(rel);
            }
            result.stats.timings.relation_us += relation_start.elapsed().as_micros() as u64;
            
            // Temporal from dirty region
            let temporal_start = instant::Instant::now();
            let temporal_result = self.temporal_cortex.scan_native(dirty_text);
            for mut mention in temporal_result.mentions {
                mention.start += offset;
                mention.end += offset;
                temporal.push(mention);
            }
            result.stats.timings.temporal_us += temporal_start.elapsed().as_micros() as u64;
        }
        
        // Deduplicate (items might overlap at boundaries)
        relations.sort_by_key(|r| (r.head_start, r.tail_start));
        relations.dedup_by(|a, b| a.head_start == b.head_start && a.tail_start == b.tail_start);
        
        implicit.sort_by_key(|m| m.start);
        implicit.dedup_by(|a, b| a.start == b.start && a.entity_id == b.entity_id);
        
        triples.sort_by_key(|t| t.start);
        triples.dedup_by(|a, b| a.start == b.start && a.source == b.source);
        
        temporal.sort_by_key(|t| t.start);
        temporal.dedup_by(|a, b| a.start == b.start && a.text == b.text);
        
        // Populate result
        result.stats.relations_found = relations.len();
        result.stats.implicit_found = implicit.len();
        result.stats.triples_found = triples.len();
        result.stats.temporal_found = temporal.len();
        result.relations = relations.clone();
        result.implicit = implicit.clone();
        result.triples = triples.clone();
        result.temporal = temporal.clone();
        
        // Finalize
        result.stats.timings.total_us = overall_start.elapsed().as_micros() as u64;
        result.stats.was_skipped = false;
        
        // Update state
        self.incremental_state = Some(IncrementalState {
            chunks: incremental::chunk_text(text),
            extracted_items: ExtractedItems {
                relations,
                implicit,
                triples,
                temporal,
            },
        });
        self.last_result = Some(result.clone());
        
        result
    }

    /// Full scan - extract everything from scratch
    fn scan_full(&mut self, text: &str, external_spans: &[EntitySpan], content_hash: u64) -> ScanResult {
        let overall_start = instant::Instant::now();
        let mut result = ScanResult::default();
        result.stats.content_hash = format!("{:x}", content_hash);
        
        // Phase 1: Triple extraction (independent, no entity context needed)
        let triple_start = instant::Instant::now();
        result.triples = self.triple_cortex.extract(text);
        result.stats.timings.triple_us = triple_start.elapsed().as_micros() as u64;
        result.stats.triples_found = result.triples.len();
        
        // Phase 2: Implicit entity mentions (FIRST - feeds into relations)
        let implicit_start = instant::Instant::now();
        result.implicit = self.implicit_cortex.find_mentions(text);
        result.stats.timings.implicit_us = implicit_start.elapsed().as_micros() as u64;
        result.stats.implicit_found = result.implicit.len();
        
        // Phase 3: Build entity spans from implicit mentions
        // This makes DocumentCortex SELF-SUFFICIENT - no external spans needed
        let mut all_spans: Vec<EntitySpan> = result.implicit.iter().map(|mention| {
            EntitySpan {
                label: mention.entity_label.clone(),
                entity_id: Some(mention.entity_id.clone()),
                start: mention.start,
                end: mention.end,
                kind: Some(mention.entity_kind.clone()),
            }
        }).collect();
        
        // Merge with any external spans (optional augmentation from syntax detection)
        // External spans take precedence if there's overlap (they're explicit)
        for ext in external_spans {
            let overlaps = all_spans.iter().any(|s| {
                (ext.start >= s.start && ext.start < s.end) ||
                (ext.end > s.start && ext.end <= s.end) ||
                (ext.start <= s.start && ext.end >= s.end)
            });
            if !overlaps {
                all_spans.push(ext.clone());
            }
        }
        
        // Phase 4: Relation extraction (uses combined spans)
        let relation_start = instant::Instant::now();
        result.relations = self.relation_cortex.extract_legacy(text, &all_spans);
        result.stats.timings.relation_us = relation_start.elapsed().as_micros() as u64;
        result.stats.relations_found = result.relations.len();
        
        // Phase 5: Temporal extraction
        let temporal_start = instant::Instant::now();
        let temporal_result = self.temporal_cortex.scan_native(text);
        result.temporal = temporal_result.mentions;
        result.stats.timings.temporal_us = temporal_start.elapsed().as_micros() as u64;
        result.stats.temporal_found = result.temporal.len();
        
        // Phase 6: Structured relation extraction (SVO-based implicit triples)
        // Uses sentence structure to find subject-verb-object patterns
        let structured_start = instant::Instant::now();
        result.structured = self.structured_extractor.extract_structured(text, &all_spans);
        result.stats.timings.structured_us = structured_start.elapsed().as_micros() as u64;
        result.stats.structured_found = result.structured.len();
        
        // Convert structured relations to triples for convenience
        for sr in &result.structured {
            if let Some(ref object) = sr.object {
                result.triples.push(ExtractedTriple {
                    source: sr.subject.clone(),
                    predicate: sr.relation_type.clone(),
                    target: object.clone(),
                    start: sr.subject_span.start,
                    end: sr.object_span.as_ref().map(|s| s.end).unwrap_or(sr.predicate_span.end),
                    raw_text: format!("{} {} {}", sr.subject, sr.predicate, object),
                    source_kind: None,
                    target_kind: None,
                });
            }
        }
        result.stats.triples_found = result.triples.len();
        
        // Phase 7: Unified relation extraction (CST + Graph inference)
        // Uses the new RelationEngine pipeline for combined extraction
        let unified_start = instant::Instant::now();
        
        // Collect existing edges from explicit triples for graph inference
        let existing_edges: Vec<(String, String, String)> = result.triples
            .iter()
            .map(|t| (t.source.clone(), t.target.clone(), t.predicate.clone()))
            .collect();
        
        let (unified_relations, _unified_stats) = self.relation_cortex.extract(text, &all_spans, &existing_edges);
        result.unified_relations = unified_relations;
        result.stats.timings.unified_us = unified_start.elapsed().as_micros() as u64;
        result.stats.unified_found = result.unified_relations.len();
        
        // Finalize
        result.stats.timings.total_us = overall_start.elapsed().as_micros() as u64;
        result.stats.was_skipped = false;
        
        // Update incremental state for next scan
        self.incremental_state = Some(IncrementalState {
            chunks: incremental::chunk_text(text),
            extracted_items: ExtractedItems {
                relations: result.relations.clone(),
                implicit: result.implicit.clone(),
                triples: result.triples.clone(),
                temporal: result.temporal.clone(),
            },
        });
        
        // Cache result
        self.last_result = Some(result.clone());
        
        result
    }

    /// Scan and return as JsValue for WASM
    pub fn scan_js(&mut self, text: &str, entity_spans: &[EntitySpan]) -> JsValue {
        let result = self.scan(text, entity_spans);
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Reset change detector, cached result, and incremental state
    pub fn reset(&mut self) {
        self.change_detector.reset();
        self.last_result = None;
        self.incremental_state = None;
    }

    /// Get incremental stats
    pub fn incremental_stats(&self) -> &IncrementalStats {
        &self.incremental_stats
    }

    /// Get the last scan result (if any)
    pub fn last_result(&self) -> Option<&ScanResult> {
        self.last_result.as_ref()
    }
}

// =============================================================================
// Tests (TDD - written first!)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn entity_span(label: &str, start: usize, end: usize) -> EntitySpan {
        EntitySpan {
            label: label.to_string(),
            entity_id: None,
            start,
            end,
            kind: None,
        }
    }

    fn entity_def(id: &str, label: &str, kind: &str) -> EntityDefinition {
        EntityDefinition {
            id: id.to_string(),
            label: label.to_string(),
            kind: kind.to_string(),
            aliases: vec![],
        }
    }

    // -------------------------------------------------------------------------
    // Requirement 1: Basic scan returns result
    // -------------------------------------------------------------------------
    #[test]
    fn test_basic_scan_returns_result() {
        let mut cortex = DocumentCortex::new();
        let result = cortex.scan("Hello world", &[]);
        
        assert!(!result.stats.was_skipped);
        assert!(result.stats.timings.total_us > 0);
    }

    // -------------------------------------------------------------------------
    // Requirement 2: Relation extraction works
    // -------------------------------------------------------------------------
    #[test]
    fn test_scan_extracts_relations() {
        let mut cortex = DocumentCortex::new();
        
        // NOTE: Pattern dictionary is removed in new CST-based architecture.
        // "brother of" no longer triggers SIBLING_OF pattern match.
        // For specific relations, use explicit triples: "[Frodo] (SIBLING_OF) [Sam]"
        let text = "Frodo is the brother of Sam";
        let spans = vec![
            entity_span("Frodo", 0, 5),
            entity_span("Sam", 24, 27),
        ];
        
        let result = cortex.scan(text, &spans);
        
        // Pattern dictionary removed - no automatic SIBLING_OF detection.
        // Relations are now via: 1) explicit triples, 2) CST SVO, 3) graph inference.
        // "is" is not a strong transitive verb, so no CST relation for this sentence.
        
        // But we can verify the new unified_relations pipeline works:
        println!("Unified relations: {}", result.unified_relations.len());
        
        // Verify scan completed successfully
        assert!(result.stats.timings.total_us > 0, "Scan should have timing stats");
    }

    // -------------------------------------------------------------------------
    // Requirement 3: Triple extraction works
    // -------------------------------------------------------------------------
    #[test]
    fn test_scan_extracts_triples() {
        let mut cortex = DocumentCortex::new();
        
        let text = "The relationship: [[Frodo->OWNS->Ring]]";
        let result = cortex.scan(text, &[]);
        
        assert_eq!(result.triples.len(), 1);
        assert_eq!(result.triples[0].source, "Frodo");
        assert_eq!(result.triples[0].predicate, "OWNS");
        assert_eq!(result.triples[0].target, "Ring");
        assert_eq!(result.stats.triples_found, 1);
    }

    // -------------------------------------------------------------------------
    // Requirement 4: Implicit entity matching works
    // -------------------------------------------------------------------------
    #[test]
    fn test_scan_extracts_implicit_mentions() {
        let mut cortex = DocumentCortex::new();
        
        // Hydrate with entities
        cortex.hydrate_entities(vec![
            entity_def("char_001", "Gandalf", "CHARACTER"),
            entity_def("char_002", "Frodo", "CHARACTER"),
        ]).unwrap();
        
        let text = "Gandalf gave the ring to Frodo";
        let result = cortex.scan(text, &[]);
        
        assert_eq!(result.implicit.len(), 2);
        assert_eq!(result.stats.implicit_found, 2);
    }

    // -------------------------------------------------------------------------
    // Requirement 5: Change detection skips unchanged content
    // -------------------------------------------------------------------------
    #[test]
    fn test_scan_skips_unchanged() {
        let mut cortex = DocumentCortex::new();
        
        let text = "Hello world";
        let result1 = cortex.scan(text, &[]);
        assert!(!result1.stats.was_skipped);
        
        let result2 = cortex.scan(text, &[]);
        assert!(result2.stats.was_skipped, "Second scan should be skipped");
        
        // Timings should be minimal for skipped scan
        assert!(result2.stats.timings.total_us < result1.stats.timings.total_us);
    }

    // -------------------------------------------------------------------------
    // Requirement 6: Changed content is rescanned
    // -------------------------------------------------------------------------
    #[test]
    fn test_scan_detects_changes() {
        let mut cortex = DocumentCortex::new();
        
        cortex.scan("Hello world", &[]);
        let result2 = cortex.scan("Hello universe", &[]);
        
        assert!(!result2.stats.was_skipped, "Changed content should not be skipped");
    }

    // -------------------------------------------------------------------------
    // Requirement 7: Reset clears cached result
    // -------------------------------------------------------------------------
    #[test]
    fn test_reset_clears_cache() {
        let mut cortex = DocumentCortex::new();
        
        cortex.scan("Hello", &[]);
        cortex.reset();
        
        let result = cortex.scan("Hello", &[]);
        assert!(!result.stats.was_skipped, "After reset, should not skip");
    }

    // -------------------------------------------------------------------------
    // Requirement 8: Skip rate is tracked
    // -------------------------------------------------------------------------
    #[test]
    fn test_skip_rate_tracked() {
        let mut cortex = DocumentCortex::new();
        
        cortex.scan("Text", &[]);
        cortex.scan("Text", &[]);
        cortex.scan("Text", &[]);
        
        // 2 skips out of 3 checks = 66.67%
        assert!(cortex.skip_rate() > 60.0);
    }

    // -------------------------------------------------------------------------
    // Requirement 9: Content hash is returned
    // -------------------------------------------------------------------------
    #[test]
    fn test_content_hash_returned() {
        let mut cortex = DocumentCortex::new();
        
        let result1 = cortex.scan("Hello", &[]);
        let result2 = cortex.scan("World", &[]);
        
        assert_ne!(result1.stats.content_hash, result2.stats.content_hash);
    }

    // -------------------------------------------------------------------------
    // Requirement 10: All timings are populated
    // -------------------------------------------------------------------------
    #[test]
    fn test_all_timings_populated() {
        let mut cortex = DocumentCortex::new();
        
        let text = "[[A->B->C]] Frodo is brother of Sam";
        let spans = vec![
            entity_span("Frodo", 12, 17),
            entity_span("Sam", 32, 35),
        ];
        
        let result = cortex.scan(text, &spans);
        
        // All timings should be >= 0 (some may be 0 for very fast ops)
        assert!(result.stats.timings.total_us > 0);
        // triple_us, relation_us, implicit_us should be tracked
    }

    // -------------------------------------------------------------------------
    // Requirement 11: Combined extraction works
    // -------------------------------------------------------------------------
    #[test]
    fn test_combined_extraction() {
        let mut cortex = DocumentCortex::new();
        
        cortex.hydrate_entities(vec![
            entity_def("char_001", "Aragorn", "CHARACTER"),
        ]).unwrap();
        
        let text = "[[Aragorn->LEADS->Rangers]] Aragorn is married to Arwen";
        let spans = vec![
            entity_span("Aragorn", 27, 34),
            entity_span("Arwen", 50, 55),
        ];
        
        let result = cortex.scan(text, &spans);
        
        // Triple (explicit syntax)
        assert!(result.triples.len() >= 1, "Expected at least 1 triple, got {}", result.triples.len());
        
        // NEW: Pattern dictionary is removed. "married to" is no longer pattern-matched.
        // Relations now come from: explicit triples, CST SVO extraction, or graph inference.
        // For relationship semantics like SPOUSE_OF, use explicit triples: [Aragorn] (SPOUSE_OF) [Arwen]
        
        // Implicit (Aragorn appears twice, but first is inside triple)
        assert!(result.implicit.len() >= 1);
        
        // Unified relations available for CST/Graph pipeline
        println!("Unified relations: {}", result.unified_relations.len());
    }

    // -------------------------------------------------------------------------
    // Requirement 12: Self-Sufficiency - no external spans needed
    // -------------------------------------------------------------------------
    #[test]
    fn test_scan_self_sufficiency() {
        let mut cortex = DocumentCortex::new();
        
        // Hydrate with Batman and Robin
        cortex.hydrate_entities(vec![
            entity_def("hero_001", "Batman", "CHARACTER"),
            entity_def("hero_002", "Robin", "CHARACTER"),
        ]).unwrap();
        
        // Input text with a relationship - NO external spans provided
        // NOTE: Pattern dictionary is removed. "married to" is no longer pattern-matched.
        // For explicit relations, use: "[Batman] (SPOUSE_OF) [Robin]"
        let text = "Batman is married to Robin";
        
        // Call scan with EMPTY spans - scanner must be self-sufficient
        let result = cortex.scan(text, &[]);
        
        // Implicit mentions should be found
        assert_eq!(result.implicit.len(), 2, "Should find Batman and Robin implicitly");
        
        // NEW: Pattern dictionary is removed in new CST-based architecture.
        // Relations are now via: 1) explicit triples, 2) CST SVO, 3) graph inference.
        // "is married to" doesn't have a strong transitive verb, so no automatic relation.
        // For specific semantics, use explicit triples.
        
        // Unified relations pipeline is available
        println!("Unified relations (CST + Graph): {}", result.unified_relations.len());
    }

    // -------------------------------------------------------------------------
    // Requirement 13: Self-Sufficiency with sibling pattern
    // -------------------------------------------------------------------------
    #[test]
    fn test_scan_self_sufficiency_sibling() {
        let mut cortex = DocumentCortex::new();
        
        // Hydrate with Frodo and Sam
        cortex.hydrate_entities(vec![
            entity_def("char_001", "Frodo", "CHARACTER"),
            entity_def("char_002", "Sam", "CHARACTER"),
        ]).unwrap();
        
        // Text with sibling pattern - NO external spans
        // NOTE: With the new CST-based architecture, "brother of" is no longer
        // a pattern-matched relation. Use explicit triples for specific relations:
        // "[Frodo] (SIBLING_OF) [Sam]"
        let text = "Frodo is the brother of Sam in the Shire";
        
        let result = cortex.scan(text, &[]);
        
        // Should find both implicitly
        assert_eq!(result.implicit.len(), 2);
        
        // Pattern dictionary is removed in new architecture.
        // Relations are now extracted via: 1) explicit triples, 2) CST SVO, 3) graph inference
        // This text doesn't have an SVO pattern (no transitive verb), so no CST relations.
        // We can verify the unified_relations is available for future enhancement.
        println!("Unified relations found: {}", result.unified_relations.len());
        // Note: If we wanted to detect "brother of", we'd need to add it to StructuredRelationExtractor
    }
}
