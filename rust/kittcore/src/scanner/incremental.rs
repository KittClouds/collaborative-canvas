//! Incremental Scanner: Chunk-based delta scanning
//!
//! Enables sub-20ms updates by only reprocessing changed regions.
//!
//! # Architecture
//! - **Paragraph-based chunking**: Split by `\n\n` with sentence fallback for giant blobs
//! - **Hash-based diffing**: Compare chunk hashes to identify dirty regions
//! - **Coordinate shifting**: Adjust item positions downstream of changes
//! - **Partial rescan**: Only run extractors on dirty regions + context padding

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::ops::Range;

use crate::scanner::{
    ExtractedTriple, ImplicitMention, TemporalMention, UnifiedRelation,
};

// =============================================================================
// Constants
// =============================================================================

/// Maximum chunk size before triggering sentence-level fallback
const MAX_CHUNK_SIZE: usize = 2000;

/// Dirty ratio threshold for incremental scanning (30%)
const DIRTY_RATIO_THRESHOLD: f64 = 0.30;

/// Maximum dirty chunks before falling back to full rescan
const MAX_DIRTY_CHUNKS: usize = 10;

/// Context padding: how many paragraphs to expand around dirty region
const CONTEXT_PADDING_PARAGRAPHS: usize = 1;

// =============================================================================
// Core Types
// =============================================================================

/// A chunk of text with position and hash
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    /// Absolute start position in the source text
    pub start: usize,
    /// Absolute end position in the source text
    pub end: usize,
    /// Content hash (FNV-1a via DefaultHasher)
    pub hash: u64,
}

impl Chunk {
    /// Create a new chunk from text slice with position
    pub fn new(text: &str, start: usize) -> Self {
        Self {
            start,
            end: start + text.len(),
            hash: compute_hash(text),
        }
    }

    /// Length of this chunk
    pub fn len(&self) -> usize {
        self.end - self.start
    }

    /// Check if chunk is empty
    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }
}

/// A single change record for shift calculation
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Change {
    /// Original start position
    pub old_start: usize,
    /// Original end position
    pub old_end: usize,
    /// Original length
    pub old_len: usize,
    /// New length (after change)
    pub new_len: usize,
}

impl Change {
    /// Net shift caused by this change
    pub fn shift(&self) -> i64 {
        self.new_len as i64 - self.old_len as i64
    }
}

/// Delta result from comparing old chunks to new text
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Delta {
    /// Ranges in the NEW text that need rescanning
    pub dirty_ranges: Vec<Range<usize>>,
    /// Individual change records for shift calculation
    pub changes: Vec<Change>,
    /// Total number of chunks in the new text
    pub total_chunks: usize,
    /// Number of dirty chunks
    pub dirty_chunks: usize,
}

impl Delta {
    /// Check if incremental scanning should be used
    pub fn should_use_incremental(&self) -> bool {
        if self.total_chunks == 0 {
            return false;
        }
        let dirty_ratio = self.dirty_chunks as f64 / self.total_chunks as f64;
        dirty_ratio < DIRTY_RATIO_THRESHOLD && self.dirty_chunks < MAX_DIRTY_CHUNKS
    }

    /// Calculate cumulative shift at a given position
    pub fn shift_at(&self, pos: usize) -> i64 {
        let mut shift = 0i64;
        for change in &self.changes {
            if change.old_end <= pos {
                shift += change.shift();
            }
        }
        shift
    }

    /// Check if a range overlaps any dirty range
    pub fn overlaps_dirty(&self, start: usize, end: usize) -> bool {
        self.dirty_ranges.iter().any(|dirty| {
            start < dirty.end && end > dirty.start
        })
    }
}

/// Cached extracted items from a previous scan
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ExtractedItems {
    pub unified_relations: Vec<UnifiedRelation>,
    pub implicit: Vec<ImplicitMention>,
    pub triples: Vec<ExtractedTriple>,
    pub temporal: Vec<TemporalMention>,
}

/// Full incremental state persisted between scans
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IncrementalState {
    /// Chunked representation of the last scanned text
    pub chunks: Vec<Chunk>,
    /// Cached extracted items
    pub extracted_items: ExtractedItems,
}

/// Statistics for incremental scanning
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IncrementalStats {
    /// Number of incremental scans performed
    pub incremental_count: u64,
    /// Number of full rescans performed
    pub full_rescan_count: u64,
    /// Average dirty ratio for incremental scans
    pub avg_dirty_ratio: f64,
}

