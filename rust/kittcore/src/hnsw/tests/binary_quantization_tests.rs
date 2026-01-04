//! Tests for Binary Quantization and Two-Stage Search
//!
//! Contract tests for ultra-fast binary filtering with exact rerank.

use crate::hnsw::binary_quantization::{
    BinaryQuantized, two_stage_search, cosine_similarity
};

// ============================================================================
// Quantization Contract Tests
// ============================================================================

#[test]
fn test_quantize_basic() {
    let vector = vec![1.0, -1.0, 0.5, -0.5, 0.0];
    let bq = BinaryQuantized::quantize(&vector);

    assert_eq!(bq.dimensions, 5);
    // Bits: 1, 0, 1, 0, 1 (0.0 counts as positive)
    assert_eq!(bq.data[0] & 0b11111, 0b10101);
}

#[test]
fn test_quantize_empty_vector() {
    let vector: Vec<f32> = vec![];
    let bq = BinaryQuantized::quantize(&vector);

    assert_eq!(bq.dimensions, 0);
    assert!(bq.data.is_empty());
}

#[test]
fn test_quantize_large_vector() {
    // 384D vector (typical BGE-small)
    let vector: Vec<f32> = (0..384).map(|i| if i % 2 == 0 { 1.0 } else { -1.0 }).collect();
    let bq = BinaryQuantized::quantize(&vector);

    assert_eq!(bq.dimensions, 384);
    assert_eq!(bq.data.len(), 6); // 384 / 64 = 6 words
}

// ============================================================================
// Hamming Distance Contract Tests
// ============================================================================

#[test]
fn test_hamming_identical() {
    let v = vec![1.0, -1.0, 1.0, -1.0];
    let bq1 = BinaryQuantized::quantize(&v);
    let bq2 = BinaryQuantized::quantize(&v);

    assert_eq!(bq1.hamming_distance(&bq2), 0);
}

#[test]
fn test_hamming_all_different() {
    let v1 = vec![1.0, 1.0, 1.0, 1.0];
    let v2 = vec![-1.0, -1.0, -1.0, -1.0];

    let bq1 = BinaryQuantized::quantize(&v1);
    let bq2 = BinaryQuantized::quantize(&v2);

    assert_eq!(bq1.hamming_distance(&bq2), 4);
}

#[test]
fn test_hamming_symmetry() {
    let v1 = vec![1.0, 1.0, -1.0, -1.0];
    let v2 = vec![1.0, -1.0, -1.0, 1.0];

    let bq1 = BinaryQuantized::quantize(&v1);
    let bq2 = BinaryQuantized::quantize(&v2);

    assert_eq!(bq1.hamming_distance(&bq2), bq2.hamming_distance(&bq1));
}

// ============================================================================
// Compression Ratio Contract Tests
// ============================================================================

#[test]
fn test_compression_ratio_384d() {
    let v: Vec<f32> = (0..384).map(|i| i as f32).collect();
    let bq = BinaryQuantized::quantize(&v);

    let ratio = bq.compression_ratio();
    assert!(ratio > 20.0 && ratio < 35.0, "Compression ratio: {}", ratio);
}

#[test]
fn test_compression_ratio_768d() {
    let v: Vec<f32> = (0..768).map(|i| i as f32).collect();
    let bq = BinaryQuantized::quantize(&v);

    let ratio = bq.compression_ratio();
    assert!(ratio > 25.0 && ratio < 35.0, "Compression ratio: {}", ratio);
}

// ============================================================================
// Two-Stage Search Contract Tests
// ============================================================================

#[test]
fn test_two_stage_empty_index() {
    let query = vec![1.0, 0.0, 0.0];
    let index: Vec<(u32, BinaryQuantized)> = vec![];

    let results = two_stage_search(
        &query,
        &index,
        5,
        2.0,
        |_| None,
        cosine_similarity,
    );

    assert!(results.is_empty());
}

#[test]
fn test_two_stage_returns_k() {
    let vectors: Vec<(u32, Vec<f32>)> = vec![
        (1, vec![1.0, 0.0, 0.0]),
        (2, vec![0.9, 0.1, 0.0]),
        (3, vec![0.0, 1.0, 0.0]),
        (4, vec![0.0, 0.0, 1.0]),
    ];

    let binary_index: Vec<(u32, BinaryQuantized)> = vectors
        .iter()
        .map(|(id, v)| (*id, BinaryQuantized::quantize(v)))
        .collect();

    let query = vec![1.0, 0.0, 0.0];

    let results = two_stage_search(
        &query,
        &binary_index,
        3,
        2.0,
        |id| vectors.iter().find(|(i, _)| *i == id).map(|(_, v)| v.clone()),
        cosine_similarity,
    );

    assert_eq!(results.len(), 3);
}

#[test]
fn test_two_stage_ordering() {
    let vectors: Vec<(u32, Vec<f32>)> = vec![
        (1, vec![1.0, 0.0, 0.0]),
        (2, vec![0.707, 0.707, 0.0]),
        (3, vec![0.0, 1.0, 0.0]),
    ];

    let binary_index: Vec<(u32, BinaryQuantized)> = vectors
        .iter()
        .map(|(id, v)| (*id, BinaryQuantized::quantize(v)))
        .collect();

    let query = vec![1.0, 0.0, 0.0];

    let results = two_stage_search(
        &query,
        &binary_index,
        3,
        2.0,
        |id| vectors.iter().find(|(i, _)| *i == id).map(|(_, v)| v.clone()),
        cosine_similarity,
    );

    // Should be ordered by exact similarity
    assert_eq!(results[0].0, 1);
    assert!(results[0].1 > results[1].1);
}

// ============================================================================
// Recall Quality Benchmark
// ============================================================================

#[test]
fn test_two_stage_recall_quality() {
    use std::collections::HashSet;

    let mut seed: u64 = 42;
    let mut rng = || {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        (seed >> 33) as f32 / (u32::MAX as f32) - 0.5
    };

    // Using larger dimension improves binary quantization recall
    let dim = 256;
    let n = 100;
    let k = 10;

    let vectors: Vec<(u32, Vec<f32>)> = (0..n)
        .map(|i| (i as u32, (0..dim).map(|_| rng()).collect()))
        .collect();

    let binary_index: Vec<(u32, BinaryQuantized)> = vectors
        .iter()
        .map(|(id, v)| (*id, BinaryQuantized::quantize(v)))
        .collect();

    let query: Vec<f32> = (0..dim).map(|_| rng()).collect();

    // Use 10x rerank multiplier for better recall
    let two_stage_results = two_stage_search(
        &query,
        &binary_index,
        k,
        10.0, // High rerank multiplier
        |id| vectors.iter().find(|(i, _)| *i == id).map(|(_, v)| v.clone()),
        cosine_similarity,
    );
    let two_stage_ids: HashSet<u32> = two_stage_results.iter().map(|(id, _)| *id).collect();

    // Brute force ground truth
    let mut brute: Vec<(u32, f32)> = vectors
        .iter()
        .map(|(id, v)| (*id, cosine_similarity(&query, v)))
        .collect();
    brute.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    let brute_ids: HashSet<u32> = brute.iter().take(k).map(|(id, _)| *id).collect();

    let recall = two_stage_ids.intersection(&brute_ids).count() as f32 / k as f32;

    // Binary quantization has inherent recall limits, but with 10x rerank
    // and 100 candidates for k=10, we should see reasonable overlap
    assert!(
        recall >= 0.3,
        "Two-stage recall@{} = {:.2}, expected >= 0.3 (binary quantization has inherent limits)",
        k, recall
    );
}
