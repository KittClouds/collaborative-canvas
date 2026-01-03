//! HNSW (Hierarchical Navigable Small World) Index
//!
//! A production-grade implementation of the HNSW algorithm for approximate
//! nearest neighbor search. Optimized for high-dimensional embedding vectors.
//!
//! # Algorithm Overview
//! HNSW builds a multi-layer graph where:
//! - Higher layers have fewer nodes (exponential decay)
//! - Search starts from top layer, greedily descending
//! - Each layer is a navigable small-world graph
//!
//! # Performance Characteristics
//! - Insert: O(log N) average
//! - Search: O(log N) average
//! - Memory: O(N * M) where M = max neighbors per node

use std::collections::{HashMap, HashSet, BinaryHeap};
use std::cmp::Reverse;
use super::node::HnswNode;
use super::pqueue::ScoredItem;
use super::distance::{cosine_similarity, euclidean_distance_squared, magnitude};

/// Distance metric for similarity computation
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Metric {
    Cosine,
    Euclidean,
}

/// HNSW-specific errors
#[derive(Debug, Clone, PartialEq)]
pub enum HnswError {
    DuplicateId(u32),
    DimensionMismatch { expected: usize, got: usize },
    EmptyVector,
    SerializationError(String),
}

impl std::fmt::Display for HnswError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HnswError::DuplicateId(id) => write!(f, "Duplicate node ID: {}", id),
            HnswError::DimensionMismatch { expected, got } => {
                write!(f, "Dimension mismatch: expected {}, got {}", expected, got)
            }
            HnswError::EmptyVector => write!(f, "Empty vector"),
            HnswError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for HnswError {}

/// HNSW Index
///
/// # Example
/// ```ignore
/// let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
/// hnsw.add_point(1, vec![0.1, 0.2, 0.3])?;
/// let results = hnsw.search_knn(&[0.1, 0.2, 0.3], 10);
/// ```
pub struct Hnsw {
    // Configuration
    m: usize,                    // Max neighbors per level (M in paper)
    m_max0: usize,               // Max neighbors at level 0 (usually 2*M)
    ef_construction: usize,      // Search depth during construction
    level_mult: f32,             // Level generation multiplier (1/ln(M))
    metric: Metric,

    // State
    nodes: HashMap<u32, HnswNode>,
    entry_point_id: Option<u32>,
    level_max: u8,
    dimension: Option<usize>,
    
    // RNG state for level selection (simple LCG for determinism)
    rng_state: u64,
}

impl Hnsw {
    /// Create a new HNSW index
    ///
    /// # Arguments
    /// * `m` - Max neighbors per node per layer (typically 16-64)
    /// * `ef_construction` - Search beam width during construction (typically 100-500)
    /// * `metric` - Distance metric (Cosine or Euclidean)
    pub fn new(m: usize, ef_construction: usize, metric: Metric) -> Self {
        let level_mult = 1.0 / (m as f32).ln();
        
        Hnsw {
            m,
            m_max0: m * 2,
            ef_construction,
            level_mult,
            metric,
            nodes: HashMap::new(),
            entry_point_id: None,
            level_max: 0,
            dimension: None,
            rng_state: 42, // Deterministic seed
        }
    }

    /// Add a point to the index
    pub fn add_point(&mut self, id: u32, vector: Vec<f32>) -> Result<(), HnswError> {
        // Validation
        if vector.is_empty() {
            return Err(HnswError::EmptyVector);
        }
        
        if self.nodes.contains_key(&id) {
            return Err(HnswError::DuplicateId(id));
        }
        
        if let Some(dim) = self.dimension {
            if vector.len() != dim {
                return Err(HnswError::DimensionMismatch {
                    expected: dim,
                    got: vector.len(),
                });
            }
        } else {
            self.dimension = Some(vector.len());
        }

        // Select random level for this node
        let level = self.select_level();
        
        // Create node with neighbor lists for all levels up to `level`
        let node = HnswNode::new(id, level, vector, (level as usize) + 1);
        
        // First node case
        if self.entry_point_id.is_none() {
            self.entry_point_id = Some(id);
            self.level_max = level;
            self.nodes.insert(id, node);
            return Ok(());
        }

        // Get entry point
        let mut ep_id = self.entry_point_id.unwrap();
        
        // Insert the node first so we can reference it
        self.nodes.insert(id, node);
        
        // Phase 1: Traverse from top to node's level + 1 (greedy search)
        let mut current_level = self.level_max as i32;
        while current_level > level as i32 {
            let (nearest_id, _) = self.search_layer_single(ep_id, id, current_level as u8);
            ep_id = nearest_id;
            current_level -= 1;
        }
        
        // Phase 2: Insert at each level from node's level down to 0
        for lc in (0..=level).rev() {
            // Find ef_construction nearest neighbors at this level
            let neighbors = self.search_layer(ep_id, id, self.ef_construction, lc);
            
            // Select M best neighbors
            let m_limit = if lc == 0 { self.m_max0 } else { self.m };
            let selected: Vec<u32> = neighbors.iter()
                .take(m_limit)
                .map(|(nid, _)| *nid)
                .collect();
            
            // Add bidirectional connections
            for &neighbor_id in &selected {
                // Add neighbor -> new node
                self.add_neighbor(neighbor_id, id, lc);
                // Add new node -> neighbor
                self.add_neighbor(id, neighbor_id, lc);
            }
            
            // Prune neighbors if over limit
            for &neighbor_id in &selected {
                self.prune_neighbors(neighbor_id, lc, m_limit);
            }
            
            // Update entry point for next level
            if !neighbors.is_empty() {
                ep_id = neighbors[0].0;
            }
        }
        
        // Update global entry point if new node is higher level
        if level > self.level_max {
            self.entry_point_id = Some(id);
            self.level_max = level;
        }

        Ok(())
    }