// =============================================================================
// Trait for shiftable items
// =============================================================================

/// Trait for items that have start/end positions
pub trait HasSpan {
    fn start(&self) -> usize;
    fn end(&self) -> usize;
    fn set_start(&mut self, start: usize);
    fn set_end(&mut self, end: usize);
}

// Implement HasSpan for all extraction types
impl HasSpan for UnifiedRelation {
    fn start(&self) -> usize { self.span.map(|(s, _)| s).unwrap_or(0) }
    fn end(&self) -> usize { self.span.map(|(_, e)| e).unwrap_or(0) }
    fn set_start(&mut self, start: usize) {
        if let Some((_, end)) = self.span {
            self.span = Some((start, end));
        }
    }
    fn set_end(&mut self, end: usize) {
        if let Some((start, _)) = self.span {
            self.span = Some((start, end));
        }
    }
}

impl HasSpan for ImplicitMention {
    fn start(&self) -> usize { self.start }
    fn end(&self) -> usize { self.end }
    fn set_start(&mut self, start: usize) { self.start = start; }
    fn set_end(&mut self, end: usize) { self.end = end; }
}

impl HasSpan for ExtractedTriple {
    fn start(&self) -> usize { self.start }
    fn end(&self) -> usize { self.end }
    fn set_start(&mut self, start: usize) { self.start = start; }
    fn set_end(&mut self, end: usize) { self.end = end; }
}

impl HasSpan for TemporalMention {
    fn start(&self) -> usize { self.start }
    fn end(&self) -> usize { self.end }
    fn set_start(&mut self, start: usize) { self.start = start; }
    fn set_end(&mut self, end: usize) { self.end = end; }
}

// =============================================================================
// Core Functions
// =============================================================================

/// Compute FNV-1a hash of text
fn compute_hash(text: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    hasher.finish()
}

/// Split text by sentences (fallback for giant paragraphs)
fn split_sentences(text: &str) -> Vec<&str> {
    // Simple sentence splitter: split on . ! ? followed by whitespace
    let mut sentences = Vec::new();
    let mut start = 0;
    
    for (i, c) in text.char_indices() {
        if matches!(c, '.' | '!' | '?') {
            // Look ahead for whitespace
            let rest = &text[i + c.len_utf8()..];
            if rest.starts_with(char::is_whitespace) || rest.is_empty() {
                let sentence = &text[start..i + c.len_utf8()];
                if !sentence.trim().is_empty() {
                    sentences.push(sentence);
                }
                start = i + c.len_utf8();
                // Skip leading whitespace for next sentence
                while start < text.len() && text[start..].starts_with(char::is_whitespace) {
                    start += text[start..].chars().next().map_or(1, |c| c.len_utf8());
                }
            }
        }
    }
    
    // Capture trailing text
    if start < text.len() && !text[start..].trim().is_empty() {
        sentences.push(&text[start..]);
    }
    
    if sentences.is_empty() && !text.trim().is_empty() {
        sentences.push(text);
    }
    
    sentences
}

/// Split text into chunks (paragraph-based with sentence fallback)
pub fn chunk_text(text: &str) -> Vec<Chunk> {
    let mut chunks = Vec::new();
    let mut pos = 0;
    
    // Split by double newline (paragraphs)
    for part in text.split("\n\n") {
        if part.is_empty() {
            pos += 2; // Account for the \n\n
            continue;
        }
        
        if part.len() <= MAX_CHUNK_SIZE {
            chunks.push(Chunk::new(part, pos));
        } else {
            // Giant blob: split by sentence
            let mut sent_pos = pos;
            for sentence in split_sentences(part) {
                // Find actual position in part
                if let Some(offset) = part[sent_pos - pos..].find(sentence) {
                    let actual_pos = sent_pos + offset - (sent_pos - pos) + (sent_pos - pos);
                    chunks.push(Chunk::new(sentence, actual_pos));
                    sent_pos = actual_pos + sentence.len();
                } else {
                    // Fallback: just add at current position
                    chunks.push(Chunk::new(sentence, sent_pos));
                    sent_pos += sentence.len();
                }
            }
        }
        
        pos += part.len() + 2; // +2 for the \n\n separator
    }
    
    // Adjust last chunk (no trailing \n\n)
    if !chunks.is_empty() && pos > text.len() + 2 {
        // We over-counted
    }
    
    chunks
}

