//! Projections - Generate views and projections from Refs
//!
//! Test-Driven Development: Tests define the contract first.
//!
//! # Functionality (ported from TypeScript)
//! - Build timelines from temporal refs
//! - Build character sheets from entity refs
//! - Build relationship graphs from triple refs
//! - Build link graphs from wikilink refs

use std::collections::{HashMap, HashSet};
use serde::{Serialize, Deserialize};
use wasm_bindgen::prelude::*;

// =============================================================================
// TYPES
// =============================================================================

/// Timeline event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub timestamp: Option<i64>,
    pub expression: String,
    pub entities: Vec<EntityInfo>,
    pub description: String,
    pub source_note_id: String,
    pub position: usize,
    pub is_relative: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityInfo {
    pub kind: String,
    pub label: String,
}

/// Character sheet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterSheet {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub aliases: Vec<String>,
    pub relationships: Vec<CharacterRelationship>,
    pub appearances: Vec<NoteAppearance>,
    pub traits: Vec<String>,
    pub timeline: Vec<TimelineEvent>,
    pub stats: CharacterStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterRelationship {
    pub target_id: String,
    pub target_label: String,
    pub target_kind: String,
    pub predicate: String,
    pub source_note_id: String,
    pub bidirectional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteAppearance {
    pub note_id: String,
    pub mention_count: usize,
    pub contexts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CharacterStats {
    pub total_mentions: usize,
    pub unique_notes: usize,
    pub relationship_count: usize,
    pub first_seen: i64,
    pub last_seen: i64,
}

/// Relationship graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub predicate: String,
}

/// Link graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkGraph {
    pub nodes: Vec<LinkNode>,
    pub edges: Vec<LinkEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkNode {
    pub id: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkEdge {
    pub source: String,
    pub target: String,
}

/// Ref input for projections (simplified)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionRef {
    pub id: String,
    pub kind: String,
    pub target: String,
    pub source_note_id: String,
    pub predicate: Option<String>,
    pub positions: Vec<RefPosition>,
    pub payload: Option<ProjectionPayload>,
    pub attributes: Option<serde_json::Value>,
    pub created_at: i64,
    pub last_seen_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefPosition {
    pub note_id: String,
    pub offset: usize,
    pub length: usize,
    pub context_before: Option<String>,
    pub context_after: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionPayload {
    pub entity_kind: Option<String>,
    pub subject_kind: Option<String>,
    pub subject_label: Option<String>,
    pub subject_id: Option<String>,
    pub object_kind: Option<String>,
    pub object_label: Option<String>,
    pub object_id: Option<String>,
    pub aliases: Option<Vec<String>>,
    pub expression: Option<String>,
    pub parsed_date: Option<String>,
    pub temporal_type: Option<String>,
    pub exists: Option<bool>,
}

// =============================================================================
// TESTS - THE CONTRACT
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entity_ref(id: &str, target: &str, entity_kind: &str) -> ProjectionRef {
        ProjectionRef {
            id: id.to_string(),
            kind: "entity".to_string(),
            target: target.to_string(),
            source_note_id: "note1".to_string(),
            predicate: None,
            positions: vec![RefPosition {
                note_id: "note1".to_string(),
                offset: 0,
                length: target.len(),
                context_before: Some("Before ".to_string()),
                context_after: Some(" After".to_string()),
            }],
            payload: Some(ProjectionPayload {
                entity_kind: Some(entity_kind.to_string()),
                subject_kind: None,
                subject_label: None,
                subject_id: None,
                object_kind: None,
                object_label: None,
                object_id: None,
                aliases: Some(vec![]),
                expression: None,
                parsed_date: None,
                temporal_type: None,
                exists: None,
            }),
            attributes: None,
            created_at: 1000,
            last_seen_at: 2000,
        }
    }

    fn make_triple_ref(subject: &str, predicate: &str, object: &str) -> ProjectionRef {
        ProjectionRef {
            id: "triple1".to_string(),
            kind: "triple".to_string(),
            target: format!("{} {} {}", subject, predicate, object),
            source_note_id: "note1".to_string(),
            predicate: Some(predicate.to_string()),
            positions: vec![RefPosition {
                note_id: "note1".to_string(),
                offset: 0,
                length: 20,
                context_before: None,
                context_after: None,
            }],
            payload: Some(ProjectionPayload {
                entity_kind: None,
                subject_kind: Some("CHARACTER".to_string()),
                subject_label: Some(subject.to_string()),
                subject_id: Some(format!("id_{}", subject.to_lowercase())),
                object_kind: Some("CHARACTER".to_string()),
                object_label: Some(object.to_string()),
                object_id: Some(format!("id_{}", object.to_lowercase())),
                aliases: None,
                expression: None,
                parsed_date: None,
                temporal_type: None,
                exists: None,
            }),
            attributes: None,
            created_at: 1000,
            last_seen_at: 2000,
        }
    }

    fn make_temporal_ref(expression: &str) -> ProjectionRef {
        ProjectionRef {
            id: "temp1".to_string(),
            kind: "temporal".to_string(),
            target: expression.to_string(),
            source_note_id: "note1".to_string(),
            predicate: None,
            positions: vec![RefPosition {
                note_id: "note1".to_string(),
                offset: 50,
                length: expression.len(),
                context_before: None,
                context_after: None,
            }],
            payload: Some(ProjectionPayload {
                entity_kind: None,
                subject_kind: None,
                subject_label: None,
                subject_id: None,
                object_kind: None,
                object_label: None,
                object_id: None,
                aliases: None,
                expression: Some(expression.to_string()),
                parsed_date: Some("2023-01-15T00:00:00Z".to_string()),
                temporal_type: Some("absolute".to_string()),
                exists: None,
            }),
            attributes: None,
            created_at: 1000,
            last_seen_at: 2000,
        }
    }

    fn make_wikilink_ref(target: &str, exists: bool) -> ProjectionRef {
        ProjectionRef {
            id: format!("wiki_{}", target.to_lowercase()),
            kind: "wikilink".to_string(),
            target: target.to_string(),
            source_note_id: "note1".to_string(),
            predicate: None,
            positions: vec![RefPosition {
                note_id: "note1".to_string(),
                offset: 0,
                length: target.len() + 4,
                context_before: None,
                context_after: None,
            }],
            payload: Some(ProjectionPayload {
                entity_kind: None,
                subject_kind: None,
                subject_label: None,
                subject_id: None,
                object_kind: None,
                object_label: None,
                object_id: None,
                aliases: None,
                expression: None,
                parsed_date: None,
                temporal_type: None,
                exists: Some(exists),
            }),
            attributes: None,
            created_at: 1000,
            last_seen_at: 2000,
        }
    }

    // -------------------------------------------------------------------------
    // Timeline Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_build_timeline_from_temporal_refs() {
        let projector = Projector::new();
        
        let refs = vec![
            make_temporal_ref("January 15, 2023"),
            make_entity_ref("ent1", "Jon", "CHARACTER"),
        ];
        
        let timeline = projector.build_timeline(&refs);
        
        assert_eq!(timeline.len(), 1);
        assert_eq!(timeline[0].expression, "January 15, 2023");
    }

    #[test]
    fn test_timeline_sorts_by_timestamp() {
        let projector = Projector::new();
        
        let mut temp1 = make_temporal_ref("First event");
        if let Some(ref mut payload) = temp1.payload {
            payload.parsed_date = Some("2023-01-01T00:00:00Z".to_string());
        }
        
        let mut temp2 = make_temporal_ref("Second event");
        if let Some(ref mut payload) = temp2.payload {
            payload.parsed_date = Some("2022-12-01T00:00:00Z".to_string());
        }
        
        let refs = vec![temp1, temp2];
        let timeline = projector.build_timeline(&refs);
        
        assert_eq!(timeline.len(), 2);
        // Second event (Dec 2022) should come before First event (Jan 2023)
        assert_eq!(timeline[0].expression, "Second event");
    }

    #[test]
    fn test_timeline_finds_nearby_entities() {
        let projector = Projector::new();
        
        // Temporal ref at position 50
        let temp = make_temporal_ref("next day");
        
        // Entity ref at position 0 (within 200 chars of temporal)
        let mut entity = make_entity_ref("ent1", "Jon", "CHARACTER");
        entity.positions[0].offset = 30;
        
        let refs = vec![temp, entity];
        let timeline = projector.build_timeline(&refs);
        
        assert_eq!(timeline.len(), 1);
        assert!(!timeline[0].entities.is_empty());
        assert_eq!(timeline[0].entities[0].label, "Jon");
    }

    // -------------------------------------------------------------------------
    // Relationship Graph Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_build_relationship_graph() {
        let projector = Projector::new();
        
        let refs = vec![
            make_entity_ref("ent1", "Jon", "CHARACTER"),
            make_entity_ref("ent2", "Arya", "CHARACTER"),
            make_triple_ref("Jon", "KNOWS", "Arya"),
        ];
        
        let graph = projector.build_relationship_graph(&refs);
        
        // Should have 2 nodes (Jon and Arya)
        assert_eq!(graph.nodes.len(), 2);
        
        // Should have 1 edge
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.edges[0].predicate, "KNOWS");
    }

    #[test]
    fn test_relationship_graph_creates_nodes_from_triples() {
        let projector = Projector::new();
        
        // Only triples, no entity refs
        let refs = vec![
            make_triple_ref("Jon", "LOVES", "Daenerys"),
        ];
        
        let graph = projector.build_relationship_graph(&refs);
        
        // Should create nodes from triple subjects/objects
        assert_eq!(graph.nodes.len(), 2);
    }

    // -------------------------------------------------------------------------
    // Link Graph Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_build_link_graph() {
        let projector = Projector::new();
        
        let refs = vec![
            make_wikilink_ref("Winterfell", true),
            make_wikilink_ref("Kings Landing", false),
        ];
        
        let graph = projector.build_link_graph(&refs);
        
        // Should have 3 nodes: note1 (source) + 2 targets
        assert_eq!(graph.nodes.len(), 3);
        
        // Should have 2 edges
        assert_eq!(graph.edges.len(), 2);
        
        // Winterfell should exist, Kings Landing should not
        let winterfell = graph.nodes.iter().find(|n| n.id == "winterfell").unwrap();
        assert!(winterfell.exists);
        
        let kings_landing = graph.nodes.iter().find(|n| n.id == "kings landing").unwrap();
        assert!(!kings_landing.exists);
    }

    // -------------------------------------------------------------------------
    // Character Sheet Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_build_character_sheet() {
        let projector = Projector::new();
        
        let character = make_entity_ref("ent1", "Jon", "CHARACTER");
        let refs = vec![
            character.clone(),
            make_entity_ref("ent2", "Arya", "CHARACTER"),
            make_triple_ref("Jon", "KNOWS", "Arya"),
        ];
        
        let sheet = projector.build_character_sheet(&character, &refs);
        
        assert_eq!(sheet.name, "Jon");
        assert_eq!(sheet.kind, "CHARACTER");
        assert_eq!(sheet.relationships.len(), 1);
        assert_eq!(sheet.relationships[0].target_label, "Arya");
        assert_eq!(sheet.relationships[0].predicate, "KNOWS");
    }

    #[test]
    fn test_character_sheet_finds_appearances() {
        let projector = Projector::new();
        
        let mut character = make_entity_ref("ent1", "Jon", "CHARACTER");
        // Add multiple positions
        character.positions.push(RefPosition {
            note_id: "note2".to_string(),
            offset: 100,
            length: 3,
            context_before: Some("In ".to_string()),
            context_after: Some(" we trust".to_string()),
        });
        
        let refs = vec![character.clone()];
        let sheet = projector.build_character_sheet(&character, &refs);
        
        assert_eq!(sheet.stats.unique_notes, 2);
        assert_eq!(sheet.appearances.len(), 2);
    }
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/// Ref projector for building views
#[derive(Debug, Clone, Default)]
pub struct Projector;