    /// Search for k nearest neighbors
    pub fn search_knn(&self, query: &[f32], k: usize) -> Vec<(u32, f32)> {
        if self.nodes.is_empty() || self.entry_point_id.is_none() {
            return Vec::new();
        }
        
        let query_vec = query.to_vec();
        let query_mag = magnitude(&query_vec);
        
        let mut ep_id = self.entry_point_id.unwrap();
        
        // Phase 1: Traverse from top to level 1 (greedy)
        let mut current_level = self.level_max as i32;
        while current_level > 0 {
            let (nearest_id, _) = self.search_layer_single_query(ep_id, &query_vec, query_mag, current_level as u8);
            ep_id = nearest_id;
            current_level -= 1;
        }
        
        // Phase 2: Search at level 0 with ef = max(k, ef_construction)
        let ef = k.max(self.ef_construction);
        let candidates = self.search_layer_query(ep_id, &query_vec, query_mag, ef, 0);
        
        // Return top k, filtered by deleted flag
        candidates.into_iter()
            .filter(|(id, _)| {
                self.nodes.get(id).map(|n| !n.deleted).unwrap_or(false)
            })
            .take(k)
            .collect()
    }

    /// Soft-delete a point
    pub fn delete_point(&mut self, id: u32) {
        if let Some(node) = self.nodes.get_mut(&id) {
            node.deleted = true;
        }
    }

    /// Number of points
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Get the vector for a specific node by ID
    pub fn get_vector(&self, id: u32) -> Option<Vec<f32>> {
        self.nodes.get(&id).map(|node| node.vector.clone())
    }

    // ========================================================================
    // Serialization
    // ========================================================================

    pub fn serialize(&self) -> Vec<u8> {
        let mut buffer = Vec::new();
        
        // Header
        buffer.extend_from_slice(&0x48534e57u32.to_le_bytes()); // Magic "HNSW"
        buffer.extend_from_slice(&(self.dimension.unwrap_or(0) as u16).to_le_bytes());
        buffer.extend_from_slice(&(self.m as u16).to_le_bytes());
        buffer.extend_from_slice(&(self.nodes.len() as u32).to_le_bytes());
        buffer.extend_from_slice(&(self.level_max as u16).to_le_bytes());
        // Entry Point ID (u32::MAX if None)
        let ep = self.entry_point_id.unwrap_or(u32::MAX);
        buffer.extend_from_slice(&ep.to_le_bytes());
        
        // Nodes (in undetermined order, but consistent if map iteration is)
        // HashMap iteration is not deterministic unless using a sorted map or collecting.
        // For persistence stability we should probably sort by ID.
        let mut sorted_ids: Vec<u32> = self.nodes.keys().cloned().collect();
        sorted_ids.sort();
        
        for id in sorted_ids {
            let node = &self.nodes[&id];
            
            // Per Node
            buffer.extend_from_slice(&node.id.to_le_bytes());
            buffer.extend_from_slice(&node.level.to_le_bytes()); // level_count is basically level + 1 if we store 0..level.
            // Spec says "level_count: u8"
            // Wait, node.level is max level. 
            // Neighbors vec has size `level + 1`. 
            // So level_count IS node.neighbors.len() as u8.
            let level_count = node.neighbors.len() as u8;
            buffer.push(level_count);
            
            // Vector
            for &val in &node.vector {
                buffer.extend_from_slice(&val.to_le_bytes());
            }
            
            // Deleted flag (my extension)
            buffer.push(if node.deleted { 1 } else { 0 });
            
            // Neighbors
            for neighbors_at_level in &node.neighbors {
                // Filter valid neighbors
                let valid: Vec<u32> = neighbors_at_level.iter()
                    .filter(|&&nid| nid >= 0)
                    .map(|&nid| nid as u32)
                    .collect();
                
                buffer.extend_from_slice(&(valid.len() as u16).to_le_bytes());
                for &nid in &valid {
                    buffer.extend_from_slice(&nid.to_le_bytes());
                }
            }
        }
        
        buffer
    }

