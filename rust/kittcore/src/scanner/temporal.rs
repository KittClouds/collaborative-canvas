//! TemporalCortex - Temporal pattern detection via Aho-Corasick
//!
//! Detects temporal expressions in O(n) time using CharwiseDoubleArrayAhoCorasick
//! for Unicode-safe matching. Supports custom calendar integration (fantasy months,
//! weekdays, eras) via hydration.
//!
//! # Categories (126+ patterns)
//! - WEEKDAY: monday, tue, wed, etc.
//! - MONTH: january, jan, etc.
//! - TIME_OF_DAY: morning, dusk, midnight, etc.
//! - NARRATIVE_MARKER: chapter, scene, act, etc.
//! - RELATIVE: "later that day", "the next morning", etc.
//! - CONNECTOR: before, after, during, etc.
//! - ERA: "third age", ad, bc, stardate, etc.

use daachorse::{CharwiseDoubleArrayAhoCorasick, CharwiseDoubleArrayAhoCorasickBuilder, MatchKind};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// ==================== TYPE DEFINITIONS ====================

/// Kind of temporal pattern detected
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub enum TemporalKind {
    Weekday,
    Month,
    TimeOfDay,
    NarrativeMarker,
    Relative,
    Connector,
    Era,
    Custom, // User-defined via calendar hydration
}

impl TemporalKind {
    fn as_str(&self) -> &'static str {
        match self {
            TemporalKind::Weekday => "WEEKDAY",
            TemporalKind::Month => "MONTH",
            TemporalKind::TimeOfDay => "TIME_OF_DAY",
            TemporalKind::NarrativeMarker => "NARRATIVE_MARKER",
            TemporalKind::Relative => "RELATIVE",
            TemporalKind::Connector => "CONNECTOR",
            TemporalKind::Era => "ERA",
            TemporalKind::Custom => "CUSTOM",
        }
    }
    
    fn confidence(&self) -> f64 {
        match self {
            TemporalKind::NarrativeMarker => 0.95,
            TemporalKind::Weekday => 0.90,
            TemporalKind::Month => 0.90,
            TemporalKind::Era => 0.90,
            TemporalKind::TimeOfDay => 0.85,
            TemporalKind::Relative => 0.80,
            TemporalKind::Connector => 0.70,
            TemporalKind::Custom => 0.85,
        }
    }
}

/// Direction for temporal connectors
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum TemporalDirection {
    Before,
    After,
    Concurrent,
}

/// Metadata extracted from temporal mentions
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct TemporalMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weekday_index: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub month_index: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub narrative_number: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub era_year: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub era_name: Option<String>,
}

/// A single temporal mention result
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TemporalMention {
    pub kind: String,
    pub text: String,
    pub start: usize,
    pub end: usize,
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<TemporalMetadata>,
}

/// Scan result with statistics
#[derive(Serialize, Deserialize)]
pub struct TemporalScanResult {
    pub mentions: Vec<TemporalMention>,
    pub stats: TemporalScanStats,
}

#[derive(Serialize, Deserialize)]
pub struct TemporalScanStats {
    pub patterns_matched: usize,
    pub scan_time_ms: f64,
}

/// Dictionary statistics
#[derive(Serialize, Deserialize)]
pub struct TemporalDictionaryStats {
    pub total_patterns: usize,
    pub weekdays: usize,
    pub months: usize,
    pub time_of_day: usize,
    pub narrative_markers: usize,
    pub relative_phrases: usize,
    pub connectors: usize,
    pub eras: usize,
    pub custom: usize,
}

// ==================== DICTIONARIES ====================

/// Pattern metadata for the automaton
#[derive(Clone)]
struct PatternMeta {
    kind: TemporalKind,
    weekday_idx: Option<u8>,
    month_idx: Option<u8>,
    direction: Option<String>,
}

// Weekdays (14 entries)
const WEEKDAYS: &[(&str, u8)] = &[
    ("monday", 0), ("mon", 0),
    ("tuesday", 1), ("tue", 1),
    ("wednesday", 2), ("wed", 2),
    ("thursday", 3), ("thu", 3),
    ("friday", 4), ("fri", 4),
    ("saturday", 5), ("sat", 5),
    ("sunday", 6), ("sun", 6),
];

// Months (24 entries)
const MONTHS: &[(&str, u8)] = &[
    ("january", 0), ("jan", 0),
    ("february", 1), ("feb", 1),
    ("march", 2), ("mar", 2),
    ("april", 3), ("apr", 3),
    ("may", 4),
    ("june", 5), ("jun", 5),
    ("july", 6), ("jul", 6),
    ("august", 7), ("aug", 7),
    ("september", 8), ("sep", 8),
    ("october", 9), ("oct", 9),
    ("november", 10), ("nov", 10),
    ("december", 11), ("dec", 11),
];

