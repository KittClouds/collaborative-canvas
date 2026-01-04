//! Tests for MMR Diversity Search
//!
//! Contract tests defining the behavior of Maximal Marginal Relevance reranking.

use crate::hnsw::mmr::{mmr_rerank, mmr_rerank_with_lookup, MmrCandidate, MmrConfig};

fn make_candidate(id: u32, score: f32, vector: Vec<f32>) -> MmrCandidate {
    MmrCandidate { id, score, vector }
}

// ============================================================================
// MMR Config Contract Tests
// ============================================================================

#[test]
fn test_config_default() {
    let config = MmrConfig::default();
    assert!((config.lambda - 0.5).abs() < 1e-6);
    assert!((config.fetch_multiplier - 2.0).abs() < 1e-6);
}

#[test]
fn test_config_clamps_lambda() {
    let config = MmrConfig::with_lambda(1.5);
    assert!((config.lambda - 1.0).abs() < 1e-6);

    let config = MmrConfig::with_lambda(-0.5);
    assert!((config.lambda - 0.0).abs() < 1e-6);
}

#[test]
fn test_config_presets() {
    let balanced = MmrConfig::balanced();
    assert!((balanced.lambda - 0.5).abs() < 1e-6);

    let rel = MmrConfig::relevance_focused();
    assert!((rel.lambda - 0.7).abs() < 1e-6);

    let div = MmrConfig::diversity_focused();
    assert!((div.lambda - 0.3).abs() < 1e-6);
}

// ============================================================================
// MMR Rerank Core Contract Tests
// ============================================================================

#[test]
fn test_mmr_empty_candidates() {
    let query = vec![1.0, 0.0, 0.0];
    let candidates = vec![];
    
    let results = mmr_rerank(&query, candidates, 5, 0.5);
    assert!(results.is_empty());
}

#[test]
fn test_mmr_returns_k_results() {
    let query = vec![1.0, 0.0, 0.0];
    let candidates = vec![
        make_candidate(1, 0.9, vec![0.9, 0.1, 0.0]),
        make_candidate(2, 0.8, vec![0.8, 0.2, 0.0]),
        make_candidate(3, 0.7, vec![0.7, 0.3, 0.0]),
        make_candidate(4, 0.6, vec![0.6, 0.4, 0.0]),
    ];
    
    let results = mmr_rerank(&query, candidates, 3, 0.5);
    assert_eq!(results.len(), 3);
}

#[test]
fn test_mmr_pure_relevance_preserves_order() {
    // With lambda = 1.0, MMR should preserve original order
    let query = vec![1.0, 0.0];
    let candidates = vec![
        make_candidate(1, 0.9, vec![0.9, 0.1]),
        make_candidate(2, 0.85, vec![0.88, 0.12]),
        make_candidate(3, 0.5, vec![0.5, 0.5]),
    ];
    
    let results = mmr_rerank(&query, candidates, 3, 1.0);
    
    // Should be in order of similarity to query
    assert_eq!(results[0].0, 1);
    assert_eq!(results[1].0, 2);
}

#[test]
fn test_mmr_promotes_diversity() {
    // With balanced lambda, MMR should promote diverse results
    let query = vec![1.0, 0.0, 0.0];
    
    // Two very similar vectors and one different
    let candidates = vec![
        make_candidate(1, 0.95, vec![0.99, 0.01, 0.0]),  // Very similar to query
        make_candidate(2, 0.94, vec![0.98, 0.02, 0.0]),  // Almost identical to #1
        make_candidate(3, 0.7, vec![0.0, 0.0, 1.0]),     // Orthogonal/different
    ];
    
    let results = mmr_rerank(&query, candidates, 2, 0.5);
    
    // First should still be most relevant
    assert_eq!(results[0].0, 1);
    // Second should be the diverse one (#3), not the near-duplicate (#2)
    assert_eq!(results[1].0, 3, "MMR should prefer diverse result over near-duplicate");
}

#[test]
fn test_mmr_pure_diversity() {
    // With lambda = 0.0, should maximize diversity
    let query = vec![1.0, 0.0];
    let candidates = vec![
        make_candidate(1, 0.9, vec![1.0, 0.0]),
        make_candidate(2, 0.85, vec![0.99, 0.01]),  // Very similar to #1
        make_candidate(3, 0.3, vec![0.0, 1.0]),    // Orthogonal
    ];
    
    let results = mmr_rerank(&query, candidates, 2, 0.0);
    
    // With pure diversity, should not select both similar vectors
    let has_both_similar = results.iter().any(|(id, _)| *id == 1) 
        && results.iter().any(|(id, _)| *id == 2);
    assert!(!has_both_similar, "Pure diversity should avoid selecting similar vectors");
}

// ============================================================================
// MMR with Lookup Contract Tests
// ============================================================================

#[test]
fn test_mmr_with_lookup() {
    let query = vec![1.0, 0.0, 0.0];
    let results = vec![
        (1u32, 0.9f32),
        (2u32, 0.8f32),
        (3u32, 0.7f32),
    ];
    
    // Mock vector lookup
    let get_vector = |id: u32| -> Option<Vec<f32>> {
        match id {
            1 => Some(vec![0.9, 0.1, 0.0]),
            2 => Some(vec![0.8, 0.2, 0.0]),
            3 => Some(vec![0.0, 1.0, 0.0]),
            _ => None,
        }
    };
    
    let reranked = mmr_rerank_with_lookup(&query, &results, 2, 0.5, get_vector);
    assert_eq!(reranked.len(), 2);
}

#[test]
fn test_mmr_handles_missing_vectors() {
    let query = vec![1.0, 0.0];
    let results = vec![
        (1u32, 0.9f32),
        (2u32, 0.8f32), // Will be missing
        (3u32, 0.7f32),
    ];
    
    let get_vector = |id: u32| -> Option<Vec<f32>> {
        match id {
            1 => Some(vec![0.9, 0.1]),
            3 => Some(vec![0.7, 0.3]),
            _ => None, // ID 2 is missing
        }
    };
    
    let reranked = mmr_rerank_with_lookup(&query, &results, 3, 0.5, get_vector);
    
    // Should only return vectors that were found
    assert_eq!(reranked.len(), 2);
    assert!(!reranked.iter().any(|(id, _)| *id == 2));
}

// ============================================================================
// Edge Cases
// ============================================================================

#[test]
fn test_mmr_k_larger_than_candidates() {
    let query = vec![1.0, 0.0];
    let candidates = vec![
        make_candidate(1, 0.9, vec![0.9, 0.1]),
    ];
    
    let results = mmr_rerank(&query, candidates, 10, 0.5);
    assert_eq!(results.len(), 1);
}

#[test]
fn test_mmr_k_zero() {
    let query = vec![1.0, 0.0];
    let candidates = vec![
        make_candidate(1, 0.9, vec![0.9, 0.1]),
    ];
    
    let results = mmr_rerank(&query, candidates, 0, 0.5);
    assert!(results.is_empty());
}

#[test]
fn test_mmr_identical_vectors() {
    // All candidates are identical - should still work
    let query = vec![1.0, 0.0];
    let candidates = vec![
        make_candidate(1, 0.9, vec![1.0, 0.0]),
        make_candidate(2, 0.8, vec![1.0, 0.0]),
        make_candidate(3, 0.7, vec![1.0, 0.0]),
    ];
    
    let results = mmr_rerank(&query, candidates, 3, 0.5);
    assert_eq!(results.len(), 3);
}