impl Projector {
    pub fn new() -> Self {
        Self
    }

    /// Build timeline from refs
    pub fn build_timeline(&self, refs: &[ProjectionRef]) -> Vec<TimelineEvent> {
        let mut events = Vec::new();

        // Filter temporal refs
        let temporal_refs: Vec<_> = refs.iter()
            .filter(|r| r.kind == "temporal")
            .collect();

        for temporal_ref in temporal_refs {
            let payload = temporal_ref.payload.as_ref();
            let position = temporal_ref.positions.first();

            // Find nearby entities
            let nearby = self.find_nearby_entities(
                refs,
                &temporal_ref.source_note_id,
                position.map(|p| p.offset).unwrap_or(0),
                200,
            );

            let timestamp = payload
                .and_then(|p| p.parsed_date.as_ref())
                .and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok())
                .map(|dt| dt.timestamp_millis());

            events.push(TimelineEvent {
                timestamp,
                expression: payload
                    .and_then(|p| p.expression.clone())
                    .unwrap_or_else(|| temporal_ref.target.clone()),
                entities: nearby.into_iter()
                    .map(|r| EntityInfo {
                        kind: r.payload.as_ref()
                            .and_then(|p| p.entity_kind.clone())
                            .unwrap_or_default(),
                        label: r.target.clone(),
                    })
                    .collect(),
                description: temporal_ref.target.clone(),
                source_note_id: temporal_ref.source_note_id.clone(),
                position: position.map(|p| p.offset).unwrap_or(0),
                is_relative: payload
                    .and_then(|p| p.temporal_type.as_ref())
                    .map(|t| t == "relative")
                    .unwrap_or(false),
            });
        }

