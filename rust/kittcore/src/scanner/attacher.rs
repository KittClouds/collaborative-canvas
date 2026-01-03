//! Dependency Attacher - Phase 2 of NarrativeGraph
//!
//! Links chunks into a dependency graph using a non-greedy scoring strategy.
//! Resolves relationships like Subject-Verb, Verb-Object, and PP-Attachment.
//!
//! # Universal Dependencies (Simplified)
//!
//! | Relation | From (Head) | To (Dep) | Example |
//! |----------|-------------|----------|---------|
//! | nsubj    | Verb        | Noun     | walked ← Frodo |
//! | obj      | Verb        | Noun     | carried → ring |
//! | nmod     | Noun        | Noun/PP  | ring → finger (on) |
//! | amod     | Noun        | AdjPh    | wizard ← ancient |
//! | advmod   | Verb        | AdvPh    | walked ← slowly |
//!
//! # Scoring Strategy
//!
//! Instead of greedy left-to-right attachment, we score potential head-dependent pairs:
//! `Score = Proximity + SemanticFit + Parallelism + Recency`

use crate::scanner::chunker::{Chunk, ChunkKind, ChunkResult};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// =============================================================================
// Core Types
// =============================================================================

/// Types of dependencies between chunks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DependencyKind {
    /// Nominal subject: "The **wizard** walked" (walked -> wizard)
    NSubj,
    /// Direct object: "found the **ring**" (found -> ring)
    Obj,
    /// Nominal modifier (usually PP): "walked **in the forest**" (walked -> found)
    /// or "Book **of Spells**" (Book -> Spells)
    NMod,
    /// Adjective modifier (from AdjPhrase): "**Happy**, the wizard smiled"
    AMod,
    /// Adverbial modifier (from VerbPhrase modifiers or AdvPhrase): "walked **slowly**"
    AdvMod,
    /// Root of the sentence (usually the main verb)
    Root,
    /// Conjunction / Other
    Unknown,
}

/// A resolved dependency link
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Dependency {
    /// Index of the head chunk in the chunk list
    pub head_idx: usize,
    /// Index of the dependent chunk in the chunk list
    pub dep_idx: usize,
    /// The type of relationship
    pub kind: DependencyKind,
    /// The confidence score of this attachment
    pub score: f64,
}

impl Dependency {
    pub fn new(head_idx: usize, dep_idx: usize, kind: DependencyKind, score: f64) -> Self {
        Dependency {
            head_idx,
            dep_idx,
            kind,
            score,
        }
    }
}

/// Parsed sentence with dependencies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyGraph {
    pub chunks: Vec<Chunk>,
    pub dependencies: Vec<Dependency>,
    pub root_idx: Option<usize>,
}

// =============================================================================
// Attacher Implementation
// =============================================================================

#[wasm_bindgen]
pub struct Attacher {
    // Configuration weights could go here
    proximity_weight: f64,
    semantic_weight: f64,
}

