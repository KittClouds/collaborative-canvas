//! Unified Reality Engine
//!
//! This module combines all reality components into a single cohesive engine:
//! - CST (Rowan) for syntax tree operations
//! - Graph (petgraph) for semantic relationships  
//! - Synapse for text↔graph bridging
//! - Interner for string deduplication

use rowan::GreenNode;

use super::syntax::{RealityLanguage, SyntaxKind};
use super::parser::{zip_reality, SemanticSpan};
use super::projection::{project_triples, Triple};
use super::graph::{ConceptGraph, ConceptNode, ConceptEdge};
use super::synapse::SynapseBridge;

/// Type alias for Rowan syntax node with our language
pub type SyntaxNode = rowan::SyntaxNode<RealityLanguage>;

// =============================================================================
// RealityEngine
// =============================================================================

/// The unified reality engine
/// 
/// Holds: CST (Rowan) + Graph (petgraph) + Synapse (bridge)
/// 
/// This is the main entry point for processing documents and querying
/// the semantic graph.
#[derive(Default)]
pub struct RealityEngine {
    /// Current document's CST root (GreenNode is immutable, cheap to clone)
    green: Option<GreenNode>,
    
    /// The semantic graph (concepts and relationships)
    graph: ConceptGraph,
    
    /// Text ↔ Graph bridge
    synapse: SynapseBridge,
    
    /// Statistics for the last process operation
    last_stats: Option<ProcessStats>,
}

/// Statistics from processing a document
#[derive(Debug, Clone, Default)]
pub struct ProcessStats {
    pub triples_extracted: usize,
    pub nodes_created: usize,
    pub edges_created: usize,
    pub synapse_links: usize,
}

impl RealityEngine {
    /// Create a new empty engine
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Process a document with semantic spans
    /// 
    /// This is the main entry point. It:
    /// 1. Builds the CST from text + spans
    /// 2. Extracts triples from the CST
    /// 3. Updates the graph with new concepts/relationships
    /// 4. Populates the synapse bridge for text↔graph linking
    /// 
    /// Returns the number of triples extracted.
    pub fn process<S: SemanticSpan>(&mut self, text: &str, spans: &[S]) -> usize {
        // Clear previous state
        self.synapse.clear();
        
        // 1. Build CST
        self.green = Some(zip_reality(text, spans));
        
        // 2. Extract triples
        let root = self.syntax_root().expect("Just built the tree");
        let triples = project_triples(&root);
        
        // 3. Update graph and synapse
        let mut stats = ProcessStats::default();
        stats.triples_extracted = triples.len();
        
        for triple in &triples {
            self.ingest_triple(triple, &mut stats);
        }
        
        // Also link entities that aren't in triples
        self.link_standalone_entities(&root, &mut stats);
        
        self.last_stats = Some(stats.clone());
        
        stats.triples_extracted
    }
    
    /// Clear all state (graph, synapse, CST)
    pub fn clear(&mut self) {
        self.green = None;
        self.graph.clear();
        self.synapse.clear();
        self.last_stats = None;
    }
    
    /// Get the syntax tree root (if processed)
    pub fn syntax_root(&self) -> Option<SyntaxNode> {
        self.green.as_ref().map(|g| SyntaxNode::new_root(g.clone()))
    }
    
    /// Get a reference to the graph
    pub fn graph(&self) -> &ConceptGraph {
        &self.graph
    }
    
    /// Get a mutable reference to the graph
    pub fn graph_mut(&mut self) -> &mut ConceptGraph {
        &mut self.graph
    }
    
    /// Get a reference to the synapse bridge
    pub fn synapse(&self) -> &SynapseBridge {
        &self.synapse
    }
    
    /// Get stats from the last process operation
    pub fn last_stats(&self) -> Option<&ProcessStats> {
        self.last_stats.as_ref()
    }
    
