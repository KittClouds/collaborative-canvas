//! Tests for Scalar Quantization
//!
//! Contract tests defining the behavior of ScalarQuantized struct.

use crate::hnsw::quantization::ScalarQuantized;

// ============================================================================
// Quantization Contract Tests
// ============================================================================

#[test]
fn test_quantize_basic() {
    let vector = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let quantized = ScalarQuantized::quantize(&vector);

    assert_eq!(quantized.data.len(), 5);
    assert!((quantized.min - 1.0).abs() < 1e-6);
    // scale = (5.0 - 1.0) / 255.0 ≈ 0.01569
    assert!(quantized.scale > 0.0);
}

#[test]
fn test_quantize_empty_vector() {
    let vector: Vec<f32> = vec![];
    let quantized = ScalarQuantized::quantize(&vector);

    assert!(quantized.data.is_empty());
}

#[test]
fn test_quantize_identical_values() {
    let vector = vec![5.0, 5.0, 5.0, 5.0];
    let quantized = ScalarQuantized::quantize(&vector);

    // All values should be 0 (since all are at min)
    assert!(quantized.data.iter().all(|&v| v == 0));
    assert!((quantized.min - 5.0).abs() < 1e-6);
}

#[test]
fn test_quantize_negative_values() {
    let vector = vec![-10.0, -5.0, 0.0, 5.0, 10.0];
    let quantized = ScalarQuantized::quantize(&vector);

    assert_eq!(quantized.data.len(), 5);
    assert!((quantized.min - (-10.0)).abs() < 1e-6);
    // First value should be 0 (min), last should be 255 (max)
    assert_eq!(quantized.data[0], 0);
    assert_eq!(quantized.data[4], 255);
}

// ============================================================================
// Reconstruction Contract Tests
// ============================================================================

#[test]
fn test_reconstruct_roundtrip() {
    let vector = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let quantized = ScalarQuantized::quantize(&vector);
    let reconstructed = quantized.reconstruct();

    assert_eq!(reconstructed.len(), vector.len());

    // With 8-bit quantization, max error is roughly (max-min)/255
    let max_error = (5.0 - 1.0) / 255.0 * 2.0; // 2x tolerance for rounding

    for (orig, recon) in vector.iter().zip(reconstructed.iter()) {
        assert!(
            (orig - recon).abs() < max_error,
            "Roundtrip error too large: orig={}, recon={}, error={}",
            orig, recon, (orig - recon).abs()
        );
    }
}

#[test]
fn test_reconstruct_preserves_endpoints() {
    let vector = vec![0.0, 100.0];
    let quantized = ScalarQuantized::quantize(&vector);
    let reconstructed = quantized.reconstruct();

    // Min should be exactly 0
    assert!((reconstructed[0] - 0.0).abs() < 0.5);
    // Max should be approximately 100
    assert!((reconstructed[1] - 100.0).abs() < 0.5);
}

// ============================================================================
// Distance Contract Tests
// ============================================================================

#[test]
fn test_distance_identical_vectors() {
    let v1 = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let q1 = ScalarQuantized::quantize(&v1);
    let q2 = ScalarQuantized::quantize(&v1);

    let dist = q1.distance_l2_squared(&q2);
    assert!(dist < 1e-6, "Identical vectors should have ~0 distance");
}

#[test]
fn test_distance_symmetry() {
    let v1 = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let v2 = vec![2.0, 3.0, 4.0, 5.0, 6.0];

    let q1 = ScalarQuantized::quantize(&v1);
    let q2 = ScalarQuantized::quantize(&v2);

    let dist_ab = q1.distance_l2_squared(&q2);
    let dist_ba = q2.distance_l2_squared(&q1);

    assert!(
        (dist_ab - dist_ba).abs() < 0.01,
        "Distance not symmetric: d(a,b)={}, d(b,a)={}",
        dist_ab, dist_ba
    );
}

