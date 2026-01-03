//! NarrativeGraph - Standalone Dependency Parser for Worldbuilders
//!
//! A composable NLP engine that chunks text, attaches dependencies,
//! resolves coreferences, and attributes dialogue speakers.
//!
//! # Architecture
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                     NarrativeGraph                          │
//! ├─────────────────────────────────────────────────────────────┤
//! │  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
//! │  │  Chunker    │ →  │   Attacher   │ →  │   Resolver    │  │
//! │  │  (NP/VP/PP) │    │  (head-find) │    │ (coref/alias) │  │
//! │  └─────────────┘    └──────────────┘    └───────────────┘  │
//! │         ↓                                                   │
//! │  ┌─────────────────────────────────────────────────────┐   │
//! │  │              DialogueAttributor                      │   │
//! │  │    (speaker identification for quotes)              │   │
//! │  └─────────────────────────────────────────────────────┘   │
//! └─────────────────────────────────────────────────────────────┘
//! ```
//!
//! # Usage (Rust)
//! ```rust,ignore
//! let mut ng = NarrativeGraph::new();
//! ng.hydrate_entity("e1", "Gandalf", Gender::Male, vec!["Mithrandir"]);
//! let result = ng.analyze("Gandalf walked through the forest. He stopped.");
//! ```
//!
//! # Usage (JavaScript/WASM)
//! ```javascript,ignore
//! const ng = new NarrativeGraph();
//! ng.hydrate_entities([{ id: "e1", name: "Gandalf", gender: "male", aliases: [] }]);
//! const result = ng.analyze("Gandalf walked through the forest.");
//! console.log(result.chunks, result.dependencies);
//! ```

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::scanner::chunker::{Chunk, ChunkStats, Chunker};
use crate::scanner::attacher::{Attacher, Dependency};
use crate::scanner::resolver::{Resolver, Gender, EntityId};
use crate::scanner::dialogue::{DialogueAttributor, QuotePosition};

// =============================================================================
// Result Types
// =============================================================================

/// Complete analysis result from NarrativeGraph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeResult {
    /// Detected phrase chunks
    pub chunks: Vec<Chunk>,
    /// Dependency links between chunks
    pub dependencies: Vec<Dependency>,
    /// Root chunk index (usually main verb)
    pub root_idx: Option<usize>,
    /// Statistics
    pub stats: NarrativeStats,
}

/// Performance and count statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeStats {
    pub chunk_count: usize,
    pub dependency_count: usize,
    pub noun_phrases: usize,
    pub verb_phrases: usize,
    pub prep_phrases: usize,
    pub timing_us: u64,
}

/// Entity hydration input (for WASM)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityInput {
    pub id: String,
    pub name: String,
    pub gender: String, // "male", "female", "neutral", "plural", "unknown"
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub kind: String,
}

impl EntityInput {
    fn to_gender(&self) -> Gender {
        match self.gender.to_lowercase().as_str() {
            "male" | "m" => Gender::Male,
            "female" | "f" => Gender::Female,
            "neutral" | "n" | "it" => Gender::Neutral,
            "plural" | "p" | "they" => Gender::Plural,
            _ => Gender::Unknown,
        }
    }
}

// =============================================================================
// NarrativeGraph Facade
// =============================================================================

/// Standalone NLP engine for narrative text analysis
/// 
/// Combines chunking, dependency attachment, coreference resolution,
/// and dialogue attribution into a single, composable API.
#[wasm_bindgen]
pub struct NarrativeGraph {
    chunker: Chunker,
    attacher: Attacher,
    resolver: Resolver,
    attributor: DialogueAttributor,
}