    /// Get engine stats (current state)
    pub fn stats(&self) -> EngineStats {
        EngineStats {
            has_cst: self.green.is_some(),
            node_count: self.graph.node_count(),
            edge_count: self.graph.edge_count(),
            synapse_links: self.synapse.link_count(),
        }
    }
    
    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    
    /// Ingest a triple into the graph and synapse
    fn ingest_triple(&mut self, triple: &Triple, stats: &mut ProcessStats) {
        // Create or get source node
        let source_id = self.make_entity_id(&triple.source);
        let source_node = ConceptNode::new(&source_id, &triple.source, "Entity");
        let source_idx = self.graph.ensure_node(source_node);
        if self.graph.node_count() > stats.nodes_created {
            stats.nodes_created = self.graph.node_count();
        }
        
        // Create or get target node
        let target_id = self.make_entity_id(&triple.target);
        let target_node = ConceptNode::new(&target_id, &triple.target, "Entity");
        let target_idx = self.graph.ensure_node(target_node);
        stats.nodes_created = self.graph.node_count();
        
        // Create edge
        let edge = ConceptEdge::unweighted(&triple.relation);
        if self.graph.add_edge(&source_id, &target_id, edge).is_some() {
            stats.edges_created += 1;
        }
        
        // Link source span to graph
        if let Some((start, end)) = triple.source_span {
            self.synapse.link_offsets(
                start as u32,
                end as u32,
                source_id.clone(),
                source_idx,
            );
            stats.synapse_links += 1;
        }
        
        // Link target span to graph
        if let Some((start, end)) = triple.target_span {
            self.synapse.link_offsets(
                start as u32,
                end as u32,
                target_id,
                target_idx,
            );
            stats.synapse_links += 1;
        }
    }
    
    /// Link standalone entities (those not in triples) to the synapse
    fn link_standalone_entities(&mut self, root: &SyntaxNode, stats: &mut ProcessStats) {
        for node in root.descendants() {
            if node.kind() == SyntaxKind::EntitySpan {
                let text = node.text().to_string();
                let range = node.text_range();
                
                let entity_id = self.make_entity_id(&text);
                
                // Ensure node exists in graph
                let concept = ConceptNode::new(&entity_id, &text, "Entity");
                let idx = self.graph.ensure_node(concept);
                stats.nodes_created = self.graph.node_count();
                
                // Link if not already linked
                if !self.synapse.contains_range(range) {
                    self.synapse.link(range, entity_id, idx);
                    stats.synapse_links += 1;
                }
            }
        }
    }
    
    /// Generate a stable entity ID from a label
    fn make_entity_id(&self, label: &str) -> String {
        // Simple normalization: lowercase, trim, replace spaces with underscores
        label.trim().to_lowercase().replace(' ', "_")
    }
}

