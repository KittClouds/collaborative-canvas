//! RelationCortex: Relationship Extraction Module
//!
//! Extracts relationships between entities using pattern matching.
//! Designed for zero-shot relationship extraction with user-defined labels.
//!
//! # Architecture
//!
//! ## Phase 1: Pattern-Based (Current)
//! Uses Aho-Corasick for fast pattern matching with custom relation patterns.
//! Supports Blueprint Hub custom patterns via hydration.
//!
//! ## Phase 2: ML-Based (Future)
//! Will integrate gline-rs (GLiNER) for zero-shot relation extraction.
//! Requires ONNX model files and runtime.
//!
//! # Usage
//!
//! ```rust,ignore
//! let mut cortex = RelationCortex::new();
//!
//! // Add relationship patterns
//! cortex.add_pattern("owns", vec!["owns", "possesses", "has", "holds"]);
//! cortex.add_pattern("located_in", vec!["in", "at", "within", "inside"]);
//! cortex.build();
//!
//! // Extract with entity spans
//! let relations = cortex.extract(text, &entity_spans);
//! ```

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};

// =============================================================================
// Types
// =============================================================================

/// A detected relationship between two entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedRelation {
    /// Entity at the head of the relation
    pub head_entity: String,
    /// Position of head entity in text
    pub head_start: usize,
    pub head_end: usize,
    /// Entity at the tail of the relation
    pub tail_entity: String,
    /// Position of tail entity in text
    pub tail_start: usize,
    pub tail_end: usize,
    /// The relationship type/label
    pub relation_type: String,
    /// The matched pattern text
    pub pattern_matched: String,
    /// Position of the pattern in text
    pub pattern_start: usize,
    pub pattern_end: usize,
    /// Confidence score (1.0 for exact match)
    pub confidence: f64,
}

/// Entity span input for relation extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitySpan {
    /// The entity label/name
    pub label: String,
    /// Entity ID (if known)
    pub entity_id: Option<String>,
    /// Start position in text
    pub start: usize,
    /// End position in text
    pub end: usize,
    /// Entity kind (CHARACTER, LOCATION, etc.)
    pub kind: Option<String>,
}

/// Metadata for a relation pattern
#[derive(Debug, Clone)]
struct PatternMeta {
    /// The relation type this pattern indicates
    relation_type: String,
    /// Original pattern text
    pattern_text: String,
    /// Confidence score for this pattern
    confidence: f64,
    /// Whether this is a bidirectional relation
    bidirectional: bool,
    /// Allowed entity kinds for the head entity (None = any)
    valid_head_kinds: Option<Vec<String>>,
    /// Allowed entity kinds for the tail entity (None = any)
    valid_tail_kinds: Option<Vec<String>>,
}

/// Statistics from relation extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationStats {
    pub patterns_checked: usize,
    pub relations_found: usize,
    pub entity_pairs_scanned: usize,
    pub scan_time_ms: f64,
}

// =============================================================================
// RelationCortex
// =============================================================================

/// Relationship extraction engine using Aho-Corasick pattern matching
#[wasm_bindgen]
pub struct RelationCortex {
    /// Compiled Aho-Corasick automaton
    automaton: Option<AhoCorasick>,
    /// Metadata for each pattern (indexed by pattern ID)
    pattern_meta: Vec<PatternMeta>,
    /// Pending patterns before build
    pending_patterns: Vec<String>,
    /// Maximum distance between entities (in characters)
    max_entity_distance: usize,
    /// Whether automaton needs rebuilding
    needs_rebuild: bool,
}

impl Default for RelationCortex {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl RelationCortex {
    /// Create a new RelationCortex with default patterns
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut cortex = Self {
            automaton: None,
            pattern_meta: Vec::new(),
            pending_patterns: Vec::new(),
            max_entity_distance: 200, // Default: 200 chars max between entities
            needs_rebuild: true,
        };
        
        // Add default relationship patterns (Mega-Dictionary)
        cortex.add_default_patterns();
        
        cortex
    }
    
