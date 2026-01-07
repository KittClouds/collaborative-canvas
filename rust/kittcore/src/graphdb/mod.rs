//! GraphDB Module
//!
//! Persistent graph database layer for KittClouds.
//! Wraps ConceptGraph with indexes and optional SQLite storage.

pub mod indexes;
pub mod storage;

pub use indexes::{KindIndex, LabelIndex};
#[cfg(feature = "sqlite_wasm")]
pub use storage::GraphStorage;

use crate::reality::graph::{ConceptGraph, ConceptNode, ConceptEdge};
use rustworkx_core::petgraph::graph::NodeIndex;

// =============================================================================
// GraphDB
// =============================================================================

/// Graph database with index-backed queries
/// 
/// Wraps ConceptGraph (petgraph-based) with additional indexes for fast lookups.
/// Does NOT modify the inner graph's behavior — CST and projections continue to work.
pub struct GraphDB {
    /// Inner graph (petgraph-based)
    graph: ConceptGraph,
    /// Index by entity kind (CHARACTER, LOCATION, etc.)
    kind_index: KindIndex,
    /// Index by entity label
    label_index: LabelIndex,
}

impl Default for GraphDB {
    fn default() -> Self {
        Self::new()
    }
}

impl GraphDB {
    /// Create a new empty graph database
    pub fn new() -> Self {
        Self {
            graph: ConceptGraph::new(),
            kind_index: KindIndex::new(),
            label_index: LabelIndex::new(),
        }
    }

    // =========================================================================
    // Node Operations
    // =========================================================================

    /// Add a node to the graph and update indexes
    pub fn add_node(&mut self, node: ConceptNode) -> NodeIndex {
        let id = node.id.clone();
        let kind = node.kind.clone();
        let label = node.label.clone();

        // Add to graph
        let idx = self.graph.ensure_node(node);

        // Update indexes
        self.kind_index.add(&id, &kind);
        self.label_index.add(&id, &label);

        idx
    }

    /// Get a node by ID
    pub fn get_node(&self, id: &str) -> Option<&ConceptNode> {
        self.graph.get_node(id)
    }

    /// Get all nodes of a given kind
    pub fn nodes_by_kind(&self, kind: &str) -> Vec<&ConceptNode> {
        self.kind_index
            .get(kind)
            .iter()
            .filter_map(|id| self.graph.get_node(id))
            .collect()
    }

    /// Get all nodes with a given label (exact match)
    pub fn nodes_by_label(&self, label: &str) -> Vec<&ConceptNode> {
        self.label_index
            .get(label)
            .iter()
            .filter_map(|id| self.graph.get_node(id))
            .collect()
    }

    /// Get all nodes with a given label (case-insensitive)
    pub fn nodes_by_label_insensitive(&self, label: &str) -> Vec<&ConceptNode> {
        self.label_index
            .get_insensitive(label)
            .iter()
            .filter_map(|id| self.graph.get_node(id))
            .collect()
    }

    // =========================================================================
    // Edge Operations  
    // =========================================================================

    /// Add an edge between two nodes
    pub fn add_edge(&mut self, src_id: &str, tgt_id: &str, edge: ConceptEdge) {
        self.graph.add_edge(src_id, tgt_id, edge);
    }

    // =========================================================================
    // Graph Access (for CST/Projections)
    // =========================================================================

    /// Get immutable reference to inner graph
    pub fn graph(&self) -> &ConceptGraph {
        &self.graph
    }

    /// Get mutable reference to inner graph
    /// 
    /// **Warning**: Direct mutations bypass indexes!
    /// Use `add_node`/`add_edge` methods when possible.
    pub fn graph_mut(&mut self) -> &mut ConceptGraph {
        &mut self.graph
    }

    // =========================================================================
    // Stats
    // =========================================================================

    /// Get number of nodes
    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }

    /// Get number of edges
    pub fn edge_count(&self) -> usize {
        self.graph.edge_count()
    }

    /// Get all entity kinds in the graph
    pub fn kinds(&self) -> Vec<String> {
        self.kind_index.kinds()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod graphdb_tests {
    use super::*;

    #[test]
    fn graphdb_new_is_empty() {
        let db = GraphDB::new();
        assert_eq!(db.node_count(), 0);
        assert_eq!(db.edge_count(), 0);
    }

    #[test]
    fn graphdb_add_node_indexed() {
        let mut db = GraphDB::new();
        db.add_node(ConceptNode::new("e1", "Frodo", "CHARACTER"));

        assert_eq!(db.node_count(), 1);
        assert!(db.get_node("e1").is_some());
        assert_eq!(db.nodes_by_kind("CHARACTER").len(), 1);
    }

    #[test]
    fn graphdb_add_edge() {
        let mut db = GraphDB::new();
        db.add_node(ConceptNode::new("e1", "Frodo", "CHARACTER"));
        db.add_node(ConceptNode::new("e2", "Sam", "CHARACTER"));
        db.add_edge("e1", "e2", ConceptEdge::unweighted("FRIEND_OF"));

        assert_eq!(db.edge_count(), 1);
    }

    #[test]
    fn graphdb_nodes_by_kind_filters() {
        let mut db = GraphDB::new();
        db.add_node(ConceptNode::new("e1", "Frodo", "CHARACTER"));
        db.add_node(ConceptNode::new("e2", "Shire", "LOCATION"));

        assert_eq!(db.nodes_by_kind("CHARACTER").len(), 1);
        assert_eq!(db.nodes_by_kind("LOCATION").len(), 1);
        assert_eq!(db.nodes_by_kind("EVENT").len(), 0);
    }

    #[test]
    fn graphdb_inner_graph_accessible() {
        let mut db = GraphDB::new();
        db.add_node(ConceptNode::new("e1", "Frodo", "CHARACTER"));

        // CST/projections can still access inner graph
        let graph = db.graph();
        assert_eq!(graph.node_count(), 1);
    }

    #[test]
    fn graphdb_nodes_by_label() {
        let mut db = GraphDB::new();
        db.add_node(ConceptNode::new("e1", "Frodo Baggins", "CHARACTER"));
        db.add_node(ConceptNode::new("e2", "Bilbo Baggins", "CHARACTER"));

        assert_eq!(db.nodes_by_label("Frodo Baggins").len(), 1);
        assert_eq!(db.nodes_by_label_insensitive("frodo baggins").len(), 1);
    }
}
