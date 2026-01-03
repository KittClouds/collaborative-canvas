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
}
