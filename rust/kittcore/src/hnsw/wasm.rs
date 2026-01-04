use wasm_bindgen::prelude::*;
use crate::hnsw::index::{Hnsw, Metric};
use crate::hnsw::node::HnswNode;

#[wasm_bindgen]
pub struct HnswIndex {
    inner: Hnsw,
}

#[wasm_bindgen]
impl HnswIndex {
    #[wasm_bindgen(constructor)]
    pub fn new(m: usize, ef_construction: usize, metric_idx: u8) -> Self {
        let metric = match metric_idx {
            1 => Metric::Euclidean,
            _ => Metric::Cosine,
        };
        HnswIndex {
            inner: Hnsw::new(m, ef_construction, metric),
        }
    }

    #[wasm_bindgen]
    pub fn add_point(&mut self, id: u32, vector: Vec<f32>) -> Result<(), JsValue> {
        self.inner.add_point(id, vector)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn search(&self, query: Vec<f32>, k: usize) -> Result<Vec<u32>, JsValue> {
        // Return only IDs for now, or tuple?
        // WASM limitations on tuples.
        // We can return Uint32Array of IDs.
        let results = self.inner.search_knn(&query, k);
        let ids: Vec<u32> = results.into_iter().map(|(id, _)| id).collect();
        Ok(ids)
    }
    
    #[wasm_bindgen(js_name = searchWithScores)]
    pub fn search_with_scores(&self, query: Vec<f32>, k: usize) -> Result<JsValue, JsValue> {
         let results = self.inner.search_knn(&query, k);
         serde_wasm_bindgen::to_value(&results)
             .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn delete_point(&mut self, id: u32) {
        self.inner.delete_point(id);
    }

    #[wasm_bindgen]
    pub fn serialize(&self) -> Vec<u8> {
        self.inner.serialize()
    }

    #[wasm_bindgen]
    pub fn deserialize(bytes: &[u8]) -> Result<HnswIndex, JsValue> {
        let inner = Hnsw::deserialize(bytes)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(HnswIndex { inner })
    }
    
    #[wasm_bindgen]
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    // ========================================================================
    // Hybrid Quantized Methods
    // ========================================================================

    /// Add a point with both full-precision and quantized storage
    #[wasm_bindgen(js_name = addPointQuantized)]
    pub fn add_point_quantized(&mut self, id: u32, vector: Vec<f32>) -> Result<(), JsValue> {
        self.inner.add_point_quantized(id, vector)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Search using hybrid quantized approach
    #[wasm_bindgen(js_name = searchHybrid)]
    pub fn search_hybrid(&self, query: Vec<f32>, k: usize) -> Result<Vec<u32>, JsValue> {
        let results = self.inner.search_hybrid(&query, k);
        let ids: Vec<u32> = results.into_iter().map(|(id, _)| id).collect();
        Ok(ids)
    }

    /// Search hybrid with scores
    #[wasm_bindgen(js_name = searchHybridWithScores)]
    pub fn search_hybrid_with_scores(&self, query: Vec<f32>, k: usize) -> Result<JsValue, JsValue> {
        let results = self.inner.search_hybrid(&query, k);
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get memory usage statistics
    /// Returns { fullBytes: number, quantizedBytes: number, compressionRatio: number }
    #[wasm_bindgen(js_name = memoryUsage)]
    pub fn memory_usage(&self) -> Result<JsValue, JsValue> {
        let (full_bytes, quantized_bytes) = self.inner.memory_usage();
        let ratio = if quantized_bytes > 0 {
            full_bytes as f32 / quantized_bytes as f32
        } else {
            1.0
        };
        
        let stats = serde_json::json!({
            "fullBytes": full_bytes,
            "quantizedBytes": quantized_bytes,
            "compressionRatio": ratio
        });
        
        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // ========================================================================
    // Diversity Search (MMR)
    // ========================================================================

    /// Search with diversity using MMR (Maximal Marginal Relevance)
    /// 
    /// # Arguments
    /// * `query` - Query vector
    /// * `k` - Number of results to return
    /// * `lambda` - Balance factor: 0.0 = pure diversity, 0.5 = balanced, 1.0 = pure relevance
    /// 
    /// # Returns
    /// Uint32Array of IDs reranked for diversity
    #[wasm_bindgen(js_name = searchWithDiversity)]
    pub fn search_with_diversity(&self, query: Vec<f32>, k: usize, lambda: f32) -> Result<Vec<u32>, JsValue> {
        let results = self.inner.search_with_diversity(&query, k, lambda);
        let ids: Vec<u32> = results.into_iter().map(|(id, _)| id).collect();
        Ok(ids)
    }

    /// Search with diversity, returning scores
    /// 
    /// # Arguments
    /// * `query` - Query vector
    /// * `k` - Number of results to return
    /// * `lambda` - Balance factor: 0.0 = pure diversity, 0.5 = balanced, 1.0 = pure relevance
    /// 
    /// # Returns
    /// Array of [id, score] pairs reranked for diversity
    #[wasm_bindgen(js_name = searchWithDiversityScores)]
    pub fn search_with_diversity_scores(&self, query: Vec<f32>, k: usize, lambda: f32) -> Result<JsValue, JsValue> {
        let results = self.inner.search_with_diversity(&query, k, lambda);
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // ========================================================================
    // Two-Stage Retrieval (Binary Quantization)
    // ========================================================================

    /// Add a point with binary quantization for ultra-fast coarse filtering
    #[wasm_bindgen(js_name = addPointBinary)]
    pub fn add_point_binary(&mut self, id: u32, vector: Vec<f32>) -> Result<(), JsValue> {
        self.inner.add_point_binary(id, vector)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Two-stage search: binary coarse filter → exact rerank
    /// 
    /// # Arguments
    /// * `query` - Query vector
    /// * `k` - Number of results to return
    /// * `rerank_multiplier` - How many candidates to rerank (e.g., 10.0 = 10*k)
    #[wasm_bindgen(js_name = searchTwoStage)]
    pub fn search_two_stage(&self, query: Vec<f32>, k: usize, rerank_multiplier: f32) -> Result<Vec<u32>, JsValue> {
        let results = self.inner.search_two_stage(&query, k, rerank_multiplier);
        let ids: Vec<u32> = results.into_iter().map(|(id, _)| id).collect();
        Ok(ids)
    }

    /// Two-stage search with scores
    #[wasm_bindgen(js_name = searchTwoStageWithScores)]
    pub fn search_two_stage_with_scores(&self, query: Vec<f32>, k: usize, rerank_multiplier: f32) -> Result<JsValue, JsValue> {
        let results = self.inner.search_two_stage(&query, k, rerank_multiplier);
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get full memory usage statistics including binary index
    /// Returns { fullBytes, scalarQuantizedBytes, binaryQuantizedBytes }
    #[wasm_bindgen(js_name = memoryUsageFull)]
    pub fn memory_usage_full(&self) -> Result<JsValue, JsValue> {
        let (full, scalar, binary) = self.inner.memory_usage_full();
        
        let stats = serde_json::json!({
            "fullBytes": full,
            "scalarQuantizedBytes": scalar,
            "binaryQuantizedBytes": binary,
            "scalarCompressionRatio": if scalar > 0 { full as f32 / scalar as f32 } else { 1.0 },
            "binaryCompressionRatio": if binary > 0 { full as f32 / binary as f32 } else { 1.0 }
        });
        
        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // ========================================================================
    // Filtered Search
    // ========================================================================

    /// Search with a list of allowed IDs
    /// 
    /// The filter is specified as a list of allowed IDs. This is simpler for WASM
    /// than passing filter expressions - the JS side evaluates metadata conditions
    /// and passes the resulting allowed ID set.
    /// 
    /// # Arguments
    /// * `query` - Query vector
    /// * `k` - Number of results to return
    /// * `allowed_ids` - List of IDs that are allowed in results
    #[wasm_bindgen(js_name = searchFiltered)]
    pub fn search_filtered(&self, query: Vec<f32>, k: usize, allowed_ids: Vec<u32>) -> Result<Vec<u32>, JsValue> {
        use std::collections::HashSet;
        let allowed: HashSet<u32> = allowed_ids.into_iter().collect();
        
        let results = self.inner.search_knn_filtered(&query, k, |id| allowed.contains(&id));
        let ids: Vec<u32> = results.into_iter().map(|(id, _)| id).collect();
        Ok(ids)
    }

    /// Search with a list of allowed IDs, returning scores
    #[wasm_bindgen(js_name = searchFilteredWithScores)]
    pub fn search_filtered_with_scores(&self, query: Vec<f32>, k: usize, allowed_ids: Vec<u32>) -> Result<JsValue, JsValue> {
        use std::collections::HashSet;
        let allowed: HashSet<u32> = allowed_ids.into_iter().collect();
        
        let results = self.inner.search_knn_filtered(&query, k, |id| allowed.contains(&id));
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
