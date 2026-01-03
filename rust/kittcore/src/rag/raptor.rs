//! RAPTOR - Hierarchical Retrieval with Tree-structured Embeddings
//!
//! Implements RAPTOR-style retrieval where chunks form leaves and
//! internal nodes are clusters with centroid embeddings.
//!
//! Two retrieval modes:
//! - Collapsed: Flatten all nodes, single HNSW search
//! - Traversal: Beam search from roots to leaves

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Types
// ============================================================================

/// A node in the RAPTOR tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaptorNode {
    pub id: String,
    pub level: u8,              // 0 = leaf (chunk), 1+ = internal
    pub embedding: Vec<f32>,
    pub children: Vec<String>,  // Child node IDs (empty for leaves)
    pub payload: Option<RaptorPayload>,
}

/// Payload for leaf nodes (actual chunk data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaptorPayload {
    pub chunk_id: String,
    pub note_id: String,
    pub text: String,
    pub start: usize,
    pub end: usize,
}

/// Search result from RAPTOR retrieval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaptorSearchResult {
    pub node_id: String,
    pub level: u8,
    pub score: f32,
    pub payload: Option<RaptorPayload>,
    pub is_leaf: bool,
}

/// Retrieval mode
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RetrievalMode {
    Collapsed,   // Flat search over all nodes
    Traversal,   // Beam search down the tree
    Hybrid,      // Collapsed + constrained traversal on best branches
}

/// RAPTOR error types
#[derive(Debug, Clone)]
pub enum RaptorError {
    EmptyInput,
    DimensionMismatch { expected: usize, got: usize },
    BuildError(String),
    SerializationError(String),
}

impl std::fmt::Display for RaptorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RaptorError::EmptyInput => write!(f, "Empty input"),
            RaptorError::DimensionMismatch { expected, got } => {
                write!(f, "Dimension mismatch: expected {}, got {}", expected, got)
            }
            RaptorError::BuildError(msg) => write!(f, "Build error: {}", msg),
            RaptorError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for RaptorError {}

// ============================================================================
// RAPTOR Tree
// ============================================================================

/// The RAPTOR hierarchical index
pub struct RaptorTree {
    dimensions: usize,
    nodes: HashMap<String, RaptorNode>,
    roots: Vec<String>,
    level_count: u8,
}

impl RaptorTree {
    /// Create an empty RAPTOR tree
    pub fn new(dimensions: usize) -> Self {
        RaptorTree {
            dimensions,
            nodes: HashMap::new(),
            roots: Vec::new(),
            level_count: 0,
        }
    }

    /// Build tree from chunk embeddings
    ///
    /// # Arguments
    /// * `chunks` - Vec of (chunk_id, embedding, payload)
    /// * `target_cluster_size` - Target number of children per internal node
    pub fn build_from_chunks(
        chunks: Vec<(String, Vec<f32>, RaptorPayload)>,
        target_cluster_size: usize,
    ) -> Result<Self, RaptorError> {
        if chunks.is_empty() {
            return Err(RaptorError::EmptyInput);
        }

        let dimensions = chunks[0].1.len();
        
        // Validate dimensions
        for (id, emb, _) in &chunks {
            if emb.len() != dimensions {
                return Err(RaptorError::DimensionMismatch {
                    expected: dimensions,
                    got: emb.len(),
                });
            }
        }

        let mut all_nodes: HashMap<String, RaptorNode> = HashMap::new();

        // Create leaf nodes (level 0)
        let mut current_level_nodes: Vec<RaptorNode> = chunks
            .into_iter()
            .map(|(id, embedding, payload)| RaptorNode {
                id,
                level: 0,
                embedding,
                children: vec![],
                payload: Some(payload),
            })
            .collect();

        let mut current_level: u8 = 0;
        let target = target_cluster_size.max(2);

        // Build tree bottom-up
        while current_level_nodes.len() > 1 {
            // Cluster current level
            let clusters = simple_cluster(&current_level_nodes, target);

            // Create parent nodes
            let mut parent_nodes: Vec<RaptorNode> = Vec::new();
            
            for (i, cluster) in clusters.into_iter().enumerate() {
                let parent_id = format!("raptor:L{}:{}", current_level + 1, i);
                let centroid = compute_centroid(&cluster);
                let children: Vec<String> = cluster.iter().map(|n| n.id.clone()).collect();

                parent_nodes.push(RaptorNode {
                    id: parent_id,
                    level: current_level + 1,
                    embedding: centroid,
                    children,
                    payload: None,
                });
            }

            // Store current level nodes
            for node in current_level_nodes {
                all_nodes.insert(node.id.clone(), node);
            }

            current_level_nodes = parent_nodes;
            current_level += 1;
        }

        // Store final root(s)
        let roots: Vec<String> = current_level_nodes.iter().map(|n| n.id.clone()).collect();
        for node in current_level_nodes {
            all_nodes.insert(node.id.clone(), node);
        }

        Ok(RaptorTree {
            dimensions,
            nodes: all_nodes,
            roots,
            level_count: current_level + 1,
        })
    }

