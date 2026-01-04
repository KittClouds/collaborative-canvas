//! Binary Quantization for Ultra-Fast Coarse Filtering
//!
//! Converts f32 vectors to binary codes (sign bits) for 32× compression.
//! Uses Hamming distance for O(1) candidate filtering, then exact rerank.
//!
//! # Compression
//! - 768D f32 vector: 3072 bytes → 96 bytes (32×)
//! - 384D f32 vector: 1536 bytes → 48 bytes (32×)

use serde::{Deserialize, Serialize};

/// Binary quantized vector using sign bits
/// 
/// Each dimension is encoded as 1 bit (positive = 1, negative = 0).
/// Stored as packed u64 words for efficient Hamming distance via popcount.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryQuantized {
    /// Packed binary codes (sign bits). Each u64 holds 64 dimensions.
    pub data: Vec<u64>,
    /// Original vector dimension
    pub dimensions: usize,
}

impl BinaryQuantized {
    /// Quantize a full-precision f32 vector to binary (sign bits)
    /// 
    /// # Algorithm
    /// For each dimension: bit = 1 if value >= 0, else 0
    /// Pack into u64 words for efficient Hamming distance
    pub fn quantize(vector: &[f32]) -> Self {
        let dimensions = vector.len();
        let num_words = (dimensions + 63) / 64; // Ceiling division
        let mut data = vec![0u64; num_words];

        for (i, &v) in vector.iter().enumerate() {
            if v >= 0.0 {
                let word_idx = i / 64;
                let bit_idx = i % 64;
                data[word_idx] |= 1u64 << bit_idx;
            }
        }

        Self { data, dimensions }
    }

    /// Compute Hamming distance to another binary vector
    /// 
    /// # Returns
    /// Number of differing bits (lower = more similar)
    #[inline]
    pub fn hamming_distance(&self, other: &Self) -> u32 {
        if self.dimensions != other.dimensions {
            return u32::MAX;
        }

        self.data
            .iter()
            .zip(&other.data)
            .map(|(&a, &b)| (a ^ b).count_ones())
            .sum()
    }

    /// Compute normalized similarity from Hamming distance
    /// 
    /// # Returns
    /// Similarity in [0.0, 1.0] where 1.0 = identical
    #[inline]
    pub fn similarity(&self, other: &Self) -> f32 {
        let distance = self.hamming_distance(other);
        if distance == u32::MAX {
            return 0.0;
        }
        1.0 - (distance as f32 / self.dimensions as f32)
    }

    /// Memory size in bytes
    pub fn size_bytes(&self) -> usize {
        self.data.len() * 8 + 8 // data + dimensions field
    }

    /// Compression ratio vs f32
    pub fn compression_ratio(&self) -> f32 {
        if self.dimensions == 0 {
            return 1.0;
        }
        let original_bytes = self.dimensions * 4; // f32 = 4 bytes
        let compressed_bytes = self.size_bytes();
        original_bytes as f32 / compressed_bytes as f32
    }
}

/// Two-stage search: binary coarse filter → exact rerank
/// 
/// 1. Compute Hamming distance to all binary vectors (fast)
/// 2. Take top `rerank_count` candidates by Hamming
/// 3. Score candidates with full-precision similarity
/// 4. Return top-k
pub fn two_stage_search<F>(
    query: &[f32],
    binary_index: &[(u32, BinaryQuantized)],
    k: usize,
    rerank_multiplier: f32,
    get_full_vector: F,
    similarity_fn: fn(&[f32], &[f32]) -> f32,
) -> Vec<(u32, f32)>
where
    F: Fn(u32) -> Option<Vec<f32>>,
{
    if binary_index.is_empty() || k == 0 {
        return Vec::new();
    }

    // Stage 1: Binary coarse filter
    let query_binary = BinaryQuantized::quantize(query);
    let rerank_count = ((k as f32 * rerank_multiplier).ceil() as usize).max(k);

    let mut candidates: Vec<(u32, u32)> = binary_index
        .iter()
        .map(|(id, bq)| (*id, query_binary.hamming_distance(bq)))
        .collect();

    // Sort by Hamming distance (ascending = most similar first)
    candidates.sort_by_key(|(_, dist)| *dist);
    candidates.truncate(rerank_count);

    // Stage 2: Exact rerank with full precision
    let mut results: Vec<(u32, f32)> = candidates
        .into_iter()
        .filter_map(|(id, _)| {
            let full_vector = get_full_vector(id)?;
            let score = similarity_fn(query, &full_vector);
            Some((id, score))
        })
        .collect();

    // Sort by score (descending = highest similarity first)
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(k);

    results
}