        // Sort by timestamp
        events.sort_by(|a, b| {
            match (a.timestamp, b.timestamp) {
                (Some(ta), Some(tb)) => ta.cmp(&tb),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => a.position.cmp(&b.position),
            }
        });

        events
    }

    /// Build relationship graph
    pub fn build_relationship_graph(&self, refs: &[ProjectionRef]) -> RelationshipGraph {
        let mut nodes: HashMap<String, GraphNode> = HashMap::new();
        let mut edges = Vec::new();

        // Add entity nodes
        for r in refs.iter().filter(|r| r.kind == "entity") {
            let kind = r.payload.as_ref()
                .and_then(|p| p.entity_kind.clone())
                .unwrap_or_default();
            let key = format!("{}:{}", kind, r.target.to_lowercase());
            
            if !nodes.contains_key(&key) {
                nodes.insert(key.clone(), GraphNode {
                    id: key,
                    label: r.target.clone(),
                    kind,
                });
            }
        }

        // Add edges from triples
        for r in refs.iter().filter(|r| r.kind == "triple") {
            if let Some(payload) = &r.payload {
                let subject_kind = payload.subject_kind.clone().unwrap_or_default();
                let subject_label = payload.subject_label.clone().unwrap_or_default();
                let object_kind = payload.object_kind.clone().unwrap_or_default();
                let object_label = payload.object_label.clone().unwrap_or_default();

                let source_key = format!("{}:{}", subject_kind, subject_label.to_lowercase());
                let target_key = format!("{}:{}", object_kind, object_label.to_lowercase());

                // Ensure nodes exist
                if !nodes.contains_key(&source_key) {
                    nodes.insert(source_key.clone(), GraphNode {
                        id: source_key.clone(),
                        label: subject_label,
                        kind: subject_kind,
                    });
                }
                if !nodes.contains_key(&target_key) {
                    nodes.insert(target_key.clone(), GraphNode {
                        id: target_key.clone(),
                        label: object_label,
                        kind: object_kind,
                    });
                }

                edges.push(GraphEdge {
                    source: source_key,
                    target: target_key,
                    predicate: r.predicate.clone().unwrap_or_default(),
                });
            }
        }

        RelationshipGraph {
            nodes: nodes.into_values().collect(),
            edges,
        }
    }

    /// Build link graph from wikilinks
    pub fn build_link_graph(&self, refs: &[ProjectionRef]) -> LinkGraph {
        let mut nodes: HashMap<String, LinkNode> = HashMap::new();
        let mut edges = Vec::new();

        for r in refs.iter().filter(|r| r.kind == "wikilink") {
            let target = r.target.to_lowercase();
            let exists = r.payload.as_ref()
                .and_then(|p| p.exists)
                .unwrap_or(false);

            if !nodes.contains_key(&target) {
                nodes.insert(target.clone(), LinkNode {
                    id: target.clone(),
                    exists,
                });
            }

            edges.push(LinkEdge {
                source: r.source_note_id.clone(),
                target: target.clone(),
            });

            // Add source note as node
            if !nodes.contains_key(&r.source_note_id) {
                nodes.insert(r.source_note_id.clone(), LinkNode {
                    id: r.source_note_id.clone(),
                    exists: true,
                });
            }
        }

        LinkGraph {
            nodes: nodes.into_values().collect(),
            edges,
        }
    }

    /// Build character sheet
    pub fn build_character_sheet(&self, character_ref: &ProjectionRef, all_refs: &[ProjectionRef]) -> CharacterSheet {
        let payload = character_ref.payload.as_ref();
        let character_label = character_ref.target.to_lowercase();

        // Extract relationships
        let relationships = self.extract_relationships(&character_ref.target, all_refs);

        // Extract appearances
        let aliases = payload
            .and_then(|p| p.aliases.clone())
            .unwrap_or_default();
        let appearances = self.extract_appearances(&character_ref.target, &aliases, all_refs);

        // Extract traits
        let traits = self.extract_traits(character_ref, all_refs);

        // Build timeline
        let timeline = self.build_entity_timeline(&character_ref.target, all_refs);

        // Calculate stats
        let unique_notes: HashSet<_> = character_ref.positions.iter()
            .map(|p| &p.note_id)
            .collect();

        let stats = CharacterStats {
            total_mentions: character_ref.positions.len(),
            unique_notes: unique_notes.len(),
            relationship_count: relationships.len(),
            first_seen: character_ref.created_at,
            last_seen: character_ref.last_seen_at,
        };

        CharacterSheet {
            id: character_ref.id.clone(),
            name: character_ref.target.clone(),
            kind: payload
                .and_then(|p| p.entity_kind.clone())
                .unwrap_or_default(),
            aliases,
            relationships,
            appearances,
            traits,
            timeline,
            stats,
        }
    }

    // ==================== PRIVATE HELPERS ====================

    fn find_nearby_entities<'a>(
        &self,
        refs: &'a [ProjectionRef],
        note_id: &str,
        position: usize,
        radius: usize,
    ) -> Vec<&'a ProjectionRef> {
        refs.iter()
            .filter(|r| r.kind == "entity")
            .filter(|r| {
                r.positions.iter().any(|p| {
                    p.note_id == note_id && 
                    (p.offset as isize - position as isize).unsigned_abs() <= radius
                })
            })
            .collect()
    }

    fn extract_relationships(&self, label: &str, refs: &[ProjectionRef]) -> Vec<CharacterRelationship> {
        let mut relationships = Vec::new();
        let label_lower = label.to_lowercase();

        for r in refs.iter().filter(|r| r.kind == "triple") {
            if let Some(payload) = &r.payload {
                let subject_label = payload.subject_label.as_deref().unwrap_or("").to_lowercase();
                let object_label = payload.object_label.as_deref().unwrap_or("").to_lowercase();

                // Character is subject
                if subject_label == label_lower {
                    relationships.push(CharacterRelationship {
                        target_id: payload.object_id.clone().unwrap_or_default(),
                        target_label: payload.object_label.clone().unwrap_or_default(),
                        target_kind: payload.object_kind.clone().unwrap_or_default(),
                        predicate: r.predicate.clone().unwrap_or_default(),
                        source_note_id: r.source_note_id.clone(),
                        bidirectional: false,
                    });
                }

                // Character is object
                if object_label == label_lower {
                    relationships.push(CharacterRelationship {
                        target_id: payload.subject_id.clone().unwrap_or_default(),
                        target_label: payload.subject_label.clone().unwrap_or_default(),
                        target_kind: payload.subject_kind.clone().unwrap_or_default(),
                        predicate: format!("←{}", r.predicate.as_deref().unwrap_or("")),
                        source_note_id: r.source_note_id.clone(),
                        bidirectional: false,
                    });
                }
            }
        }

        relationships
    }

    fn extract_appearances(&self, label: &str, aliases: &[String], refs: &[ProjectionRef]) -> Vec<NoteAppearance> {
        let mut appearances: HashMap<String, NoteAppearance> = HashMap::new();
        let patterns: Vec<_> = std::iter::once(label.to_lowercase())
            .chain(aliases.iter().map(|a| a.to_lowercase()))
            .collect();

        for r in refs.iter().filter(|r| r.kind == "entity") {
            if !patterns.contains(&r.target.to_lowercase()) {
                continue;
            }

            for pos in &r.positions {
                let note_id = &pos.note_id;
                let entry = appearances.entry(note_id.clone()).or_insert_with(|| NoteAppearance {
                    note_id: note_id.clone(),
                    mention_count: 0,
                    contexts: Vec::new(),
                });

                entry.mention_count += 1;

                if pos.context_before.is_some() || pos.context_after.is_some() {
                    let context = format!(
                        "{}{}{}",
                        pos.context_before.as_deref().unwrap_or(""),
                        r.target,
                        pos.context_after.as_deref().unwrap_or("")
                    );
                    entry.contexts.push(context);
                }
            }
        }

        appearances.into_values().collect()
    }

    fn extract_traits(&self, character_ref: &ProjectionRef, all_refs: &[ProjectionRef]) -> Vec<String> {
        let mut traits = Vec::new();
        let label_lower = character_ref.target.to_lowercase();

        // Look for HAS_TRAIT relationships
        for r in all_refs.iter().filter(|r| r.kind == "triple") {
            if let Some(payload) = &r.payload {
                if payload.subject_label.as_deref().unwrap_or("").to_lowercase() == label_lower
                    && r.predicate.as_deref() == Some("HAS_TRAIT")
                {
                    if let Some(trait_name) = &payload.object_label {
                        traits.push(trait_name.clone());
                    }
                }
            }
        }

        // Deduplicate
        traits.sort();
        traits.dedup();
        traits
    }

    fn build_entity_timeline(&self, label: &str, refs: &[ProjectionRef]) -> Vec<TimelineEvent> {
        let timeline = self.build_timeline(refs);
        let label_lower = label.to_lowercase();

        timeline.into_iter()
            .filter(|e| e.entities.iter().any(|ent| ent.label.to_lowercase() == label_lower))
            .collect()
    }
}

