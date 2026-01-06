//! WASM API for the Reality Engine
//!
//! Exposes the full RealityEngine to TypeScript via wasm_bindgen.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

use super::parser::SemanticSpan;
use super::syntax::SyntaxKind;
use super::engine::RealityEngine;

// =============================================================================
// Input Types (from TypeScript)
// =============================================================================

/// Input span from TypeScript scanner
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputSpan {
    pub start: usize,
    pub end: usize,
    pub label: Option<String>,
    /// "Entity", "Relation", "Concept" → mapped to SyntaxKind
    pub kind: String,
}

impl SemanticSpan for InputSpan {
    fn start(&self) -> usize { self.start }
    fn end(&self) -> usize { self.end }
    fn syntax_kind(&self) -> SyntaxKind {
        match self.kind.as_str() {
            "Relation" | "RELATION" | "relation" => SyntaxKind::RelationSpan,
            "Concept" | "CONCEPT" | "concept" => SyntaxKind::ConceptSpan,
            _ => SyntaxKind::EntitySpan,
        }
    }
}

// =============================================================================
// Output Types (to TypeScript)
// =============================================================================

/// Full processing result
#[derive(Serialize)]
pub struct ProcessResult {
    pub triples: Vec<ExportedTriple>,
    pub stats: ExportedStats,
}

/// A triple (subject-predicate-object)
#[derive(Serialize)]
pub struct ExportedTriple {
    pub source: String,
    pub relation: String,
    pub target: String,
    pub source_span: Option<(usize, usize)>,
    pub target_span: Option<(usize, usize)>,
}

/// Processing statistics
#[derive(Serialize)]
pub struct ExportedStats {
    pub triples_extracted: usize,
    pub node_count: usize,
    pub edge_count: usize,
    pub synapse_links: usize,
}

/// Graph node info
#[derive(Serialize)]
pub struct ExportedNode {
    pub id: String,
    pub label: String,
    pub kind: String,
}

/// Graph edge info
#[derive(Serialize)]
pub struct ExportedEdge {
    pub source_id: String,
    pub target_id: String,
    pub relation: String,
    pub weight: f64,
}

/// Entity lookup result
#[derive(Serialize)]
pub struct EntityAtResult {
    pub entity_id: String,
    pub node_index: usize,
}

/// Span info for highlighting
#[derive(Serialize)]
pub struct SpanInfo {
    pub start: u32,
    pub end: u32,
}

// =============================================================================
use crate::scanner::relation::{RelationCortex, EntitySpan as RelationEntitySpan, ExtractedRelation};
use super::entity_layer::{EntityLayer, SpanRecord, EntityRecord};
use super::metadata_layer::{MetadataLayer, EntityMetadata};

// =============================================================================
// Extended Output Types (for EntityLayer)
// =============================================================================

/// Exported span record for TypeScript
#[derive(Serialize)]
pub struct ExportedSpanRecord {
    pub doc_id: String,
    pub start: usize,
    pub end: usize,
    pub context: String,
}

/// Exported entity record for TypeScript
#[derive(Serialize)]
pub struct ExportedEntityRecord {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub frequency: usize,
    pub spans: Vec<ExportedSpanRecord>,
}

impl From<&EntityRecord> for ExportedEntityRecord {
    fn from(record: &EntityRecord) -> Self {
        Self {
            id: record.id.clone(),
            label: record.label.clone(),
            kind: record.kind.clone(),
            frequency: record.frequency(),
            spans: record.spans.iter().map(|s| ExportedSpanRecord {
                doc_id: s.doc_id.clone(),
                start: s.start,
                end: s.end,
                context: s.context.clone(),
            }).collect(),
        }
    }
}

/// Exported metadata for TypeScript
#[derive(Serialize)]
pub struct ExportedMetadata {
    pub entity_id: String,
    pub frequency: usize,
    pub first_mention_doc: String,
    pub first_mention_offset: usize,
    pub importance: f64,
    pub documents: Vec<String>,
    pub aliases: Vec<String>,
    pub is_cross_document: bool,
}

impl From<&EntityMetadata> for ExportedMetadata {
    fn from(meta: &EntityMetadata) -> Self {
        Self {
            entity_id: meta.entity_id.clone(),
            frequency: meta.frequency,
            first_mention_doc: meta.first_mention_doc.clone(),
            first_mention_offset: meta.first_mention_offset,
            importance: meta.importance,
            documents: meta.documents.iter().cloned().collect(),
            aliases: meta.aliases.iter().cloned().collect(),
            is_cross_document: meta.is_cross_document(),
        }
    }
}

