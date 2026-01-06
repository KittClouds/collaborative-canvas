//! DocumentScanner - Unified document scanning facade
//!
//! Orchestrates ReflexCortex, SyntaxCortex, TemporalCortex, and RelationCortex
//! to provide a single entry point for document analysis.
//!
//! # Usage (JavaScript)
//! ```javascript
//! import init, { DocumentScanner } from 'kittcore';
//! 
//! await init();
//! const scanner = new DocumentScanner();
//! scanner.hydrateEntities(entitiesJson);
//! scanner.hydrateCalendar(calendarJson);
//! const result = scanner.scan(documentText);
//! ```

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::reflex::{ReflexCortex, EntityMatch};
use super::syntax::{SyntaxCortex, SyntaxMatch};
use super::temporal::{TemporalCortex, TemporalMention};
use super::relation::{RelationCortex, ExtractedRelation, EntitySpan};

// ==================== TYPE DEFINITIONS ====================

/// Configuration for the DocumentScanner
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScannerConfig {
    #[serde(default = "default_true")]
    pub enable_reflex: bool,
    #[serde(default = "default_true")]
    pub enable_syntax: bool,
    #[serde(default = "default_true")]
    pub enable_temporal: bool,
    #[serde(default = "default_true")]
    pub enable_relations: bool,
    #[serde(default = "default_true")]
    pub case_insensitive: bool,
}

fn default_true() -> bool { true }

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            enable_reflex: true,
            enable_syntax: true,
            enable_temporal: true,
            enable_relations: true,
            case_insensitive: true,
        }
    }
}

/// Unified scan result containing all extraction outputs
#[derive(Serialize, Deserialize)]
pub struct ScanResult {
    pub entities: Vec<EntityMatch>,
    pub syntax: Vec<SyntaxMatch>,
    pub temporal: Vec<TemporalMention>,
    pub relations: Vec<ExtractedRelation>,
    pub stats: ScanStats,
}

/// Performance statistics for the scan
#[derive(Serialize, Deserialize)]
pub struct ScanStats {
    pub total_time_ms: f64,
    pub reflex_time_ms: f64,
    pub syntax_time_ms: f64,
    pub temporal_time_ms: f64,
    pub relation_time_ms: f64,
    pub text_length: usize,
    pub entity_count: usize,
    pub syntax_count: usize,
    pub temporal_count: usize,
    pub relation_count: usize,
}

/// Entity data for hydration
#[derive(Serialize, Deserialize, Debug)]
pub struct EntityData {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub aliases: Vec<String>,
}

/// Calendar data for hydration
#[derive(Serialize, Deserialize, Debug)]
pub struct CalendarData {
    #[serde(default)]
    pub months: Vec<String>,
    #[serde(default)]
    pub weekdays: Vec<String>,
    #[serde(default)]
    pub eras: Vec<String>,
}

// ==================== MAIN IMPLEMENTATION ====================

/// DocumentScanner - Unified document analysis engine
///
/// Combines entity detection (Aho-Corasick), syntax pattern matching (Regex),
/// and temporal expression extraction into a single scan operation.
#[wasm_bindgen]
pub struct DocumentScanner {
    reflex: ReflexCortex,
    syntax: SyntaxCortex,
    temporal: TemporalCortex,
    relation: RelationCortex,
    config: ScannerConfig,
    entities_hydrated: bool,
    calendar_hydrated: bool,
    relations_hydrated: bool,
}

#[wasm_bindgen]
impl DocumentScanner {
    /// Create a new DocumentScanner with optional configuration
    ///
    /// # Arguments
    /// * `config` - Optional JSON configuration object
    #[wasm_bindgen(constructor)]
    pub fn new(config: JsValue) -> Result<DocumentScanner, JsValue> {
        let config: ScannerConfig = if config.is_null() || config.is_undefined() {
            ScannerConfig::default()
        } else {
            serde_wasm_bindgen::from_value(config)
                .map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?
        };

        let mut relation = RelationCortex::new();
        relation.build().map_err(|e| JsValue::from_str(&format!("RelationCortex build error: {:?}", e)))?;

        Ok(Self {
            reflex: ReflexCortex::new(config.case_insensitive),
            syntax: SyntaxCortex::new(),
            temporal: TemporalCortex::new(),
            relation,
            config,
            entities_hydrated: false,
            calendar_hydrated: false,
            relations_hydrated: true, // Default patterns are loaded
        })
    }