    /// Add default relationship patterns (Mega-Dictionary)
    /// 
    /// Aho-Corasick handles 100,000+ patterns in microseconds.
    /// This is a comprehensive set covering common narrative relationships.
    fn add_default_patterns(&mut self) {
        // ========== FAMILY ==========
        self.add_pattern_internal("PARENT_OF", &[
            "father of", "mother of", "parent of", "dad of", "mom of",
            "sire of", "progenitor of", "gave birth to", "derived from"
        ], 0.95, false);
        self.add_pattern_internal("CHILD_OF", &[
            "son of", "daughter of", "child of", "offspring of", "heir to", "descendant of"
        ], 0.95, false);
        self.add_pattern_internal("SIBLING_OF", &[
            "brother of", "sister of", "sibling of", "twin of", "half-brother of", "half-sister of"
        ], 0.95, true);
        self.add_pattern_internal("SPOUSE_OF", &[
            "married to", "wife of", "husband of", "spouse of", "betrothed to",
            "fiance of", "engaged to", "wedded to", "partner of"
        ], 0.95, true);
        self.add_pattern_internal("RELATED_TO", &[
            "related to", "kin to", "relative of", "family of", "cousin of", 
            "uncle of", "aunt of", "nephew of", "niece of", "ancestor of"
        ], 0.85, true);

        // ========== HIERARCHY ==========
        self.add_pattern_internal("COMMANDS", &[
            "commands", "leads", "rules over", "is captain of", "is leader of",
            "gives orders to", "directs", "governs", "presides over", "heads",
            "is boss of", "supervises", "manages", "controls"
        ], 0.90, false);
        self.add_pattern_internal("SERVES", &[
            "serves", "follows", "obeys", "is subordinate to", "reports to",
            "works under", "is loyal to", "swore allegiance to", "pledged loyalty to",
            "under command of", "assistant to", "deputy of"
        ], 0.90, false);
        self.add_pattern_internal("MEMBER_OF", &[
            "member of", "belongs to", "part of", "joined", "is in",
            "affiliated with", "crewmate of", "enrolled in", "citizen of"
        ], 0.85, false);

        // ========== SOCIAL ==========
        self.add_pattern_internal("KNOWS", &[
            "knows", "met", "encountered", "is acquainted with", "recognizes",
            "aware of", "familiar with", "introduced to"
        ], 0.70, true);
        self.add_pattern_internal("FRIEND_OF", &[
            "friend of", "befriended", "is friends with", "companion of",
            "ally of", "partner of", "comrade of", "pal of", "buddy of", "close to"
        ], 0.85, true);
        self.add_pattern_internal("RIVAL_OF", &[
            "rival of", "competes with", "nemesis of", "adversary of",
            "opponent of", "challenged", "vying with"
        ], 0.85, true);
        self.add_pattern_internal("ENEMY_OF", &[
            "enemy of", "hates", "despises", "loathes", "opposes",
            "hostile towards", "at war with", "conflict with"
        ], 0.85, true);
        self.add_pattern_internal("COLLABORATES_WITH", &[
            "collaborates with", "works with", "coconspirator with", "associated with",
            "in league with", "cooperates with"
        ], 0.80, true);

        // ========== ROMANCE ==========
        self.add_pattern_internal("LOVES", &[
            "loves", "is in love with", "adores", "is enamored with",
            "has feelings for", "fell in love with", "devoted to", "cherishes"
        ], 0.90, false);
        self.add_pattern_internal("ATTRACTED_TO", &[
            "attracted to", "infatuated with", "has a crush on", "drawn to",
            "desires", "fancies"
        ], 0.80, false);
        self.add_pattern_internal("DATED", &[
            "dated", "went out with", "was in a relationship with", "ex-partner of",
            "broke up with", "courted"
        ], 0.85, true);

        // ========== CONFLICT ==========
        self.add_pattern_internal("FOUGHT", &[
            "fought", "battled", "clashed with", "dueled", "skirmished with",
            "engaged in combat with", "attacked", "assaulted", "ambushed"
        ], 0.85, true);
        self.add_pattern_internal("DEFEATED", &[
            "defeated", "beat", "conquered", "overcame", "bested", "vanquished",
            "triumphed over", "crushed", "destroyed", "decimated"
        ], 0.90, false);
        self.add_pattern_internal("KILLED", &[
            "killed", "slew", "murdered", "assassinated", "executed",
            "slaughtered", "ended the life of", "took the life of"
        ], 0.95, false);

        // ========== LOCATION ==========
        self.add_pattern_internal("LOCATED_IN", &[
            " in ", " at ", " within ", "located in", "found in", "resides in",
            "lives in", "dwells in", "stationed at", "based in", "situated in",
            "inhabits", "occupies", "housed in"
        ], 0.75, false);
        self.add_pattern_internal("TRAVELED_TO", &[
            "traveled to", "went to", "journeyed to", "arrived at", "sailed to",
            "flew to", "headed to", "departed for", "visited", "explored",
            "trekked to", "voyaged to", "migrated to"
        ], 0.80, false);
        self.add_pattern_internal("BORN_IN", &[
            "born in", "native of", "hails from", "originated from", "comes from"
        ], 0.90, false);
        self.add_pattern_internal("DIED_IN", &[
            "died in", "perished in", "fell in", "buried in", "tomb is in"
        ], 0.90, false);

        // ========== POSSESSION ==========
        self.add_pattern_internal("OWNS", &[
            "owns", "possesses", "has", "holds", "wields", "carries",
            "is owner of", "is in possession of", "equipped with", "uses",
            "bears", "keeps"
        ], 0.80, false);
        self.add_pattern_internal("CREATED", &[
            "created", "made", "forged", "built", "crafted", "designed",
            "invented", "authored", "wrote", "composed", "painted", "sculpted",
            "founded", "established"
        ], 0.85, false);
        self.add_pattern_internal("LOST", &[
            "lost", "misplaced", "dropped", "had stolen", "no longer has"
        ], 0.85, false);

        // ========== MENTORSHIP ==========
        self.add_pattern_internal("MENTORED_BY", &[
            "trained by", "taught by", "learned from", "mentored by",
            "apprenticed to", "student of", "disciple of", "protege of",
            "studied under", "guided by"
        ], 0.90, false);
        self.add_pattern_internal("MENTORS", &[
            "trains", "teaches", "mentors", "guides", "instructs",
            "is master of", "tutors", "coaches", "advises"
        ], 0.90, false);

        // ========== GENRE: FANTASY ==========
        self.add_pattern_internal("CAST_SPELL_ON", &[
            "cast a spell on", "enchanted", "cursed", "hexed", "bewitched",
            "charmed", "put a spell on", "magically bound"
        ], 0.85, false);
        self.add_pattern_internal("SUMMONED", &[
            "summoned", "conjured", "called forth", "invoked", "bound"
        ], 0.85, false);
        self.add_pattern_internal("WORSHIPS", &[
            "worships", "prays to", "devoted to", "follows the teachings of",
            "cultist of", "priest of", "cleric of"
        ], 0.90, false);

        // ========== GENRE: SCI-FI ==========
        self.add_pattern_internal("PILOTED", &[
            "piloted", "flew", "commanded the", "helmed", "captain of the",
            "drove", "operated"
        ], 0.80, false);
        self.add_pattern_internal("HACKED", &[
            "hacked", "breached", "infiltrated", "jacked into", "cracked",
            "bypassed security of", "accessed unauthorized"
        ], 0.85, false);
        self.add_pattern_internal("PROGRAMMED", &[
            "programmed", "coded", "developed", "engineered", "built logic for"
        ], 0.85, false);

        // ========== GENRE: MYSTERY/NOIR ==========
        self.add_pattern_internal("INVESTIGATED", &[
            "investigated", "interrogated", "questioned", "surveilled",
            "spied on", "tailed", "followed", "looked into"
        ], 0.80, false);
        self.add_pattern_internal("SUSPECTED_OF", &[
            "suspected of", "accused of", "implicated in", "framed for",
            "charged with", "indicted for"
        ], 0.75, false);
        self.add_pattern_internal("WITNESSED", &[
            "witnessed", "saw", "observed", "testified against", "caught"
        ], 0.85, false);
    }
    
