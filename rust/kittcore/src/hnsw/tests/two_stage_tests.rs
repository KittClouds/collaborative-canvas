//! Integration Tests for Two-Stage Retrieval
//!
//! Tests HNSW + Binary Quantization two-stage search pattern.

use crate::hnsw::index::{Hnsw, Metric};

// ============================================================================
// Two-Stage Search Integration Tests
// ============================================================================

#[test]
fn test_add_point_binary() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    hnsw.add_point_binary(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point_binary(2, vec![0.0, 1.0, 0.0]).unwrap();
    
    assert!(hnsw.get_binary_quantized(1).is_some());
    assert!(hnsw.get_binary_quantized(2).is_some());
    assert!(hnsw.get_binary_quantized(99).is_none());
}

#[test]
fn test_search_two_stage_fallback() {
    // Without binary index, falls back to standard search
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    hnsw.add_point(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point(2, vec![0.0, 1.0, 0.0]).unwrap();
    
    let query = vec![1.0, 0.0, 0.0];
    let results = hnsw.search_two_stage(&query, 2, 10.0);
    
    assert_eq!(results.len(), 2);
}

#[test]
fn test_search_two_stage_with_binary() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    for i in 0..10 {
        let v: Vec<f32> = (0..64).map(|j| ((i + j) as f32) / 100.0 - 0.5).collect();
        hnsw.add_point_binary(i as u32, v).unwrap();
    }
    
    let query: Vec<f32> = (0..64).map(|j| j as f32 / 100.0 - 0.5).collect();
    let results = hnsw.search_two_stage(&query, 5, 2.0);
    
    assert_eq!(results.len(), 5);
}

#[test]
fn test_search_two_stage_ordering() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    hnsw.add_point_binary(1, vec![1.0, 0.0, 0.0]).unwrap();
    hnsw.add_point_binary(2, vec![0.8, 0.2, 0.0]).unwrap();
    hnsw.add_point_binary(3, vec![0.0, 1.0, 0.0]).unwrap();
    
    let query = vec![1.0, 0.0, 0.0];
    let results = hnsw.search_two_stage(&query, 3, 10.0);
    
    // First result should be exact match
    assert_eq!(results[0].0, 1);
    // Scores should be descending
    assert!(results[0].1 >= results[1].1);
    assert!(results[1].1 >= results[2].1);
}

#[test]
fn test_memory_usage_full() {
    let mut hnsw = Hnsw::new(16, 200, Metric::Cosine);
    
    for i in 0..10 {
        let v: Vec<f32> = (0..384).map(|j| j as f32 + i as f32).collect();
        hnsw.add_point_binary(i as u32, v).unwrap();
    }
    
    let (full, scalar, binary) = hnsw.memory_usage_full();
    
    // Full: 10 * 384 * 4 = 15360 bytes
    assert_eq!(full, 10 * 384 * 4);
    
    // Scalar: 10 * (384 + 8) = 3920 bytes (4x compression)
    assert_eq!(scalar, 10 * (384 + 8));
    
    // Binary: 10 * ((384/64)*8 + 8) = 10 * (48 + 8) = 560 bytes (27x compression)
    let binary_words = (384 + 63) / 64;
    assert_eq!(binary, 10 * (binary_words * 8 + 8));
    
    // Verify compression ratios
    let scalar_ratio = full as f32 / scalar as f32;
    let binary_ratio = full as f32 / binary as f32;
    
    assert!(scalar_ratio > 3.5 && scalar_ratio < 4.5, "Scalar: {}", scalar_ratio);
    assert!(binary_ratio > 20.0 && binary_ratio < 35.0, "Binary: {}", binary_ratio);
}

// ============================================================================
// Recall vs Speed Benchmark
// ============================================================================

#[test]
fn test_two_stage_recall_benchmark() {
    use std::collections::HashSet;
    use std::time::Instant;

    let mut seed: u64 = 12345;
    let mut rng = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        (seed >> 33) as f32 / (u32::MAX as f32) - 0.5
    };

    let dim = 256;
    let n = 500;
    let k = 10;

    // Build index with binary quantization
    let mut hnsw = Hnsw::new(16, 100, Metric::Cosine);
    let mut vectors: Vec<Vec<f32>> = Vec::new();
    
    for i in 0..n {
        let v: Vec<f32> = (0..dim).map(|_| rng()).collect();
        vectors.push(v.clone());
        hnsw.add_point_binary(i as u32, v).unwrap();
    }

    let query: Vec<f32> = (0..dim).map(|_| rng()).collect();

    // Brute force ground truth
    let brute_start = Instant::now();
    let mut brute: Vec<(u32, f32)> = vectors
        .iter()
        .enumerate()
        .map(|(i, v)| {
            let sim = crate::hnsw::distance::cosine_similarity(&query, v, None, None);
            (i as u32, sim)
        })
        .collect();
    brute.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    let brute_time = brute_start.elapsed();
    let brute_ids: HashSet<u32> = brute.iter().take(k).map(|(id, _)| *id).collect();

    // HNSW search (standard)
    let hnsw_start = Instant::now();
    let hnsw_results = hnsw.search_knn(&query, k);
    let hnsw_time = hnsw_start.elapsed();
    let hnsw_ids: HashSet<u32> = hnsw_results.iter().map(|(id, _)| *id).collect();
    let hnsw_recall = hnsw_ids.intersection(&brute_ids).count() as f32 / k as f32;

    // Two-stage search
    let two_stage_start = Instant::now();
    let two_stage_results = hnsw.search_two_stage(&query, k, 10.0);
    let two_stage_time = two_stage_start.elapsed();
    let two_stage_ids: HashSet<u32> = two_stage_results.iter().map(|(id, _)| *id).collect();
    let two_stage_recall = two_stage_ids.intersection(&brute_ids).count() as f32 / k as f32;

    // Log benchmark results (visible with --nocapture)
    println!("\n=== Two-Stage Retrieval Benchmark ===");
    println!("Dataset: {}D × {} vectors", dim, n);
    println!("Query k: {}", k);
    println!("---");
    println!("Brute force:  {:?}", brute_time);
    println!("HNSW:         {:?} (recall: {:.0}%)", hnsw_time, hnsw_recall * 100.0);
    println!("Two-stage:    {:?} (recall: {:.0}%)", two_stage_time, two_stage_recall * 100.0);
    
    // Memory comparison
    let (full, _scalar, binary) = hnsw.memory_usage_full();
    println!("---");
    println!("Full memory:   {} KB", full / 1024);
    println!("Binary memory: {} KB ({:.1}× compression)", binary / 1024, full as f32 / binary as f32);
    println!("===================================\n");

    // Assertions
    assert!(hnsw_recall >= 0.8, "HNSW recall should be high: {}", hnsw_recall);
    assert!(two_stage_recall >= 0.3, "Two-stage recall: {} (with 10x rerank)", two_stage_recall);
}
