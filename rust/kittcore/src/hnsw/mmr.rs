//! Maximal Marginal Relevance (MMR) for Diversity-Aware Search
//!
//! MMR reranks results to balance relevance and diversity:
//! MMR = λ × similarity(query, doc) - (1-λ) × max(similarity(doc, selected_docs))
//!
//! λ = 1.0: Pure relevance (standard search)
//! λ = 0.5: Balanced relevance + diversity
//! λ = 0.0: Pure diversity

use super::distance::{cosine_similarity, magnitude};

/// MMR configuration
#[derive(Debug, Clone, Copy)]
pub struct MmrConfig {
    /// Lambda: 0.0 = pure diversity, 1.0 = pure relevance
    pub lambda: f32,
    /// How many extra candidates to fetch (multiplier on k)
    pub fetch_multiplier: f32,
}

impl Default for MmrConfig {
    fn default() -> Self {
        Self {
            lambda: 0.5,
            fetch_multiplier: 2.0,
        }
    }
}

impl MmrConfig {
    /// Create balanced config (0.5 lambda)
    pub fn balanced() -> Self {
        Self::default()
    }

    /// Create relevance-focused config (0.7 lambda)
    pub fn relevance_focused() -> Self {
        Self {
            lambda: 0.7,
            fetch_multiplier: 1.5,
        }
    }

    /// Create diversity-focused config (0.3 lambda)
    pub fn diversity_focused() -> Self {
        Self {
            lambda: 0.3,
            fetch_multiplier: 3.0,
        }
    }

    /// Custom lambda (clamped to 0.0-1.0)
    pub fn with_lambda(lambda: f32) -> Self {
        Self {
            lambda: lambda.clamp(0.0, 1.0),
            fetch_multiplier: 2.0,
        }
    }
}

/// Candidate for MMR reranking
#[derive(Debug, Clone)]
pub struct MmrCandidate {
    pub id: u32,
    pub score: f32,
    pub vector: Vec<f32>,
}

/// Rerank search results using Maximal Marginal Relevance
/// 
/// # Arguments
/// * `query` - Query vector
/// * `candidates` - Initial search results with vectors (sorted by relevance desc)
/// * `k` - Number of diverse results to return
/// * `lambda` - Balance factor (0.0 = diversity, 1.0 = relevance)
/// 
/// # Returns
/// Top-k results reranked for diversity
pub fn mmr_rerank(
    query: &[f32],
    candidates: Vec<MmrCandidate>,
    k: usize,
    lambda: f32,
) -> Vec<(u32, f32)> {
    if candidates.is_empty() || k == 0 {
        return Vec::new();
    }

    let k = k.min(candidates.len());
    let query_mag = magnitude(query);
    
    let mut selected: Vec<MmrCandidate> = Vec::with_capacity(k);
    let mut remaining = candidates;

    // Iteratively select documents maximizing MMR
    for _ in 0..k {
        if remaining.is_empty() {
            break;
        }

        let mut best_idx = 0;
        let mut best_mmr = f32::NEG_INFINITY;

        for (idx, candidate) in remaining.iter().enumerate() {
            let mmr_score = compute_mmr_score(
                query,
                query_mag,
                candidate,
                &selected,
                lambda,
            );

            if mmr_score > best_mmr {
                best_mmr = mmr_score;
                best_idx = idx;
            }
        }

        // Move best candidate to selected set
        let best = remaining.remove(best_idx);
        selected.push(best);
    }

    // Return (id, original_score) pairs
    selected.into_iter()
        .map(|c| (c.id, c.score))
        .collect()
}

/// Compute MMR score for a candidate
/// MMR = λ × relevance - (1-λ) × max_similarity_to_selected
fn compute_mmr_score(
    query: &[f32],
    query_mag: f32,
    candidate: &MmrCandidate,
    selected: &[MmrCandidate],
    lambda: f32,
) -> f32 {
    // Relevance: cosine similarity to query
    let candidate_mag = magnitude(&candidate.vector);
    let relevance = cosine_similarity(
        query,
        &candidate.vector,
        Some(query_mag),
        Some(candidate_mag),
    );

    // Diversity: max similarity to already selected documents
    let max_similarity = if selected.is_empty() {
        0.0
    } else {
        selected.iter()
            .map(|s| {
                let s_mag = magnitude(&s.vector);
                cosine_similarity(
                    &candidate.vector,
                    &s.vector,
                    Some(candidate_mag),
                    Some(s_mag),
                )
            })
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap_or(0.0)
    };

    // MMR = λ × relevance - (1-λ) × max_similarity
    lambda * relevance - (1.0 - lambda) * max_similarity
}

/// Convenience function for simple MMR with just IDs and scores
/// Fetches vectors internally using a lookup function
pub fn mmr_rerank_with_lookup<F>(
    query: &[f32],
    results: &[(u32, f32)],
    k: usize,
    lambda: f32,
    get_vector: F,
) -> Vec<(u32, f32)>
where
    F: Fn(u32) -> Option<Vec<f32>>,
{
    // Convert results to candidates with vectors
    let candidates: Vec<MmrCandidate> = results.iter()
        .filter_map(|(id, score)| {
            get_vector(*id).map(|vector| MmrCandidate {
                id: *id,
                score: *score,
                vector,
            })
        })
        .collect();

    mmr_rerank(query, candidates, k, lambda)
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
