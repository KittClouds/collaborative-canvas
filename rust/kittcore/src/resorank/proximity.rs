//! Proximity strategies for ResoRank
//!
//! Implements 4 proximity calculation strategies that boost scores
//! when query terms appear close together in documents.

use super::config::{F32, U32};
use super::math::pop_count;
use super::types::TermWithIdf;
use serde::{Deserialize, Serialize};

// =============================================================================
// Proximity Strategy Enum
// =============================================================================

/// Proximity calculation strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProximityStrategy {
    /// Global overlap across all terms
    Global,
    /// Per-term proximity with other terms
    PerTerm,
    /// Pairwise overlap between term pairs
    Pairwise,
    /// IDF-weighted: rare terms have stronger proximity effect
    IdfWeighted,
}

impl Default for ProximityStrategy {
    fn default() -> Self {
        ProximityStrategy::IdfWeighted
    }
}

impl ProximityStrategy {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProximityStrategy::Global => "global",
            ProximityStrategy::PerTerm => "per-term",
            ProximityStrategy::Pairwise => "pairwise",
            ProximityStrategy::IdfWeighted => "idf-weighted",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "global" => ProximityStrategy::Global,
            "per-term" | "perterm" => ProximityStrategy::PerTerm,
            "pairwise" => ProximityStrategy::Pairwise,
            "idf-weighted" | "idfweighted" => ProximityStrategy::IdfWeighted,
            _ => ProximityStrategy::IdfWeighted,
        }
    }
}

// =============================================================================
// Proximity Result
// =============================================================================

/// Result of proximity calculation
#[derive(Debug, Clone)]
pub struct ProximityResult {
    /// Final multiplier to apply to score
    pub multiplier: F32,
    /// Number of segments where all terms overlap
    pub overlap_count: U32,
    /// Length decay factor
    pub decay: F32,
    /// IDF boost factor (for IdfWeighted strategy)
    pub idf_boost: F32,
}

impl Default for ProximityResult {
    fn default() -> Self {
        Self {
            multiplier: 1.0,
            overlap_count: 0,
            decay: 1.0,
            idf_boost: 1.0,
        }
    }
}

// =============================================================================
// Global Proximity
// =============================================================================

/// Global proximity multiplier
///
/// Computes overlap across ALL query terms. Terms must appear in the same
/// segment to contribute to proximity boost.
///
/// # Arguments
/// * `term_masks` - Segment bitmasks for each query term
/// * `alpha` - Proximity strength parameter
/// * `max_segments` - Maximum segments (for normalization)
/// * `document_length` - Length of document
/// * `avg_doc_length` - Average document length in corpus
/// * `decay_lambda` - Decay factor for length penalty
pub fn global_proximity_multiplier(
    term_masks: &[U32],
    alpha: F32,
    max_segments: U32,
    document_length: U32,
    avg_doc_length: F32,
    decay_lambda: F32,
) -> ProximityResult {
    if term_masks.len() < 2 {
        return ProximityResult::default();
    }

    // AND all masks together to find common segments
    let common_mask = term_masks.iter().fold(0xFFFFFFFF, |acc, &mask| acc & mask);
    let overlap_count = pop_count(common_mask);
    let max_possible_overlap = (term_masks.len() as u32).min(max_segments);

    if max_possible_overlap == 0 {
        return ProximityResult::default();
    }

    let base_multiplier = overlap_count as f32 / max_possible_overlap as f32;
    let length_ratio = if avg_doc_length > 0.0 {
        document_length as f32 / avg_doc_length
    } else {
        1.0
    };
    let decay = (-decay_lambda * length_ratio).exp();

    ProximityResult {
        multiplier: 1.0 + alpha * base_multiplier * decay,
        overlap_count,
        decay,
        idf_boost: 1.0,
    }
}

// =============================================================================
// IDF-Weighted Proximity
// =============================================================================

/// IDF-weighted proximity multiplier
///
/// Rare term clusters get stronger boost. When high-IDF terms appear
/// close together, the proximity bonus is amplified.
///
/// # Arguments
/// * `term_data` - Term masks with IDF values
/// * `alpha` - Proximity strength parameter
/// * `max_segments` - Maximum segments
/// * `document_length` - Length of document
/// * `avg_doc_length` - Average document length
/// * `decay_lambda` - Decay factor
/// * `idf_scale` - IDF scaling factor (default: 5.0)
pub fn idf_weighted_proximity_multiplier(
    term_data: &[TermWithIdf],
    alpha: F32,
    max_segments: U32,
    document_length: U32,
    avg_doc_length: F32,
    decay_lambda: F32,
    idf_scale: F32,
) -> ProximityResult {
    if term_data.len() < 2 {
        return ProximityResult::default();
    }

    // Calculate average IDF
    let total_idf: f32 = term_data.iter().map(|t| t.idf).sum();
    let avg_idf = total_idf / term_data.len() as f32;

    // AND all masks
    let common_mask = term_data.iter().fold(0xFFFFFFFF, |acc, t| acc & t.mask);
    let overlap_count = pop_count(common_mask);
    let max_possible_overlap = (term_data.len() as u32).min(max_segments);

    if max_possible_overlap == 0 {
        return ProximityResult::default();
    }

    let base_multiplier = overlap_count as f32 / max_possible_overlap as f32;
    let idf_boost = 1.0 + avg_idf / idf_scale;
    let length_ratio = if avg_doc_length > 0.0 {
        document_length as f32 / avg_doc_length
    } else {
        1.0
    };
    let decay = (-decay_lambda * length_ratio).exp();

    ProximityResult {
        multiplier: 1.0 + alpha * base_multiplier * idf_boost * decay,
        overlap_count,
        decay,
        idf_boost,
    }
}

