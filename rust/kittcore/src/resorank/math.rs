//! Math utilities for ResoRank
//!
//! Direct port from TypeScript math utilities section.
//! Includes IDF, TF normalization, saturation, and bit operations.

use super::config::{F32, U32, Usize};

// =============================================================================
// IDF Calculation
// =============================================================================

/// Calculate Inverse Document Frequency (IDF)
///
/// Uses the standard BM25 IDF formula:
/// IDF = ln(1 + (N - df + 0.5) / (df + 0.5))
///
/// # Arguments
/// * `total_documents` - Total number of documents in corpus
/// * `doc_frequency` - Number of documents containing this term
///
/// # Returns
/// IDF value (always >= 0)
#[inline]
pub fn calculate_idf(total_documents: F32, doc_frequency: Usize) -> F32 {
    if doc_frequency == 0 {
        return 0.0;
    }

    let df = doc_frequency as f32;
    let ratio = (total_documents - df + 0.5) / (df + 0.5);
    
    // ln(1 + max(0, ratio)) - ensures non-negative
    (1.0 + ratio.max(0.0)).ln()
}

// =============================================================================
// Term Frequency Normalization
// =============================================================================

/// Normalized term frequency using BM25F length normalization
///
/// Formula: tf / (1 - b + b * (fieldLength / avgFieldLength))
///
/// # Arguments
/// * `tf` - Raw term frequency
/// * `field_length` - Length of the field
/// * `average_field_length` - Average field length in corpus
/// * `b` - Length normalization parameter (0.0 = no normalization, 1.0 = full)
#[inline]
pub fn normalized_term_frequency(
    tf: U32,
    field_length: U32,
    average_field_length: F32,
    b: F32,
) -> F32 {
    if average_field_length <= 0.0 || tf == 0 {
        return 0.0;
    }

    let denominator = 1.0 - b + b * (field_length as f32 / average_field_length);
    
    if denominator > 0.0 {
        tf as f32 / denominator
    } else {
        0.0
    }
}

/// BM𝒳-enhanced normalized term frequency
///
/// Adds entropy adjustment to the denominator:
/// tf / (1 - b + b * (fieldLength / avgFieldLength) + γ × ℰ)
///
/// # Arguments
/// * `tf` - Raw term frequency
/// * `field_length` - Length of the field
/// * `average_field_length` - Average field length in corpus
/// * `b` - Length normalization parameter
/// * `avg_entropy` - Average normalized entropy (ℰ) from query terms
/// * `gamma` - Weight for entropy in denominator (γ)
#[inline]
pub fn normalized_term_frequency_bmx(
    tf: U32,
    field_length: U32,
    average_field_length: F32,
    b: F32,
    avg_entropy: F32,
    gamma: F32,
) -> F32 {
    if average_field_length <= 0.0 || tf == 0 {
        return 0.0;
    }

    // Standard BM25F length normalization
    let length_norm = 1.0 - b + b * (field_length as f32 / average_field_length);

    // BM𝒳 enhancement: add γ × ℰ to denominator
    let denominator = length_norm + gamma * avg_entropy;

    if denominator > 0.0 {
        tf as f32 / denominator
    } else {
        0.0
    }
}

// =============================================================================
// Saturation Functions
// =============================================================================

/// Term saturation function (BM25)
///
/// Formula: ((k1 + 1) * aggregatedScore) / (k1 + aggregatedScore)
///
/// # Arguments
/// * `aggregated_score` - Aggregated field scores
/// * `k1` - Saturation parameter (higher = more weight to additional occurrences)
#[inline]
pub fn saturate(aggregated_score: F32, k1: F32) -> F32 {
    saturate_bmx(aggregated_score, k1)
}

/// BM𝒳-compatible saturation function
///
/// Works with either k1 (classic) or α (adaptive)
#[inline]
pub fn saturate_bmx(aggregated_score: F32, k1_or_alpha: F32) -> F32 {
    if !aggregated_score.is_finite() || aggregated_score <= 0.0 {
        return 0.0;
    }

    if k1_or_alpha <= 0.0 {
        return aggregated_score;
    }

    ((k1_or_alpha + 1.0) * aggregated_score) / (k1_or_alpha + aggregated_score)
}

// =============================================================================
// Bit Operations
// =============================================================================

/// Population count (number of set bits in a u32)
///
/// Uses SWAR algorithm for efficient bit counting without hardware intrinsics.
/// Matches the TypeScript implementation exactly.
#[inline]
pub fn pop_count(mut n: U32) -> U32 {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    (((n + (n >> 4)) & 0x0F0F0F0F).wrapping_mul(0x01010101)) >> 24
}

/// Format a number as binary string with fixed width
#[inline]
pub fn format_binary(n: U32, bits: U32) -> String {
    format!("{:0width$b}", n, width = bits as usize)
}