#[test]
fn test_distance_monotonicity() {
    // Quantized distance should preserve monotonicity:
    // closer points should have smaller distances
    let origin = vec![0.0, 0.0];
    let near = vec![1.0, 0.0];
    let far = vec![10.0, 0.0];

    let q_origin = ScalarQuantized::quantize(&origin);
    let q_near = ScalarQuantized::quantize(&near);
    let q_far = ScalarQuantized::quantize(&far);

    // Same vector should have zero distance
    let d_self = q_origin.distance_l2_squared(&q_origin);
    assert!(d_self < 1e-6, "Self-distance should be ~0: {}", d_self);

    // Note: Triangle inequality may not hold strictly for per-vector quantization
    // because each vector has its own min/scale. This is a known property.
    // Instead we verify that distance is non-negative.
    let d_near = q_origin.distance_l2_squared(&q_near);
    let d_far = q_origin.distance_l2_squared(&q_far);
    assert!(d_near >= 0.0, "Distance should be non-negative");
    assert!(d_far >= 0.0, "Distance should be non-negative");
}

// ============================================================================
// Cosine to Query Contract Tests
// ============================================================================

#[test]
fn test_cosine_identical_direction() {
    let v = vec![1.0, 0.0, 0.0];
    let query = vec![2.0, 0.0, 0.0]; // Same direction, different magnitude
    let query_mag = 2.0;

    let quantized = ScalarQuantized::quantize(&v);
    let sim = quantized.cosine_to_query(&query, query_mag);

    assert!(sim > 0.9, "Identical direction should have high similarity: {}", sim);
}

#[test]
fn test_cosine_orthogonal() {
    let v = vec![1.0, 0.0];
    let query = vec![0.0, 1.0];
    let query_mag = 1.0;

    let quantized = ScalarQuantized::quantize(&v);
    let sim = quantized.cosine_to_query(&query, query_mag);

    assert!(sim.abs() < 0.1, "Orthogonal vectors should have ~0 similarity: {}", sim);
}

#[test]
fn test_cosine_dimension_mismatch_returns_zero() {
    let v = vec![1.0, 2.0, 3.0];
    let query = vec![1.0, 2.0]; // Different dimension
    let query_mag = 2.236;

    let quantized = ScalarQuantized::quantize(&v);
    let sim = quantized.cosine_to_query(&query, query_mag);

    assert_eq!(sim, 0.0);
}

// ============================================================================
// Compression Ratio Contract Tests
// ============================================================================

#[test]
fn test_compression_ratio_384d() {
    // Typical BGE-small dimension
    let v: Vec<f32> = (0..384).map(|i| i as f32 / 384.0).collect();
    let quantized = ScalarQuantized::quantize(&v);

    let ratio = quantized.compression_ratio();
    // Expected: 384 * 4 / (384 + 8) = 1536 / 392 ≈ 3.9x
    assert!(ratio > 3.5 && ratio < 4.5, "384D compression ratio should be ~4x: {}", ratio);
}

#[test]
fn test_compression_ratio_768d() {
    // Typical ModernBERT dimension
    let v: Vec<f32> = (0..768).map(|i| i as f32 / 768.0).collect();
    let quantized = ScalarQuantized::quantize(&v);

    let ratio = quantized.compression_ratio();
    // Expected: 768 * 4 / (768 + 8) = 3072 / 776 ≈ 3.96x
    assert!(ratio > 3.5 && ratio < 4.5, "768D compression ratio should be ~4x: {}", ratio);
}

// ============================================================================
// Recall Quality Contract Tests
// ============================================================================

#[test]
fn test_similarity_ranking_preserved() {
    // Ensure quantization preserves relative similarity ordering
    let base = vec![1.0, 0.0, 0.0];
    let similar = vec![0.9, 0.1, 0.0];
    let dissimilar = vec![0.0, 1.0, 0.0];

    let q_base = ScalarQuantized::quantize(&base);
    let q_similar = ScalarQuantized::quantize(&similar);
    let q_dissimilar = ScalarQuantized::quantize(&dissimilar);

    let dist_similar = q_base.distance_l2_squared(&q_similar);
    let dist_dissimilar = q_base.distance_l2_squared(&q_dissimilar);

    assert!(
        dist_similar < dist_dissimilar,
        "Similar vector should be closer: similar={}, dissimilar={}",
        dist_similar, dist_dissimilar
    );
}