// =============================================================================
// WASM BINDINGS
// =============================================================================

#[wasm_bindgen]
pub struct WasmProjector {
    inner: Projector,
}

#[wasm_bindgen]
impl WasmProjector {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Projector::new(),
        }
    }

    /// Build timeline from refs (JSON array input)
    #[wasm_bindgen(js_name = buildTimeline)]
    pub fn build_timeline(&self, refs_js: JsValue) -> Result<JsValue, JsValue> {
        let refs: Vec<ProjectionRef> = serde_wasm_bindgen::from_value(refs_js)
            .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;
        
        let timeline = self.inner.build_timeline(&refs);
        serde_wasm_bindgen::to_value(&timeline)
            .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
    }

    /// Build relationship graph
    #[wasm_bindgen(js_name = buildRelationshipGraph)]
    pub fn build_relationship_graph(&self, refs_js: JsValue) -> Result<JsValue, JsValue> {
        let refs: Vec<ProjectionRef> = serde_wasm_bindgen::from_value(refs_js)
            .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;
        
        let graph = self.inner.build_relationship_graph(&refs);
        serde_wasm_bindgen::to_value(&graph)
            .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
    }

    /// Build link graph
    #[wasm_bindgen(js_name = buildLinkGraph)]
    pub fn build_link_graph(&self, refs_js: JsValue) -> Result<JsValue, JsValue> {
        let refs: Vec<ProjectionRef> = serde_wasm_bindgen::from_value(refs_js)
            .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;
        
        let graph = self.inner.build_link_graph(&refs);
        serde_wasm_bindgen::to_value(&graph)
            .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
    }

    /// Build character sheet
    #[wasm_bindgen(js_name = buildCharacterSheet)]
    pub fn build_character_sheet(&self, character_js: JsValue, refs_js: JsValue) -> Result<JsValue, JsValue> {
        let character: ProjectionRef = serde_wasm_bindgen::from_value(character_js)
            .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;
        let refs: Vec<ProjectionRef> = serde_wasm_bindgen::from_value(refs_js)
            .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;
        
        let sheet = self.inner.build_character_sheet(&character, &refs);
        serde_wasm_bindgen::to_value(&sheet)
            .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
    }
}

impl Default for WasmProjector {
    fn default() -> Self {
        Self::new()
    }
}