// =============================================================================
// Segment Calculation
// =============================================================================

/// Calculate adaptive segment count based on document length
///
/// # Arguments
/// * `doc_length` - Total tokens in document
/// * `tokens_per_segment` - Target tokens per segment (default: 50)
///
/// # Returns
/// Segment count clamped between 8 and 32
#[inline]
pub fn adaptive_segment_count(doc_length: U32, tokens_per_segment: U32) -> U32 {
    let raw = (doc_length as f32 / tokens_per_segment as f32).ceil() as u32;
    raw.clamp(8, 32)
}

// =============================================================================
// BM𝒳 Parameter Calculations
// =============================================================================

/// Sigmoid function for entropy calculation
#[inline]
pub fn sigmoid(x: F32) -> F32 {
    1.0 / (1.0 + (-x).exp())
}

/// Calculate adaptive alpha parameter (BM𝒳 Equation 3)
///
/// α = clamp(avgDocLength / 100, 0.5, 1.5)
#[inline]
pub fn calculate_adaptive_alpha(average_document_length: F32) -> F32 {
    (average_document_length / 100.0).clamp(0.5, 1.5)
}

/// Calculate beta parameter for similarity boost (BM𝒳 Equation 3)
///
/// β = 1 / ln(1 + N)
#[inline]
pub fn calculate_beta(total_documents: Usize) -> F32 {
    1.0 / (1.0 + total_documents as f32).ln()
}

/// Calculate normalized score (BM𝒳 Equations 10-11)
#[inline]
pub fn normalize_score(raw_score: F32, query_length: usize, total_documents: Usize) -> F32 {
    let max_idf_approx = (1.0 + (total_documents as f32 - 0.5) / 1.5).ln();
    let score_max = query_length as f32 * (max_idf_approx + 1.0);
    
    if score_max > 0.0 {
        raw_score / score_max
    } else {
        0.0
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_idf() {
        // Term appearing in 1 out of 100 docs should have high IDF
        let idf_rare = calculate_idf(100.0, 1);
        assert!(idf_rare > 3.0);

        // Term appearing in 50 out of 100 docs should have low IDF
        let idf_common = calculate_idf(100.0, 50);
        assert!(idf_common < 1.0);
        assert!(idf_common >= 0.0);

        // Zero doc frequency should return 0
        let idf_zero = calculate_idf(100.0, 0);
        assert_eq!(idf_zero, 0.0);
    }

    #[test]
    fn test_normalized_term_frequency() {
        // Standard case
        let ntf = normalized_term_frequency(3, 100, 100.0, 0.75);
        assert!((ntf - 3.0).abs() < 0.001); // Should be exactly 3 when lengths match

        // Long document (should reduce TF)
        let ntf_long = normalized_term_frequency(3, 200, 100.0, 0.75);
        assert!(ntf_long < 3.0);

        // Short document (should boost TF)
        let ntf_short = normalized_term_frequency(3, 50, 100.0, 0.75);
        assert!(ntf_short > 3.0);
    }

    #[test]
    fn test_saturate() {
        // At k1=1.2, saturation should limit growth
        let sat1 = saturate(1.0, 1.2);
        let sat2 = saturate(2.0, 1.2);
        let sat10 = saturate(10.0, 1.2);

        // Scores should grow sublinearly
        assert!(sat2 < 2.0 * sat1);
        assert!(sat10 < 10.0 * sat1);

        // Should never exceed 1 + k1 = 2.2 asymptotically
        let sat100 = saturate(100.0, 1.2);
        assert!(sat100 < 2.2);
    }

    #[test]
    fn test_pop_count() {
        assert_eq!(pop_count(0b0000), 0);
        assert_eq!(pop_count(0b0001), 1);
        assert_eq!(pop_count(0b1111), 4);
        assert_eq!(pop_count(0b10101010), 4);
        assert_eq!(pop_count(0xFFFFFFFF), 32);
    }

    #[test]
    fn test_adaptive_segment_count() {
        assert_eq!(adaptive_segment_count(100, 50), 8);  // Clamped to min
        assert_eq!(adaptive_segment_count(1000, 50), 20);
        assert_eq!(adaptive_segment_count(5000, 50), 32); // Clamped to max
    }

    #[test]
    fn test_sigmoid() {
        assert!((sigmoid(0.0) - 0.5).abs() < 0.001);
        assert!(sigmoid(10.0) > 0.999);
        assert!(sigmoid(-10.0) < 0.001);
    }

    #[test]
    fn test_adaptive_alpha() {
        assert_eq!(calculate_adaptive_alpha(50.0), 0.5);   // Clamped to min
        assert_eq!(calculate_adaptive_alpha(100.0), 1.0);
        assert_eq!(calculate_adaptive_alpha(200.0), 1.5);  // Clamped to max
    }
}
