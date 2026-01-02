//! In-memory semantic graph engine using petgraph
//!
//! This module provides a pure Rust graph structure for representing
//! semantic relationships between concepts. No serialization, no WASM —
//! just fast in-memory graph operations.

use petgraph::graph::{DiGraph, NodeIndex, EdgeIndex};
use petgraph::visit::EdgeRef;
use petgraph::Direction;
use std::collections::HashMap;

// =============================================================================
// Types
// =============================================================================

/// A concept node in the semantic graph
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ConceptNode {
    /// Stable identifier (e.g., entity ID from scanner)
    pub id: String,
    /// Display name
    pub label: String,
    /// Type/category: "Person", "Place", "Concept", "Item", etc.
    pub kind: String,
}

impl ConceptNode {
    pub fn new(id: impl Into<String>, label: impl Into<String>, kind: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            kind: kind.into(),
        }
    }
}

/// An edge/relationship between concepts
#[derive(Debug, Clone)]
pub struct ConceptEdge {
    /// Relation type: "owns", "created", "located_in", etc.
    pub relation: String,
    /// Confidence or strength (0.0 to 1.0)
    pub weight: f64,
}

impl ConceptEdge {
    pub fn new(relation: impl Into<String>, weight: f64) -> Self {
        Self {
            relation: relation.into(),
            weight,
        }
    }
    
    /// Create an edge with default weight (1.0)
    pub fn unweighted(relation: impl Into<String>) -> Self {
        Self::new(relation, 1.0)
    }
}

// =============================================================================
// ConceptGraph
// =============================================================================

/// The semantic graph — pure in-memory, no serialization
/// 
/// Uses a directed graph (DiGraph) where:
/// - Nodes are ConceptNode (entities/concepts)
/// - Edges are ConceptEdge (relationships with direction)
pub struct ConceptGraph {
    /// The underlying petgraph structure
    graph: DiGraph<ConceptNode, ConceptEdge>,
    /// Fast lookup: node ID → petgraph NodeIndex
    id_to_index: HashMap<String, NodeIndex>,
}