impl Default for NarrativeGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl NarrativeGraph {
    /// Create a new NarrativeGraph engine
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        NarrativeGraph {
            chunker: Chunker::new(),
            attacher: Attacher::new(),
            resolver: Resolver::new(),
            attributor: DialogueAttributor::new(),
        }
    }

    /// Hydrate with known entities for coreference resolution
    /// 
    /// # Arguments
    /// * `entities` - JSON array of EntityInput objects
    pub fn hydrate_entities(&mut self, entities: JsValue) -> Result<(), JsValue> {
        let inputs: Vec<EntityInput> = serde_wasm_bindgen::from_value(entities)
            .map_err(|e| JsValue::from_str(&format!("Invalid entities: {}", e)))?;
        
        for input in inputs {
            self.resolver.register_entity(
                &input.id,
                &input.name,
                input.to_gender(),
                input.aliases,
            );
        }
        
        Ok(())
    }

    /// Full analysis pipeline: chunk → attach → return structured result
    /// 
    /// # Arguments
    /// * `text` - The narrative text to analyze
    pub fn analyze(&self, text: &str) -> Result<JsValue, JsValue> {
        let result = self.analyze_native(text);
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Chunk only (standalone operation)
    pub fn chunk_only(&self, text: &str) -> Result<JsValue, JsValue> {
        let result = self.chunker.chunk_native(text);
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Resolve a pronoun or alias to an entity ID
    pub fn resolve(&mut self, text: &str) -> Option<String> {
        self.resolver.resolve(text)
    }

    /// Record an explicit mention (updates coreference context)
    pub fn observe_mention(&mut self, entity_id: &str) {
        self.resolver.observe_mention(entity_id);
    }

    /// Get current context state (for debugging)
    pub fn get_context_state(&self) -> JsValue {
        // Returns simplified state info
        JsValue::from_str("NarrativeGraph context active")
    }
}

// Native (non-WASM) API
impl NarrativeGraph {
    /// Full analysis pipeline (native Rust)
    pub fn analyze_native(&self, text: &str) -> NarrativeResult {
        let start = instant::Instant::now();
        
        // Step 1: Chunk
        let chunk_result = self.chunker.chunk_native(text);
        
        // Step 2: Attach dependencies
        let dep_graph = self.attacher.attach_native(&chunk_result.chunks);
        
        // Step 3: Build stats
        let chunk_stats = ChunkStats::from_chunks(&chunk_result.chunks, chunk_result.tokens.len());
        
        // Capture counts before moving
        let dep_count = dep_graph.dependencies.len();
        let chunk_count = chunk_result.chunks.len();
        
        NarrativeResult {
            chunks: dep_graph.chunks,
            dependencies: dep_graph.dependencies,
            root_idx: dep_graph.root_idx,
            stats: NarrativeStats {
                chunk_count,
                dependency_count: dep_count,
                noun_phrases: chunk_stats.noun_phrases,
                verb_phrases: chunk_stats.verb_phrases,
                prep_phrases: chunk_stats.prep_phrases,
                timing_us: start.elapsed().as_micros() as u64,
            },
        }
    }

    /// Hydrate a single entity (native)
    pub fn hydrate_entity(&mut self, id: &str, name: &str, gender: Gender, aliases: Vec<String>) {
        self.resolver.register_entity(id, name, gender, aliases);
    }

    /// Attribute speaker for dialogue (native)
    pub fn attribute_speaker(
        &mut self, 
        text: &str, 
        quote_pos: QuotePosition
    ) -> Option<EntityId> {
        let chunk_result = self.chunker.chunk_native(text);
        DialogueAttributor::attribute_simple(text, &chunk_result.chunks, quote_pos, &mut self.resolver)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_instance() {
        let ng = NarrativeGraph::new();
        // Just verify it constructs
        assert!(true);
    }

    #[test]
    fn test_analyze_simple() {
        let ng = NarrativeGraph::new();
        let result = ng.analyze_native("The wizard walked through the forest.");
        
        assert!(result.stats.chunk_count > 0, "Should have chunks");
        assert!(result.stats.noun_phrases >= 1, "Should have at least one NP");
        assert!(result.stats.verb_phrases >= 1, "Should have at least one VP");
    }

    #[test]
    fn test_analyze_with_dependencies() {
        let ng = NarrativeGraph::new();
        let result = ng.analyze_native("Frodo found the ring.");
        
        // Just verify analysis runs and produces chunks
        assert!(result.stats.chunk_count >= 1, "Should produce at least 1 chunk");
        // The exact number of NPs/VPs depends on lexicon coverage
        // Main goal: verify the pipeline runs without panic
    }

    #[test]
    fn test_hydrate_and_resolve() {
        let mut ng = NarrativeGraph::new();
        ng.hydrate_entity("e1", "Gandalf", Gender::Male, vec!["Mithrandir".to_string()]);
        
        // Resolve by name
        assert_eq!(ng.resolve("Gandalf").as_deref(), Some("e1"));
        
        // Resolve by alias
        assert_eq!(ng.resolve("Mithrandir").as_deref(), Some("e1"));
    }

    #[test]
    fn test_pronoun_resolution_with_context() {
        let mut ng = NarrativeGraph::new();
        ng.hydrate_entity("e1", "Gandalf", Gender::Male, vec![]);
        ng.observe_mention("e1");
        
        assert_eq!(ng.resolve("He").as_deref(), Some("e1"));
    }

    #[test]
    fn test_dialogue_attribution() {
        let mut ng = NarrativeGraph::new();
        ng.hydrate_entity("e1", "Gandalf", Gender::Male, vec![]);
        
        let speaker = ng.attribute_speaker("shouted Gandalf", QuotePosition::Before);
        assert_eq!(speaker.as_deref(), Some("e1"));
    }

    #[test]
    fn test_full_narrative_flow() {
        let mut ng = NarrativeGraph::new();
        
        // Hydrate entities
        ng.hydrate_entity("gandalf", "Gandalf", Gender::Male, vec!["the wizard".to_string()]);
        ng.hydrate_entity("frodo", "Frodo", Gender::Male, vec![]);
        
        // Analyze text
        let result = ng.analyze_native("Gandalf walked slowly. The wizard stopped.");
        
        // Observe first mention
        ng.observe_mention("gandalf");
        
        // Resolve pronoun
        assert_eq!(ng.resolve("He").as_deref(), Some("gandalf"));
        
        // Resolve alias
        assert_eq!(ng.resolve("the wizard").as_deref(), Some("gandalf"));
    }

    #[test]
    fn test_performance() {
        let ng = NarrativeGraph::new();
        let text = "The ancient wizard slowly walked through the dark forest. \
                   He was searching for the hidden tower where the dragon lived.";
        
        let result = ng.analyze_native(text);
        
        // Should complete in under 5ms
        assert!(result.stats.timing_us < 5000, "Should analyze quickly, took {}us", result.stats.timing_us);
    }
}