    /// Get all node IDs and embeddings (for building external HNSW)
    pub fn all_embeddings(&self) -> Vec<(String, Vec<f32>)> {
        self.nodes
            .iter()
            .map(|(id, node)| (id.clone(), node.embedding.clone()))
            .collect()
    }

    /// Get a node by ID
    pub fn get_node(&self, id: &str) -> Option<&RaptorNode> {
        self.nodes.get(id)
    }

    /// Number of nodes
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Number of levels
    pub fn level_count(&self) -> u8 {
        self.level_count
    }

    /// Get leaf nodes only
    pub fn leaves(&self) -> Vec<&RaptorNode> {
        self.nodes.values().filter(|n| n.level == 0).collect()
    }

    // ========================================================================
    // Retrieval: Collapsed (Flat)
    // ========================================================================

    /// Collapsed retrieval: score all nodes, return top-k
    /// 
    /// For best performance, use this with an external HNSW built from `all_embeddings()`.
    /// This method is the brute-force fallback.
    pub fn search_collapsed(&self, query: &[f32], k: usize) -> Vec<RaptorSearchResult> {
        if query.len() != self.dimensions {
            return vec![];
        }

        let mut scored: Vec<(String, f32)> = self.nodes
            .iter()
            .map(|(id, node)| (id.clone(), cosine_similarity(query, &node.embedding)))
            .collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        scored
            .into_iter()
            .take(k)
            .filter_map(|(id, score)| {
                self.nodes.get(&id).map(|node| RaptorSearchResult {
                    node_id: id,
                    level: node.level,
                    score,
                    payload: node.payload.clone(),
                    is_leaf: node.children.is_empty(),
                })
            })
            .collect()
    }

    /// Collapsed retrieval prioritizing leaves
    pub fn search_collapsed_leaves_only(&self, query: &[f32], k: usize) -> Vec<RaptorSearchResult> {
        if query.len() != self.dimensions {
            return vec![];
        }

        let mut scored: Vec<(String, f32)> = self.nodes
            .iter()
            .filter(|(_, node)| node.level == 0)
            .map(|(id, node)| (id.clone(), cosine_similarity(query, &node.embedding)))
            .collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        scored
            .into_iter()
            .take(k)
            .filter_map(|(id, score)| {
                self.nodes.get(&id).map(|node| RaptorSearchResult {
                    node_id: id,
                    level: node.level,
                    score,
                    payload: node.payload.clone(),
                    is_leaf: true,
                })
            })
            .collect()
    }

    // ========================================================================
    // Retrieval: Traversal (Beam Search)
    // ========================================================================

    /// Traversal retrieval: beam search from roots to leaves
    pub fn search_traversal(&self, query: &[f32], k: usize, beam_width: usize) -> Vec<RaptorSearchResult> {
        if query.len() != self.dimensions || self.roots.is_empty() {
            return vec![];
        }

        let beam = beam_width.max(k);

        // Start with roots
        let mut candidates: Vec<(String, f32)> = self.roots
            .iter()
            .map(|id| {
                let score = self.nodes.get(id)
                    .map(|n| cosine_similarity(query, &n.embedding))
                    .unwrap_or(0.0);
                (id.clone(), score)
            })
            .collect();

        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        candidates.truncate(beam);

        // Descend until all candidates are leaves
        let max_iterations = self.level_count as usize + 1;
        for _ in 0..max_iterations {
            let all_leaves = candidates.iter().all(|(id, _)| {
                self.nodes.get(id).map(|n| n.children.is_empty()).unwrap_or(true)
            });

            if all_leaves {
                break;
            }

            let mut next_candidates: Vec<(String, f32)> = Vec::new();

            for (id, parent_score) in &candidates {
                if let Some(node) = self.nodes.get(id) {
                    if node.children.is_empty() {
                        // Keep leaf
                        next_candidates.push((id.clone(), *parent_score));
                    } else {
                        // Expand children
                        for child_id in &node.children {
                            let score = self.nodes.get(child_id)
                                .map(|n| cosine_similarity(query, &n.embedding))
                                .unwrap_or(0.0);
                            next_candidates.push((child_id.clone(), score));
                        }
                    }
                }
            }

            next_candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            candidates = next_candidates.into_iter().take(beam).collect();
        }

        // Return top-k leaves
        candidates
            .into_iter()
            .take(k)
            .filter_map(|(id, score)| {
                self.nodes.get(&id).map(|node| RaptorSearchResult {
                    node_id: id,
                    level: node.level,
                    score,
                    payload: node.payload.clone(),
                    is_leaf: node.children.is_empty(),
                })
            })
            .collect()
    }

