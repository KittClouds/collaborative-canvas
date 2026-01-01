//! Incremental Scorer for Streaming Updates
//!
//! Optimized for incrementally building scores as term data arrives,
//! useful for streaming tokenization scenarios.

use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

use super::config::{CorpusStatistics, FieldId, ResoRankConfig, F32, U32, Usize};
use super::math::{calculate_idf, normalized_term_frequency, saturate};
use super::proximity::{
    global_proximity_multiplier, idf_weighted_proximity_multiplier, pairwise_proximity_bonus,
    ProximityStrategy,
};
use super::types::{FieldAccumulator, IncrementalDocumentAccumulator, TermWithIdf};

// =============================================================================
// Incremental Scorer
// =============================================================================

/// Incremental scorer that accumulates scores as terms are processed
#[wasm_bindgen]
pub struct ResoRankIncrementalScorer {
    config: ResoRankConfig,
    corpus_stats: CorpusStatistics,
    document_accumulators: HashMap<String, IncrementalDocumentAccumulator>,
    idf_cache: HashMap<Usize, F32>,
    current_term_index: usize,
}

impl ResoRankIncrementalScorer {
    /// Create a new incremental scorer
    pub fn new(config: ResoRankConfig, corpus_stats: CorpusStatistics) -> Self {
        Self {
            config,
            corpus_stats,
            document_accumulators: HashMap::new(),
            idf_cache: HashMap::new(),
            current_term_index: 0,
        }
    }

    /// Create with default configuration
    pub fn with_defaults(corpus_stats: CorpusStatistics) -> Self {
        Self::new(ResoRankConfig::default(), corpus_stats)
    }

    /// Get or calculate IDF
    fn get_or_calculate_idf(&mut self, corpus_doc_freq: Usize) -> F32 {
        if let Some(&idf) = self.idf_cache.get(&corpus_doc_freq) {
            return idf;
        }

        let idf = calculate_idf(self.corpus_stats.total_documents as f32, corpus_doc_freq);
        self.idf_cache.insert(corpus_doc_freq, idf);
        idf
    }

    /// Move to the next term in the query
    pub fn next_term(&mut self) {
        self.current_term_index += 1;
    }

    /// Reset the scorer for a new query
    pub fn reset(&mut self) {
        self.current_term_index = 0;
        self.document_accumulators.clear();
    }

    /// Add a field contribution for the current term in a document
    ///
    /// # Arguments
    /// * `doc_id` - Document ID
    /// * `field_id` - Field ID
    /// * `tf` - Term frequency in this field
    /// * `field_length` - Length of the field
    /// * `segment_mask` - Segment bitmask for proximity
    /// * `document_length` - Total document length
    pub fn add_field_contribution(
        &mut self,
        doc_id: &str,
        field_id: FieldId,
        tf: U32,
        field_length: U32,
        segment_mask: U32,
        document_length: U32,
    ) {
        let acc = self
            .document_accumulators
            .entry(doc_id.to_string())
            .or_insert_with(|| IncrementalDocumentAccumulator::new(document_length));

        // Ensure we have enough field contribution slots
        while acc.field_contributions.len() <= self.current_term_index {
            acc.field_contributions.push(HashMap::new());
        }

        // Store field contribution
        acc.field_contributions[self.current_term_index].insert(
            field_id,
            FieldAccumulator {
                tf,
                field_length,
                segment_mask,
            },
        );

        // Update term mask
        if acc.term_masks.len() <= self.current_term_index {
            acc.term_masks.push(segment_mask);
        } else {
            acc.term_masks[self.current_term_index] |= segment_mask;
        }

        // Update field masks
        let field_masks = acc.field_masks.entry(field_id).or_insert_with(Vec::new);
        while field_masks.len() <= self.current_term_index {
            field_masks.push(0);
        }
        field_masks[self.current_term_index] |= segment_mask;
    }

