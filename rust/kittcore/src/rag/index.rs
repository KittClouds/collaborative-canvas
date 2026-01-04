//! Vector Index - HNSW-backed approximate nearest neighbor search
//!
//! Replaces brute-force O(N) with HNSW O(log N) search.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use crate::hnsw::index::{Hnsw, Metric, HnswError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub metadata: Option<Value>,
}

/// HNSW-backed vector index for RAG pipeline
pub struct VectorIndex {
    dimensions: usize,
    hnsw: Hnsw,
    // String ID -> u32 ID mapping
    id_to_numeric: HashMap<String, u32>,
    numeric_to_id: HashMap<u32, String>,
    // Metadata storage (keyed by numeric ID)
    metadata: HashMap<u32, Option<Value>>,
    next_id: u32,
}

impl VectorIndex {
    pub fn new(dimensions: usize) -> Self {
        VectorIndex {
            dimensions,
            hnsw: Hnsw::new(16, 100, Metric::Cosine),
            id_to_numeric: HashMap::new(),
            numeric_to_id: HashMap::new(),
            metadata: HashMap::new(),
            next_id: 0,
        }
    }

    /// Insert a vector with string ID
    pub fn insert(&mut self, id: &str, vector: Vec<f32>, meta: Option<Value>) -> Result<(), String> {
        if vector.len() != self.dimensions {
            return Err(format!(
                "Vector dimension mismatch: expected {}, got {}",
                self.dimensions,
                vector.len()
            ));
        }

        // If ID already exists, remove old entry first
        if self.id_to_numeric.contains_key(id) {
            self.remove(id);
        }

        let numeric_id = self.next_id;
        self.next_id += 1;

        // Add to HNSW
        self.hnsw
            .add_point(numeric_id, vector)
            .map_err(|e| e.to_string())?;

        // Store mappings
        self.id_to_numeric.insert(id.to_string(), numeric_id);
        self.numeric_to_id.insert(numeric_id, id.to_string());
        self.metadata.insert(numeric_id, meta);

        Ok(())
    }

    /// Search for k nearest neighbors
    pub fn search(&self, query_vector: &[f32], k: usize) -> Vec<SearchResult> {
        if query_vector.len() != self.dimensions {
            return Vec::new();
        }

        let hnsw_results = self.hnsw.search_knn(query_vector, k);

        hnsw_results
            .into_iter()
            .filter_map(|(numeric_id, score)| {
                let string_id = self.numeric_to_id.get(&numeric_id)?;
                let meta = self.metadata.get(&numeric_id).cloned().flatten();
                Some(SearchResult {
                    id: string_id.clone(),
                    score,
                    metadata: meta,
                })
            })
            .collect()
    }

    /// Search for k nearest neighbors with diversity (MMR reranking)
    /// 
    /// # Arguments
    /// * `query_vector` - Query embedding
    /// * `k` - Number of results to return  
    /// * `lambda` - Balance factor: 0.0 = pure diversity, 1.0 = pure relevance
    pub fn search_with_diversity(&self, query_vector: &[f32], k: usize, lambda: f32) -> Vec<SearchResult> {
        if query_vector.len() != self.dimensions {
            return Vec::new();
        }

        let hnsw_results = self.hnsw.search_with_diversity(query_vector, k, lambda);

        hnsw_results
            .into_iter()
            .filter_map(|(numeric_id, score)| {
                let string_id = self.numeric_to_id.get(&numeric_id)?;
                let meta = self.metadata.get(&numeric_id).cloned().flatten();
                Some(SearchResult {
                    id: string_id.clone(),
                    score,
                    metadata: meta,
                })
            })
            .collect()
    }

    /// Remove a vector by string ID (soft delete in HNSW)
    pub fn remove(&mut self, id: &str) {
        if let Some(numeric_id) = self.id_to_numeric.remove(id) {
            self.hnsw.delete_point(numeric_id);
            self.numeric_to_id.remove(&numeric_id);
            self.metadata.remove(&numeric_id);
        }
    }

    /// Number of vectors in the index
    pub fn len(&self) -> usize {
        self.id_to_numeric.len()
    }

    /// Check if index is empty
    pub fn is_empty(&self) -> bool {
        self.id_to_numeric.is_empty()
    }

    /// Get the vector for a specific ID
    pub fn get_vector(&self, id: &str) -> Option<Vec<f32>> {
        self.id_to_numeric.get(id)
            .and_then(|&numeric_id| self.hnsw.get_vector(numeric_id))
    }

    /// Clear the entire index
    pub fn clear(&mut self) {
        // Recreate HNSW (no bulk clear in current impl)
        self.hnsw = Hnsw::new(16, 100, Metric::Cosine);
        self.id_to_numeric.clear();
        self.numeric_to_id.clear();
        self.metadata.clear();
        self.next_id = 0;
    }

    /// Serialize index for persistence
    pub fn serialize(&self) -> Result<Vec<u8>, String> {
        // Serialize HNSW + metadata
        let hnsw_bytes = self.hnsw.serialize();

        let state = SerializedVectorIndex {
            dimensions: self.dimensions,
            hnsw_bytes,
            id_to_numeric: self.id_to_numeric.clone(),
            metadata: self.metadata.clone(),
            next_id: self.next_id,
        };

        serde_json::to_vec(&state).map_err(|e| e.to_string())
    }