    // ========================================================================
    // Retrieval: Hybrid
    // ========================================================================

    /// Hybrid retrieval: collapsed to find candidates, then traversal on best branches
    pub fn search_hybrid(&self, query: &[f32], k: usize, beam_width: usize) -> Vec<RaptorSearchResult> {
        // Get broad candidates from collapsed search
        let collapsed_results = self.search_collapsed(query, k * 2);
        
        // For any internal nodes, do traversal down their subtrees
        let mut leaf_results: Vec<RaptorSearchResult> = Vec::new();
        let mut seen_leaves: std::collections::HashSet<String> = std::collections::HashSet::new();

        for result in collapsed_results {
            if result.is_leaf {
                if !seen_leaves.contains(&result.node_id) {
                    seen_leaves.insert(result.node_id.clone());
                    leaf_results.push(result);
                }
            } else {
                // Traverse this subtree
                let subtree_results = self.traverse_subtree(query, &result.node_id, beam_width);
                for r in subtree_results {
                    if !seen_leaves.contains(&r.node_id) {
                        seen_leaves.insert(r.node_id.clone());
                        leaf_results.push(r);
                    }
                }
            }
        }

        // Sort by score and take top-k
        leaf_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        leaf_results.truncate(k);
        leaf_results
    }

    /// Traverse a subtree from a given node
    fn traverse_subtree(&self, query: &[f32], start_id: &str, beam_width: usize) -> Vec<RaptorSearchResult> {
        let Some(start_node) = self.nodes.get(start_id) else {
            return vec![];
        };

        if start_node.children.is_empty() {
            return vec![RaptorSearchResult {
                node_id: start_id.to_string(),
                level: start_node.level,
                score: cosine_similarity(query, &start_node.embedding),
                payload: start_node.payload.clone(),
                is_leaf: true,
            }];
        }

        let mut candidates: Vec<(String, f32)> = start_node.children
            .iter()
            .map(|id| {
                let score = self.nodes.get(id)
                    .map(|n| cosine_similarity(query, &n.embedding))
                    .unwrap_or(0.0);
                (id.clone(), score)
            })
            .collect();

        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        candidates.truncate(beam_width);

        // Descend to leaves
        let max_iterations = self.level_count as usize;
        for _ in 0..max_iterations {
            let all_leaves = candidates.iter().all(|(id, _)| {
                self.nodes.get(id).map(|n| n.children.is_empty()).unwrap_or(true)
            });

            if all_leaves {
                break;
            }

            let mut next: Vec<(String, f32)> = Vec::new();
            for (id, parent_score) in &candidates {
                if let Some(node) = self.nodes.get(id) {
                    if node.children.is_empty() {
                        next.push((id.clone(), *parent_score));
                    } else {
                        for child_id in &node.children {
                            let score = self.nodes.get(child_id)
                                .map(|n| cosine_similarity(query, &n.embedding))
                                .unwrap_or(0.0);
                            next.push((child_id.clone(), score));
                        }
                    }
                }
            }
            next.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            candidates = next.into_iter().take(beam_width).collect();
        }

        candidates
            .into_iter()
            .filter_map(|(id, score)| {
                self.nodes.get(&id).map(|node| RaptorSearchResult {
                    node_id: id,
                    level: node.level,
                    score,
                    payload: node.payload.clone(),
                    is_leaf: node.children.is_empty(),
                })
            })
            .collect()
    }

    // ========================================================================
    // Serialization
    // ========================================================================