// Narrative markers
const NARRATIVE_MARKERS: &[&str] = &[
    "chapter", "ch.", "scene", "act", "part", "book",
    "episode", "ep.", "sequence", "prologue", "epilogue", "interlude",
];

// Relative phrases (~50 entries)
const RELATIVE_PHRASES: &[&str] = &[
    // Same-day progressions
    "later that day", "later that night", "later that evening", "later that morning",
    "that morning", "that afternoon", "that evening", "that night",
    "earlier that day", "earlier that morning", "earlier that evening",
    // Next period
    "the next day", "the next morning", "the next evening", "the next night",
    "the next week", "the next month", "the next year",
    "next morning", "next evening", "next night", "next week", "next month", "next year",
    // Following period
    "the following day", "the following morning", "the following evening",
    "the following week", "the following month", "the following year",
    // Previous period
    "the previous day", "the previous morning", "the previous evening",
    "the day before", "the night before", "the week before",
    // Concurrent markers
    "meanwhile", "at the same time", "simultaneously", "in the meantime",
    "at that moment", "at that very moment", "just then",
    // Progression markers
    "moments later", "hours later", "days later", "weeks later", "months later", "years later",
    "a moment later", "an hour later", "a day later", "a week later", "a month later", "a year later",
    "some time later", "shortly after", "shortly before",
    // Vague/abstract temporal
    "long ago", "once upon a time", "in the beginning", "at the end",
    "eventually", "soon", "finally", "at last", "in time",
    "ages ago", "not long after", "before long",
];

// Time of day
const TIME_OF_DAY: &[&str] = &[
    "morning", "afternoon", "evening", "night", "midnight", "noon", "midday",
    "dawn", "dusk", "twilight", "sunrise", "sunset", "nightfall", "daybreak",
    "early morning", "late morning", "early afternoon", "late afternoon",
    "late evening", "late night",
];

// Temporal connectors with direction
const CONNECTORS_BEFORE: &[&str] = &[
    "before", "prior to", "preceding", "just before", "right before",
    "immediately before", "long before",
];

const CONNECTORS_AFTER: &[&str] = &[
    "after", "following", "just after", "right after",
    "immediately after", "long after", "ever since",
];

const CONNECTORS_CONCURRENT: &[&str] = &[
    "during", "while", "throughout", "in the middle of",
];

const CONNECTORS_NEUTRAL: &[&str] = &[
    "when", "until", "since", "at the start of", "at the end of",
    "by the time", "as soon as",
];

// Era markers
const ERA_MARKERS: &[&str] = &[
    "third age", "second age", "first age", "fourth age", "fifth age",
    "year", "stardate", "epoch", "era", "age of", "millennium",
    "ad", "bc", "bce", "ce", "a.d.", "b.c.", "b.c.e.", "c.e.",
];

// ==================== MAIN IMPLEMENTATION ====================

/// TemporalCortex - Temporal expression detector
///
/// Uses CharwiseDoubleArrayAhoCorasick for Unicode-safe O(n) matching.
/// Supports calendar hydration for fantasy temporal terms.
#[wasm_bindgen]
pub struct TemporalCortex {
    automaton: Option<CharwiseDoubleArrayAhoCorasick<usize>>,
    pattern_meta: Vec<PatternMeta>,
    
    // Pending patterns before build
    pending_patterns: Vec<String>,
    pending_meta: Vec<PatternMeta>,
    
    // Custom calendar state
    custom_month_index: HashMap<String, u8>,
    custom_weekday_index: HashMap<String, u8>,
    custom_era_names: Vec<String>,
    
    // Stats
    stats: TemporalDictionaryStats,
    
    // Regex for extracting numbers after patterns
    number_re: Regex,
}

#[wasm_bindgen]
impl TemporalCortex {
    /// Create a new TemporalCortex with the default dictionary
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut cortex = Self {
            automaton: None,
            pattern_meta: Vec::new(),
            pending_patterns: Vec::new(),
            pending_meta: Vec::new(),
            custom_month_index: HashMap::new(),
            custom_weekday_index: HashMap::new(),
            custom_era_names: Vec::new(),
            stats: TemporalDictionaryStats {
                total_patterns: 0,
                weekdays: 0,
                months: 0,
                time_of_day: 0,
                narrative_markers: 0,
                relative_phrases: 0,
                connectors: 0,
                eras: 0,
                custom: 0,
            },
            number_re: Regex::new(r"^(?:\s+(?:of|in))?\s*(\d+(?:\.\d+)?)").unwrap(),
        };
        