// RealityCortex WASM Handle
// =============================================================================

/// The main WASM handle for the Reality Engine
/// 
/// This is a stateful object that TypeScript instantiates once and uses
/// for all reality processing.
/// 
/// Includes:
/// - EntityLayer for lossless span storage
/// - MetadataLayer for derived entity properties
#[wasm_bindgen]
pub struct RealityCortex {
    engine: RealityEngine,
    relation_cortex: RelationCortex,
    entity_layer: EntityLayer,
    metadata_layer: MetadataLayer,
    current_doc_id: String,
}

#[wasm_bindgen]
impl RealityCortex {
    /// Create a new RealityCortex instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut relation_cortex = RelationCortex::new();
        // Ensure default patterns are loaded and built
        let _ = relation_cortex.build(); // Ignore error if empty
        
        Self {
            engine: RealityEngine::new(),
            relation_cortex,
            entity_layer: EntityLayer::new(),
            metadata_layer: MetadataLayer::new(),
            current_doc_id: String::new(),
        }
    }
    
    /// Set the current document ID for span tracking
    #[wasm_bindgen(js_name = setDocId)]
    pub fn set_doc_id(&mut self, doc_id: &str) {
        self.current_doc_id = doc_id.to_string();
    }

    /// Add a custom relationship pattern
    #[wasm_bindgen(js_name = addRelationPattern)]
    pub fn add_relation_pattern(
        &mut self,
        relation_type: &str,
        patterns: JsValue,
        confidence: f64,
        bidirectional: bool,
    ) -> Result<(), JsValue> {
        self.relation_cortex.js_add_pattern(relation_type, patterns, confidence, bidirectional)
    }

    /// Hydrate relation patterns from JSON
    #[wasm_bindgen(js_name = hydrateRelationPatterns)]
    pub fn hydrate_relation_patterns(&mut self, patterns: JsValue) -> Result<(), JsValue> {
        self.relation_cortex.js_hydrate_patterns(patterns)
    }
    
    /// Process a document with AUTOMATIC relation detection
    /// 
    /// 1. Takes text and known entity spans (e.g. from Regex/NER).
    /// 2. Runs RelationCortex to find patterns between entities.
    /// 3. Merges detected relations as new spans.
    /// 4. Runs full Reality Engine processing.
    /// Process a document with AUTOMATIC relation detection
    /// 
    /// 1. Stores ALL raw spans in EntityLayer (LOSSLESS)
    /// 2. Runs RelationCortex to find patterns between entities
    /// 3. Merges detected relations as new spans
    /// 4. Runs full Reality Engine processing (CST + Graph)
    #[wasm_bindgen(js_name = processEnhanced)]
    pub fn process_enhanced(&mut self, text: &str, spans_js: JsValue) -> Result<JsValue, JsValue> {
        let mut input_spans: Vec<InputSpan> = serde_wasm_bindgen::from_value(spans_js)?;
        
        let doc_id = if self.current_doc_id.is_empty() {
            "unknown".to_string()
        } else {
            self.current_doc_id.clone()
        };

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 1: Store ALL raw entity spans in EntityLayer (LOSSLESS)
        // ═══════════════════════════════════════════════════════════════════
        for span in input_spans.iter().filter(|s| !is_relation_kind(&s.kind)) {
            self.entity_layer.record_input_span(span, &doc_id, text);
        }

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 2: Extract relations via pattern matching
        // ═══════════════════════════════════════════════════════════════════
        let entity_spans: Vec<RelationEntitySpan> = input_spans.iter()
            .filter(|s| !is_relation_kind(&s.kind))
            .map(|s| RelationEntitySpan {
                label: s.label.clone().unwrap_or_else(|| text[s.start..s.end].to_string()),
                entity_id: None,
                start: s.start,
                end: s.end,
                kind: Some(s.kind.clone()),
            })
            .collect();

        let (relations, _) = self.relation_cortex.extract(text, &entity_spans, &[]);

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 3: Convert relations to spans for CST
        // ═══════════════════════════════════════════════════════════════════
        for rel in &relations {
            if let Some((start, end)) = rel.span {
                input_spans.push(InputSpan {
                    start,
                    end,
                    label: Some(rel.relation_type.clone()),
                    kind: "Relation".to_string(),
                });
            }
        }

        // Sort spans by position
        input_spans.sort_by(|a, b| a.start.cmp(&b.start));

        // ═══════════════════════════════════════════════════════════════════
        // LAYER 4: Build CST + Graph with merged spans
        // ═══════════════════════════════════════════════════════════════════
        let result = self.process(text, serde_wasm_bindgen::to_value(&input_spans)?)?;
        
        // ═══════════════════════════════════════════════════════════════════
        // LAYER 5: Recompute metadata from EntityLayer
        // ═══════════════════════════════════════════════════════════════════
        self.metadata_layer.compute_from_entity_layer(&self.entity_layer);
        
        Ok(result)
    }
    
    /// Process a document with semantic spans
    /// 
    /// # Arguments
    /// * `text` - The document text
    /// * `spans_js` - Array of InputSpan objects from TypeScript
    /// 
    /// # Returns
    /// ProcessResult with triples and stats
    #[wasm_bindgen]
    pub fn process(&mut self, text: &str, spans_js: JsValue) -> Result<JsValue, JsValue> {
        let spans: Vec<InputSpan> = serde_wasm_bindgen::from_value(spans_js)?;
        
        self.engine.process(text, &spans);
        
        // Get triples from the last processing
        let root = self.engine.syntax_root().unwrap();
        let triples = super::projection::project_triples(&root);
        
        let stats = self.engine.stats();
        let triple_count = triples.len();
        
        let result = ProcessResult {
            triples: triples.into_iter().map(|t| ExportedTriple {
                source: t.source,
                relation: t.relation,
                target: t.target,
                source_span: t.source_span,
                target_span: t.target_span,
            }).collect(),
            stats: ExportedStats {
                triples_extracted: triple_count,
                node_count: stats.node_count,
                edge_count: stats.edge_count,
                synapse_links: stats.synapse_links,
            },
        };
        
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
    
    /// Clear all state (graph, synapse, CST)
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.engine.clear();
    }
    
    // -------------------------------------------------------------------------
    // Synapse Queries (for text↔graph linking)
    // -------------------------------------------------------------------------
    
    /// Get entity at a specific byte offset in the text
    /// 
    /// Use this for "click on text → find entity" feature
    #[wasm_bindgen]
    pub fn entity_at(&self, offset: u32) -> Result<JsValue, JsValue> {
        match self.engine.synapse().node_at(offset) {
            Some((entity_id, node_index)) => {
                let result = EntityAtResult {
                    entity_id: entity_id.to_string(),
                    node_index: node_index.index(),
                };
                Ok(serde_wasm_bindgen::to_value(&result)?)
            }
            None => Ok(JsValue::NULL),
        }
    }
    
    /// Get all text spans for an entity
    /// 
    /// Use this for "click on graph node → highlight all text occurrences" feature
    #[wasm_bindgen]
    pub fn spans_of(&self, entity_id: &str) -> Result<JsValue, JsValue> {
        let spans: Vec<SpanInfo> = self.engine.synapse()
            .spans_of(entity_id)
            .iter()
            .map(|r| SpanInfo {
                start: r.start().into(),
                end: r.end().into(),
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&spans)?)
    }
    
    /// Get all entity IDs that have synapse links
    #[wasm_bindgen]
    pub fn linked_entities(&self) -> Result<JsValue, JsValue> {
        let entities: Vec<String> = self.engine.synapse()
            .entity_ids()
            .map(|s| s.to_string())
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&entities)?)
    }
    
    // -------------------------------------------------------------------------
    // Graph Queries
    // -------------------------------------------------------------------------
    
    /// Get all nodes in the graph
    #[wasm_bindgen]
    pub fn get_all_nodes(&self) -> Result<JsValue, JsValue> {
        let nodes: Vec<ExportedNode> = self.engine.graph()
            .nodes()
            .map(|n| ExportedNode {
                id: n.id.clone(),
                label: n.label.clone(),
                kind: n.kind.clone(),
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&nodes)?)
    }
    
    /// Get all edges in the graph
    #[wasm_bindgen]
    pub fn get_all_edges(&self) -> Result<JsValue, JsValue> {
        let edges: Vec<ExportedEdge> = self.engine.graph()
            .edges()
            .map(|(src, tgt, edge)| ExportedEdge {
                source_id: src.id.clone(),
                target_id: tgt.id.clone(),
                relation: edge.relation.clone(),
                weight: edge.weight,
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&edges)?)
    }
    
    /// Get outgoing edges from a node
    #[wasm_bindgen]
    pub fn outgoing_edges(&self, entity_id: &str) -> Result<JsValue, JsValue> {
        let edges: Vec<ExportedEdge> = self.engine.graph()
            .outgoing_edges(entity_id)
            .into_iter()
            .map(|(target, edge)| ExportedEdge {
                source_id: entity_id.to_string(),
                target_id: target.id.clone(),
                relation: edge.relation.clone(),
                weight: edge.weight,
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&edges)?)
    }
    
    /// Get incoming edges to a node
    #[wasm_bindgen]
    pub fn incoming_edges(&self, entity_id: &str) -> Result<JsValue, JsValue> {
        let edges: Vec<ExportedEdge> = self.engine.graph()
            .incoming_edges(entity_id)
            .into_iter()
            .map(|(source, edge)| ExportedEdge {
                source_id: source.id.clone(),
                target_id: entity_id.to_string(),
                relation: edge.relation.clone(),
                weight: edge.weight,
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&edges)?)
    }
    
    /// Get a specific node by ID
    #[wasm_bindgen]
    pub fn get_node(&self, entity_id: &str) -> Result<JsValue, JsValue> {
        match self.engine.graph().get_node(entity_id) {
            Some(node) => {
                let exported = ExportedNode {
                    id: node.id.clone(),
                    label: node.label.clone(),
                    kind: node.kind.clone(),
                };
                Ok(serde_wasm_bindgen::to_value(&exported)?)
            }
            None => Ok(JsValue::NULL),
        }
    }
    
    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------
    
    /// Get current engine statistics
    #[wasm_bindgen]
    pub fn stats(&self) -> Result<JsValue, JsValue> {
        let stats = self.engine.stats();
        let exported = ExportedStats {
            triples_extracted: 0, // Only available after process()
            node_count: stats.node_count,
            edge_count: stats.edge_count,
            synapse_links: stats.synapse_links,
        };
        Ok(serde_wasm_bindgen::to_value(&exported)?)
    }
    
    /// Get node count
    #[wasm_bindgen]
    pub fn node_count(&self) -> usize {
        self.engine.graph().node_count()
    }
    
    /// Get edge count
    #[wasm_bindgen]
    pub fn edge_count(&self) -> usize {
        self.engine.graph().edge_count()
    }
    
    /// Get synapse link count
    #[wasm_bindgen]
    pub fn synapse_link_count(&self) -> usize {
        self.engine.synapse().link_count()
    }
}