    pub fn serialize(&self) -> Result<Vec<u8>, RaptorError> {
        #[derive(Serialize)]
        struct SerializedTree {
            dimensions: usize,
            nodes: Vec<RaptorNode>,
            roots: Vec<String>,
            level_count: u8,
        }

        let state = SerializedTree {
            dimensions: self.dimensions,
            nodes: self.nodes.values().cloned().collect(),
            roots: self.roots.clone(),
            level_count: self.level_count,
        };

        serde_json::to_vec(&state)
            .map_err(|e| RaptorError::SerializationError(e.to_string()))
    }

    pub fn deserialize(bytes: &[u8]) -> Result<Self, RaptorError> {
        #[derive(Deserialize)]
        struct SerializedTree {
            dimensions: usize,
            nodes: Vec<RaptorNode>,
            roots: Vec<String>,
            level_count: u8,
        }

        let state: SerializedTree = serde_json::from_slice(bytes)
            .map_err(|e| RaptorError::SerializationError(e.to_string()))?;

        let nodes: HashMap<String, RaptorNode> = state.nodes
            .into_iter()
            .map(|n| (n.id.clone(), n))
            .collect();

        Ok(RaptorTree {
            dimensions: state.dimensions,
            nodes,
            roots: state.roots,
            level_count: state.level_count,
        })
    }
}

// ============================================================================
// Clustering Helpers
// ============================================================================

/// Simple clustering: partition nodes into groups of ~target_size
fn simple_cluster(nodes: &[RaptorNode], target_size: usize) -> Vec<Vec<RaptorNode>> {
    if nodes.len() <= target_size {
        return vec![nodes.to_vec()];
    }

    // Simple k-means with k = ceil(n / target_size)
    let k = (nodes.len() + target_size - 1) / target_size;
    k_means(nodes, k.max(2), 10)
}

/// Basic k-means clustering
fn k_means(nodes: &[RaptorNode], k: usize, max_iterations: usize) -> Vec<Vec<RaptorNode>> {
    if nodes.is_empty() || k == 0 {
        return vec![];
    }

    let k = k.min(nodes.len());
    let dim = nodes[0].embedding.len();

    // Initialize centroids by picking k evenly-spaced nodes
    let step = nodes.len() / k;
    let mut centroids: Vec<Vec<f32>> = (0..k)
        .map(|i| nodes[(i * step).min(nodes.len() - 1)].embedding.clone())
        .collect();

    let mut assignments: Vec<usize> = vec![0; nodes.len()];

    for _ in 0..max_iterations {
        // Assign each node to nearest centroid
        let mut changed = false;
        for (i, node) in nodes.iter().enumerate() {
            let best = centroids
                .iter()
                .enumerate()
                .map(|(ci, c)| (ci, cosine_similarity(&node.embedding, c)))
                .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(ci, _)| ci)
                .unwrap_or(0);

            if assignments[i] != best {
                assignments[i] = best;
                changed = true;
            }
        }

        if !changed {
            break;
        }

        // Recompute centroids
        let mut sums: Vec<Vec<f32>> = vec![vec![0.0; dim]; k];
        let mut counts: Vec<usize> = vec![0; k];

        for (i, node) in nodes.iter().enumerate() {
            let c = assignments[i];
            counts[c] += 1;
            for (j, val) in node.embedding.iter().enumerate() {
                sums[c][j] += val;
            }
        }

        for c in 0..k {
            if counts[c] > 0 {
                for j in 0..dim {
                    centroids[c][j] = sums[c][j] / counts[c] as f32;
                }
            }
        }
    }

    // Group nodes by cluster
    let mut clusters: Vec<Vec<RaptorNode>> = vec![vec![]; k];
    for (i, node) in nodes.iter().enumerate() {
        clusters[assignments[i]].push(node.clone());
    }

    // Remove empty clusters
    clusters.into_iter().filter(|c| !c.is_empty()).collect()
}

/// Compute centroid (mean) of node embeddings
fn compute_centroid(nodes: &[RaptorNode]) -> Vec<f32> {
    if nodes.is_empty() {
        return vec![];
    }

    let dim = nodes[0].embedding.len();
    let mut sum: Vec<f32> = vec![0.0; dim];

    for node in nodes {
        for (i, val) in node.embedding.iter().enumerate() {
            sum[i] += val;
        }
    }

    let n = nodes.len() as f32;
    sum.iter_mut().for_each(|v| *v /= n);
    sum
}

