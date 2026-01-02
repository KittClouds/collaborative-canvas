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
#[derive(Debug, Clone, Deserialize)]
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
// RealityCortex WASM Handle
// =============================================================================

/// The main WASM handle for the Reality Engine
/// 
/// This is a stateful object that TypeScript instantiates once and uses
/// for all reality processing.
#[wasm_bindgen]
pub struct RealityCortex {
    engine: RealityEngine,
}

#[wasm_bindgen]
impl RealityCortex {
    /// Create a new RealityCortex instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            engine: RealityEngine::new(),
        }
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