    /// Deserialize index from persistence
    pub fn deserialize(bytes: &[u8]) -> Result<Self, String> {
        let state: SerializedVectorIndex =
            serde_json::from_slice(bytes).map_err(|e| e.to_string())?;

        let hnsw = Hnsw::deserialize(&state.hnsw_bytes).map_err(|e| e.to_string())?;

        // Rebuild reverse mapping
        let numeric_to_id: HashMap<u32, String> = state
            .id_to_numeric
            .iter()
            .map(|(k, v)| (*v, k.clone()))
            .collect();

        Ok(VectorIndex {
            dimensions: state.dimensions,
            hnsw,
            id_to_numeric: state.id_to_numeric,
            numeric_to_id,
            metadata: state.metadata,
            next_id: state.next_id,
        })
    }
}

#[derive(Serialize, Deserialize)]
struct SerializedVectorIndex {
    dimensions: usize,
    hnsw_bytes: Vec<u8>,
    id_to_numeric: HashMap<String, u32>,
    metadata: HashMap<u32, Option<Value>>,
    next_id: u32,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_insert_and_search() {
        let mut index = VectorIndex::new(3);

        index.insert("a", vec![1.0, 0.0, 0.0], None).unwrap();
        index.insert("b", vec![0.0, 1.0, 0.0], None).unwrap();
        index.insert("c", vec![0.0, 0.0, 1.0], None).unwrap();

        let results = index.search(&[1.0, 0.0, 0.0], 1);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "a");
    }

    #[test]
    fn test_remove() {
        let mut index = VectorIndex::new(3);

        index.insert("a", vec![1.0, 0.0, 0.0], None).unwrap();
        index.insert("b", vec![0.9, 0.1, 0.0], None).unwrap();

        index.remove("a");

        let results = index.search(&[1.0, 0.0, 0.0], 10);
        assert!(!results.iter().any(|r| r.id == "a"));
    }

    #[test]
    fn test_metadata_preserved() {
        let mut index = VectorIndex::new(3);

        let meta = serde_json::json!({"note_id": "123", "chunk": 0});
        index
            .insert("a", vec![1.0, 0.0, 0.0], Some(meta.clone()))
            .unwrap();

        let results = index.search(&[1.0, 0.0, 0.0], 1);
        assert_eq!(results[0].metadata, Some(meta));
    }

    #[test]
    fn test_upsert_behavior() {
        let mut index = VectorIndex::new(3);

        index.insert("a", vec![1.0, 0.0, 0.0], None).unwrap();
        // Insert same ID with different vector
        index.insert("a", vec![0.0, 1.0, 0.0], None).unwrap();

        let results = index.search(&[0.0, 1.0, 0.0], 1);
        assert_eq!(results[0].id, "a");
        assert!(results[0].score > 0.99); // Should match new vector
    }

    #[test]
    fn test_dimension_mismatch() {
        let mut index = VectorIndex::new(3);

        let result = index.insert("a", vec![1.0, 0.0], None);
        assert!(result.is_err());
    }

    #[test]
    fn test_hnsw_vs_brute_force_overlap() {
        // Create index with enough points to test approximate search
        let mut index = VectorIndex::new(8);
        let n = 100;

        // Deterministic pseudo-random
        let mut seed: u64 = 42;
        let mut rng = || {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            (seed >> 33) as f32 / (u32::MAX as f32) - 0.5
        };

        let mut vectors: Vec<(String, Vec<f32>)> = Vec::new();
        for i in 0..n {
            let v: Vec<f32> = (0..8).map(|_| rng()).collect();
            let id = format!("vec_{}", i);
            vectors.push((id.clone(), v.clone()));
            index.insert(&id, v, None).unwrap();
        }

        // Query
        let query: Vec<f32> = (0..8).map(|_| rng()).collect();

        // HNSW results
        let hnsw_results = index.search(&query, 10);
        let hnsw_ids: std::collections::HashSet<_> =
            hnsw_results.iter().map(|r| r.id.clone()).collect();

        // Brute force
        let mut brute: Vec<(String, f32)> = vectors
            .iter()
            .map(|(id, v)| (id.clone(), cosine_sim(&query, v)))
            .collect();
        brute.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let brute_ids: std::collections::HashSet<_> =
            brute.iter().take(10).map(|(id, _)| id.clone()).collect();

        // Assert high overlap
        let overlap = hnsw_ids.intersection(&brute_ids).count();
        assert!(
            overlap >= 8,
            "Expected overlap >= 8, got {}. HNSW: {:?}, Brute: {:?}",
            overlap,
            hnsw_ids,
            brute_ids
        );
    }

    fn cosine_sim(a: &[f32], b: &[f32]) -> f32 {
        let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
        let mag_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let mag_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        if mag_a == 0.0 || mag_b == 0.0 {
            0.0
        } else {
            dot / (mag_a * mag_b)
        }
    }
}
