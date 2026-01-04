//! Integration Tests for Diversity Search
//!
//! Tests HNSW + MMR integration via search_with_diversity method.

use crate::hnsw::index::{Hnsw, Metric};

// ============================================================================
// Integration Contract Tests
// ============================================================================

#[test]
fn test_search_with_diversity_returns_k() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    for i in 0..10 {
        let v: Vec<f32> = (0..3).map(|j| ((i + j) as f32) / 10.0).collect();
        hnsw.add_point(i as u32, v).unwrap();
    }
    
    let query = vec![0.5, 0.5, 0.5];
    let results = hnsw.search_with_diversity(&query, 5, 0.5);
    
    assert_eq!(results.len(), 5);
}

#[test]
fn test_search_with_diversity_lambda_1_is_relevance() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Add vectors at different angles
    hnsw.add_point(1, vec![1.0, 0.0]).unwrap();      // Exact match
    hnsw.add_point(2, vec![0.9, 0.1]).unwrap();      // Very similar
    hnsw.add_point(3, vec![0.0, 1.0]).unwrap();      // Orthogonal
    
    let query = vec![1.0, 0.0];
    
    // With lambda = 1.0, should be pure relevance
    let results = hnsw.search_with_diversity(&query, 3, 1.0);
    
    // First should be exact match
    assert_eq!(results[0].0, 1);
    // Second should be similar, not diverse
    assert_eq!(results[1].0, 2);
}

#[test]
fn test_search_with_diversity_promotes_variety() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Two near-identical vectors and two different ones
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point(2, vec![0.99, 0.01, 0.0]).unwrap();  // Near-duplicate of 1
    hnsw.add_point(3, vec![0.0, 1.0, 0.0]).unwrap();    // Orthogonal
    hnsw.add_point(4, vec![0.0, 0.0, 1.0]).unwrap();    // Also orthogonal
    
    let query = vec![1.0, 0.0, 0.0];
    
    // With diversity-focused lambda (0.3), should prefer diversity
    let results = hnsw.search_with_diversity(&query, 3, 0.3);
    
    // First should be most relevant
    assert_eq!(results[0].0, 1);
    
    // With diversity focus, at least one orthogonal vector should appear in top 3
    let has_diverse = results.iter().any(|(id, _)| *id == 3 || *id == 4);
    assert!(has_diverse, "Diversity-focused search should include orthogonal vectors in top 3");
}

#[test]
fn test_search_with_diversity_empty_index() {
    let hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let query = vec![1.0, 0.0, 0.0];
    
    let results = hnsw.search_with_diversity(&query, 5, 0.5);
    assert!(results.is_empty());
}

#[test]
fn test_search_with_diversity_single_result() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    
    let query = vec![1.0, 0.0, 0.0];
    let results = hnsw.search_with_diversity(&query, 5, 0.5);
    
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].0, 1);
}