/// Compute delta between old chunks and new text
pub fn compute_delta(old_chunks: &[Chunk], new_text: &str) -> Delta {
    let new_chunks = chunk_text(new_text);
    let mut delta = Delta {
        total_chunks: new_chunks.len(),
        ..Default::default()
    };
    
    if old_chunks.is_empty() {
        // No previous state: everything is dirty
        if !new_text.is_empty() {
            delta.dirty_ranges.push(0..new_text.len());
            delta.dirty_chunks = new_chunks.len();
        }
        return delta;
    }
    
    // Compare chunks by hash
    let mut old_idx = 0;
    let mut new_idx = 0;
    let _cumulative_shift: i64 = 0;
    
    while new_idx < new_chunks.len() {
        let new_chunk = &new_chunks[new_idx];
        
        // Try to find matching old chunk
        let mut found_match = false;
        if old_idx < old_chunks.len() {
            let old_chunk = &old_chunks[old_idx];
            
            if old_chunk.hash == new_chunk.hash && old_chunk.len() == new_chunk.len() {
                // Matching chunk (hash + length verification for skip hint)
                found_match = true;
                old_idx += 1;
            }
        }
        
        if !found_match {
            // This chunk is dirty
            delta.dirty_chunks += 1;
            
            // Add to dirty ranges (with context padding)
            let padded_start = if new_idx >= CONTEXT_PADDING_PARAGRAPHS {
                new_chunks.get(new_idx - CONTEXT_PADDING_PARAGRAPHS)
                    .map(|c| c.start)
                    .unwrap_or(new_chunk.start)
            } else {
                0
            };
            
            let padded_end = new_chunks.get(new_idx + CONTEXT_PADDING_PARAGRAPHS)
                .map(|c| c.end)
                .unwrap_or(new_chunk.end)
                .min(new_text.len());
            
            // Merge with last dirty range if overlapping
            if let Some(last) = delta.dirty_ranges.last_mut() {
                if padded_start <= last.end {
                    last.end = last.end.max(padded_end);
                } else {
                    delta.dirty_ranges.push(padded_start..padded_end);
                }
            } else {
                delta.dirty_ranges.push(padded_start..padded_end);
            }
            
            // Record change for shift calculation
            if old_idx < old_chunks.len() {
                let old_chunk = &old_chunks[old_idx];
                delta.changes.push(Change {
                    old_start: old_chunk.start,
                    old_end: old_chunk.end,
                    old_len: old_chunk.len(),
                    new_len: new_chunk.len(),
                });
                old_idx += 1;
            } else {
                // Appended chunk
                delta.changes.push(Change {
                    old_start: old_chunks.last().map(|c| c.end).unwrap_or(0),
                    old_end: old_chunks.last().map(|c| c.end).unwrap_or(0),
                    old_len: 0,
                    new_len: new_chunk.len(),
                });
            }
        }
        
        new_idx += 1;
    }
    
    delta
}

/// Shift items based on delta changes
pub fn shift_items<T: HasSpan>(items: &mut Vec<T>, delta: &Delta) {
    items.retain_mut(|item| {
        // Remove items that overlap dirty ranges (they'll be re-extracted)
        if delta.overlaps_dirty(item.start(), item.end()) {
            return false;
        }
        
        // Shift items downstream of changes
        let shift = delta.shift_at(item.start());
        if shift != 0 {
            let new_start = (item.start() as i64 + shift).max(0) as usize;
            let new_end = (item.end() as i64 + shift).max(0) as usize;
            item.set_start(new_start);
            item.set_end(new_end);
        }
        
        true
    });
}