impl Default for RealityCortex {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Check if a kind string represents a relation type
fn is_relation_kind(kind: &str) -> bool {
    matches!(kind, "Relation" | "RELATION" | "relation")
}

// =============================================================================
// EntityLayer WASM Exports (Phase 2)
// =============================================================================

#[wasm_bindgen]
impl RealityCortex {
    // -------------------------------------------------------------------------
    // EntityLayer Queries (Lossless Span Storage)
    // -------------------------------------------------------------------------
    
    /// Get all spans for an entity (lossless - includes all mentions)
    #[wasm_bindgen(js_name = getEntitySpans)]
    pub fn get_entity_spans(&self, entity_id: &str) -> Result<JsValue, JsValue> {
        let spans: Vec<ExportedSpanRecord> = self.entity_layer
            .all_spans_for(entity_id)
            .iter()
            .map(|s| ExportedSpanRecord {
                doc_id: s.doc_id.clone(),
                start: s.start,
                end: s.end,
                context: s.context.clone(),
            })
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&spans)?)
    }
    
    /// Get an entity record with all metadata
    #[wasm_bindgen(js_name = getEntityRecord)]
    pub fn get_entity_record(&self, entity_id: &str) -> Result<JsValue, JsValue> {
        match self.entity_layer.get_entity(entity_id) {
            Some(record) => {
                let exported = ExportedEntityRecord::from(record);
                Ok(serde_wasm_bindgen::to_value(&exported)?)
            }
            None => Ok(JsValue::NULL),
        }
    }
    
    /// Get all entity records (for full export)
    #[wasm_bindgen(js_name = getAllEntityRecords)]
    pub fn get_all_entity_records(&self) -> Result<JsValue, JsValue> {
        let records: Vec<ExportedEntityRecord> = self.entity_layer
            .iter()
            .map(|(_, record)| ExportedEntityRecord::from(record))
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&records)?)
    }
    
    /// Get number of unique entities in EntityLayer
    #[wasm_bindgen(js_name = uniqueEntityCount)]
    pub fn unique_entity_count(&self) -> usize {
        self.entity_layer.unique_entities()
    }
    
    /// Get total number of spans stored in EntityLayer
    #[wasm_bindgen(js_name = totalSpanCount)]
    pub fn total_span_count(&self) -> usize {
        self.entity_layer.total_spans()
    }
    
    /// Clear spans for a specific document
    #[wasm_bindgen(js_name = clearDocSpans)]
    pub fn clear_doc_spans(&mut self, doc_id: &str) {
        self.entity_layer.clear_doc(doc_id);
    }
    
    /// Clear all EntityLayer data
    #[wasm_bindgen(js_name = clearEntityLayer)]
    pub fn clear_entity_layer(&mut self) {
        self.entity_layer.clear();
        self.metadata_layer.clear();
    }
}