        cortex.load_default_dictionary();
        cortex.build_internal();
        
        cortex
    }
    
    /// Load the default temporal dictionary
    fn load_default_dictionary(&mut self) {
        // Weekdays
        for (pattern, idx) in WEEKDAYS {
            self.add_pattern_internal(
                pattern,
                TemporalKind::Weekday,
                Some(*idx),
                None,
                None,
            );
        }
        self.stats.weekdays = WEEKDAYS.len();
        
        // Months
        for (pattern, idx) in MONTHS {
            self.add_pattern_internal(
                pattern,
                TemporalKind::Month,
                None,
                Some(*idx),
                None,
            );
        }
        self.stats.months = MONTHS.len();
        
        // Time of day
        for pattern in TIME_OF_DAY {
            self.add_pattern_internal(pattern, TemporalKind::TimeOfDay, None, None, None);
        }
        self.stats.time_of_day = TIME_OF_DAY.len();
        
        // Narrative markers
        for pattern in NARRATIVE_MARKERS {
            self.add_pattern_internal(pattern, TemporalKind::NarrativeMarker, None, None, None);
        }
        self.stats.narrative_markers = NARRATIVE_MARKERS.len();
        
        // Relative phrases
        for pattern in RELATIVE_PHRASES {
            self.add_pattern_internal(pattern, TemporalKind::Relative, None, None, None);
        }
        self.stats.relative_phrases = RELATIVE_PHRASES.len();
        
        // Connectors
        for pattern in CONNECTORS_BEFORE {
            self.add_pattern_internal(pattern, TemporalKind::Connector, None, None, Some("before".to_string()));
        }
        for pattern in CONNECTORS_AFTER {
            self.add_pattern_internal(pattern, TemporalKind::Connector, None, None, Some("after".to_string()));
        }
        for pattern in CONNECTORS_CONCURRENT {
            self.add_pattern_internal(pattern, TemporalKind::Connector, None, None, Some("concurrent".to_string()));
        }
        for pattern in CONNECTORS_NEUTRAL {
            self.add_pattern_internal(pattern, TemporalKind::Connector, None, None, None);
        }
        self.stats.connectors = CONNECTORS_BEFORE.len() + CONNECTORS_AFTER.len() + 
                                CONNECTORS_CONCURRENT.len() + CONNECTORS_NEUTRAL.len();
        
        // Era markers
        for pattern in ERA_MARKERS {
            self.add_pattern_internal(pattern, TemporalKind::Era, None, None, None);
        }
        self.stats.eras = ERA_MARKERS.len();
        
        self.stats.total_patterns = self.pending_patterns.len();
    }
    
    /// Add a pattern to the pending list
    fn add_pattern_internal(
        &mut self,
        pattern: &str,
        kind: TemporalKind,
        weekday_idx: Option<u8>,
        month_idx: Option<u8>,
        direction: Option<String>,
    ) {
        self.pending_patterns.push(pattern.to_lowercase());
        self.pending_meta.push(PatternMeta {
            kind,
            weekday_idx,
            month_idx,
            direction,
        });
    }
    
    /// Build the automaton internally
    fn build_internal(&mut self) {
        if self.pending_patterns.is_empty() {
            return;
        }
        
        // Use LeftmostLongest for longer phrase matches
        let pma = CharwiseDoubleArrayAhoCorasickBuilder::new()
            .match_kind(MatchKind::LeftmostLongest)
            .build(&self.pending_patterns)
            .expect("Failed to build TemporalCortex automaton");
        
        self.automaton = Some(pma);
        self.pattern_meta = self.pending_meta.clone();
    }
    
    /// Hydrate with custom calendar terms (months, weekdays, eras)
    ///
    /// # Arguments
    /// * `months` - JSON array of month names (ordered)
    /// * `weekdays` - JSON array of weekday names (ordered)
    /// * `eras` - JSON array of era names
    #[wasm_bindgen(js_name = hydrateCalendar)]
    pub fn hydrate_calendar(
        &mut self,
        months: JsValue,
        weekdays: JsValue,
        eras: JsValue,
    ) -> Result<(), JsValue> {
        // Clear existing custom patterns
        self.custom_month_index.clear();
        self.custom_weekday_index.clear();
        self.custom_era_names.clear();
        self.stats.custom = 0;
        
        // Reset and reload default dictionary
        self.pending_patterns.clear();
        self.pending_meta.clear();
        self.automaton = None;
        
        // Parse months
        if !months.is_null() && !months.is_undefined() {
            let month_list: Vec<String> = serde_wasm_bindgen::from_value(months)
                .map_err(|e| JsValue::from_str(&format!("Invalid months: {}", e)))?;
            
            for (idx, month) in month_list.iter().enumerate() {
                if month.len() >= 2 {
                    let lower = month.to_lowercase();
                    self.custom_month_index.insert(lower.clone(), idx as u8);
                    self.add_pattern_internal(&lower, TemporalKind::Custom, None, Some(idx as u8), None);
                    self.stats.custom += 1;
                }
            }
        }
        
        // Parse weekdays
        if !weekdays.is_null() && !weekdays.is_undefined() {
            let weekday_list: Vec<String> = serde_wasm_bindgen::from_value(weekdays)
                .map_err(|e| JsValue::from_str(&format!("Invalid weekdays: {}", e)))?;
            
            for (idx, weekday) in weekday_list.iter().enumerate() {
                if weekday.len() >= 2 {
                    let lower = weekday.to_lowercase();
                    self.custom_weekday_index.insert(lower.clone(), idx as u8);
                    self.add_pattern_internal(&lower, TemporalKind::Custom, Some(idx as u8), None, None);
                    self.stats.custom += 1;
                }
            }
        }
        
        // Parse eras
        if !eras.is_null() && !eras.is_undefined() {
            let era_list: Vec<String> = serde_wasm_bindgen::from_value(eras)
                .map_err(|e| JsValue::from_str(&format!("Invalid eras: {}", e)))?;
            
            for era in era_list {
                if era.len() >= 2 {
                    let lower = era.to_lowercase();
                    self.custom_era_names.push(lower.clone());
                    self.add_pattern_internal(&lower, TemporalKind::Era, None, None, None);
                    self.stats.custom += 1;
                }
            }
        }
        
        // Now add default dictionary (custom patterns take priority due to ordering)
        self.load_default_dictionary();
        self.build_internal();
        
        Ok(())
    }
    
    /// Scan text for temporal mentions
    #[wasm_bindgen(js_name = scan)]
    pub fn scan(&self, text: &str) -> Result<JsValue, JsValue> {
        let start = js_sys::Date::now();
        
        let pma = self.automaton.as_ref()
            .ok_or_else(|| JsValue::from_str("Automaton not built"))?;
        
        let lower_text = text.to_lowercase();
        let mut mentions: Vec<TemporalMention> = Vec::new();
        
        for m in pma.leftmost_find_iter(&lower_text) {
            let meta = &self.pattern_meta[m.value()];
            let matched_text = &text[m.start()..m.end()];
            
            // Extract metadata based on kind
            let metadata = self.extract_metadata(meta, text, m.end());
            
            mentions.push(TemporalMention {
                kind: meta.kind.as_str().to_string(),
                text: matched_text.to_string(),
                start: m.start(),
                end: m.end(),
                confidence: meta.kind.confidence(),
                metadata: if metadata.weekday_index.is_some() 
                    || metadata.month_index.is_some()
                    || metadata.narrative_number.is_some()
                    || metadata.direction.is_some()
                    || metadata.era_year.is_some()
                    || metadata.era_name.is_some() 
                {
                    Some(metadata)
                } else {
                    None
                },
            });
        }
        
        // Deduplicate overlapping (keep longer)
        mentions = self.dedupe_overlapping(mentions);
        
        let result = TemporalScanResult {
            stats: TemporalScanStats {
                patterns_matched: mentions.len(),
                scan_time_ms: js_sys::Date::now() - start,
            },
            mentions,
        };
        
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
    
    /// Extract metadata based on pattern kind
    fn extract_metadata(&self, meta: &PatternMeta, text: &str, end_pos: usize) -> TemporalMetadata {
        let mut metadata = TemporalMetadata::default();
        
        // Weekday index
        if let Some(idx) = meta.weekday_idx {
            metadata.weekday_index = Some(idx);
        }
        
        // Month index
        if let Some(idx) = meta.month_idx {
            metadata.month_index = Some(idx);
        }
        
        // Direction
        if let Some(ref dir) = meta.direction {
            metadata.direction = Some(dir.clone());
        }
        
        // Look for narrative number (e.g., "Chapter 5" -> 5)
        if meta.kind == TemporalKind::NarrativeMarker {
            let after = &text[end_pos..std::cmp::min(end_pos + 15, text.len())];
            if let Some(cap) = self.number_re.captures(after) {
                if let Some(num) = cap.get(1) {
                    if let Ok(n) = num.as_str().parse::<u32>() {
                        metadata.narrative_number = Some(n);
                    }
                }
            }
        }
        
        // Look for era year (e.g., "Third Age 3019" -> 3019)
        if meta.kind == TemporalKind::Era {
            let after = &text[end_pos..std::cmp::min(end_pos + 20, text.len())];
            if let Some(cap) = self.number_re.captures(after) {
                if let Some(num) = cap.get(1) {
                    if let Ok(n) = num.as_str().parse::<f64>() {
                        metadata.era_year = Some(n);
                    }
                }
            }
            // Era name is the matched pattern itself
            let start = end_pos.saturating_sub(30);
            let matched_lower = text[start..end_pos].to_lowercase();
            for era in &self.custom_era_names {
                if matched_lower.ends_with(era) {
                    metadata.era_name = Some(era.clone());
                    break;
                }
            }
            // Also check built-in eras
            for era in ERA_MARKERS {
                if matched_lower.ends_with(era) {
                    metadata.era_name = Some(era.to_string());
                    break;
                }
            }
        }
        
        metadata
    }
    
    /// Deduplicate overlapping mentions, keeping longer matches
    fn dedupe_overlapping(&self, mut mentions: Vec<TemporalMention>) -> Vec<TemporalMention> {
        if mentions.is_empty() {
            return mentions;
        }
        
        // Sort by start, then by length (longer first)
        mentions.sort_by(|a, b| {
            if a.start != b.start {
                a.start.cmp(&b.start)
            } else {
                (b.end - b.start).cmp(&(a.end - a.start))
            }
        });
        
        let mut result = Vec::with_capacity(mentions.len());
        let mut last_end = 0;
        
        for mention in mentions {
            if mention.start >= last_end {
                last_end = mention.end;
                result.push(mention);
            }
        }
        
        result
    }
    
    /// Get dictionary statistics
    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.stats).unwrap_or(JsValue::NULL)
    }
    
    /// Check if cortex is ready
    #[wasm_bindgen(js_name = isReady)]
    pub fn is_ready(&self) -> bool {
        self.automaton.is_some()
    }
}