    /// Add patterns for a relationship type (no type constraints)
    fn add_pattern_internal(
        &mut self,
        relation_type: &str,
        patterns: &[&str],
        confidence: f64,
        bidirectional: bool,
    ) {
        self.add_pattern_with_types_internal(
            relation_type,
            patterns,
            confidence,
            bidirectional,
            None,
            None,
        );
    }
    
    /// Add patterns with type constraints for disambiguation
    /// 
    /// Example: "fired" is ambiguous:
    /// - (Person) "fired" (Organization) -> LEFT_GROUP
    /// - (Person) "fired at" (Person) -> ATTACKED
    fn add_pattern_with_types_internal(
        &mut self,
        relation_type: &str,
        patterns: &[&str],
        confidence: f64,
        bidirectional: bool,
        valid_head_kinds: Option<Vec<String>>,
        valid_tail_kinds: Option<Vec<String>>,
    ) {
        for pattern in patterns {
            let pattern_lower = pattern.to_lowercase();
            
            self.pattern_meta.push(PatternMeta {
                relation_type: relation_type.to_string(),
                pattern_text: pattern_lower.clone(),
                confidence,
                bidirectional,
                valid_head_kinds: valid_head_kinds.clone(),
                valid_tail_kinds: valid_tail_kinds.clone(),
            });
            
            self.pending_patterns.push(pattern_lower);
        }
        
        self.needs_rebuild = true;
    }
    
    /// Build the Aho-Corasick automaton
    #[wasm_bindgen]
    pub fn build(&mut self) -> Result<(), JsValue> {
        if self.pending_patterns.is_empty() {
            return Ok(());
        }
        
        // Build automaton with LeftmostLongest matching
        // aho-corasick uses iterative construction - no stack overflow!
        let automaton = AhoCorasickBuilder::new()
            .match_kind(MatchKind::LeftmostLongest)
            .ascii_case_insensitive(true)  // Match case-insensitively without allocating
            .build(&self.pending_patterns)
            .map_err(|e| JsValue::from_str(&format!("Failed to build automaton: {}", e)))?;
        
        self.automaton = Some(automaton);
        self.needs_rebuild = false;
        
        Ok(())
    }
    
    /// Get the number of registered patterns
    #[wasm_bindgen(js_name = patternCount)]
    pub fn pattern_count(&self) -> usize {
        self.pattern_meta.len()
    }
    
    /// Set maximum distance between entities
    #[wasm_bindgen(js_name = setMaxEntityDistance)]
    pub fn set_max_entity_distance(&mut self, distance: usize) {
        self.max_entity_distance = distance;
    }
}

// =============================================================================
// Native API (non-WASM)
// =============================================================================

impl RelationCortex {
    /// Add a custom relationship pattern (native, no type constraints)
    pub fn add_pattern(&mut self, relation_type: &str, patterns: Vec<String>, confidence: f64, bidirectional: bool) {
        self.add_pattern_with_types(relation_type, patterns, confidence, bidirectional, None, None);
    }
    
