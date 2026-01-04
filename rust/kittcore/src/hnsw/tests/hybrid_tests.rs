//! Tests for Hybrid HNSW with Scalar Quantization
//!
//! Contract tests for HNSW enhanced with quantized storage and hybrid search.

use crate::hnsw::index::{Hnsw, Metric, HnswError};
use crate::hnsw::quantization::ScalarQuantized;

// ============================================================================
// Hybrid Storage Contract Tests
// ============================================================================

#[test]
fn test_add_point_with_quantization() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let vector = vec![1.0, 0.0, 0.0];
    
    let result = hnsw.add_point_quantized(1, vector.clone());
    assert!(result.is_ok());
    assert_eq!(hnsw.len(), 1);
    
    // Should store both full precision and quantized
    assert!(hnsw.get_quantized(1).is_some());
    assert!(hnsw.get_vector(1).is_some());
}

#[test]
fn test_quantized_storage_compression() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Add 100 384D vectors
    for i in 0..100 {
        let v: Vec<f32> = (0..384).map(|j| ((i + j) as f32) / 384.0).collect();
        hnsw.add_point_quantized(i as u32, v).unwrap();
    }
    
    // Get memory stats
    let (full_bytes, quantized_bytes) = hnsw.memory_usage();
    
    // Quantized should be ~4x smaller than full precision
    let ratio = full_bytes as f32 / quantized_bytes as f32;
    assert!(ratio > 3.0 && ratio < 5.0, 
        "Expected ~4x compression, got {:.2}x", ratio);
}

// ============================================================================
// Hybrid Search Contract Tests
// ============================================================================

#[test]
fn test_search_hybrid_returns_correct_count() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Add orthogonal vectors
    hnsw.add_point_quantized(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point_quantized(2, vec![0.0, 1.0, 0.0]).unwrap();
    hnsw.add_point_quantized(3, vec![0.0, 0.0, 1.0]).unwrap();
    
    let results = hnsw.search_hybrid(&[1.0, 0.0, 0.0], 2);
    assert_eq!(results.len(), 2);
}

#[test]
fn test_search_hybrid_ordering() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Add vectors at different angles
    hnsw.add_point_quantized(1, vec![1.0, 0.0]).unwrap();      // Exact match
    hnsw.add_point_quantized(2, vec![0.707, 0.707]).unwrap();  // 45 degrees
    hnsw.add_point_quantized(3, vec![0.0, 1.0]).unwrap();      // 90 degrees
    
    let results = hnsw.search_hybrid(&[1.0, 0.0], 3);
    
    // Should be ordered by similarity (descending)
    assert_eq!(results[0].0, 1); // Closest
    assert_eq!(results[1].0, 2); // Middle
    assert_eq!(results[2].0, 3); // Farthest
}

#[test]
fn test_search_hybrid_reranks_with_full_precision() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    // Add vectors that might have different quantized vs full rankings
    hnsw.add_point_quantized(1, vec![1.0, 0.1, 0.0]).unwrap();
    hnsw.add_point_quantized(2, vec![0.99, 0.11, 0.0]).unwrap();
    
    let query = vec![1.0, 0.1, 0.0];
    let results = hnsw.search_hybrid(&query, 2);
    
    // Exact match should be first after full precision reranking
    assert_eq!(results[0].0, 1);
}

// ============================================================================
// Recall Quality Contract Tests
// ============================================================================

#[test]
fn test_hybrid_search_recall_vs_standard() {
    use std::collections::HashSet;
    
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let dim = 128;
    let n = 500;
    let k = 10;
    
    // Deterministic random
    let mut seed: u64 = 42;
    let mut rng = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        (seed >> 33) as f32 / (u32::MAX as f32) - 0.5
    };
    
    // Add vectors with quantization
    for i in 0..n {
        let v: Vec<f32> = (0..dim).map(|_| rng()).collect();
        hnsw.add_point_quantized(i as u32, v).unwrap();
    }
    
    // Run queries
    let mut avg_recall = 0.0;
    let num_queries = 5;
    
    for _ in 0..num_queries {
        let query: Vec<f32> = (0..dim).map(|_| rng()).collect();
        
        // Standard search (ground truth for this test)
        let standard_results = hnsw.search_knn(&query, k);
        let standard_set: HashSet<u32> = standard_results.iter().map(|(id, _)| *id).collect();
        
        // Hybrid search
        let hybrid_results = hnsw.search_hybrid(&query, k);
        let hybrid_set: HashSet<u32> = hybrid_results.iter().map(|(id, _)| *id).collect();
        
        // Calculate recall vs standard search
        let hits = standard_set.intersection(&hybrid_set).count();
        avg_recall += hits as f32 / k as f32;
    }
    
    avg_recall /= num_queries as f32;
    
    // Hybrid should have high recall vs standard (>90%)
    assert!(avg_recall > 0.9, 
        "Hybrid recall@{} vs standard = {:.2}, expected > 0.9", k, avg_recall);
}

// ============================================================================
// Get Quantized Contract Tests
// ============================================================================

#[test]
fn test_get_quantized_returns_none_for_missing() {
    let hnsw = Hnsw::new(16, 200, Metric::Cosine);
    assert!(hnsw.get_quantized(999).is_none());
}

#[test]
fn test_get_quantized_returns_correct_data() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    let vector = vec![0.0, 0.5, 1.0];
    
    hnsw.add_point_quantized(1, vector.clone()).unwrap();
    
    let quantized = hnsw.get_quantized(1).unwrap();
    let reconstructed = quantized.reconstruct();
    
    // Reconstructed should be close to original
    for (orig, recon) in vector.iter().zip(reconstructed.iter()) {
        assert!((orig - recon).abs() < 0.1, 
            "Reconstruction error too large: orig={}, recon={}", orig, recon);
    }
}
