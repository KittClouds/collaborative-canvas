//! RAG Pipeline Orchestrator
//!
//! Coordinates chunking, embedding, and indexing for RAG search.
//! Exposed via WASM for TypeScript consumption.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::embeddings::EmbedCortex;
use crate::resorank::{
    ResoRankScorer, CorpusStatistics, ResoRankConfig, ProximityStrategy,
    DocumentMetadata as ResoDocMeta, TokenMetadata, FieldOccurrence,
};
use super::chunker::{RagChunker, Chunk};
use super::index::{VectorIndex, SearchResult as IndexSearchResult};
use super::raptor::{RaptorTree, RaptorPayload, RaptorSearchResult};

/// Note input for indexing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteInput {
    pub id: String,
    pub title: String,
    pub content: String,
}

/// Chunk metadata stored in index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMeta {
    pub note_id: String,
    pub note_title: String,
    pub chunk_index: usize,
    pub start: usize,
    pub end: usize,
}

/// Search result returned to TypeScript
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagSearchResult {
    pub note_id: String,
    pub note_title: String,
    pub chunk_text: String,
    pub score: f32,
    pub chunk_index: usize,
}

/// RAG Pipeline - Main orchestrator
///
/// # Example (TypeScript)
/// ```typescript
/// const rag = new RagPipeline();
/// await rag.loadModel(onnxBytes, tokenizerJson);
/// rag.indexNote({ id: "1", title: "My Note", content: "..." });
/// const results = rag.search("query", 10);
/// ```
#[wasm_bindgen]
pub struct RagPipeline {
    /// Embedding engine
    embed_cortex: Option<EmbedCortex>,
    /// Text chunker
    chunker: RagChunker,
    /// Vector index (HNSW)
    index: VectorIndex,
    /// ResoRank scorer (BM25F)
    resorank: Option<ResoRankScorer>,
    /// Chunk text storage (chunk_id -> text)
    chunk_texts: HashMap<String, String>,
    /// Chunk metadata storage (chunk_id -> meta)
    chunk_metas: HashMap<String, ChunkMeta>,
    /// Model dimensions
    dimensions: usize,
    /// Whether model is loaded
    model_loaded: bool,
    /// Word frequency for IDF calculation
    word_doc_freq: HashMap<String, usize>,
    /// Total documents indexed
    total_docs: usize,
    /// RAPTOR hierarchical tree (optional)
    raptor_tree: Option<RaptorTree>,
}