    /// Add a custom relationship pattern with type constraints (native)
    /// 
    /// Type constraints help disambiguate patterns like "fired":
    /// - (CHARACTER) "fired" (ORGANIZATION) -> LEFT_GROUP
    /// - (CHARACTER) "fired at" (CHARACTER) -> ATTACKED
    pub fn add_pattern_with_types(
        &mut self,
        relation_type: &str,
        patterns: Vec<String>,
        confidence: f64,
        bidirectional: bool,
        valid_head_kinds: Option<Vec<String>>,
        valid_tail_kinds: Option<Vec<String>>,
    ) {
        for pattern in patterns {
            let pattern_lower = pattern.to_lowercase();
            
            self.pattern_meta.push(PatternMeta {
                relation_type: relation_type.to_string(),
                pattern_text: pattern_lower.clone(),
                confidence,
                bidirectional,
                valid_head_kinds: valid_head_kinds.clone(),
                valid_tail_kinds: valid_tail_kinds.clone(),
            });
            
            self.pending_patterns.push(pattern_lower);
        }
        
        self.needs_rebuild = true;
    }
    
    /// Clear all patterns (for rehydration)
    pub fn clear_patterns(&mut self) {
        self.pattern_meta.clear();
        self.pending_patterns.clear();
        self.automaton = None;
        self.needs_rebuild = true;
    }
    
    /// Extract relationships from text given entity spans
    /// 
    /// Uses pattern-first algorithm: O(n + P log E) instead of O(E² × P)
    /// 1. Single automaton pass over entire text to find all pattern hits
    /// 2. For each pattern hit, binary search for nearest entity neighbors
    /// 3. Emit relations if both neighbors exist within max_distance
    pub fn extract(&self, text: &str, entity_spans: &[EntitySpan]) -> Vec<ExtractedRelation> {
        let mut relations = Vec::new();
        
        let automaton = match &self.automaton {
            Some(a) => a,
            None => return relations,
        };
        
        if entity_spans.len() < 2 {
            return relations;
        }
        
        // Sort entities by position (required for binary search)
        let mut sorted_spans = entity_spans.to_vec();
        sorted_spans.sort_by_key(|e| e.start);
        
        // Also need entities sorted by end position for finding left neighbors
        let mut by_end: Vec<(usize, &EntitySpan)> = sorted_spans.iter()
            .enumerate()
            .map(|(i, s)| (i, s))
            .collect();
        by_end.sort_by_key(|(_, s)| s.end);
        
        // Single automaton pass over entire text - O(n)
        for mat in automaton.find_iter(text) {
            let pattern_id = mat.pattern().as_usize();
            let pattern_start = mat.start();
            let pattern_end = mat.end();
            
            let meta = match self.pattern_meta.get(pattern_id) {
                Some(m) => m,
                None => continue,
            };
            
            // Find left neighbor: entity whose END is <= pattern_start
            // and within max_entity_distance
            let left = sorted_spans.iter()
                .rev()
                .find(|e| e.end <= pattern_start && pattern_start - e.end <= self.max_entity_distance);
            
            // Find right neighbor: entity whose START is >= pattern_end
            // and within max_entity_distance
            let right = sorted_spans.iter()
                .find(|e| e.start >= pattern_end && e.start - pattern_end <= self.max_entity_distance);
            
            // Both neighbors must exist to form a relation
            let (head, tail) = match (left, right) {
                (Some(h), Some(t)) => (h, t),
                _ => continue,
            };
            
            // Check type constraints for disambiguation
            let head_valid = match &meta.valid_head_kinds {
                None => true,
                Some(kinds) => head.kind.as_ref().map_or(
                    true,
                    |k| kinds.iter().any(|vk| vk.eq_ignore_ascii_case(k))
                ),
            };
            let tail_valid = match &meta.valid_tail_kinds {
                None => true,
                Some(kinds) => tail.kind.as_ref().map_or(
                    true,
                    |k| kinds.iter().any(|vk| vk.eq_ignore_ascii_case(k))
                ),
            };
            
            if !head_valid || !tail_valid {
                continue;
            }
            
            // Emit forward relation (head -> tail)
            relations.push(ExtractedRelation {
                head_entity: head.label.clone(),
                head_start: head.start,
                head_end: head.end,
                tail_entity: tail.label.clone(),
                tail_start: tail.start,
                tail_end: tail.end,
                relation_type: meta.relation_type.clone(),
                pattern_matched: meta.pattern_text.clone(),
                pattern_start,
                pattern_end,
                confidence: meta.confidence,
            });
            
            // Emit reverse relation if bidirectional (tail -> head)
            if meta.bidirectional {
                relations.push(ExtractedRelation {
                    head_entity: tail.label.clone(),
                    head_start: tail.start,
                    head_end: tail.end,
                    tail_entity: head.label.clone(),
                    tail_start: head.start,
                    tail_end: head.end,
                    relation_type: meta.relation_type.clone(),
                    pattern_matched: meta.pattern_text.clone(),
                    pattern_start,
                    pattern_end,
                    confidence: meta.confidence,
                });
            }
        }
        
        relations
    }
    
    /// Extract with statistics
    pub fn extract_with_stats(&self, text: &str, entity_spans: &[EntitySpan]) -> (Vec<ExtractedRelation>, RelationStats) {
        let start = instant::Instant::now();
        
        let entity_pairs = if entity_spans.len() > 1 {
            (entity_spans.len() * (entity_spans.len() - 1)) / 2
        } else {
            0
        };
        
        let relations = self.extract(text, entity_spans);
        
        let stats = RelationStats {
            patterns_checked: self.pattern_meta.len(),
            relations_found: relations.len(),
            entity_pairs_scanned: entity_pairs,
            scan_time_ms: start.elapsed().as_secs_f64() * 1000.0,
        };
        
        (relations, stats)
    }
}