impl Default for Attacher {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl Attacher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Attacher {
            proximity_weight: 1.0,
            semantic_weight: 1.0,
        }
    }

    /// Process chunks and build dependency graph (WASM wrapper)
    pub fn attach(&self, chunks_js: JsValue) -> Result<JsValue, JsValue> {
        let chunks: Vec<Chunk> = serde_wasm_bindgen::from_value(chunks_js)
            .map_err(|e| JsValue::from_str(&format!("Invalid chunks: {}", e)))?;
            
        let graph = self.attach_native(&chunks);
        
        serde_wasm_bindgen::to_value(&graph)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

// Native API
impl Attacher {
    pub fn attach_native(&self, chunks: &[Chunk]) -> DependencyGraph {
        let mut dependencies = Vec::new();
        let mut attached_indices = std::collections::HashSet::new();

        // 1. Find Root (usually the first main verb phrase)
        let root_idx = chunks.iter().position(|c| c.kind == ChunkKind::VerbPhrase);
        
        // 2. For each chunk, find its best head
        for (i, chunk) in chunks.iter().enumerate() {
            // Skip the root itself (it has no head in this simplified view, or points to pseudo-root)
            if Some(i) == root_idx {
                continue;
            }

            // Find best attachment
            if let Some(best_dep) = self.find_best_attachment(i, chunk, chunks, &attached_indices) {
                attached_indices.insert(best_dep.dep_idx);
                dependencies.push(best_dep);
            }
        }

        DependencyGraph {
            chunks: chunks.to_vec(),
            dependencies,
            root_idx,
        }
    }

    /// Score all potential parents and return the best one
    fn find_best_attachment(
        &self,
        child_idx: usize,
        child: &Chunk,
        chunks: &[Chunk],
        _attached: &std::collections::HashSet<usize>,
    ) -> Option<Dependency> {
        let mut best_score = -1.0;
        let mut best_dep = None;

        // Look at all other chunks as potential parents
        for (parent_idx, parent) in chunks.iter().enumerate() {
            if child_idx == parent_idx {
                continue;
            }

            // Calculate raw score
            let score = self.score_attachment(child_idx, child, parent_idx, parent);

            // Determine valid relationship type based on chunk kinds
            let kind = self.determine_relation(child.kind, parent.kind, child_idx < parent_idx);
            
            if let Some(k) = kind {
                if score > best_score {
                    best_score = score;
                    best_dep = Some(Dependency::new(parent_idx, child_idx, k, score));
                }
            }
        }

        best_dep
    }

    /// The Core Scoring Function
    fn score_attachment(
        &self,
        child_idx: usize,
        child: &Chunk,
        parent_idx: usize,
        parent: &Chunk,
    ) -> f64 {
        let mut score = 0.0;
        
        // 1. Proximity: Closer is better (usually)
        // Distance in chunks
        let dist = (child_idx as i32 - parent_idx as i32).abs() as f64;
        score += (10.0 / dist) * self.proximity_weight;

        // 2. Directional Preference (English is largely SVO)
        let is_before = child_idx < parent_idx;
        
        match (child.kind, parent.kind) {
             // Subject usually comes before Verb
            (ChunkKind::NounPhrase, ChunkKind::VerbPhrase) => {
                if is_before { score += 5.0; } // Subject
                else { score += 4.0; }         // Object (Verb NP)
            },
            // PP usually attaches to preceding Noun or Verb
            (ChunkKind::PrepPhrase, _) => {
                if !is_before { score += 5.0; }
            },
            _ => {}
        }

        // 3. Simple Semantic Heuristics (Placeholder for future robustness)
        // e.g. "Prepositions matching verbs"
        if child.kind == ChunkKind::PrepPhrase {
             // Prefer linking PP to Verb over Noun if distance is small
             if parent.kind == ChunkKind::VerbPhrase {
                 score += 1.0; 
             }
        }

        score
    }

    /// Determine valid dependency kind based on chunk types and order
    fn determine_relation(&self, child_type: ChunkKind, parent_type: ChunkKind, child_is_before: bool) -> Option<DependencyKind> {
        match (parent_type, child_type) {
            // VERB -> NOUN
            (ChunkKind::VerbPhrase, ChunkKind::NounPhrase) => {
                if child_is_before {
                    Some(DependencyKind::NSubj)
                } else {
                    Some(DependencyKind::Obj)
                }
            },
            
            // VERB -> ADVERB (or ADJ phrase acting adverbially)
            (ChunkKind::VerbPhrase, ChunkKind::AdjPhrase) => Some(DependencyKind::AdvMod),
            
            // NOUN -> PP (Modifier) "Book of Spells"
            (ChunkKind::NounPhrase, ChunkKind::PrepPhrase) => Some(DependencyKind::NMod),
            
            // VERB -> PP (Modifier) "Walked in forest"
            (ChunkKind::VerbPhrase, ChunkKind::PrepPhrase) => Some(DependencyKind::NMod), // or Obl

            // NOUN -> CLAUSE "The man who lived"
            (ChunkKind::NounPhrase, ChunkKind::Clause) => Some(DependencyKind::NMod), // acl:relcl

            _ => None
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scanner::chunker::{TextRange, Chunk, ChunkKind};

    // Helper to create valid chunks quickly
    fn mk_chunk(kind: ChunkKind, text: &str) -> Chunk {
        // Dummy ranges, we only care about logic for now
        let range = TextRange::new(0, text.len());
        Chunk::new(kind, range, range)
    }

    fn attach(chunks: &[Chunk]) -> DependencyGraph {
        let attacher = Attacher::new();
        attacher.attach_native(chunks)
    }

    #[test]
    fn test_simple_svo() {
        // "Frodo found the ring"
        // NP(Frodo) VP(found) NP(ring)
        let chunks = vec![
            mk_chunk(ChunkKind::NounPhrase, "Frodo"),
            mk_chunk(ChunkKind::VerbPhrase, "found"),
            mk_chunk(ChunkKind::NounPhrase, "the ring"),
        ];

        let graph = attach(&chunks);

        // Should detect root
        assert_eq!(graph.root_idx, Some(1)); // "found"

        // Frodo -> found (nsubj)
        let sub = graph.dependencies.iter().find(|d| d.dep_idx == 0).expect("Frodo should explain subject");
        assert_eq!(sub.head_idx, 1);
        assert_eq!(sub.kind, DependencyKind::NSubj);

        // ring -> found (obj)
        let obj = graph.dependencies.iter().find(|d| d.dep_idx == 2).expect("Ring should be object");
        assert_eq!(obj.head_idx, 1);
        assert_eq!(obj.kind, DependencyKind::Obj);
    }

    #[test]
    fn test_pp_attachment_verb() {
        // "Walked in the forest"
        // VP(Walked) PP(in the forest)
        let chunks = vec![
            mk_chunk(ChunkKind::VerbPhrase, "Walked"),
            mk_chunk(ChunkKind::PrepPhrase, "in the forest"),
        ];

        let graph = attach(&chunks);
        
        let pp = graph.dependencies.iter().find(|d| d.dep_idx == 1).unwrap();
        assert_eq!(pp.head_idx, 0);
        assert_eq!(pp.kind, DependencyKind::NMod); // or obl
    }

    #[test]
    fn test_pp_attachment_noun() {
        // "Book of spells"
        // NP(Book) PP(of spells)
        // We need a verb to be root usually, but let's see if it links NP->PP
        let chunks = vec![
            mk_chunk(ChunkKind::NounPhrase, "Book"),
            mk_chunk(ChunkKind::PrepPhrase, "of spells"),
        ];

        let attacher = Attacher::new();
        // Since there is no root VP, we manually inspect relations
        // We expect PP to attach to NP
        let graph = attacher.attach_native(&chunks);
        
        let pp = graph.dependencies.iter().find(|d| d.dep_idx == 1).unwrap();
        assert_eq!(pp.head_idx, 0);
        assert_eq!(pp.kind, DependencyKind::NMod);
    }

    #[test]
    fn test_ambiguity_preference() {
        // "The man saw the girl with the telescope"
        // NP(man) VP(saw) NP(girl) PP(with telescope)
        
        // Classic ambiguity: 
        // 1. saw -> with telescope (Instrument) - Higher semantic fit usually
        // 2. girl -> with telescope (Possession) - Proximity favors this!
        
        // Our simple scorer weights Proximity high (10.0/dist).
        // VP(1) is dist 2 from PP(3). NP(2) is dist 1 from PP(3).
        // Proximity score: VP=5.0, NP=10.0.
        // Unless we add semantic weight, Proximity will attach to "girl".
        
        let chunks = vec![
            mk_chunk(ChunkKind::NounPhrase, "The man"),  // 0
            mk_chunk(ChunkKind::VerbPhrase, "saw"),      // 1
            mk_chunk(ChunkKind::NounPhrase, "the girl"), // 2
            mk_chunk(ChunkKind::PrepPhrase, "with the telescope"), // 3
        ];
        
        let graph = attach(&chunks);
        
        // Expect PP(3) to attach to NP(2) (girl) due to proximity in this basic model
        let pp = graph.dependencies.iter().find(|d| d.dep_idx == 3).unwrap();
        assert_eq!(pp.head_idx, 2, "Proximity should prefer 'girl' as head");
    }
}