/// Extract text for dirty ranges (with context padding)
pub fn extract_dirty_text<'a>(text: &'a str, delta: &Delta) -> Vec<(Range<usize>, &'a str)> {
    delta.dirty_ranges
        .iter()
        .filter_map(|range| {
            let start = range.start.min(text.len());
            let end = range.end.min(text.len());
            if start < end {
                Some((start..end, &text[start..end]))
            } else {
                None
            }
        })
        .collect()
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Chunk text tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_chunk_text_single_paragraph() {
        let text = "Hello world";
        let chunks = chunk_text(text);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].start, 0);
        assert_eq!(chunks[0].end, 11);
    }
    
    #[test]
    fn test_chunk_text_multiple_paragraphs() {
        let text = "First paragraph.\n\nSecond paragraph.";
        let chunks = chunk_text(text);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].start, 0);
        assert_eq!(chunks[1].start, 18);
    }
    
    #[test]
    fn test_chunk_text_empty() {
        let text = "";
        let chunks = chunk_text(text);
        assert!(chunks.is_empty());
    }
    
    #[test]
    fn test_chunk_text_giant_blob_fallback() {
        let text = format!("{}. {}. {}", 
            "A".repeat(800), 
            "B".repeat(800), 
            "C".repeat(800)
        );
        let chunks = chunk_text(&text);
        // Should split into sentences
        assert!(chunks.len() > 1, "Giant blob should be split into sentences");
    }
    
    // -------------------------------------------------------------------------
    // Delta computation tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_compute_delta_append() {
        // Use multi-paragraph doc so appending only affects one chunk out of several
        let old_text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
        let old_chunks = chunk_text(old_text);
        assert_eq!(old_chunks.len(), 3);
        
        // Append to last paragraph
        let new_text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph. More text.";
        let delta = compute_delta(&old_chunks, new_text);
        
        // Only last chunk changed, so 1/3 chunks dirty (~33%) - but < 10 chunks, so incremental
        assert!(!delta.dirty_ranges.is_empty());
        assert_eq!(delta.dirty_chunks, 1);
        // 1/3 = 33% which is just over 30%, so this should NOT use incremental
        // Let's adjust: 1/4 would be 25%
    }
    
    #[test]
    fn test_compute_delta_append_uses_incremental() {
        // Use 4+ paragraph doc so appending only affects one chunk (25% dirty)
        let old_text = "P1.\n\nP2.\n\nP3.\n\nP4.";
        let old_chunks = chunk_text(old_text);
        assert_eq!(old_chunks.len(), 4);
        
        // Append to last paragraph
        let new_text = "P1.\n\nP2.\n\nP3.\n\nP4. More.";
        let delta = compute_delta(&old_chunks, new_text);
        
        // 1/4 = 25% dirty, which is < 30% threshold
        assert_eq!(delta.dirty_chunks, 1);
        assert!(delta.should_use_incremental(), "25% dirty should use incremental");
    }
    
    #[test]
    fn test_compute_delta_no_change() {
        let text = "Hello world";
        let chunks = chunk_text(text);
        
        let delta = compute_delta(&chunks, text);
        
        assert!(delta.dirty_ranges.is_empty());
        assert_eq!(delta.dirty_chunks, 0);
    }
    
    #[test]
    fn test_compute_delta_insert_middle() {
        // Use 4 paragraphs so 1 modified = 25% dirty (under 30% threshold)
        let old_text = "AAA\n\nBBB\n\nCCC\n\nDDD";
        let old_chunks = chunk_text(old_text);
        assert_eq!(old_chunks.len(), 4);
        
        let new_text = "AAA\n\nBBB MODIFIED\n\nCCC\n\nDDD";
        let delta = compute_delta(&old_chunks, new_text);
        
        // Middle chunk changed, so dirty (1/4 = 25%)
        assert!(!delta.dirty_ranges.is_empty());
        assert_eq!(delta.dirty_chunks, 1);
        assert!(delta.should_use_incremental(), "25% dirty should use incremental");
    }
    
    #[test]
    fn test_compute_delta_full_replace() {
        let old_text = "A\n\nB\n\nC";
        let old_chunks = chunk_text(old_text);
        
        let new_text = "X\n\nY\n\nZ";
        let delta = compute_delta(&old_chunks, new_text);
        
        // All chunks changed
        assert_eq!(delta.dirty_chunks, 3);
    }
    
    // -------------------------------------------------------------------------
    // Shift calculation tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_delta_shift_at() {
        let delta = Delta {
            changes: vec![
                Change { old_start: 5, old_end: 10, old_len: 5, new_len: 8 }, // +3
            ],
            ..Default::default()
        };
        
        // Before change: no shift
        assert_eq!(delta.shift_at(0), 0);
        assert_eq!(delta.shift_at(5), 0);
        
        // After change: shifted by +3
        assert_eq!(delta.shift_at(10), 3);
        assert_eq!(delta.shift_at(15), 3);
    }
    
    #[test]
    fn test_delta_shift_at_multiple_changes() {
        let delta = Delta {
            changes: vec![
                Change { old_start: 0, old_end: 5, old_len: 5, new_len: 10 },  // +5
                Change { old_start: 10, old_end: 15, old_len: 5, new_len: 2 }, // -3
            ],
            ..Default::default()
        };
        
        // After first change but before second
        assert_eq!(delta.shift_at(5), 5);
        
        // After both changes: +5 - 3 = +2
        assert_eq!(delta.shift_at(15), 2);
    }
    
    // -------------------------------------------------------------------------
    // Item shifting tests
    // -------------------------------------------------------------------------
    
    #[derive(Debug, Clone)]
    struct TestItem {
        start: usize,
        end: usize,
    }
    
    impl HasSpan for TestItem {
        fn start(&self) -> usize { self.start }
        fn end(&self) -> usize { self.end }
        fn set_start(&mut self, s: usize) { self.start = s; }
        fn set_end(&mut self, e: usize) { self.end = e; }
    }
    
    #[test]
    fn test_shift_items_downstream() {
        let mut items = vec![
            TestItem { start: 0, end: 5 },   // Before change
            TestItem { start: 20, end: 25 }, // After change
        ];
        
        let delta = Delta {
            changes: vec![
                Change { old_start: 10, old_end: 10, old_len: 0, new_len: 5 }, // Insert 5 chars at pos 10
            ],
            dirty_ranges: vec![10..15],
            ..Default::default()
        };
        
        shift_items(&mut items, &delta);
        
        // First item unchanged
        assert_eq!(items[0].start, 0);
        assert_eq!(items[0].end, 5);
        
        // Second item shifted by +5
        assert_eq!(items[1].start, 25);
        assert_eq!(items[1].end, 30);
    }
    
    #[test]
    fn test_shift_items_removes_dirty() {
        let mut items = vec![
            TestItem { start: 0, end: 5 },   // Before dirty
            TestItem { start: 10, end: 15 }, // Inside dirty
            TestItem { start: 20, end: 25 }, // After dirty
        ];
        
        let delta = Delta {
            dirty_ranges: vec![8..18],
            ..Default::default()
        };
        
        shift_items(&mut items, &delta);
        
        // Middle item should be removed
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].start, 0);
        assert_eq!(items[1].start, 20);
    }
    
    // -------------------------------------------------------------------------
    // Threshold tests
    // -------------------------------------------------------------------------
    
    #[test]
    fn test_should_use_incremental_low_ratio() {
        let delta = Delta {
            dirty_chunks: 1,
            total_chunks: 10,
            ..Default::default()
        };
        assert!(delta.should_use_incremental());
    }
    
    #[test]
    fn test_should_use_incremental_high_ratio() {
        let delta = Delta {
            dirty_chunks: 5,
            total_chunks: 10,
            ..Default::default()
        };
        assert!(!delta.should_use_incremental(), "50% dirty should trigger full rescan");
    }
    
    #[test]
    fn test_should_use_incremental_too_many_chunks() {
        let delta = Delta {
            dirty_chunks: 11,
            total_chunks: 100,
            ..Default::default()
        };
        assert!(!delta.should_use_incremental(), "11 dirty chunks exceeds threshold");
    }

    #[test]
    fn test_compute_delta_hash_collision_with_different_lengths() {
        // Manually construct a scenario where new text produces a chunk with
        // SAME hash as old chunk, but DIFFERENT length.
        
        let old_text = "Short";
        let mut old_chunks = chunk_text(old_text);
        
        // Assert initial state
        assert_eq!(old_chunks.len(), 1);
        let _real_hash = old_chunks[0].hash;
        
        // MANUALLY modify the old chunk to have the same hash as "LongerString"
        // but keep its length as "Short".len() (5).
        // This simulates a hash collision (two different strings, different lengths, same hash).
        
        let new_text = "LongerString"; // Length 12
        let new_chunks_ref = chunk_text(new_text);
        let target_hash = new_chunks_ref[0].hash;
        
        // Set old chunk to have the SAME hash as the new text's chunk
        old_chunks[0].hash = target_hash;
        
        // Verify setup: Hashes match, Lengths differ
        assert_eq!(old_chunks[0].hash, target_hash);
        assert_ne!(old_chunks[0].len(), new_chunks_ref[0].len());
        
        // Compute delta
        let delta = compute_delta(&old_chunks, new_text);
        
        // EXPECTATION: 
        // If we ONLY check hash, this will return found_match = true -> 0 dirty chunks.
        // If we check hash + len, this will mismatch -> 1 dirty chunk.
        
        assert_eq!(delta.dirty_chunks, 1, "Should detect change due to length mismatch despite hash collision");
    }
}