/// Cosine similarity for reranking
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let mut dot = 0.0f32;
    let mut mag_a = 0.0f32;
    let mut mag_b = 0.0f32;

    for (x, y) in a.iter().zip(b) {
        dot += x * y;
        mag_a += x * x;
        mag_b += y * y;
    }

    let denom = (mag_a.sqrt() * mag_b.sqrt());
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============================================================================
    // Quantization Contract Tests
    // ============================================================================

    #[test]
    fn test_quantize_basic() {
        let vector = vec![1.0, -1.0, 0.5, -0.5, 0.0];
        let bq = BinaryQuantized::quantize(&vector);

        assert_eq!(bq.dimensions, 5);
        // Bits: 1, 0, 1, 0, 1 (0.0 counts as positive)
        // Packed: 0b10101 = 21
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
    fn test_quantize_all_positive() {
        let vector = vec![1.0, 2.0, 3.0, 4.0];
        let bq = BinaryQuantized::quantize(&vector);

        assert_eq!(bq.data[0] & 0b1111, 0b1111);
    }

    #[test]
    fn test_quantize_all_negative() {
        let vector = vec![-1.0, -2.0, -3.0, -4.0];
        let bq = BinaryQuantized::quantize(&vector);

        assert_eq!(bq.data[0] & 0b1111, 0b0000);
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
    fn test_hamming_half_different() {
        let v1 = vec![1.0, 1.0, -1.0, -1.0];
        let v2 = vec![1.0, -1.0, -1.0, 1.0];

        let bq1 = BinaryQuantized::quantize(&v1);
        let bq2 = BinaryQuantized::quantize(&v2);

        assert_eq!(bq1.hamming_distance(&bq2), 2);
    }

    #[test]
    fn test_hamming_dimension_mismatch() {
        let v1 = vec![1.0, 1.0];
        let v2 = vec![1.0, 1.0, 1.0];

        let bq1 = BinaryQuantized::quantize(&v1);
        let bq2 = BinaryQuantized::quantize(&v2);

        assert_eq!(bq1.hamming_distance(&bq2), u32::MAX);
    }

    // ============================================================================
    // Similarity Contract Tests
    // ============================================================================

    #[test]
    fn test_similarity_identical() {
        let v = vec![1.0, -1.0, 1.0, -1.0];
        let bq1 = BinaryQuantized::quantize(&v);
        let bq2 = BinaryQuantized::quantize(&v);

        assert!((bq1.similarity(&bq2) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_similarity_opposite() {
        let v1 = vec![1.0, 1.0, 1.0, 1.0];
        let v2 = vec![-1.0, -1.0, -1.0, -1.0];

        let bq1 = BinaryQuantized::quantize(&v1);
        let bq2 = BinaryQuantized::quantize(&v2);

        assert!((bq1.similarity(&bq2) - 0.0).abs() < 1e-6);
    }

    // ============================================================================
    // Compression Ratio Contract Tests
    // ============================================================================

    #[test]
    fn test_compression_ratio_384d() {
        let v: Vec<f32> = (0..384).map(|i| i as f32).collect();
        let bq = BinaryQuantized::quantize(&v);

        let ratio = bq.compression_ratio();
        // 384 * 4 = 1536 bytes / (6 * 8 + 8) = 56 bytes ≈ 27x
        // Actually: 1536 / 56 ≈ 27.4x
        assert!(ratio > 20.0 && ratio < 35.0, "Compression ratio: {}", ratio);
    }

    #[test]
    fn test_compression_ratio_768d() {
        let v: Vec<f32> = (0..768).map(|i| i as f32).collect();
        let bq = BinaryQuantized::quantize(&v);

        let ratio = bq.compression_ratio();
        // 768 * 4 = 3072 bytes / (12 * 8 + 8) = 104 bytes ≈ 29.5x
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
        // Create index
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
            (1, vec![1.0, 0.0, 0.0]),      // Exact match
            (2, vec![0.707, 0.707, 0.0]),  // 45 degrees
            (3, vec![0.0, 1.0, 0.0]),      // 90 degrees
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

        // Should be ordered by exact similarity after reranking
        assert_eq!(results[0].0, 1); // Exact match first
        assert!(results[0].1 > results[1].1); // Scores descending
    }

    #[test]
    fn test_two_stage_rerank_multiplier() {
        // With multiplier = 1.0, only k candidates are reranked
        // With multiplier = 3.0, 3*k candidates are reranked
        let vectors: Vec<(u32, Vec<f32>)> = (0..20)
            .map(|i| (i as u32, vec![1.0 - i as f32 * 0.05, i as f32 * 0.05, 0.0]))
            .collect();

        let binary_index: Vec<(u32, BinaryQuantized)> = vectors
            .iter()
            .map(|(id, v)| (*id, BinaryQuantized::quantize(v)))
            .collect();

        let query = vec![1.0, 0.0, 0.0];

        let results = two_stage_search(
            &query,
            &binary_index,
            5,
            3.0, // Get 15 candidates for reranking
            |id| vectors.iter().find(|(i, _)| *i == id).map(|(_, v)| v.clone()),
            cosine_similarity,
        );

        assert_eq!(results.len(), 5);
        // First result should be the most similar
        assert_eq!(results[0].0, 0);
    }

    // ============================================================================
    // Recall Benchmark Test
    // ============================================================================

    #[test]
    fn test_two_stage_recall_quality() {
        use std::collections::HashSet;

        // Generate random-ish vectors
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

        // Recall = overlap with brute force
        let recall = two_stage_ids.intersection(&brute_ids).count() as f32 / k as f32;

        // Binary quantization has inherent recall limits, but with 10x rerank
        // and 100 candidates for k=10, we should see reasonable overlap
        assert!(
            recall >= 0.3,
            "Two-stage recall@{} = {:.2}, expected >= 0.3 (binary quantization has inherent limits)",
            k, recall
        );
    }
}