#[wasm_bindgen]
impl RagPipeline {
    /// Create a new RAG pipeline
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            embed_cortex: None,
            chunker: RagChunker::default(),
            index: VectorIndex::new(384), // Default BGE-small dimensions
            resorank: None,
            chunk_texts: HashMap::new(),
            chunk_metas: HashMap::new(),
            dimensions: 384,
            model_loaded: false,
            word_doc_freq: HashMap::new(),
            total_docs: 0,
            raptor_tree: None,
        }
    }

    /// Load embedding model
    ///
    /// # Arguments
    /// * `model_bytes` - ONNX model bytes
    /// * `tokenizer_json` - Tokenizer JSON string
    #[wasm_bindgen(js_name = loadModel)]
    pub fn load_model(&mut self, model_bytes: &[u8], tokenizer_json: &str) -> Result<(), JsValue> {
        let mut cortex = EmbedCortex::new();
        cortex.load_model(model_bytes, tokenizer_json)?;
        
        self.dimensions = cortex.get_dimensions() as usize;
        self.index = VectorIndex::new(self.dimensions);
        self.embed_cortex = Some(cortex);
        self.model_loaded = true;

        web_sys::console::log_1(&format!(
            "[RagPipeline] Model loaded ({}d)",
            self.dimensions
        ).into());

        Ok(())
    }

    /// Check if model is loaded
    #[wasm_bindgen(js_name = isModelLoaded)]
    pub fn is_model_loaded(&self) -> bool {
        self.model_loaded
    }

    /// Get model dimensions
    #[wasm_bindgen(js_name = getDimensions)]
    pub fn get_dimensions(&self) -> usize {
        self.dimensions
    }

    /// Set dimensions for external embedding mode (TypeScript models)
    /// 
    /// Use this when embeddings are generated on the TypeScript side
    /// (e.g., MDBR Leaf via Transformers.js) and passed directly to Rust.
    /// This reconfigures the HNSW index without loading a Rust model.
    #[wasm_bindgen(js_name = setDimensions)]
    pub fn set_dimensions(&mut self, dims: u32) {
        let dims = dims as usize;
        if dims != self.dimensions {
            self.dimensions = dims;
            self.index = VectorIndex::new(dims);
            
            web_sys::console::log_1(&format!(
                "[RagPipeline] Dimensions set to {} (external embedding mode)",
                dims
            ).into());
        }
    }

    /// Check if using external embedding mode (no Rust model loaded)
    #[wasm_bindgen(js_name = isExternalEmbedding)]
    pub fn is_external_embedding(&self) -> bool {
        self.embed_cortex.is_none() && self.dimensions > 0
    }

    /// Index a single note
    ///
    /// Chunks the note, embeds each chunk, and adds to index.
    #[wasm_bindgen(js_name = indexNote)]
    pub fn index_note(&mut self, note: JsValue) -> Result<usize, JsValue> {
        let note: NoteInput = serde_wasm_bindgen::from_value(note)
            .map_err(|e| JsValue::from_str(&format!("Invalid note input: {}", e)))?;

        self.index_note_internal(&note)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Index multiple notes (batch)
    #[wasm_bindgen(js_name = indexNotes)]
    pub fn index_notes(&mut self, notes: JsValue) -> Result<usize, JsValue> {
        let notes: Vec<NoteInput> = serde_wasm_bindgen::from_value(notes)
            .map_err(|e| JsValue::from_str(&format!("Invalid notes input: {}", e)))?;

        self.index_notes_internal(notes)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Internal batch indexing logic (testable)
    fn index_notes_internal(&mut self, notes: Vec<NoteInput>) -> Result<usize, String> {
        let note_count = notes.len();
        
        // 1. Collect ALL chunks to be indexed
        struct PendingChunk {
            id: String,
            text_to_embed: String,
            chunk: Chunk,
            note: NoteInput,
        }
        
        let mut pending_chunks: Vec<PendingChunk> = Vec::new();

        // Prepare chunks
        for note in &notes {
            // Remove existing chunks for this note first
            self.remove_note(&note.id);
            
            let chunks = self.chunker.chunk(&note.content);
            for chunk in chunks {
                let chunk_id = format!("{}_{}", note.id, chunk.index);
                let text_to_embed = format!("{}\n---\n{}", note.title, chunk.text);
                
                pending_chunks.push(PendingChunk {
                    id: chunk_id,
                    text_to_embed,
                    chunk,
                    note: note.clone(),
                });
            }
        }
        
        let total_chunks = pending_chunks.len();
        
        // Initialize ResoRank if needed
        if !pending_chunks.is_empty() && self.resorank.is_none() {
            let corpus_stats = CorpusStatistics::default();
            self.resorank = Some(ResoRankScorer::with_defaults(corpus_stats));
        }

        // 2. Process in batches
        const BATCH_SIZE: usize = 32;
        
        for batch in pending_chunks.chunks(BATCH_SIZE) {
            let texts: Vec<String> = batch.iter().map(|p| p.text_to_embed.clone()).collect();
            
            // Get embeddings for the batch
            let embeddings = {
                let cortex = self.embed_cortex.as_ref()
                    .ok_or("Model not loaded")?;
                cortex.embed_batch(&texts)
                    .map_err(|e| format!("Batch embed failed: {}", e))?
            };
            
            // Insert embeddings
            for (i, embedding) in embeddings.into_iter().enumerate() {
                let item = &batch[i];
                let meta = ChunkMeta {
                    note_id: item.note.id.clone(),
                    note_title: item.note.title.clone(),
                    chunk_index: item.chunk.index,
                    start: item.chunk.start,
                    end: item.chunk.end,
                };
                
                // Vector Index Insert
                self.index.insert(
                    &item.id,
                    embedding,
                    Some(serde_json::to_value(&meta).unwrap()),
                ).map_err(|e| format!("Index insert failed: {}", e))?;
                
                // Storage Insert
                self.chunk_texts.insert(item.id.clone(), item.chunk.text.clone());
                self.chunk_metas.insert(item.id.clone(), meta);
                
                // ResoRank Insert
                let tokens = Self::tokenize_static(&item.text_to_embed);
                let token_metadata = Self::tokens_to_metadata(&tokens, &mut self.word_doc_freq);
                let doc_meta = Self::create_doc_metadata_static(&tokens);
                
                if let Some(ref mut rr) = self.resorank {
                    rr.index_document(&item.id, doc_meta, token_metadata, true);
                }
            }
        }
        
        self.total_docs += total_chunks;

        // Logging handled by caller or simple println if needed, 
        // avoiding web_sys in internal method ensures testability
        
        Ok(total_chunks)
    }

    /// Insert a pre-computed chunk for hydration from persistence
    ///
    /// # Arguments
    /// * `chunk` - JsValue containing { id, note_id, chunk_index, text, embedding, note_title, start, end }
    #[wasm_bindgen(js_name = insertChunk)]
    pub fn insert_chunk(&mut self, chunk: JsValue) -> Result<(), JsValue> {
        #[derive(Deserialize)]
        struct ChunkData {
            id: String,
            note_id: String,
            chunk_index: usize,
            text: String,
            embedding: Vec<f32>,
            note_title: String,
            start: usize,
            end: usize,
        }
        
        let data: ChunkData = serde_wasm_bindgen::from_value(chunk)
            .map_err(|e| JsValue::from_str(&format!("Invalid chunk data: {}", e)))?;
        
        let meta = ChunkMeta {
            note_id: data.note_id.clone(),
            note_title: data.note_title.clone(),
            chunk_index: data.chunk_index,
            start: data.start,
            end: data.end,
        };
        
        // Insert into vector index
        self.index.insert(
            &data.id,
            data.embedding,
            Some(serde_json::to_value(&meta).unwrap()),
        ).map_err(|e| JsValue::from_str(&format!("Index insert failed: {}", e)))?;
        
        // Insert into text storage
        self.chunk_texts.insert(data.id.clone(), data.text);
        self.chunk_metas.insert(data.id, meta);
        
        self.total_docs += 1;
        
        Ok(())
    }

    /// Get all indexed chunks for persistence
    ///
    /// Returns an array of { id, note_id, chunk_index, text, embedding, note_title, start, end }
    #[wasm_bindgen(js_name = getChunks)]
    pub fn get_chunks(&self) -> Result<JsValue, JsValue> {
        #[derive(Serialize)]
        struct ExportedChunk {
            id: String,
            note_id: String,
            chunk_index: usize,
            text: String,
            embedding: Vec<f32>,
            note_title: String,
            start: usize,
            end: usize,
        }
        
        let mut chunks: Vec<ExportedChunk> = Vec::new();
        
        for (id, meta) in &self.chunk_metas {
            let text = self.chunk_texts.get(id).cloned().unwrap_or_default();
            
            // Get embedding from index
            // Note: VectorIndex doesn't have a direct get_vector method,
            // so we'll do a 1-NN search with the vector ID to retrieve it.
            // This is a workaround until we add proper getVector to VectorIndex.
            if let Some(embedding) = self.index.get_vector(id) {
                chunks.push(ExportedChunk {
                    id: id.clone(),
                    note_id: meta.note_id.clone(),
                    chunk_index: meta.chunk_index,
                    text,
                    embedding,
                    note_title: meta.note_title.clone(),
                    start: meta.start,
                    end: meta.end,
                });
            }
        }
        
        serde_wasm_bindgen::to_value(&chunks)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Search for similar content
    ///
    /// # Arguments
    /// * `query` - Search query text
    /// * `k` - Number of results to return
    #[wasm_bindgen]
    pub fn search(&self, query: &str, k: usize) -> Result<JsValue, JsValue> {
        let cortex = self.embed_cortex.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;

        // Embed query
        let query_vec = cortex.embed_text(query)?;

        // Search index
        let results = self.index.search(&query_vec, k);

        // Convert to RagSearchResult
        let rag_results: Vec<RagSearchResult> = results
            .into_iter()
            .filter_map(|r| {
                let meta = self.chunk_metas.get(&r.id)?;
                let text = self.chunk_texts.get(&r.id)?;
                
                Some(RagSearchResult {
                    note_id: meta.note_id.clone(),
                    note_title: meta.note_title.clone(),
                    chunk_text: text.clone(),
                    score: r.score,
                    chunk_index: meta.chunk_index,
                })
            })
            .collect();

        serde_wasm_bindgen::to_value(&rag_results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Embed text (helper for worker/RAPTOR)
    #[wasm_bindgen]
    pub fn embed(&self, text: &str) -> Result<Vec<f32>, JsValue> {
        let cortex = self.embed_cortex.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;
        cortex.embed_text(text)
    }

    /// Search with diversity using MMR (Maximal Marginal Relevance)
    ///
    /// Returns results reranked to balance relevance and diversity.
    /// This is ideal for RAG to avoid redundant context.
    ///
    /// # Arguments
    /// * `query` - Search query text
    /// * `k` - Number of results to return
    /// * `lambda` - Balance factor: 0.0 = pure diversity, 0.5 = balanced, 1.0 = pure relevance
    #[wasm_bindgen(js_name = searchWithDiversity)]
    pub fn search_with_diversity(&self, query: &str, k: usize, lambda: f32) -> Result<JsValue, JsValue> {
        let cortex = self.embed_cortex.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;

        // Embed query
        let query_vec = cortex.embed_text(query)?;

        // Search with diversity (MMR reranking)
        let results = self.index.search_with_diversity(&query_vec, k, lambda);

        // Convert to RagSearchResult
        let rag_results: Vec<RagSearchResult> = results
            .into_iter()
            .filter_map(|r| {
                let meta = self.chunk_metas.get(&r.id)?;
                let text = self.chunk_texts.get(&r.id)?;
                
                Some(RagSearchResult {
                    note_id: meta.note_id.clone(),
                    note_title: meta.note_title.clone(),
                    chunk_text: text.clone(),
                    score: r.score,
                    chunk_index: meta.chunk_index,
                })
            })
            .collect();

        serde_wasm_bindgen::to_value(&rag_results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }


    /// Hybrid search combining vector (HNSW) and lexical (BM25)
    ///
    /// # Arguments
    /// * `query` - Search query text
    /// * `k` - Number of results to return
    /// * `vector_weight` - Weight for vector search (0.0 = pure lexical, 1.0 = pure vector)
    #[wasm_bindgen(js_name = searchHybrid)]
    pub fn search_hybrid(&mut self, query: &str, k: usize, vector_weight: f32) -> Result<JsValue, JsValue> {
        let cortex = self.embed_cortex.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;

        let lexical_weight = (1.0 - vector_weight).max(0.0).min(1.0);
        let vector_weight = vector_weight.max(0.0).min(1.0);

        // 1. Vector search (HNSW)
        let query_vec = cortex.embed_text(query)?;
        let vector_results = self.index.search(&query_vec, k * 3);

        // 2. Lexical search (ResoRank BM25)
        let query_tokens: Vec<String> = self.tokenize(query);
        let lexical_results = if let Some(ref mut rr) = self.resorank {
            rr.search(&query_tokens, k * 3)
        } else {
            Vec::new()
        };

        // 3. Normalize and fuse scores
        let mut scores: HashMap<String, (f32, f32)> = HashMap::new();

        // Normalize vector scores
        let v_max = vector_results.iter().map(|r| r.score).fold(0.0f32, f32::max);
        for r in &vector_results {
            let norm = if v_max > 0.0 { r.score / v_max } else { 0.0 };
            scores.entry(r.id.clone()).or_insert((0.0, 0.0)).0 = norm;
        }

        // Normalize lexical scores
        let l_max = lexical_results.iter().map(|r| r.score).fold(0.0f32, f32::max);
        for r in &lexical_results {
            let norm = if l_max > 0.0 { r.score / l_max } else { 0.0 };
            scores.entry(r.doc_id.clone()).or_insert((0.0, 0.0)).1 = norm;
        }

        // Weighted fusion
        let mut fused: Vec<(String, f32)> = scores
            .into_iter()
            .map(|(id, (v, l))| (id, v * vector_weight + l * lexical_weight))
            .collect();
        
        fused.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        fused.truncate(k);

        // Convert to RagSearchResult
        let rag_results: Vec<RagSearchResult> = fused
            .into_iter()
            .filter_map(|(chunk_id, score)| {
                let meta = self.chunk_metas.get(&chunk_id)?;
                let text = self.chunk_texts.get(&chunk_id)?;
                
                Some(RagSearchResult {
                    note_id: meta.note_id.clone(),
                    note_title: meta.note_title.clone(),
                    chunk_text: text.clone(),
                    score,
                    chunk_index: meta.chunk_index,
                })
            })
            .collect();

        serde_wasm_bindgen::to_value(&rag_results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Remove a note from the index
    #[wasm_bindgen(js_name = removeNote)]
    pub fn remove_note(&mut self, note_id: &str) -> usize {
        // Find all chunks for this note
        let chunk_ids: Vec<String> = self.chunk_metas
            .iter()
            .filter(|(_, meta)| meta.note_id == note_id)
            .map(|(id, _)| id.clone())
            .collect();

        let count = chunk_ids.len();

        // Remove from all storages
        for chunk_id in &chunk_ids {
            self.index.remove(chunk_id);
            self.chunk_texts.remove(chunk_id);
            self.chunk_metas.remove(chunk_id);
            
            // Remove from ResoRank
            if let Some(ref mut rr) = self.resorank {
                rr.remove_document(chunk_id);
            }
        }

        count
    }

    /// Get index statistics
    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self) -> JsValue {
        let stats = serde_json::json!({
            "total_chunks": self.index.len(),
            "dimensions": self.dimensions,
            "model_loaded": self.model_loaded,
            "resorank_ready": self.resorank.is_some(),
        });

        serde_wasm_bindgen::to_value(&stats).unwrap_or(JsValue::NULL)
    }

    /// Clear the entire index
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.index.clear();
        self.chunk_texts.clear();
        self.chunk_metas.clear();
        self.word_doc_freq.clear();
        self.total_docs = 0;
        self.resorank = None;
    }

    /// Serialize index for persistence
    #[wasm_bindgen]
    pub fn serialize(&self) -> Result<Vec<u8>, JsValue> {
        // Serialize everything needed to restore
        let data = serde_json::json!({
            "dimensions": self.dimensions,
            "index": self.index.serialize().map_err(|e| JsValue::from_str(&e))?,
            "texts": self.chunk_texts,
            "metas": self.chunk_metas,
        });

        serde_json::to_vec(&data)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Deserialize index from persistence
    #[wasm_bindgen]
    pub fn deserialize(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        let data: serde_json::Value = serde_json::from_slice(bytes)
            .map_err(|e| JsValue::from_str(&format!("Deserialization failed: {}", e)))?;

        self.dimensions = data["dimensions"].as_u64().unwrap_or(384) as usize;
        
        if let Some(index_bytes) = data["index"].as_array() {
            let index_bytes: Vec<u8> = index_bytes
                .iter()
                .filter_map(|v| v.as_u64().map(|n| n as u8))
                .collect();
            
            self.index = VectorIndex::deserialize(&index_bytes)
                .map_err(|e| JsValue::from_str(&e))?;
        }

        if let Some(texts) = data["texts"].as_object() {
            self.chunk_texts = texts
                .iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect();
        }

        if let Some(metas) = data["metas"].as_object() {
            self.chunk_metas = metas
                .iter()
                .filter_map(|(k, v)| {
                    serde_json::from_value(v.clone()).ok().map(|m| (k.clone(), m))
                })
                .collect();
        }

        Ok(())
    }

    // ========================================================================
    // RAPTOR Hierarchical Retrieval
    // ========================================================================

    /// Build RAPTOR tree from indexed chunks
    ///
    /// # Arguments
    /// * `target_cluster_size` - Target children per internal node (default: 10)
    #[wasm_bindgen(js_name = buildRaptorTree)]
    pub fn build_raptor_tree(&mut self, target_cluster_size: usize) -> Result<JsValue, JsValue> {
        if self.chunk_metas.is_empty() {
            return Err(JsValue::from_str("No chunks indexed. Index notes first."));
        }

        // Collect chunks with embeddings
        let mut chunks_with_embeddings: Vec<(String, Vec<f32>, RaptorPayload)> = Vec::new();

        for (chunk_id, meta) in &self.chunk_metas {
            let Some(embedding) = self.index.get_vector(chunk_id) else {
                continue;
            };
            let text = self.chunk_texts.get(chunk_id).cloned().unwrap_or_default();

            chunks_with_embeddings.push((
                chunk_id.clone(),
                embedding,
                RaptorPayload {
                    chunk_id: chunk_id.clone(),
                    note_id: meta.note_id.clone(),
                    text,
                    start: meta.start,
                    end: meta.end,
                },
            ));
        }

        if chunks_with_embeddings.is_empty() {
            return Err(JsValue::from_str("No chunk embeddings found"));
        }

        let target = if target_cluster_size == 0 { 10 } else { target_cluster_size };

        let tree = RaptorTree::build_from_chunks(chunks_with_embeddings, target)
            .map_err(|e| JsValue::from_str(&format!("RAPTOR build failed: {}", e)))?;

        let stats = serde_json::json!({
            "nodes": tree.len(),
            "levels": tree.level_count(),
            "leaves": tree.leaves().len(),
        });

        self.raptor_tree = Some(tree);

        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Check if RAPTOR tree is built
    #[wasm_bindgen(js_name = hasRaptorTree)]
    pub fn has_raptor_tree(&self) -> bool {
        self.raptor_tree.is_some()
    }

    /// Search using RAPTOR hierarchical retrieval
    ///
    /// # Arguments
    /// * `query_embedding` - Query embedding vector
    /// * `k` - Number of results
    /// * `mode` - "collapsed", "traversal", or "hybrid"
    /// * `beam_width` - Beam width for traversal/hybrid (default: 10)
    #[wasm_bindgen(js_name = searchRaptor)]
    pub fn search_raptor(
        &self,
        query_embedding: Vec<f32>,
        k: usize,
        mode: &str,
        beam_width: usize,
    ) -> Result<JsValue, JsValue> {
        let tree = self.raptor_tree.as_ref()
            .ok_or_else(|| JsValue::from_str("RAPTOR tree not built. Call buildRaptorTree first."))?;

        let beam = if beam_width == 0 { 10 } else { beam_width };

        let results: Vec<RaptorSearchResult> = match mode {
            "collapsed" => tree.search_collapsed(&query_embedding, k),
            "traversal" => tree.search_traversal(&query_embedding, k, beam),
            "hybrid" => tree.search_hybrid(&query_embedding, k, beam),
            "collapsed_leaves" => tree.search_collapsed_leaves_only(&query_embedding, k),
            _ => tree.search_hybrid(&query_embedding, k, beam), // Default to hybrid
        };

        // Convert to JS-friendly format
        #[derive(Serialize)]
        struct JsRaptorResult {
            node_id: String,
            level: u8,
            score: f32,
            is_leaf: bool,
            note_id: Option<String>,
            chunk_text: Option<String>,
        }

        let js_results: Vec<JsRaptorResult> = results
            .into_iter()
            .map(|r| JsRaptorResult {
                node_id: r.node_id,
                level: r.level,
                score: r.score,
                is_leaf: r.is_leaf,
                note_id: r.payload.as_ref().map(|p| p.note_id.clone()),
                chunk_text: r.payload.as_ref().map(|p| p.text.clone()),
            })
            .collect();

        serde_wasm_bindgen::to_value(&js_results)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Get RAPTOR tree statistics
    #[wasm_bindgen(js_name = getRaptorStats)]
    pub fn get_raptor_stats(&self) -> Result<JsValue, JsValue> {
        let tree = self.raptor_tree.as_ref()
            .ok_or_else(|| JsValue::from_str("RAPTOR tree not built"))?;

        let stats = serde_json::json!({
            "nodes": tree.len(),
            "levels": tree.level_count(),
            "leaves": tree.leaves().len(),
        });

        serde_wasm_bindgen::to_value(&stats)
            .map_err(|e| JsValue::from_str(&format!("Serialization failed: {}", e)))
    }

    /// Clear RAPTOR tree
    #[wasm_bindgen(js_name = clearRaptorTree)]
    pub fn clear_raptor_tree(&mut self) {
        self.raptor_tree = None;
    }
}

// Internal methods (not exposed to WASM)
impl RagPipeline {
    /// Internal note indexing logic - OPTIMIZED
    /// 
    /// Optimizations:
    /// 1. Batch embedding: All chunks embedded in one ONNX call
    /// 2. No console logging in hot path
    /// 3. Timing spans for diagnostics
    /// 4. Deferred ResoRank indexing (after vector inserts)
    fn index_note_internal(&mut self, note: &NoteInput) -> Result<usize, String> {
        // Skip empty content
        if note.content.trim().is_empty() {
            return Ok(0);
        }

        // Start timing
        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_with_label("rag_index_note");

        // Remove existing chunks for this note
        self.remove_note(&note.id);

        // Initialize ResoRank if not already
        if self.resorank.is_none() {
            let corpus_stats = CorpusStatistics::default();
            self.resorank = Some(ResoRankScorer::with_defaults(corpus_stats));
        }

        // Get cortex reference
        let cortex = self.embed_cortex.as_ref()
            .ok_or("Model not loaded")?;

        // === Phase 1: Chunking ===
        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_with_label("rag_chunking");
        
        let chunks = self.chunker.chunk(&note.content);
        
        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_end_with_label("rag_chunking");

        if chunks.is_empty() {
            #[cfg(target_arch = "wasm32")]
            web_sys::console::time_end_with_label("rag_index_note");
            return Ok(0);
        }

        // === Phase 2: Batch Embedding (single ONNX call) ===
        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_with_label("rag_embed_batch");

        // Prepare all texts for batch embedding
        let texts_to_embed: Vec<String> = chunks.iter()
            .map(|c| format!("{}\n---\n{}", note.title, c.text))
            .collect();

        // Single batch embed call instead of N individual calls
        let embeddings = cortex.embed_batch(&texts_to_embed)
            .map_err(|e| format!("Batch embedding failed: {}", e))?;

        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_end_with_label("rag_embed_batch");

        // === Phase 3: Vector Index Insertion ===
        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_with_label("rag_vector_insert");

        // Collect chunk IDs and texts for deferred ResoRank indexing
        let mut resorank_queue: Vec<(String, String)> = Vec::with_capacity(chunks.len());

        for (i, (chunk, embedding)) in chunks.iter().zip(embeddings.into_iter()).enumerate() {
            let chunk_id = format!("{}_{}", note.id, chunk.index);

            let meta = ChunkMeta {
                note_id: note.id.clone(),
                note_title: note.title.clone(),
                chunk_index: chunk.index,
                start: chunk.start,
                end: chunk.end,
            };

            // Vector index insert
            self.index.insert(
                &chunk_id,
                embedding,
                Some(serde_json::to_value(&meta).unwrap()),
            ).map_err(|e| format!("Index insert failed: {}", e))?;

            // Store text and meta
            self.chunk_texts.insert(chunk_id.clone(), chunk.text.clone());
            self.chunk_metas.insert(chunk_id.clone(), meta);

            // Queue for ResoRank (deferred)
            resorank_queue.push((chunk_id, texts_to_embed[i].clone()));
        }

        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_end_with_label("rag_vector_insert");

        // === Phase 4: Deferred ResoRank Indexing ===
        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_with_label("rag_resorank");

        for (chunk_id, text) in resorank_queue {
            let tokens = Self::tokenize_static(&text);
            let token_metadata = Self::tokens_to_metadata(&tokens, &mut self.word_doc_freq);
            let doc_meta = Self::create_doc_metadata_static(&tokens);
            
            if let Some(ref mut rr) = self.resorank {
                rr.index_document(&chunk_id, doc_meta, token_metadata, true);
            }
        }

        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_end_with_label("rag_resorank");

        self.total_docs += chunks.len();

        #[cfg(target_arch = "wasm32")]
        web_sys::console::time_end_with_label("rag_index_note");

        Ok(chunks.len())
    }
    
    /// Simple whitespace tokenizer (static)
    fn tokenize_static(text: &str) -> Vec<String> {
        text.to_lowercase()
            .split(|c: char| !c.is_alphanumeric())
            .filter(|s| s.len() >= 2)
            .map(|s| s.to_string())
            .collect()
    }
    
    /// Instance tokenizer (convenience wrapper)
    fn tokenize(&self, text: &str) -> Vec<String> {
        Self::tokenize_static(text)
    }
    
    /// Convert tokens to TokenMetadata (static to avoid borrow issues)
    fn tokens_to_metadata(
        tokens: &[String],
        word_doc_freq: &mut HashMap<String, usize>,
    ) -> HashMap<String, TokenMetadata> {
        let mut result: HashMap<String, TokenMetadata> = HashMap::new();
        
        // Count term frequency
        let mut tf_map: HashMap<String, u32> = HashMap::new();
        for token in tokens {
            // Track document frequency only on first occurrence
            if !tf_map.contains_key(token) {
                *word_doc_freq.entry(token.clone()).or_insert(0) += 1;
            }
            *tf_map.entry(token.clone()).or_insert(0) += 1;
        }
        
        let field_length = tokens.len() as u32;
        
        for (term, tf) in tf_map {
            let doc_freq = *word_doc_freq.get(&term).unwrap_or(&1);
            let mut meta = TokenMetadata::new(doc_freq);
            
            // Use field 1 (content)
            meta.add_field_occurrence(1, tf, field_length);
            
            // Simple segment mask (first 8 segments)
            let segment = ((tf as usize * 8) / tokens.len().max(1)).min(7) as u32;
            meta.set_segment_mask(1 << segment);
            
            result.insert(term, meta);
        }
        
        result
    }
    
    /// Create document metadata (static)
    fn create_doc_metadata_static(tokens: &[String]) -> ResoDocMeta {
        let mut meta = ResoDocMeta::new();
        meta.set_field_length(1, tokens.len() as u32);
        meta
    }
}

impl Default for RagPipeline {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_static() {
        let tokens = RagPipeline::tokenize_static("Hello World! This is a test.");
        assert!(tokens.contains(&"hello".to_string()));
        assert!(tokens.contains(&"world".to_string()));
        assert!(tokens.contains(&"this".to_string()));
        assert!(tokens.contains(&"test".to_string()));
        // Single char tokens filtered
        assert!(!tokens.contains(&"a".to_string()));
    }

    #[test]
    fn test_tokens_to_metadata() {
        let tokens = vec!["foo".to_string(), "bar".to_string(), "foo".to_string()];
        let mut word_freq: HashMap<String, usize> = HashMap::new();
        
        let metadata = RagPipeline::tokens_to_metadata(&tokens, &mut word_freq);
        
        assert_eq!(metadata.len(), 2); // foo and bar
        assert_eq!(word_freq.get("foo"), Some(&1));
        assert_eq!(word_freq.get("bar"), Some(&1));
        
        // foo has tf=2, bar has tf=1
        let foo_meta = metadata.get("foo").unwrap();
        let bar_meta = metadata.get("bar").unwrap();
        assert_eq!(foo_meta.field_occurrences.get(&1).unwrap().tf, 2);
        assert_eq!(bar_meta.field_occurrences.get(&1).unwrap().tf, 1);
    }

    #[test]
    fn test_resorank_initialization() {
        let mut pipeline = RagPipeline::new();
        assert!(pipeline.resorank.is_none());
        
        // Initialize corpus stats for resorank
        pipeline.resorank = Some(ResoRankScorer::with_defaults(CorpusStatistics::default()));
        assert!(pipeline.resorank.is_some());
    }
    #[test]
    fn test_batch_indexing_no_model() {
        let mut pipeline = RagPipeline::new();
        // Create 40 notes to exceed standard batch size of 32
        let notes: Vec<NoteInput> = (0..40).map(|i| NoteInput {
            id: i.to_string(),
            title: format!("Note {}", i),
            content: "Some content".to_string(),
        }).collect();
        
        // Pass Vec<NoteInput> directly to internal method
        let result = pipeline.index_notes_internal(notes);
        
        assert!(result.is_err(), "Expected error but got success");
        let err_msg = result.err().unwrap();
        assert!(err_msg.contains("Model not loaded"));
    }
}