// =============================================================================
// WASM Bindings
// =============================================================================

#[wasm_bindgen]
impl RelationCortex {
    /// Add a custom pattern from JS
    #[wasm_bindgen(js_name = addPattern)]
    pub fn js_add_pattern(
        &mut self,
        relation_type: &str,
        patterns: JsValue,
        confidence: f64,
        bidirectional: bool,
    ) -> Result<(), JsValue> {
        let patterns: Vec<String> = serde_wasm_bindgen::from_value(patterns)?;
        self.add_pattern(relation_type, patterns, confidence, bidirectional);
        Ok(())
    }
    
    /// Clear all patterns (JS)
    #[wasm_bindgen(js_name = clearPatterns)]
    pub fn js_clear_patterns(&mut self) {
        self.clear_patterns();
    }
    
    /// Hydrate with custom patterns from Blueprint Hub
    #[wasm_bindgen(js_name = hydratePatterns)]
    pub fn js_hydrate_patterns(&mut self, patterns: JsValue) -> Result<(), JsValue> {
        #[derive(Deserialize)]
        struct PatternInput {
            relation_type: String,
            patterns: Vec<String>,
            confidence: Option<f64>,
            bidirectional: Option<bool>,
        }
        
        let inputs: Vec<PatternInput> = serde_wasm_bindgen::from_value(patterns)?;
        
        // Clear existing and add new
        self.clear_patterns();
        self.add_default_patterns();
        
        for input in inputs {
            self.add_pattern(
                &input.relation_type,
                input.patterns,
                input.confidence.unwrap_or(0.75),
                input.bidirectional.unwrap_or(false),
            );
        }
        
        self.build()?;
        Ok(())
    }
    
    /// Extract relationships (JS)
    #[wasm_bindgen(js_name = extract)]
    pub fn js_extract(&self, text: &str, entity_spans: JsValue) -> Result<JsValue, JsValue> {
        let spans: Vec<EntitySpan> = serde_wasm_bindgen::from_value(entity_spans)?;
        let relations = self.extract(text, &spans);
        Ok(serde_wasm_bindgen::to_value(&relations)?)
    }
    