// =============================================================================
// MetadataLayer WASM Exports (Phase 3)
// =============================================================================

#[wasm_bindgen]
impl RealityCortex {
    // -------------------------------------------------------------------------
    // MetadataLayer Queries (Derived Entity Properties)
    // -------------------------------------------------------------------------
    
    /// Recompute metadata from EntityLayer
    #[wasm_bindgen(js_name = recomputeMetadata)]
    pub fn recompute_metadata(&mut self) {
        self.metadata_layer.compute_from_entity_layer(&self.entity_layer);
    }
    
    /// Get metadata for an entity
    #[wasm_bindgen(js_name = getEntityMetadata)]
    pub fn get_entity_metadata(&self, entity_id: &str) -> Result<JsValue, JsValue> {
        match self.metadata_layer.get(entity_id) {
            Some(meta) => {
                let exported = ExportedMetadata::from(meta);
                Ok(serde_wasm_bindgen::to_value(&exported)?)
            }
            None => Ok(JsValue::NULL),
        }
    }
    
    /// Get all entity metadata
    #[wasm_bindgen(js_name = getAllMetadata)]
    pub fn get_all_metadata(&self) -> Result<JsValue, JsValue> {
        let all: Vec<ExportedMetadata> = self.metadata_layer
            .iter()
            .map(|(_, meta)| ExportedMetadata::from(meta))
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&all)?)
    }
    
    /// Get entities sorted by frequency (descending)
    #[wasm_bindgen(js_name = getEntitiesByFrequency)]
    pub fn get_entities_by_frequency(&self) -> Result<JsValue, JsValue> {
        let sorted: Vec<ExportedMetadata> = self.metadata_layer
            .by_frequency()
            .into_iter()
            .map(ExportedMetadata::from)
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&sorted)?)
    }
    
    /// Get entities sorted by importance (descending)
    #[wasm_bindgen(js_name = getEntitiesByImportance)]
    pub fn get_entities_by_importance(&self) -> Result<JsValue, JsValue> {
        let sorted: Vec<ExportedMetadata> = self.metadata_layer
            .by_importance()
            .into_iter()
            .map(ExportedMetadata::from)
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&sorted)?)
    }
    
    /// Get entities that appear in multiple documents
    #[wasm_bindgen(js_name = getCrossDocumentEntities)]
    pub fn get_cross_document_entities(&self) -> Result<JsValue, JsValue> {
        let cross_doc: Vec<ExportedMetadata> = self.metadata_layer
            .cross_document_entities()
            .into_iter()
            .map(ExportedMetadata::from)
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&cross_doc)?)
    }
    
    /// Get entities from a specific document
    #[wasm_bindgen(js_name = getEntitiesInDoc)]
    pub fn get_entities_in_doc(&self, doc_id: &str) -> Result<JsValue, JsValue> {
        let in_doc: Vec<ExportedMetadata> = self.metadata_layer
            .entities_in_doc(doc_id)
            .into_iter()
            .map(ExportedMetadata::from)
            .collect();
        
        Ok(serde_wasm_bindgen::to_value(&in_doc)?)
    }
    
    /// Add an alias for an entity
    #[wasm_bindgen(js_name = addEntityAlias)]
    pub fn add_entity_alias(&mut self, entity_id: &str, alias: &str) {
        self.metadata_layer.add_alias(entity_id, alias);
    }
    
    /// Clear all metadata
    #[wasm_bindgen(js_name = clearMetadata)]
    pub fn clear_metadata(&mut self) {
        self.metadata_layer.clear();
    }
}