    /// Hydrate the scanner with entity data for ReflexCortex
    ///
    /// # Arguments
    /// * `entities` - JSON array of EntityData objects
    #[wasm_bindgen(js_name = hydrateEntities)]
    pub fn hydrate_entities(&mut self, entities: JsValue) -> Result<(), JsValue> {
        let entity_list: Vec<EntityData> = serde_wasm_bindgen::from_value(entities)
            .map_err(|e| JsValue::from_str(&format!("Invalid entities: {}", e)))?;

        // Clear and rebuild RefleхCortex
        self.reflex.clear();

        for entity in entity_list {
            let aliases = entity.aliases.join(",");
            self.reflex.add_entity(&entity.id, &entity.label, &aliases);
        }

        self.reflex.build()?;
        self.entities_hydrated = true;

        Ok(())
    }

    /// Hydrate the scanner with custom calendar data for TemporalCortex
    ///
    /// # Arguments
    /// * `calendar` - JSON object with months, weekdays, eras arrays
    #[wasm_bindgen(js_name = hydrateCalendar)]
    pub fn hydrate_calendar(&mut self, calendar: JsValue) -> Result<(), JsValue> {
        let cal_data: CalendarData = serde_wasm_bindgen::from_value(calendar)
            .map_err(|e| JsValue::from_str(&format!("Invalid calendar: {}", e)))?;

        let months = serde_wasm_bindgen::to_value(&cal_data.months)?;
        let weekdays = serde_wasm_bindgen::to_value(&cal_data.weekdays)?;
        let eras = serde_wasm_bindgen::to_value(&cal_data.eras)?;

        self.temporal.hydrate_calendar(months, weekdays, eras)?;
        self.calendar_hydrated = true;

        Ok(())
    }