    /// Finalize the current term with IDF calculation
    ///
    /// Call this after all documents have contributed to the current term
    pub fn finalize_term(&mut self, corpus_doc_frequency: Usize) {
        let idf = self.get_or_calculate_idf(corpus_doc_frequency);

        for acc in self.document_accumulators.values_mut() {
            let term_contribs = match acc.field_contributions.get(self.current_term_index) {
                Some(c) => c,
                None => continue,
            };

            if term_contribs.is_empty() {
                continue;
            }

            let mut aggregated_s = 0.0;

            for (&field_id, field_acc) in term_contribs {
                let params = match self.config.field_params.get(&field_id) {
                    Some(p) => p,
                    None => continue,
                };

                let avg_len = self
                    .corpus_stats
                    .average_field_lengths
                    .get(&field_id)
                    .copied()
                    .unwrap_or(1.0);

                let normalized_tf = normalized_term_frequency(
                    field_acc.tf,
                    field_acc.field_length,
                    avg_len,
                    params.b,
                );

                aggregated_s += params.weight * normalized_tf;
            }

            let term_score = idf * saturate(aggregated_s, self.config.k1);
            acc.bm25_score += term_score;

            // Store IDF for proximity calculation
            while acc.term_idfs.len() <= self.current_term_index {
                acc.term_idfs.push(0.0);
            }
            acc.term_idfs[self.current_term_index] = idf;
        }
    }

    /// Get final scores for all documents
    pub fn get_scores(&self, strategy: ProximityStrategy) -> HashMap<String, F32> {
        let mut results = HashMap::new();

        for (doc_id, acc) in &self.document_accumulators {
            let mut final_score = acc.bm25_score;

            match strategy {
                ProximityStrategy::Global => {
                    let result = global_proximity_multiplier(
                        &acc.term_masks,
                        self.config.proximity_alpha,
                        self.config.max_segments,
                        acc.document_length,
                        self.corpus_stats.average_document_length,
                        self.config.proximity_decay_lambda,
                    );
                    final_score *= result.multiplier;
                }

                ProximityStrategy::IdfWeighted => {
                    let term_data: Vec<_> = acc
                        .term_masks
                        .iter()
                        .zip(&acc.term_idfs)
                        .map(|(&mask, &idf)| TermWithIdf { mask, idf })
                        .collect();

                    let result = idf_weighted_proximity_multiplier(
                        &term_data,
                        self.config.proximity_alpha,
                        self.config.max_segments,
                        acc.document_length,
                        self.corpus_stats.average_document_length,
                        self.config.proximity_decay_lambda,
                        self.config.idf_proximity_scale,
                    );
                    final_score *= result.multiplier;
                }

                ProximityStrategy::Pairwise => {
                    let bonus = pairwise_proximity_bonus(
                        &acc.term_masks,
                        self.config.proximity_alpha,
                        self.config.max_segments,
                    );
                    final_score *= 1.0 + bonus;
                }

                ProximityStrategy::PerTerm => {
                    // Already handled in add_field_contribution
                }
            }

            if final_score > 0.0 {
                results.insert(doc_id.clone(), final_score);
            }
        }

        results
    }

    /// Get scores with additional explanation data
    pub fn get_scores_with_explanations(
        &self,
        strategy: ProximityStrategy,
    ) -> HashMap<String, IncrementalScoreExplanation> {
        let mut results = HashMap::new();

        for (doc_id, acc) in &self.document_accumulators {
            let mut final_score = acc.bm25_score;
            let mut overlap_count = 0;

            if strategy == ProximityStrategy::IdfWeighted {
                let term_data: Vec<_> = acc
                    .term_masks
                    .iter()
                    .zip(&acc.term_idfs)
                    .map(|(&mask, &idf)| TermWithIdf { mask, idf })
                    .collect();

                let result = idf_weighted_proximity_multiplier(
                    &term_data,
                    self.config.proximity_alpha,
                    self.config.max_segments,
                    acc.document_length,
                    self.corpus_stats.average_document_length,
                    self.config.proximity_decay_lambda,
                    self.config.idf_proximity_scale,
                );

                final_score *= result.multiplier;
                overlap_count = result.overlap_count;
            }

            if final_score > 0.0 {
                results.insert(
                    doc_id.clone(),
                    IncrementalScoreExplanation {
                        score: final_score,
                        term_count: acc.term_masks.len(),
                        overlap_count,
                    },
                );
            }
        }

        results
    }
}

/// Explanation for incremental scores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncrementalScoreExplanation {
    pub score: F32,
    pub term_count: usize,
    pub overlap_count: U32,
}

// =============================================================================
// WASM API
// =============================================================================

#[wasm_bindgen]
impl ResoRankIncrementalScorer {
    /// Create a new incremental scorer
    #[wasm_bindgen(constructor)]
    pub fn js_new(config_val: JsValue, corpus_stats_val: JsValue) -> Result<ResoRankIncrementalScorer, JsValue> {
        let config: ResoRankConfig = if config_val.is_undefined() || config_val.is_null() {
            ResoRankConfig::default()
        } else {
            serde_wasm_bindgen::from_value(config_val)?
        };
        let corpus_stats: CorpusStatistics = serde_wasm_bindgen::from_value(corpus_stats_val)?;
        Ok(Self::new(config, corpus_stats))
    }