/// Current engine state statistics
#[derive(Debug, Clone)]
pub struct EngineStats {
    pub has_cst: bool,
    pub node_count: usize,
    pub edge_count: usize,
    pub synapse_links: usize,
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone)]
    enum TestSpan {
        Entity { start: usize, end: usize, label: String },
        Relation { start: usize, end: usize },
    }
    
    impl SemanticSpan for TestSpan {
        fn start(&self) -> usize {
            match self {
                TestSpan::Entity { start, .. } => *start,
                TestSpan::Relation { start, .. } => *start,
            }
        }
        fn end(&self) -> usize {
            match self {
                TestSpan::Entity { end, .. } => *end,
                TestSpan::Relation { end, .. } => *end,
            }
        }
        fn syntax_kind(&self) -> SyntaxKind {
            match self {
                TestSpan::Entity { .. } => SyntaxKind::EntitySpan,
                TestSpan::Relation { .. } => SyntaxKind::RelationSpan,
            }
        }
    }
    
    fn entity(start: usize, end: usize, label: &str) -> TestSpan {
        TestSpan::Entity { start, end, label: label.to_string() }
    }
    
    fn relation(start: usize, end: usize) -> TestSpan {
        TestSpan::Relation { start, end }
    }
    
    // -------------------------------------------------------------------------
    // Basic Processing Tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_engine_process_simple() {
        let mut engine = RealityEngine::new();
        
        // "Frodo owns Sting."
        //  ^^^^^      ^^^^^
        //  0..5       11..16
        let text = "Frodo owns Sting.";
        let spans = vec![
            entity(0, 5, "Frodo"),
            relation(6, 10),
            entity(11, 16, "Sting"),
        ];
        
        let triple_count = engine.process(text, &spans);
        
        assert_eq!(triple_count, 1, "Should extract 1 triple");
        
        let stats = engine.stats();
        assert!(stats.has_cst, "Should have CST");
        assert_eq!(stats.node_count, 2, "Should have 2 nodes (Frodo, Sting)");
        assert_eq!(stats.edge_count, 1, "Should have 1 edge (owns)");
    }
    
    #[test]
    fn test_engine_process_chain() {
        let mut engine = RealityEngine::new();
        
        // "A owns B. B owns C."
        let text = "A owns B. B owns C.";
        let spans = vec![
            entity(0, 1, "A"),
            relation(2, 6),
            entity(7, 8, "B"),
            entity(10, 11, "B"),
            relation(12, 16),
            entity(17, 18, "C"),
        ];
        
        let triple_count = engine.process(text, &spans);
        
        assert_eq!(triple_count, 2, "Should extract 2 triples");
        
        let stats = engine.stats();
        assert_eq!(stats.node_count, 3, "Should have 3 nodes (A, B, C)");
        assert_eq!(stats.edge_count, 2, "Should have 2 edges");
    }
    
    #[test]
    fn test_engine_synapse_populated() {
        let mut engine = RealityEngine::new();
        
        let text = "Frodo owns Sting.";
        let spans = vec![
            entity(0, 5, "Frodo"),
            relation(6, 10),
            entity(11, 16, "Sting"),
        ];
        
        engine.process(text, &spans);
        
        // Check synapse has links
        assert!(engine.synapse().link_count() >= 2, "Should have at least 2 synapse links");
        
        // Check we can look up by offset
        let result = engine.synapse().node_at(2); // Inside "Frodo"
        assert!(result.is_some(), "Should find entity at offset 2");
        assert_eq!(result.unwrap().0, "frodo");
        
        let result = engine.synapse().node_at(13); // Inside "Sting"
        assert!(result.is_some(), "Should find entity at offset 13");
        assert_eq!(result.unwrap().0, "sting");
    }
    
    #[test]
    fn test_engine_stats() {
        let mut engine = RealityEngine::new();
        
        // Before processing
        let stats = engine.stats();
        assert!(!stats.has_cst);
        assert_eq!(stats.node_count, 0);
        
        // Process
        let text = "Hello World.";
        let spans: Vec<TestSpan> = vec![];
        engine.process(text, &spans);
        
        // After processing (no entities, but has CST)
        let stats = engine.stats();
        assert!(stats.has_cst);
    }
    
    #[test]
    fn test_engine_reprocess() {
        let mut engine = RealityEngine::new();
        
        // First document
        let text1 = "A owns B.";
        let spans1 = vec![
            entity(0, 1, "A"),
            relation(2, 6),
            entity(7, 8, "B"),
        ];
        engine.process(text1, &spans1);
        
        assert_eq!(engine.graph().node_count(), 2);
        
        // Second document (graph state persists, synapse clears)
        let text2 = "C owns D.";
        let spans2 = vec![
            entity(0, 1, "C"),
            relation(2, 6),
            entity(7, 8, "D"),
        ];
        engine.process(text2, &spans2);
        
        // Graph should now have 4 nodes (A, B, C, D)
        assert_eq!(engine.graph().node_count(), 4);
        
        // Synapse should only have links for the current document
        let synapse = engine.synapse();
        assert!(synapse.node_at(0).is_some()); // "C" in current doc
        assert!(synapse.spans_of("a").is_empty()); // "A" from old doc has no spans
    }
    
    #[test]
    fn test_engine_clear() {
        let mut engine = RealityEngine::new();
        
        let text = "A owns B.";
        let spans = vec![
            entity(0, 1, "A"),
            relation(2, 6),
            entity(7, 8, "B"),
        ];
        engine.process(text, &spans);
        
        assert!(engine.stats().has_cst);
        assert!(engine.graph().node_count() > 0);
        
        engine.clear();
        
        assert!(!engine.stats().has_cst);
        assert_eq!(engine.graph().node_count(), 0);
        assert!(engine.synapse().is_empty());
    }
    
    // -------------------------------------------------------------------------
    // Graph Query Tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_engine_graph_queries() {
        let mut engine = RealityEngine::new();
        
        let text = "Frodo owns Sting.";
        let spans = vec![
            entity(0, 5, "Frodo"),
            relation(6, 10),
            entity(11, 16, "Sting"),
        ];
        engine.process(text, &spans);
        
        // Query outgoing edges from Frodo
        let outgoing = engine.graph().outgoing_edges("frodo");
        assert_eq!(outgoing.len(), 1);
        assert_eq!(outgoing[0].0.id, "sting");
        assert_eq!(outgoing[0].1.relation, "owns");
        
        // Query incoming edges to Sting
        let incoming = engine.graph().incoming_edges("sting");
        assert_eq!(incoming.len(), 1);
        assert_eq!(incoming[0].0.id, "frodo");
    }
}