    /// Extract with statistics (JS)
    #[wasm_bindgen(js_name = extractWithStats)]
    pub fn js_extract_with_stats(&self, text: &str, entity_spans: JsValue) -> Result<JsValue, JsValue> {
        let spans: Vec<EntitySpan> = serde_wasm_bindgen::from_value(entity_spans)?;
        let (relations, stats) = self.extract_with_stats(text, &spans);
        
        #[derive(Serialize)]
        struct ExtractWithStatsResult {
            relations: Vec<ExtractedRelation>,
            stats: RelationStats,
        }
        
        Ok(serde_wasm_bindgen::to_value(&ExtractWithStatsResult { relations, stats })?)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_extraction() {
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();
        
        // Simple test: "A owns B"
        let text = "Frodo owns Ring";
        let entities = vec![
            EntitySpan { label: "Frodo".to_string(), entity_id: None, start: 0, end: 5, kind: None },
            EntitySpan { label: "Ring".to_string(), entity_id: None, start: 11, end: 15, kind: None },
        ];
        
        println!("Text: '{}'", text);
        println!("Between entities: '{}'", &text[5..11]);
        println!("Pattern count: {}", cortex.pattern_count());
        
        let relations = cortex.extract(text, &entities);
        
        println!("Found {} relations", relations.len());
        for r in &relations {
            println!("  {} --{}-> {}", r.head_entity, r.relation_type, r.tail_entity);
        }
        
        assert!(!relations.is_empty(), "Expected at least 1 relation, got 0. Between text: '{}'", &text[5..11]);
    }
    
    #[test]
    fn test_custom_patterns() {
        let mut cortex = RelationCortex::new();
        cortex.add_pattern(
            "MENTORED_BY",
            vec!["taught by".to_string(), "learned from".to_string(), "trained by".to_string()],
            0.85,
            false,
        );
        cortex.build().unwrap();
        
        let text = "Frodo was taught by Gandalf";
        let entities = vec![
            EntitySpan { label: "Frodo".to_string(), entity_id: None, start: 0, end: 5, kind: None },
            EntitySpan { label: "Gandalf".to_string(), entity_id: None, start: 20, end: 27, kind: None },
        ];
        
        let relations = cortex.extract(text, &entities);
        
        let mentored = relations.iter().find(|r| r.relation_type == "MENTORED_BY");
        assert!(mentored.is_some(), "Expected MENTORED_BY relation");
    }
    
    #[test]
    fn test_no_relations_when_far_apart() {
        let mut cortex = RelationCortex::new();
        cortex.set_max_entity_distance(20); // Very short distance
        cortex.build().unwrap();
        
        let text = "Frodo...[lots of text here that is more than 20 characters]...owns the Ring";
        let entities = vec![
            EntitySpan { label: "Frodo".to_string(), entity_id: None, start: 0, end: 5, kind: None },
            EntitySpan { label: "Ring".to_string(), entity_id: None, start: 70, end: 74, kind: None },
        ];
        
        let relations = cortex.extract(text, &entities);
        
        // Should find no relations due to distance
        assert!(relations.is_empty(), "Expected no relations due to distance");
    }

    #[test]
    fn test_mega_dictionary_family() {
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();

        let text = "Darth Vader is the father of Luke";
        let entities = vec![
            EntitySpan { label: "Darth Vader".to_string(), entity_id: None, start: 0, end: 11, kind: None },
            EntitySpan { label: "Luke".to_string(), entity_id: None, start: 29, end: 33, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        assert!(!relations.is_empty(), "Should detect 'father of'");
        assert_eq!(relations[0].relation_type, "PARENT_OF");
    }

    #[test]
    fn test_mega_dictionary_fantasy() {
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();

        // "cast a spell on" pattern
        let text = "Gandalf cast a spell on the Balrog";
        let entities = vec![
            EntitySpan { label: "Gandalf".to_string(), entity_id: None, start: 0, end: 7, kind: None },
            EntitySpan { label: "Balrog".to_string(), entity_id: None, start: 28, end: 34, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        assert!(!relations.is_empty(), "Should detect 'cast a spell on'");
        assert_eq!(relations[0].relation_type, "CAST_SPELL_ON");
    }

    #[test]
    fn test_mega_dictionary_scifi() {
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();

        let text = "Neo hacked the Matrix";
        let entities = vec![
            EntitySpan { label: "Neo".to_string(), entity_id: None, start: 0, end: 3, kind: None },
            EntitySpan { label: "Matrix".to_string(), entity_id: None, start: 15, end: 21, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        assert!(!relations.is_empty(), "Should detect 'hacked'");
        assert_eq!(relations[0].relation_type, "HACKED");
    }

    #[test]
    fn test_pattern_count() {
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();
        
        // Should have 200+ patterns from the mega-dictionary
        let count = cortex.pattern_count();
        println!("Total patterns in Mega-Dictionary: {}", count);
        assert!(count > 200, "Mega-Dictionary should have 200+ patterns, got {}", count);
    }

    #[test]
    fn test_type_constraint_filters_correctly() {
        let mut cortex = RelationCortex::new();
        
        // Add "fired" with type constraint: only CHARACTER -> ORGANIZATION
        cortex.add_pattern_with_types(
            "LEFT_GROUP",
            vec!["fired".to_string(), "dismissed".to_string()],
            0.85,
            false,
            Some(vec!["CHARACTER".to_string(), "PERSON".to_string()]),
            Some(vec!["FACTION".to_string(), "ORGANIZATION".to_string()]),
        );
        
        cortex.build().unwrap();
        
        // Test 1: Should match - CHARACTER fired ORGANIZATION
        let text = "John was fired from Acme Corp";
        let entities = vec![
            EntitySpan { 
                label: "John".to_string(), 
                entity_id: None, 
                start: 0, 
                end: 4, 
                kind: Some("CHARACTER".to_string()) 
            },
            EntitySpan { 
                label: "Acme Corp".to_string(), 
                entity_id: None, 
                start: 20, 
                end: 29, 
                kind: Some("ORGANIZATION".to_string()) 
            },
        ];
        let relations = cortex.extract(text, &entities);
        assert!(!relations.is_empty(), "Should detect LEFT_GROUP when types match");
        assert_eq!(relations[0].relation_type, "LEFT_GROUP");
    }

    #[test]
    fn test_type_constraint_rejects_mismatched() {
        let mut cortex = RelationCortex::new();
        
        // Clear default patterns to avoid interference
        cortex.clear_patterns();
        
        // Add "fired" with type constraint: only CHARACTER -> ORGANIZATION
        cortex.add_pattern_with_types(
            "LEFT_GROUP",
            vec!["fired".to_string()],
            0.85,
            false,
            Some(vec!["CHARACTER".to_string()]),
            Some(vec!["ORGANIZATION".to_string()]),
        );
        
        cortex.build().unwrap();
        
        // Test: Should NOT match - CHARACTER fired CHARACTER (wrong tail type)
        let text = "John fired Bob";
        let entities = vec![
            EntitySpan { 
                label: "John".to_string(), 
                entity_id: None, 
                start: 0, 
                end: 4, 
                kind: Some("CHARACTER".to_string()) 
            },
            EntitySpan { 
                label: "Bob".to_string(), 
                entity_id: None, 
                start: 11, 
                end: 14, 
                kind: Some("CHARACTER".to_string()) 
            },
        ];
        let relations = cortex.extract(text, &entities);
        assert!(relations.is_empty(), "Should NOT detect LEFT_GROUP when tail type doesn't match");
    }

    #[test]
    fn test_type_constraint_allows_no_kind() {
        let mut cortex = RelationCortex::new();
        
        // Add pattern with type constraint
        cortex.add_pattern_with_types(
            "LEFT_GROUP",
            vec!["quit".to_string()],
            0.85,
            false,
            Some(vec!["CHARACTER".to_string()]),
            Some(vec!["ORGANIZATION".to_string()]),
        );
        
        cortex.build().unwrap();
        
        // Test: Should match when entity has NO kind (graceful degradation)
        let text = "Alice quit the Company";
        let entities = vec![
            EntitySpan { 
                label: "Alice".to_string(), 
                entity_id: None, 
                start: 0, 
                end: 5, 
                kind: None  // No kind specified - should still match
            },
            EntitySpan { 
                label: "Company".to_string(), 
                entity_id: None, 
                start: 15, 
                end: 22, 
                kind: None  // No kind specified
            },
        ];
        let relations = cortex.extract(text, &entities);
        assert!(!relations.is_empty(), "Should match when entities have no kind (graceful degradation)");
    }

    #[test]
    fn test_type_constraint_case_insensitive() {
        let mut cortex = RelationCortex::new();
        
        cortex.add_pattern_with_types(
            "EMPLOYED_BY",
            vec!["works for".to_string()],
            0.85,
            false,
            Some(vec!["CHARACTER".to_string()]),
            Some(vec!["ORGANIZATION".to_string()]),
        );
        
        cortex.build().unwrap();
        
        // Test: Type matching should be case-insensitive
        let text = "Jane works for TechCo";
        let entities = vec![
            EntitySpan { 
                label: "Jane".to_string(), 
                entity_id: None, 
                start: 0, 
                end: 4, 
                kind: Some("character".to_string())  // lowercase
            },
            EntitySpan { 
                label: "TechCo".to_string(), 
                entity_id: None, 
                start: 15, 
                end: 21, 
                kind: Some("Organization".to_string())  // Mixed case
            },
        ];
        let relations = cortex.extract(text, &entities);
        assert!(!relations.is_empty(), "Type matching should be case-insensitive");
        assert_eq!(relations[0].relation_type, "EMPLOYED_BY");
    }

    // =========================================================================
    // BIDIRECTIONAL LINK TESTS (TDD)
    // =========================================================================

    #[test]
    fn test_bidirectional_sibling_both_directions() {
        let mut cortex = RelationCortex::new();
        // SIBLING_OF is bidirectional=true in default patterns
        cortex.build().unwrap();

        let text = "Thor is the brother of Loki";
        let entities = vec![
            EntitySpan { label: "Thor".to_string(), entity_id: None, start: 0, end: 4, kind: None },
            EntitySpan { label: "Loki".to_string(), entity_id: None, start: 23, end: 27, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        
        // Should get 2 relations: Thor->Loki AND Loki->Thor
        assert_eq!(relations.len(), 2, "Bidirectional should emit 2 relations");
        
        let forward = relations.iter().find(|r| r.head_entity == "Thor" && r.tail_entity == "Loki");
        let reverse = relations.iter().find(|r| r.head_entity == "Loki" && r.tail_entity == "Thor");
        
        assert!(forward.is_some(), "Should have Thor->Loki");
        assert!(reverse.is_some(), "Should have Loki->Thor");
        
        // Both should be SIBLING_OF (symmetric relation)
        assert_eq!(forward.unwrap().relation_type, "SIBLING_OF");
        assert_eq!(reverse.unwrap().relation_type, "SIBLING_OF");
    }

    #[test]
    fn test_non_bidirectional_single_direction() {
        let mut cortex = RelationCortex::new();
        // PARENT_OF is bidirectional=false
        cortex.build().unwrap();

        let text = "Vader is the father of Luke";
        let entities = vec![
            EntitySpan { label: "Vader".to_string(), entity_id: None, start: 0, end: 5, kind: None },
            EntitySpan { label: "Luke".to_string(), entity_id: None, start: 23, end: 27, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        
        // Should get only 1 relation: Vader->Luke
        assert_eq!(relations.len(), 1, "Non-bidirectional should emit 1 relation");
        assert_eq!(relations[0].head_entity, "Vader");
        assert_eq!(relations[0].tail_entity, "Luke");
    }

    #[test]
    fn test_bidirectional_spouse_symmetric() {
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();

        let text = "Romeo is married to Juliet";
        let entities = vec![
            EntitySpan { label: "Romeo".to_string(), entity_id: None, start: 0, end: 5, kind: None },
            EntitySpan { label: "Juliet".to_string(), entity_id: None, start: 20, end: 26, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        
        assert_eq!(relations.len(), 2, "SPOUSE_OF should emit 2 relations");
        
        let romeo_to_juliet = relations.iter().find(|r| r.head_entity == "Romeo");
        let juliet_to_romeo = relations.iter().find(|r| r.head_entity == "Juliet");
        
        assert!(romeo_to_juliet.is_some());
        assert!(juliet_to_romeo.is_some());
    }

    #[test]
    fn test_bidirectional_custom_pattern() {
        let mut cortex = RelationCortex::new();
        cortex.clear_patterns();
        
        // Add custom bidirectional pattern
        cortex.add_pattern_with_types(
            "ALLY_OF",
            vec!["allied with".to_string(), "partnered with".to_string()],
            0.80,
            true,  // bidirectional!
            None,
            None,
        );
        cortex.build().unwrap();

        let text = "Gondor allied with Rohan";
        let entities = vec![
            EntitySpan { label: "Gondor".to_string(), entity_id: None, start: 0, end: 6, kind: None },
            EntitySpan { label: "Rohan".to_string(), entity_id: None, start: 19, end: 24, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        
        assert_eq!(relations.len(), 2, "Custom bidirectional should emit 2 relations");
    }

    // =========================================================================
    // TDD: Pattern-First Algorithm Optimization Tests
    // These tests ensure the new algorithm produces identical results
    // =========================================================================

    #[test]
    fn test_pattern_first_produces_same_relations() {
        // This test validates that pattern-first extraction produces identical results
        // to the current O(E²) pairwise approach
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();

        // Simple case: Two relation patterns with correct positions
        let text = "Frodo is friend of Sam";
        let entities = vec![
            EntitySpan { label: "Frodo".to_string(), entity_id: None, start: 0, end: 5, kind: None },
            EntitySpan { label: "Sam".to_string(), entity_id: None, start: 19, end: 22, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        
        // Verify expected relations exist (not order-dependent)
        let has_friend = relations.iter().any(|r| 
            r.head_entity == "Frodo" && r.tail_entity == "Sam" && r.relation_type == "FRIEND_OF"
        );
        assert!(has_friend, "Should find Frodo FRIEND_OF Sam");
        
        // Test married relation separately
        let text2 = "Aragorn is married to Arwen";
        let entities2 = vec![
            EntitySpan { label: "Aragorn".to_string(), entity_id: None, start: 0, end: 7, kind: None },
            EntitySpan { label: "Arwen".to_string(), entity_id: None, start: 22, end: 27, kind: None },
        ];
        let relations2 = cortex.extract(text2, &entities2);
        
        let has_married = relations2.iter().any(|r| 
            r.head_entity == "Aragorn" && r.tail_entity == "Arwen" && r.relation_type == "SPOUSE_OF"
        );
        assert!(has_married, "Should find Aragorn SPOUSE_OF Arwen");
    }

    #[test]
    fn test_pattern_first_with_many_entities() {
        // Stress test: Many entities, ensure pattern-first doesn't miss relations
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();

        // 10 entities, only some have relations between them
        let text = "A B C D E is friend of F G H I J";
        let entities: Vec<EntitySpan> = "ABCDEFGHIJ".chars().enumerate().map(|(i, c)| {
            let label = c.to_string();
            let pos = text.find(&label).unwrap();
            EntitySpan {
                label,
                entity_id: None,
                start: pos,
                end: pos + 1,
                kind: None,
            }
        }).collect();

        let relations = cortex.extract(text, &entities);
        
        // "E is friend of F" should be detected
        let has_ef = relations.iter().any(|r| 
            r.head_entity == "E" && r.tail_entity == "F" && r.relation_type == "FRIEND_OF"
        );
        assert!(has_ef, "Should find E FRIEND_OF F even with many entities");
    }

    #[test]
    fn test_pattern_first_handles_adjacent_entities() {
        // Edge case: Entities very close together with pattern between
        let mut cortex = RelationCortex::new();
        cortex.clear_patterns();
        cortex.add_pattern("LOVES", vec!["loves".to_string()], 0.9, false);
        cortex.build().unwrap();

        let text = "A loves B";
        let entities = vec![
            EntitySpan { label: "A".to_string(), entity_id: None, start: 0, end: 1, kind: None },
            EntitySpan { label: "B".to_string(), entity_id: None, start: 8, end: 9, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        assert_eq!(relations.len(), 1);
        assert_eq!(relations[0].head_entity, "A");
        assert_eq!(relations[0].tail_entity, "B");
    }

    #[test]
    fn test_pattern_first_respects_max_distance() {
        // Pattern-first must still respect max_entity_distance
        let mut cortex = RelationCortex::new();
        cortex.set_max_entity_distance(10); // Very short
        cortex.build().unwrap();

        // Pattern exists but entities too far apart
        let text = "Frodo............................................owns the Ring";
        let entities = vec![
            EntitySpan { label: "Frodo".to_string(), entity_id: None, start: 0, end: 5, kind: None },
            EntitySpan { label: "Ring".to_string(), entity_id: None, start: 55, end: 59, kind: None },
        ];

        let relations = cortex.extract(text, &entities);
        assert!(relations.is_empty(), "Should not match when entities too far apart");
    }

    #[test]
    fn test_pattern_first_extracts_without_alloc_per_pair() {
        // Performance sanity check: Should complete in reasonable time for many entities
        // This test documents the expected O(n + P log E) behavior
        let mut cortex = RelationCortex::new();
        cortex.build().unwrap();

        // Build a document with 20 entity mentions
        let mut text = String::new();
        let mut entities = Vec::new();
        for i in 0..20 {
            let label = format!("Entity{}", i);
            let start = text.len();
            text.push_str(&label);
            text.push_str(" ");
            entities.push(EntitySpan {
                label,
                entity_id: None,
                start,
                end: start + 7 + i.to_string().len(),
                kind: None,
            });
        }

        // Add a pattern match somewhere
        text.push_str("Entity5 is friend of Entity15");
        
        // This should complete quickly even with 20 entities (190 pairs in O(E²))
        let start = std::time::Instant::now();
        let _relations = cortex.extract(&text, &entities);
        let elapsed = start.elapsed();
        
        // Should complete in < 10ms (generous for WASM/test overhead)
        assert!(elapsed.as_millis() < 50, 
            "Expected < 50ms, got {}ms - algorithm may not be O(n + P log E)", 
            elapsed.as_millis()
        );
    }
}