    /// Move to next term
    #[wasm_bindgen(js_name = nextTerm)]
    pub fn js_next_term(&mut self) {
        self.next_term();
    }

    /// Reset state
    #[wasm_bindgen(js_name = reset)]
    pub fn js_reset(&mut self) {
        self.reset();
    }

    /// Add field contribution
    #[wasm_bindgen(js_name = addFieldContribution)]
    pub fn js_add_field_contribution(
        &mut self,
        doc_id: &str,
        field_id: FieldId,
        tf: U32,
        field_length: U32,
        segment_mask: U32,
        document_length: U32,
    ) {
        self.add_field_contribution(doc_id, field_id, tf, field_length, segment_mask, document_length);
    }

    /// Finalize term
    #[wasm_bindgen(js_name = finalizeTerm)]
    pub fn js_finalize_term(&mut self, corpus_doc_frequency: usize) {
        self.finalize_term(corpus_doc_frequency);
    }

    /// Get scores map
    #[wasm_bindgen(js_name = getScores)]
    pub fn js_get_scores(&self, strategy_str: Option<String>) -> Result<JsValue, JsValue> {
        let strategy = strategy_str
            .as_deref()
            .map(ProximityStrategy::from_str)
            .unwrap_or_default();
        
        let scores = self.get_scores(strategy);
        Ok(serde_wasm_bindgen::to_value(&scores)?)
    }

    /// Get scores with explanations
    #[wasm_bindgen(js_name = getScoresWithExplanations)]
    pub fn js_get_scores_with_explanations(&self, strategy_str: Option<String>) -> Result<JsValue, JsValue> {
        let strategy = strategy_str
            .as_deref()
            .map(ProximityStrategy::from_str)
            .unwrap_or_default();
            
        let results = self.get_scores_with_explanations(strategy);
        Ok(serde_wasm_bindgen::to_value(&results)?)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_corpus_stats() -> CorpusStatistics {
        let mut stats = CorpusStatistics::default();
        stats.total_documents = 100;
        stats.average_document_length = 500.0;
        stats.average_field_lengths.insert(0, 10.0);
        stats.average_field_lengths.insert(1, 490.0);
        stats
    }

    #[test]
    fn test_incremental_single_term() {
        let mut scorer = ResoRankIncrementalScorer::with_defaults(create_test_corpus_stats());

        // Add "hello" in doc1
        scorer.add_field_contribution("doc1", 0, 1, 10, 0b0001, 500);
        scorer.add_field_contribution("doc1", 1, 3, 490, 0b0011, 500);

        scorer.finalize_term(10); // 10 docs contain this term

        let scores = scorer.get_scores(ProximityStrategy::IdfWeighted);
        assert!(scores.contains_key("doc1"));
        assert!(*scores.get("doc1").unwrap() > 0.0);
    }

    #[test]
    fn test_incremental_multi_term() {
        let mut scorer = ResoRankIncrementalScorer::with_defaults(create_test_corpus_stats());

        // Term 1: "hello"
        scorer.add_field_contribution("doc1", 0, 1, 10, 0b0001, 500);
        scorer.finalize_term(10);
        scorer.next_term();

        // Term 2: "world" (adjacent segment)
        scorer.add_field_contribution("doc1", 0, 1, 10, 0b0010, 500);
        scorer.finalize_term(5);

        let scores = scorer.get_scores(ProximityStrategy::IdfWeighted);
        assert!(scores.contains_key("doc1"));

        // Should have higher score due to proximity
        let single_scorer = {
            let mut s = ResoRankIncrementalScorer::with_defaults(create_test_corpus_stats());
            s.add_field_contribution("doc1", 0, 1, 10, 0b0001, 500);
            s.finalize_term(10);
            s
        };
        let single_scores = single_scorer.get_scores(ProximityStrategy::IdfWeighted);

        // Multi-term with proximity should score differently than single term
        assert_ne!(
            scores.get("doc1").unwrap(),
            single_scores.get("doc1").unwrap()
        );
    }

    #[test]
    fn test_reset() {
        let mut scorer = ResoRankIncrementalScorer::with_defaults(create_test_corpus_stats());

        scorer.add_field_contribution("doc1", 0, 1, 10, 0b0001, 500);
        scorer.finalize_term(10);

        assert!(!scorer.document_accumulators.is_empty());

        scorer.reset();

        assert!(scorer.document_accumulators.is_empty());
        assert_eq!(scorer.current_term_index, 0);
    }
}