    /// Perform a full scan of the document
    ///
    /// # Arguments
    /// * `text` - The document text to scan
    #[wasm_bindgen(js_name = scan)]
    pub fn scan(&self, text: &str) -> Result<JsValue, JsValue> {
        let start = js_sys::Date::now();
        let text_length = text.len();

        let mut reflex_time = 0.0;
        let mut syntax_time = 0.0;
        let mut temporal_time = 0.0;
        let mut relation_time = 0.0;

        // 1. Entity matching (ReflexCortex)
        let entities: Vec<EntityMatch> = if self.config.enable_reflex && self.entities_hydrated {
            let t0 = js_sys::Date::now();
            let result = self.reflex.scan(text)?;
            reflex_time = js_sys::Date::now() - t0;
            serde_wasm_bindgen::from_value(result)
                .map_err(|e| JsValue::from_str(&format!("Entity parse error: {}", e)))?
        } else {
            Vec::new()
        };

        // 2. Syntax pattern matching (SyntaxCortex)
        let syntax: Vec<SyntaxMatch> = if self.config.enable_syntax {
            let t0 = js_sys::Date::now();
            let result = self.syntax.scan(text)?;
            syntax_time = js_sys::Date::now() - t0;
            serde_wasm_bindgen::from_value(result)
                .map_err(|e| JsValue::from_str(&format!("Syntax parse error: {}", e)))?
        } else {
            Vec::new()
        };

        // 3. Temporal extraction (TemporalCortex)
        let temporal: Vec<TemporalMention> = if self.config.enable_temporal {
            let t0 = js_sys::Date::now();
            let result = self.temporal.scan(text)?;
            temporal_time = js_sys::Date::now() - t0;
            
            // The result is a TemporalScanResult, extract mentions
            let scan_result: super::temporal::TemporalScanResult = 
                serde_wasm_bindgen::from_value(result)
                    .map_err(|e| JsValue::from_str(&format!("Temporal parse error: {}", e)))?;
            scan_result.mentions
        } else {
            Vec::new()
        };

        // 4. Relation extraction (RelationCortex)
        let relations: Vec<ExtractedRelation> = if self.config.enable_relations && !entities.is_empty() {
            let t0 = js_sys::Date::now();
            
            // Convert EntityMatch to EntitySpan for relation extraction
            let entity_spans: Vec<EntitySpan> = entities.iter().map(|e| EntitySpan {
                label: e.matched_text.clone(),
                entity_id: Some(e.entity_id.clone()),
                start: e.start,
                end: e.end,
                kind: None,
            }).collect();
            
            let relations = self.relation.extract_legacy(text, &entity_spans);
            relation_time = js_sys::Date::now() - t0;
            relations
        } else {
            Vec::new()
        };

        let total_time = js_sys::Date::now() - start;

        let result = ScanResult {
            stats: ScanStats {
                total_time_ms: total_time,
                reflex_time_ms: reflex_time,
                syntax_time_ms: syntax_time,
                temporal_time_ms: temporal_time,
                relation_time_ms: relation_time,
                text_length,
                entity_count: entities.len(),
                syntax_count: syntax.len(),
                temporal_count: temporal.len(),
                relation_count: relations.len(),
            },
            entities,
            syntax,
            temporal,
            relations,
        };

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Scan only for entity mentions (fast path)
    #[wasm_bindgen(js_name = scanReflex)]
    pub fn scan_reflex(&self, text: &str) -> Result<JsValue, JsValue> {
        if !self.entities_hydrated {
            return Ok(serde_wasm_bindgen::to_value(&Vec::<EntityMatch>::new())?);
        }
        self.reflex.scan(text)
    }

    /// Scan only for syntax patterns (fast path)
    #[wasm_bindgen(js_name = scanSyntax)]
    pub fn scan_syntax(&self, text: &str) -> Result<JsValue, JsValue> {
        self.syntax.scan(text)
    }

    /// Scan only for temporal expressions (fast path)
    #[wasm_bindgen(js_name = scanTemporal)]
    pub fn scan_temporal(&self, text: &str) -> Result<JsValue, JsValue> {
        self.temporal.scan(text)
    }

    /// Scan only for relations given entity spans (fast path)
    #[wasm_bindgen(js_name = scanRelations)]
    pub fn scan_relations(&self, text: &str, entity_spans: JsValue) -> Result<JsValue, JsValue> {
        let entities: Vec<EntitySpan> = serde_wasm_bindgen::from_value(entity_spans)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse entities: {}", e)))?;
        let relations = self.relation.extract_legacy(text, &entities);
        serde_wasm_bindgen::to_value(&relations)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {}", e)))
    }

    /// Hydrate the scanner with custom relation patterns from Blueprint Hub
    ///
    /// # Arguments
    /// * `patterns` - JSON array of pattern objects: { relation_type, patterns[], confidence?, bidirectional? }
    #[wasm_bindgen(js_name = hydrateRelationPatterns)]
    pub fn hydrate_relation_patterns(&mut self, patterns: JsValue) -> Result<(), JsValue> {
        self.relation.js_hydrate_patterns(patterns)?;
        self.relations_hydrated = true;
        Ok(())
    }

    /// Quick check if text contains any registered entities
    #[wasm_bindgen(js_name = containsEntities)]
    pub fn contains_entities(&self, text: &str) -> bool {
        if !self.entities_hydrated {
            return false;
        }
        self.reflex.contains_any(text)
    }

    /// Get scanner status
    #[wasm_bindgen(js_name = getStatus)]
    pub fn get_status(&self) -> JsValue {
        let status = serde_json::json!({
            "entities_hydrated": self.entities_hydrated,
            "calendar_hydrated": self.calendar_hydrated,
            "relations_hydrated": self.relations_hydrated,
            "reflex_ready": self.reflex.is_built(),
            "temporal_ready": self.temporal.is_ready(),
            "relation_pattern_count": self.relation.pattern_count(),
            "config": {
                "enable_reflex": self.config.enable_reflex,
                "enable_syntax": self.config.enable_syntax,
                "enable_temporal": self.config.enable_temporal,
                "enable_relations": self.config.enable_relations,
                "case_insensitive": self.config.case_insensitive,
            }
        });
        
        JsValue::from_str(&status.to_string())
    }

    /// Get entity statistics
    #[wasm_bindgen(js_name = getReflexStats)]
    pub fn get_reflex_stats(&self) -> JsValue {
        self.reflex.get_stats()
    }

    /// Get temporal dictionary statistics
    #[wasm_bindgen(js_name = getTemporalStats)]
    pub fn get_temporal_stats(&self) -> JsValue {
        self.temporal.get_stats()
    }

    /// Get relation pattern count
    #[wasm_bindgen(js_name = getRelationPatternCount)]
    pub fn get_relation_pattern_count(&self) -> usize {
        self.relation.pattern_count()
    }
}

// ==================== TESTS ====================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let config = ScannerConfig::default();
        assert!(config.enable_reflex);
        assert!(config.enable_syntax);
        assert!(config.enable_temporal);
        assert!(config.case_insensitive);
    }

    #[test]
    fn test_entity_data_parsing() {
        let json = r#"{"id": "e1", "label": "Frodo", "aliases": ["Mr. Frodo", "Ring-bearer"]}"#;
        let entity: EntityData = serde_json::from_str(json).unwrap();
        
        assert_eq!(entity.id, "e1");
        assert_eq!(entity.label, "Frodo");
        assert_eq!(entity.aliases.len(), 2);
    }

    #[test]
    fn test_calendar_data_parsing() {
        let json = r#"{"months": ["Afteryule", "Solmath"], "weekdays": ["Sterday"], "eras": ["Third Age"]}"#;
        let calendar: CalendarData = serde_json::from_str(json).unwrap();
        
        assert_eq!(calendar.months.len(), 2);
        assert_eq!(calendar.weekdays.len(), 1);
        assert_eq!(calendar.eras.len(), 1);
    }
}