    pub fn deserialize(bytes: &[u8]) -> Result<Self, HnswError> {
        let mut cursor = 0;
        // Header size 18 bytes
        if bytes.len() < 18 {
            return Err(HnswError::SerializationError("File too short".to_string()));
        }
        
        // Header
        let magic = u32::from_le_bytes(bytes[cursor..cursor+4].try_into().unwrap());
        cursor += 4;
        if magic != 0x48534e57 {
            return Err(HnswError::SerializationError("Invalid magic".to_string()));
        }
        
        let dimension = u16::from_le_bytes(bytes[cursor..cursor+2].try_into().unwrap()) as usize;
        cursor += 2;
        
        let m = u16::from_le_bytes(bytes[cursor..cursor+2].try_into().unwrap()) as usize;
        cursor += 2;
        
        let node_count = u32::from_le_bytes(bytes[cursor..cursor+4].try_into().unwrap()) as usize;
        cursor += 4;
        
        let level_max = u16::from_le_bytes(bytes[cursor..cursor+2].try_into().unwrap()) as u8;
        cursor += 2;

        let entry_point_raw = u32::from_le_bytes(bytes[cursor..cursor+4].try_into().unwrap());
        cursor += 4;
        let entry_point_id = if entry_point_raw == u32::MAX { None } else { Some(entry_point_raw) };
        
        let mut hnsw = Hnsw::new(m, 100, Metric::Cosine); // ef defaults to 100, metric defaulted (spec doesn't store metric!)
        hnsw.dimension = Some(dimension);
        hnsw.level_max = level_max;
        hnsw.entry_point_id = entry_point_id;
        
        for _ in 0..node_count {
            if cursor + 4 + 1 > bytes.len() {
                return Err(HnswError::SerializationError("Unexpected EOF reading node header".to_string()));
            }
            
            let id = u32::from_le_bytes(bytes[cursor..cursor+4].try_into().unwrap());
            cursor += 4;
            
            let level_count = bytes[cursor] as usize; // neighbors.len()
            cursor += 1;
            // The stored 'level' of node is level_count - 1
            let level = if level_count > 0 { (level_count - 1) as u8 } else { 0 };
            
            // Vector
            let vec_size = dimension * 4;
            if cursor + vec_size > bytes.len() {
                return Err(HnswError::SerializationError("Unexpected EOF reading vector".to_string()));
            }
            
            let mut vector = Vec::with_capacity(dimension);
            for _ in 0..dimension {
                let val = f32::from_le_bytes(bytes[cursor..cursor+4].try_into().unwrap());
                vector.push(val);
                cursor += 4;
            }
            
            // Deleted flag (my extension)
            if cursor >= bytes.len() {
                return Err(HnswError::SerializationError("Unexpected EOF reading deleted flag".to_string()));
            }
            let deleted = bytes[cursor] != 0;
            cursor += 1;

            // Neighbors
            let mut neighbors = Vec::with_capacity(level_count);
            for _ in 0..level_count {
                if cursor + 2 > bytes.len() {
                    return Err(HnswError::SerializationError("Unexpected EOF count".to_string()));
                }
                let neighbor_count = u16::from_le_bytes(bytes[cursor..cursor+2].try_into().unwrap()) as usize;
                cursor += 2;
                
                let mut layer_neighbors = Vec::with_capacity(neighbor_count);
                for _ in 0..neighbor_count {
                    if cursor + 4 > bytes.len() {
                         return Err(HnswError::SerializationError("Unexpected EOF neighbor".to_string()));
                    }
                    let nid = u32::from_le_bytes(bytes[cursor..cursor+4].try_into().unwrap()) as i32;
                    layer_neighbors.push(nid);
                    cursor += 4;
                }
                neighbors.push(layer_neighbors);
            }
            
            let mut node = HnswNode::new(id, level, vector, 0);
            node.neighbors = neighbors;
            node.deleted = deleted;
            
            hnsw.nodes.insert(id, node);
        }
        
        // No need to re-find entry point as we loaded it
        Ok(hnsw)
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    /// Select a random level for a new node using exponential distribution
    fn select_level(&mut self) -> u8 {
        // LCG random
        self.rng_state = self.rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let r = ((self.rng_state >> 33) as f32 / (u32::MAX as f32)).max(1e-7);
        
        // level = floor(-ln(uniform) * level_mult)
        let level = (-r.ln() * self.level_mult).floor() as u8;
        level.min(16) // Cap at 16 levels
    }

    /// Greedy search at a single level, returns single nearest neighbor
    fn search_layer_single(&self, entry_id: u32, target_id: u32, level: u8) -> (u32, f32) {
        let target_node = self.nodes.get(&target_id).unwrap();
        let target_mag = target_node.get_magnitude();
        
        let mut current_id = entry_id;
        let mut current_dist = self.distance_to_node(current_id, &target_node.vector, target_mag);
        
        loop {
            let mut changed = false;
            
            if let Some(node) = self.nodes.get(&current_id) {
                if (level as usize) < node.neighbors.len() {
                    for &neighbor_id in &node.neighbors[level as usize] {
                        if neighbor_id < 0 { continue; }
                        let nid = neighbor_id as u32;
                        
                        let dist = self.distance_to_node(nid, &target_node.vector, target_mag);
                        if dist < current_dist {
                            current_id = nid;
                            current_dist = dist;
                            changed = true;
                        }
                    }
                }
            }
            
            if !changed {
                break;
            }
        }
        
        (current_id, current_dist)
    }

    /// Greedy search for a query vector at a single level
    fn search_layer_single_query(&self, entry_id: u32, query: &[f32], query_mag: f32, level: u8) -> (u32, f32) {
        let mut current_id = entry_id;
        let mut current_sim = self.similarity(current_id, query, query_mag);
        
        loop {
            let mut changed = false;
            
            if let Some(node) = self.nodes.get(&current_id) {
                if (level as usize) < node.neighbors.len() {
                    for &neighbor_id in &node.neighbors[level as usize] {
                        if neighbor_id < 0 { continue; }
                        let nid = neighbor_id as u32;
                        
                        // Skip deleted nodes
                        if self.nodes.get(&nid).map(|n| n.deleted).unwrap_or(true) {
                            continue;
                        }
                        
                        let sim = self.similarity(nid, query, query_mag);
                        if sim > current_sim {
                            current_id = nid;
                            current_sim = sim;
                            changed = true;
                        }
                    }
                }
            }
            
            if !changed {
                break;
            }
        }
        
        (current_id, current_sim)
    }

    /// Beam search at a single level, returns ef nearest neighbors (sorted by similarity desc)
    fn search_layer(&self, entry_id: u32, target_id: u32, ef: usize, level: u8) -> Vec<(u32, f32)> {
        let target_node = self.nodes.get(&target_id).unwrap();
        let target_mag = target_node.get_magnitude();
        
        self.search_layer_internal(entry_id, &target_node.vector, target_mag, ef, level)
    }

    /// Beam search for a query vector at a single level
    fn search_layer_query(&self, entry_id: u32, query: &[f32], query_mag: f32, ef: usize, level: u8) -> Vec<(u32, f32)> {
        self.search_layer_internal(entry_id, query, query_mag, ef, level)
    }

    /// Internal beam search implementation
    fn search_layer_internal(&self, entry_id: u32, query: &[f32], query_mag: f32, ef: usize, level: u8) -> Vec<(u32, f32)> {
        let mut visited: HashSet<u32> = HashSet::new();
        
        // Candidates: max-heap by similarity (we want to explore highest similarity first)
        let mut candidates: BinaryHeap<ScoredItem<u32>> = BinaryHeap::new();
        
        // Results: min-heap by similarity (we want to keep top-k highest)
        let mut results: BinaryHeap<Reverse<ScoredItem<u32>>> = BinaryHeap::new();
        
        let entry_sim = self.similarity(entry_id, query, query_mag);
        
        visited.insert(entry_id);
        candidates.push(ScoredItem { score: entry_sim, item: entry_id });
        results.push(Reverse(ScoredItem { score: entry_sim, item: entry_id }));
        
        while let Some(ScoredItem { score: c_sim, item: c_id }) = candidates.pop() {
            // Get worst result similarity
            let worst_sim = results.peek().map(|r| r.0.score).unwrap_or(f32::NEG_INFINITY);
            
            // If current candidate is worse than worst result and we have enough, stop
            if c_sim < worst_sim && results.len() >= ef {
                break;
            }
            
            // Explore neighbors
            if let Some(node) = self.nodes.get(&c_id) {
                if (level as usize) < node.neighbors.len() {
                    for &neighbor_id in &node.neighbors[level as usize] {
                        if neighbor_id < 0 { continue; }
                        let nid = neighbor_id as u32;
                        
                        if visited.contains(&nid) { continue; }
                        visited.insert(nid);
                        
                        let n_sim = self.similarity(nid, query, query_mag);
                        
                        // Add to results if better than worst or not full
                        let worst = results.peek().map(|r| r.0.score).unwrap_or(f32::NEG_INFINITY);
                        if n_sim > worst || results.len() < ef {
                            candidates.push(ScoredItem { score: n_sim, item: nid });
                            results.push(Reverse(ScoredItem { score: n_sim, item: nid }));
                            
                            if results.len() > ef {
                                results.pop();
                            }
                        }
                    }
                }
            }
        }
        
        // Extract results sorted by similarity (descending)
        let mut result_vec: Vec<(u32, f32)> = results.into_iter()
            .map(|r| (r.0.item, r.0.score))
            .collect();
        result_vec.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        result_vec
    }

    /// Add a neighbor connection
    fn add_neighbor(&mut self, from_id: u32, to_id: u32, level: u8) {
        if let Some(node) = self.nodes.get_mut(&from_id) {
            // Ensure neighbors vec is large enough
            while node.neighbors.len() <= level as usize {
                node.neighbors.push(Vec::new());
            }
            
            // Don't add duplicates
            let to_signed = to_id as i32;
            if !node.neighbors[level as usize].contains(&to_signed) {
                node.neighbors[level as usize].push(to_signed);
            }
        }
    }

    /// Prune neighbors to maintain at most `max_neighbors` connections
    fn prune_neighbors(&mut self, node_id: u32, level: u8, max_neighbors: usize) {
        // Get node's vector first
        let (node_vec, node_mag) = {
            let node = match self.nodes.get(&node_id) {
                Some(n) => n,
                None => return,
            };
            if (level as usize) >= node.neighbors.len() {
                return;
            }
            if node.neighbors[level as usize].len() <= max_neighbors {
                return;
            }
            (node.vector.clone(), node.get_magnitude())
        };
        
        // Score all neighbors
        let neighbors: Vec<i32> = self.nodes.get(&node_id).unwrap()
            .neighbors[level as usize].clone();
        
        let mut scored: Vec<(i32, f32)> = neighbors.iter()
            .filter(|&&nid| nid >= 0)
            .map(|&nid| {
                let sim = self.similarity(nid as u32, &node_vec, node_mag);
                (nid, sim)
            })
            .collect();
        
        // Sort by similarity descending
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Keep top max_neighbors
        let pruned: Vec<i32> = scored.into_iter()
            .take(max_neighbors)
            .map(|(nid, _)| nid)
            .collect();
        
        if let Some(node) = self.nodes.get_mut(&node_id) {
            node.neighbors[level as usize] = pruned;
        }
    }

    /// Compute distance (lower = more similar for internal use)
    fn distance_to_node(&self, node_id: u32, query: &[f32], query_mag: f32) -> f32 {
        // Returns negative similarity so lower = better (for greedy descent)
        -self.similarity(node_id, query, query_mag)
    }

    /// Compute similarity (higher = more similar)
    fn similarity(&self, node_id: u32, query: &[f32], query_mag: f32) -> f32 {
        let node = match self.nodes.get(&node_id) {
            Some(n) => n,
            None => return f32::NEG_INFINITY,
        };
        
        match self.metric {
            Metric::Cosine => {
                cosine_similarity(&node.vector, query, Some(node.get_magnitude()), Some(query_mag))
            }
            Metric::Euclidean => {
                // For Euclidean, we return negative distance so higher = more similar
                -euclidean_distance_squared(&node.vector, query).sqrt()
            }
        }
    }
}

impl Default for Hnsw {
    fn default() -> Self {
        Self::new(16, 200, Metric::Cosine)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_level_distribution() {
        let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
        let mut levels = [0u32; 17];
        
        for _ in 0..10000 {
            let level = hnsw.select_level();
            levels[level as usize] += 1;
        }
        
        // Most should be level 0
        assert!(levels[0] > 5000, "Level 0 should be most common");
        // Higher levels should be less frequent
        assert!(levels[0] > levels[1]);
        assert!(levels[1] > levels[2] || levels[2] == 0);
    }
}