impl Default for ConceptGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl ConceptGraph {
    /// Create a new empty graph
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            id_to_index: HashMap::new(),
        }
    }
    
    /// Add a node or get existing node's index
    /// 
    /// If a node with the same ID exists, returns its index.
    /// Otherwise, adds the node and returns the new index.
    pub fn ensure_node(&mut self, node: ConceptNode) -> NodeIndex {
        if let Some(&idx) = self.id_to_index.get(&node.id) {
            return idx;
        }
        
        let id = node.id.clone();
        let idx = self.graph.add_node(node);
        self.id_to_index.insert(id, idx);
        idx
    }
    
    /// Add an edge between two nodes (by ID)
    /// 
    /// Returns the EdgeIndex if both nodes exist, None otherwise.
    pub fn add_edge(&mut self, source_id: &str, target_id: &str, edge: ConceptEdge) -> Option<EdgeIndex> {
        let source_idx = self.id_to_index.get(source_id)?;
        let target_idx = self.id_to_index.get(target_id)?;
        
        Some(self.graph.add_edge(*source_idx, *target_idx, edge))
    }
    
    /// Add an edge, creating nodes if they don't exist
    /// 
    /// This is a convenience method that ensures both nodes exist before adding the edge.
    pub fn add_edge_with_nodes(
        &mut self,
        source: ConceptNode,
        target: ConceptNode,
        edge: ConceptEdge,
    ) -> EdgeIndex {
        let source_idx = self.ensure_node(source);
        let target_idx = self.ensure_node(target);
        self.graph.add_edge(source_idx, target_idx, edge)
    }
    
    /// Find a node by ID
    pub fn get_node(&self, id: &str) -> Option<&ConceptNode> {
        let idx = self.id_to_index.get(id)?;
        self.graph.node_weight(*idx)
    }
    
    /// Get the NodeIndex for a given ID
    pub fn get_index(&self, id: &str) -> Option<NodeIndex> {
        self.id_to_index.get(id).copied()
    }
    
    /// Get all outgoing edges from a node
    /// 
    /// Returns Vec of (target_node, edge)
    pub fn outgoing_edges(&self, id: &str) -> Vec<(&ConceptNode, &ConceptEdge)> {
        let Some(&idx) = self.id_to_index.get(id) else {
            return vec![];
        };
        
        self.graph
            .edges_directed(idx, Direction::Outgoing)
            .filter_map(|edge_ref| {
                let target_node = self.graph.node_weight(edge_ref.target())?;
                Some((target_node, edge_ref.weight()))
            })
            .collect()
    }
    
    /// Get all incoming edges to a node
    /// 
    /// Returns Vec of (source_node, edge)
    pub fn incoming_edges(&self, id: &str) -> Vec<(&ConceptNode, &ConceptEdge)> {
        let Some(&idx) = self.id_to_index.get(id) else {
            return vec![];
        };
        
        self.graph
            .edges_directed(idx, Direction::Incoming)
            .filter_map(|edge_ref| {
                let source_node = self.graph.node_weight(edge_ref.source())?;
                Some((source_node, edge_ref.weight()))
            })
            .collect()
    }
    
    /// Get all neighbors of a node (both directions)
    pub fn neighbors(&self, id: &str) -> Vec<&ConceptNode> {
        let Some(&idx) = self.id_to_index.get(id) else {
            return vec![];
        };
        
        self.graph
            .neighbors_undirected(idx)
            .filter_map(|neighbor_idx| self.graph.node_weight(neighbor_idx))
            .collect()
    }
    
    /// Count of nodes in the graph
    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }
    
    /// Count of edges in the graph
    pub fn edge_count(&self) -> usize {
        self.graph.edge_count()
    }
    
    /// Check if the graph is empty
    pub fn is_empty(&self) -> bool {
        self.graph.node_count() == 0
    }
    
    /// Clear all nodes and edges
    pub fn clear(&mut self) {
        self.graph.clear();
        self.id_to_index.clear();
    }
    
    /// Iterate over all nodes
    pub fn nodes(&self) -> impl Iterator<Item = &ConceptNode> {
        self.graph.node_weights()
    }
    
    /// Iterate over all edges with their source and target
    pub fn edges(&self) -> impl Iterator<Item = (&ConceptNode, &ConceptNode, &ConceptEdge)> {
        self.graph.edge_indices().filter_map(|edge_idx| {
            let (source_idx, target_idx) = self.graph.edge_endpoints(edge_idx)?;
            let source = self.graph.node_weight(source_idx)?;
            let target = self.graph.node_weight(target_idx)?;
            let edge = self.graph.edge_weight(edge_idx)?;
            Some((source, target, edge))
        })
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    fn make_node(id: &str, label: &str, kind: &str) -> ConceptNode {
        ConceptNode::new(id, label, kind)
    }
    
    // -------------------------------------------------------------------------
    // Node Tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_graph_add_node() {
        let mut graph = ConceptGraph::new();
        
        let node = make_node("frodo", "Frodo Baggins", "Person");
        let idx1 = graph.ensure_node(node.clone());
        
        assert_eq!(graph.node_count(), 1);
        
        // Adding same ID should return existing index
        let idx2 = graph.ensure_node(make_node("frodo", "Frodo", "Character"));
        assert_eq!(idx1, idx2, "Same ID should return same index");
        assert_eq!(graph.node_count(), 1, "Should not create duplicate");
    }
    
    #[test]
    fn test_graph_no_duplicate_nodes() {
        let mut graph = ConceptGraph::new();
        
        // Add multiple nodes with same ID
        for i in 0..5 {
            graph.ensure_node(make_node("only-one", &format!("Label {}", i), "Test"));
        }
        
        assert_eq!(graph.node_count(), 1, "Should only have one node despite 5 ensure_node calls");
        
        // Original label should be preserved
        let node = graph.get_node("only-one").unwrap();
        assert_eq!(node.label, "Label 0", "First label should be preserved");
    }
    
    #[test]
    fn test_graph_get_node() {
        let mut graph = ConceptGraph::new();
        
        graph.ensure_node(make_node("gandalf", "Gandalf the Grey", "Wizard"));
        
        let found = graph.get_node("gandalf");
        assert!(found.is_some());
        assert_eq!(found.unwrap().label, "Gandalf the Grey");
        
        let not_found = graph.get_node("saruman");
        assert!(not_found.is_none());
    }
    
    // -------------------------------------------------------------------------
    // Edge Tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_graph_add_edge() {
        let mut graph = ConceptGraph::new();
        
        graph.ensure_node(make_node("frodo", "Frodo", "Person"));
        graph.ensure_node(make_node("sting", "Sting", "Item"));
        
        let edge_idx = graph.add_edge("frodo", "sting", ConceptEdge::unweighted("owns"));
        
        assert!(edge_idx.is_some(), "Edge should be created");
        assert_eq!(graph.edge_count(), 1);
    }
    
    #[test]
    fn test_graph_add_edge_missing_nodes() {
        let mut graph = ConceptGraph::new();
        
        // Try to add edge without nodes
        let result = graph.add_edge("a", "b", ConceptEdge::unweighted("test"));
        assert!(result.is_none(), "Should fail when nodes don't exist");
        
        // Add one node, still should fail
        graph.ensure_node(make_node("a", "A", "Test"));
        let result = graph.add_edge("a", "b", ConceptEdge::unweighted("test"));
        assert!(result.is_none(), "Should fail when target doesn't exist");
    }
    
    #[test]
    fn test_graph_add_edge_with_nodes() {
        let mut graph = ConceptGraph::new();
        
        graph.add_edge_with_nodes(
            make_node("sam", "Samwise", "Person"),
            make_node("frodo", "Frodo", "Person"),
            ConceptEdge::new("serves", 0.95),
        );
        
        assert_eq!(graph.node_count(), 2);
        assert_eq!(graph.edge_count(), 1);
    }
    
    // -------------------------------------------------------------------------
    // Query Tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_graph_query_outgoing() {
        let mut graph = ConceptGraph::new();
        
        // Frodo owns multiple items
        graph.ensure_node(make_node("frodo", "Frodo", "Person"));
        graph.ensure_node(make_node("sting", "Sting", "Item"));
        graph.ensure_node(make_node("ring", "The One Ring", "Item"));
        graph.ensure_node(make_node("mithril", "Mithril Coat", "Item"));
        
        graph.add_edge("frodo", "sting", ConceptEdge::unweighted("owns"));
        graph.add_edge("frodo", "ring", ConceptEdge::unweighted("carries"));
        graph.add_edge("frodo", "mithril", ConceptEdge::unweighted("wears"));
        
        let outgoing = graph.outgoing_edges("frodo");
        
        assert_eq!(outgoing.len(), 3, "Frodo should have 3 outgoing edges");
        
        // Check that we can find all items
        let target_ids: Vec<&str> = outgoing.iter().map(|(node, _)| node.id.as_str()).collect();
        assert!(target_ids.contains(&"sting"));
        assert!(target_ids.contains(&"ring"));
        assert!(target_ids.contains(&"mithril"));
    }
    
    #[test]
    fn test_graph_query_incoming() {
        let mut graph = ConceptGraph::new();
        
        // Multiple people own the ring at different times
        graph.ensure_node(make_node("ring", "The One Ring", "Item"));
        graph.ensure_node(make_node("sauron", "Sauron", "Villain"));
        graph.ensure_node(make_node("isildur", "Isildur", "Person"));
        graph.ensure_node(make_node("gollum", "Gollum", "Creature"));
        graph.ensure_node(make_node("bilbo", "Bilbo", "Person"));
        graph.ensure_node(make_node("frodo", "Frodo", "Person"));
        
        graph.add_edge("sauron", "ring", ConceptEdge::unweighted("created"));
        graph.add_edge("isildur", "ring", ConceptEdge::unweighted("took"));
        graph.add_edge("gollum", "ring", ConceptEdge::unweighted("found"));
        graph.add_edge("bilbo", "ring", ConceptEdge::unweighted("won"));
        graph.add_edge("frodo", "ring", ConceptEdge::unweighted("inherited"));
        
        let incoming = graph.incoming_edges("ring");
        
        assert_eq!(incoming.len(), 5, "Ring should have 5 incoming edges");
    }
    
    #[test]
    fn test_graph_neighbors() {
        let mut graph = ConceptGraph::new();
        
        graph.ensure_node(make_node("frodo", "Frodo", "Person"));
        graph.ensure_node(make_node("sam", "Sam", "Person"));
        graph.ensure_node(make_node("mordor", "Mordor", "Place"));
        graph.ensure_node(make_node("gandalf", "Gandalf", "Wizard"));
        
        // Frodo has outgoing edges to Sam and Mordor
        graph.add_edge("frodo", "sam", ConceptEdge::unweighted("friend_of"));
        graph.add_edge("frodo", "mordor", ConceptEdge::unweighted("traveled_to"));
        // Gandalf has an edge TO Frodo (incoming for Frodo)
        graph.add_edge("gandalf", "frodo", ConceptEdge::unweighted("guided"));
        
        let neighbors = graph.neighbors("frodo");
        
        // Note: neighbors_undirected returns each neighbor once per edge
        // So Frodo should have at least 3 neighbors: Sam, Mordor, Gandalf
        assert!(neighbors.len() >= 3, "Frodo should have at least 3 neighbors, got {}", neighbors.len());
    }
    
    // -------------------------------------------------------------------------
    // Iteration Tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_graph_iterate_nodes() {
        let mut graph = ConceptGraph::new();
        
        graph.ensure_node(make_node("a", "A", "Test"));
        graph.ensure_node(make_node("b", "B", "Test"));
        graph.ensure_node(make_node("c", "C", "Test"));
        
        let node_ids: Vec<&str> = graph.nodes().map(|n| n.id.as_str()).collect();
        
        assert_eq!(node_ids.len(), 3);
        assert!(node_ids.contains(&"a"));
        assert!(node_ids.contains(&"b"));
        assert!(node_ids.contains(&"c"));
    }
    
    #[test]
    fn test_graph_iterate_edges() {
        let mut graph = ConceptGraph::new();
        
        graph.add_edge_with_nodes(
            make_node("a", "A", "Test"),
            make_node("b", "B", "Test"),
            ConceptEdge::unweighted("connects"),
        );
        graph.add_edge_with_nodes(
            make_node("b", "B", "Test"),
            make_node("c", "C", "Test"),
            ConceptEdge::unweighted("leads_to"),
        );
        
        let edges: Vec<_> = graph.edges().collect();
        
        assert_eq!(edges.len(), 2);
    }
    
    // -------------------------------------------------------------------------
    // Utility Tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_graph_clear() {
        let mut graph = ConceptGraph::new();
        
        graph.ensure_node(make_node("a", "A", "Test"));
        graph.ensure_node(make_node("b", "B", "Test"));
        graph.add_edge("a", "b", ConceptEdge::unweighted("test"));
        
        assert_eq!(graph.node_count(), 2);
        assert_eq!(graph.edge_count(), 1);
        
        graph.clear();
        
        assert_eq!(graph.node_count(), 0);
        assert_eq!(graph.edge_count(), 0);
        assert!(graph.is_empty());
    }
    
    #[test]
    fn test_graph_edge_weights() {
        let mut graph = ConceptGraph::new();
        
        graph.ensure_node(make_node("a", "A", "Test"));
        graph.ensure_node(make_node("b", "B", "Test"));
        
        graph.add_edge("a", "b", ConceptEdge::new("high_confidence", 0.95));
        
        let edges = graph.outgoing_edges("a");
        assert_eq!(edges.len(), 1);
        
        let (_, edge) = &edges[0];
        assert_eq!(edge.relation, "high_confidence");
        assert!((edge.weight - 0.95).abs() < f64::EPSILON);
    }
}