/// Cosine similarity
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if mag_a == 0.0 || mag_b == 0.0 {
        0.0
    } else {
        dot / (mag_a * mag_b)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_chunk(id: &str, embedding: Vec<f32>) -> (String, Vec<f32>, RaptorPayload) {
        (
            id.to_string(),
            embedding,
            RaptorPayload {
                chunk_id: id.to_string(),
                note_id: "test_note".to_string(),
                text: format!("Chunk {}", id),
                start: 0,
                end: 10,
            },
        )
    }

    #[test]
    fn test_build_tree_single_chunk() {
        let chunks = vec![make_chunk("c1", vec![1.0, 0.0, 0.0])];
        let tree = RaptorTree::build_from_chunks(chunks, 4).unwrap();
        
        assert_eq!(tree.len(), 1);
        assert_eq!(tree.leaves().len(), 1);
    }

    #[test]
    fn test_build_tree_multiple_chunks() {
        let chunks = vec![
            make_chunk("c1", vec![1.0, 0.0, 0.0]),
            make_chunk("c2", vec![0.9, 0.1, 0.0]),
            make_chunk("c3", vec![0.0, 1.0, 0.0]),
            make_chunk("c4", vec![0.0, 0.9, 0.1]),
            make_chunk("c5", vec![0.0, 0.0, 1.0]),
            make_chunk("c6", vec![0.1, 0.0, 0.9]),
        ];
        
        let tree = RaptorTree::build_from_chunks(chunks, 3).unwrap();
        
        assert!(tree.len() > 6); // Should have internal nodes
        assert_eq!(tree.leaves().len(), 6);
        assert!(!tree.roots.is_empty());
    }

    #[test]
    fn test_collapsed_search() {
        let chunks = vec![
            make_chunk("c1", vec![1.0, 0.0, 0.0]),
            make_chunk("c2", vec![0.0, 1.0, 0.0]),
            make_chunk("c3", vec![0.0, 0.0, 1.0]),
        ];
        
        let tree = RaptorTree::build_from_chunks(chunks, 2).unwrap();
        let results = tree.search_collapsed(&[1.0, 0.0, 0.0], 3);
        
        assert!(!results.is_empty());
        // First result should be the matching chunk
        let leaf_results: Vec<_> = results.iter().filter(|r| r.is_leaf).collect();
        assert!(!leaf_results.is_empty());
    }

    #[test]
    fn test_traversal_search() {
        let chunks = vec![
            make_chunk("c1", vec![1.0, 0.0, 0.0]),
            make_chunk("c2", vec![0.9, 0.1, 0.0]),
            make_chunk("c3", vec![0.0, 1.0, 0.0]),
            make_chunk("c4", vec![0.0, 0.9, 0.1]),
        ];
        
        let tree = RaptorTree::build_from_chunks(chunks, 2).unwrap();
        let results = tree.search_traversal(&[1.0, 0.0, 0.0], 2, 4);
        
        assert!(!results.is_empty());
        // All traversal results should be leaves
        assert!(results.iter().all(|r| r.is_leaf));
    }

    #[test]
    fn test_serialization() {
        let chunks = vec![
            make_chunk("c1", vec![1.0, 0.0, 0.0]),
            make_chunk("c2", vec![0.0, 1.0, 0.0]),
        ];
        
        let tree = RaptorTree::build_from_chunks(chunks, 2).unwrap();
        let bytes = tree.serialize().unwrap();
        let restored = RaptorTree::deserialize(&bytes).unwrap();
        
        assert_eq!(tree.len(), restored.len());
        assert_eq!(tree.level_count(), restored.level_count());
    }

    #[test]
    fn test_hybrid_search() {
        let chunks = vec![
            make_chunk("c1", vec![1.0, 0.0, 0.0]),
            make_chunk("c2", vec![0.9, 0.1, 0.0]),
            make_chunk("c3", vec![0.0, 1.0, 0.0]),
            make_chunk("c4", vec![0.0, 0.9, 0.1]),
            make_chunk("c5", vec![0.0, 0.0, 1.0]),
            make_chunk("c6", vec![0.1, 0.0, 0.9]),
        ];
        
        let tree = RaptorTree::build_from_chunks(chunks, 2).unwrap();
        let results = tree.search_hybrid(&[1.0, 0.0, 0.0], 3, 4);
        
        assert!(!results.is_empty());
        assert!(results.len() <= 3);
        // All hybrid results should be leaves
        assert!(results.iter().all(|r| r.is_leaf));
    }
}