impl Default for TemporalCortex {
    fn default() -> Self {
        Self::new()
    }
}

// ==================== TESTS ====================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_weekday_detection() {
        let cortex = TemporalCortex::new();
        assert!(cortex.is_ready());
        
        // Manual test of pattern matching
        let pma = cortex.automaton.as_ref().unwrap();
        let text = "on monday we meet";
        let matches: Vec<_> = pma.leftmost_find_iter(text).collect();
        
        assert_eq!(matches.len(), 1);
        assert_eq!(&text[matches[0].start()..matches[0].end()], "monday");
    }

    #[test]
    fn test_relative_phrase() {
        let cortex = TemporalCortex::new();
        let pma = cortex.automaton.as_ref().unwrap();
        let text = "later that day the hero arrived";
        let matches: Vec<_> = pma.leftmost_find_iter(text).collect();
        
        assert!(matches.iter().any(|m| &text[m.start()..m.end()] == "later that day"));
    }

    #[test]
    fn test_narrative_marker() {
        let cortex = TemporalCortex::new();
        let pma = cortex.automaton.as_ref().unwrap();
        let text = "chapter 5 begins here";
        let matches: Vec<_> = pma.leftmost_find_iter(text).collect();
        
        assert!(matches.iter().any(|m| &text[m.start()..m.end()] == "chapter"));
    }

    #[test]
    fn test_era_marker() {
        let cortex = TemporalCortex::new();
        let pma = cortex.automaton.as_ref().unwrap();
        let text = "in the third age 3019";
        let matches: Vec<_> = pma.leftmost_find_iter(text).collect();
        
        assert!(matches.iter().any(|m| &text[m.start()..m.end()] == "third age"));
    }

    #[test]
    fn test_connector_direction() {
        let cortex = TemporalCortex::new();
        
        // Check that "before" is tagged with direction
        let idx = cortex.pending_patterns.iter()
            .position(|p| p == "before")
            .unwrap();
        
        assert_eq!(cortex.pending_meta[idx].direction, Some("before".to_string()));
    }

    #[test]
    fn test_dictionary_stats() {
        let cortex = TemporalCortex::new();
        let stats = &cortex.stats;
        
        assert!(stats.total_patterns >= 100); // Should have 100+ patterns
        assert_eq!(stats.weekdays, 14);
        assert!(stats.months >= 20);
        assert!(stats.relative_phrases >= 40);
    }
}