// =============================================================================
// Per-Term Proximity
// =============================================================================

/// Per-term proximity multiplier
///
/// Calculates average overlap between one term and all other terms.
///
/// # Arguments
/// * `term_mask` - Segment mask for the current term
/// * `other_masks` - Segment masks for other query terms
/// * `alpha` - Proximity strength parameter
/// * `max_segments` - Maximum segments
pub fn per_term_proximity_multiplier(
    term_mask: U32,
    other_masks: &[U32],
    alpha: F32,
    max_segments: U32,
) -> F32 {
    if other_masks.is_empty() || max_segments == 0 {
        return 1.0;
    }

    let total_overlap: u32 = other_masks.iter().map(|&other| pop_count(term_mask & other)).sum();
    let average_overlap = total_overlap as f32 / other_masks.len() as f32;
    let normalized_overlap = average_overlap / max_segments as f32;

    1.0 + alpha * normalized_overlap
}

// =============================================================================
// Pairwise Proximity
// =============================================================================

/// Pairwise proximity bonus
///
/// Calculates average overlap between all pairs of terms.
///
/// # Arguments
/// * `term_masks` - Segment masks for all query terms
/// * `alpha` - Proximity strength parameter
/// * `max_segments` - Maximum segments
pub fn pairwise_proximity_bonus(term_masks: &[U32], alpha: F32, max_segments: U32) -> F32 {
    if term_masks.len() < 2 || max_segments == 0 {
        return 0.0;
    }

    let mut total_proximity = 0.0;
    let mut pair_count = 0;

    for i in 0..term_masks.len() {
        for j in (i + 1)..term_masks.len() {
            let overlap = pop_count(term_masks[i] & term_masks[j]);
            total_proximity += overlap as f32 / max_segments as f32;
            pair_count += 1;
        }
    }

    if pair_count > 0 {
        alpha * (total_proximity / pair_count as f32)
    } else {
        0.0
    }
}

// =============================================================================
// Phrase Detection
// =============================================================================

/// Detect if consecutive query terms appear in adjacent segments
///
/// Enforces strict order: term[i] must be in segment N, term[i+1] in segment N+1.
///
/// # Arguments
/// * `query_terms` - Query terms in order
/// * `doc_term_masks` - Mapping of term -> segment mask for this document
pub fn detect_phrase_match(
    query_terms: &[String],
    doc_term_masks: &std::collections::HashMap<String, U32>,
) -> bool {
    if query_terms.len() < 2 {
        return false;
    }

    for i in 0..(query_terms.len() - 1) {
        let mask1 = doc_term_masks.get(&query_terms[i]);
        let mask2 = doc_term_masks.get(&query_terms[i + 1]);

        match (mask1, mask2) {
            (Some(&m1), Some(&m2)) => {
                // Shift mask1 left: 0001 -> 0010. If mask2 has bit at 0010, they are adjacent.
                let strict_order_adjacent = (m1 << 1) & m2;
                if strict_order_adjacent == 0 {
                    return false;
                }
            }
            _ => return false,
        }
    }

    true
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_global_proximity() {
        // Two terms, both in segment 0
        let masks = vec![0b0001, 0b0001];
        let result = global_proximity_multiplier(&masks, 0.5, 16, 100, 100.0, 0.5);
        
        assert!(result.multiplier > 1.0);
        assert_eq!(result.overlap_count, 1);
    }

    #[test]
    fn test_global_proximity_no_overlap() {
        // Two terms in different segments
        let masks = vec![0b0001, 0b0010];
        let result = global_proximity_multiplier(&masks, 0.5, 16, 100, 100.0, 0.5);
        
        assert_eq!(result.overlap_count, 0);
        assert_eq!(result.multiplier, 1.0);
    }

    #[test]
    fn test_idf_weighted_proximity() {
        let term_data = vec![
            TermWithIdf { mask: 0b0001, idf: 3.0 },
            TermWithIdf { mask: 0b0001, idf: 3.0 },
        ];
        let result = idf_weighted_proximity_multiplier(&term_data, 0.5, 16, 100, 100.0, 0.5, 5.0);
        
        assert!(result.multiplier > 1.0);
        assert!(result.idf_boost > 1.0);
    }

    #[test]
    fn test_pairwise_proximity() {
        let masks = vec![0b1111, 0b1111, 0b1111]; // Full overlap
        let bonus = pairwise_proximity_bonus(&masks, 0.5, 4);
        
        assert!(bonus > 0.0);
        assert!(bonus <= 0.5);
    }

    #[test]
    fn test_phrase_detection() {
        let mut masks = HashMap::new();
        masks.insert("hello".to_string(), 0b0001); // Segment 0
        masks.insert("world".to_string(), 0b0010); // Segment 1 (adjacent)

        let query = vec!["hello".to_string(), "world".to_string()];
        assert!(detect_phrase_match(&query, &masks));

        // Non-adjacent
        masks.insert("world".to_string(), 0b0100); // Segment 2 (not adjacent)
        assert!(!detect_phrase_match(&query, &masks));
    }
}
