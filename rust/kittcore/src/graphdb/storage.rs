//! Graph Storage Layer
//!
//! SQLite persistence for GraphDB nodes and edges.
//! Uses the sqlite-wasm-rs Database for OPFS support.

#[cfg(feature = "sqlite_wasm")]
use crate::db::Database;
use crate::reality::graph::{ConceptNode, ConceptEdge, EdgeKind};

/// Storage layer for persisting graph data to SQLite
#[cfg(feature = "sqlite_wasm")]
pub struct GraphStorage {
    db: Database,
}

#[cfg(feature = "sqlite_wasm")]
impl GraphStorage {
    /// Create a new storage layer with an existing database connection
    pub fn new(db: Database) -> Result<Self, String> {
        let storage = Self { db };
        storage.init_schema()?;
        Ok(storage)
    }

    /// Initialize the database schema
    fn init_schema(&self) -> Result<(), String> {
        self.db.execute(
            r#"
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                kind TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                relation TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                kind_json TEXT,
                doc_id TEXT,
                span_start INTEGER,
                span_end INTEGER,
                created_at INTEGER,
                FOREIGN KEY (source_id) REFERENCES nodes(id),
                FOREIGN KEY (target_id) REFERENCES nodes(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind);
            CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
            CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
            CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);
            "#,
        )
    }

    /// Persist a node to storage (INSERT OR REPLACE)
    pub fn persist_node(&self, node: &ConceptNode) -> Result<(), String> {
        let sql = format!(
            "INSERT OR REPLACE INTO nodes (id, label, kind) VALUES ('{}', '{}', '{}')",
            Self::escape(&node.id),
            Self::escape(&node.label),
            Self::escape(&node.kind),
        );
        self.db.execute(&sql)
    }

    /// Persist an edge to storage
    pub fn persist_edge(&self, source_id: &str, target_id: &str, edge: &ConceptEdge) -> Result<(), String> {
        let kind_json = Self::edge_kind_to_json(&edge.edge_kind);
        let span_start = edge.source_span.map(|(s, _)| s.to_string()).unwrap_or_else(|| "NULL".to_string());
        let span_end = edge.source_span.map(|(_, e)| e.to_string()).unwrap_or_else(|| "NULL".to_string());
        let doc_id = edge.source_doc.as_ref().map(|d| format!("'{}'", Self::escape(d))).unwrap_or_else(|| "NULL".to_string());
        let created_at = edge.created_at.map(|t| t.to_string()).unwrap_or_else(|| "NULL".to_string());

        let sql = format!(
            "INSERT INTO edges (source_id, target_id, relation, weight, kind_json, doc_id, span_start, span_end, created_at) VALUES ('{}', '{}', '{}', {}, '{}', {}, {}, {}, {})",
            Self::escape(source_id),
            Self::escape(target_id),
            Self::escape(&edge.relation),
            edge.weight,
            Self::escape(&kind_json),
            doc_id,
            span_start,
            span_end,
            created_at,
        );
        self.db.execute(&sql)
    }

    /// Load a node by ID
    pub fn load_node(&self, _id: &str) -> Result<Option<ConceptNode>, String> {
        // Note: Full query support requires sqlite3_prepare/step/column which
        // we haven't implemented yet. For now, this is a placeholder.
        // In a real implementation, we'd use prepared statements.
        Ok(None)
    }

    /// Load all nodes from storage
    pub fn load_all_nodes(&self) -> Result<Vec<ConceptNode>, String> {
        // Placeholder - requires query row iteration
        Ok(vec![])
    }

    /// Load edges from a source node
    pub fn load_edges_from(&self, _source_id: &str) -> Result<Vec<(String, ConceptEdge)>, String> {
        // Placeholder - requires query row iteration
        Ok(vec![])
    }

    /// Escape SQL string (basic protection)
    fn escape(s: &str) -> String {
        s.replace('\'', "''")
    }

    /// Serialize EdgeKind to JSON
    fn edge_kind_to_json(kind: &EdgeKind) -> String {
        match kind {
            EdgeKind::Relation => r#"{"type":"relation"}"#.to_string(),
            EdgeKind::Attribution { verb } => {
                let escaped_verb = Self::escape(verb);
                format!(r#"{{"type":"attribution","verb":"{}"}}"#, escaped_verb)
            }
            EdgeKind::StateTransition { trigger } => {
                match trigger {
                    Some(t) => format!(r#"{{"type":"state_transition","trigger":"{}"}}"#, Self::escape(t)),
                    None => r#"{"type":"state_transition"}"#.to_string(),
                }
            }
            EdgeKind::ModifiedRelation { manner, location, time } => {
                let mut parts = vec![r#""type":"modified_relation""#.to_string()];
                if let Some(m) = manner {
                    parts.push(format!(r#""manner":"{}""#, Self::escape(m)));
                }
                if let Some(l) = location {
                    parts.push(format!(r#""location":"{}""#, Self::escape(l)));
                }
                if let Some(t) = time {
                    parts.push(format!(r#""time":"{}""#, Self::escape(t)));
                }
                format!("{{{}}}", parts.join(","))
            }
        }
    }
}

// =============================================================================
// Tests (run with sqlite_wasm feature)
// =============================================================================

#[cfg(all(test, feature = "sqlite_wasm"))]
mod storage_tests {
    use super::*;

    #[test]
    fn storage_init_creates_tables() {
        let db = Database::open_memory().unwrap();
        let storage = GraphStorage::new(db);
        assert!(storage.is_ok());
    }

    #[test]
    fn storage_persist_node() {
        let db = Database::open_memory().unwrap();
        let storage = GraphStorage::new(db).unwrap();

        let node = ConceptNode::new("e1", "Frodo", "CHARACTER");
        let result = storage.persist_node(&node);
        assert!(result.is_ok());
    }

    #[test]
    fn storage_persist_edge() {
        let db = Database::open_memory().unwrap();
        let storage = GraphStorage::new(db).unwrap();

        // First persist nodes
        storage.persist_node(&ConceptNode::new("e1", "Frodo", "CHARACTER")).unwrap();
        storage.persist_node(&ConceptNode::new("e2", "Sam", "CHARACTER")).unwrap();

        // Then persist edge
        let edge = ConceptEdge::unweighted("FRIEND_OF");
        let result = storage.persist_edge("e1", "e2", &edge);
        assert!(result.is_ok());
    }

    #[test]
    fn storage_persist_edge_with_metadata() {
        let db = Database::open_memory().unwrap();
        let storage = GraphStorage::new(db).unwrap();

        storage.persist_node(&ConceptNode::new("e1", "Gandalf", "CHARACTER")).unwrap();
        storage.persist_node(&ConceptNode::new("e2", "Balrog", "CREATURE")).unwrap();

        let edge = ConceptEdge::new("DEFEATED", 0.95)
            .with_doc("chapter1")
            .with_span(100, 150)
            .with_timestamp(1234567890);

        let result = storage.persist_edge("e1", "e2", &edge);
        assert!(result.is_ok());
    }
}

// =============================================================================
// Non-SQLite stub (for testing without sqlite_wasm feature)
// =============================================================================

#[cfg(not(feature = "sqlite_wasm"))]
pub struct GraphStorage;

#[cfg(not(feature = "sqlite_wasm"))]
impl GraphStorage {
    pub fn new_stub() -> Self {
        Self
    }
}
