//! UnifiedScanner - Test-Driven Development Contract
//!
//! This file defines the **tests first** for the unified document processing pipeline.
//! The tests specify the EXACT behavior expected, establishing the contract.
//! Implementation follows to satisfy these tests.
//!
//! # Design Goals (ULTRATHINK)
//!
//! ## Performance Strategy
//! 1. **Single-pass scanning**: Use a RegexSet to detect ALL pattern types simultaneously
//! 2. **Zero-copy captures**: Use &str slices into original text, no .to_string() until serialization
//! 3. **Arena allocation**: Use bumpalo for all intermediate structures during a single scan
//! 4. **Interned strings**: Use interned entity kinds to avoid repeated allocations
//! 5. **Bitflag overlap tracking**: Use bitflags instead of HashSet for O(1) overlap detection
//!
//! ## API Design
//! - `scan(text) -> ScanResult` — One call, all extractions
//! - `ScanResult` contains: `spans: Vec<DecorationSpan>`, `refs: Vec<Ref>`, `stats: ScanStats`
//! - `DecorationSpan` is what TS needs for rendering (position + styling hints)
//! - `Ref` is the semantic data for graph/storage
//!
//! ## Memory Budget
//! - Target: <1KB allocation per 10KB of text
//! - Use small string optimization for labels <24 bytes
//! - Pre-size Vecs based on pattern count estimates

use std::collections::HashMap;
use serde::{Serialize, Deserialize};

// =============================================================================
// CONTRACT TYPES (What the tests expect)
// =============================================================================

/// Kind of reference detected
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum RefKind {
    Entity = 0,
    Wikilink = 1,
    Backlink = 2,
    Tag = 3,
    Mention = 4,
    Triple = 5,
    InlineRelation = 6,
    Temporal = 7,
    Implicit = 8,      // From ImplicitCortex
    Relation = 9,      // From RelationCortex
}

/// Styling hints for TS decoration (NOT actual CSS)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StylingHint {
    /// Semantic color key (e.g., "entity-character", "wikilink", "tag")
    pub color_key: String,
    /// Confidence for implicit matches (1.0 for explicit)
    pub confidence: f64,
    /// Whether this should render as a widget
    pub widget_mode: bool,
    /// Whether the cursor is inside (TS determines from selection)
    pub is_editing: bool,
}

/// A decoration span for TS to render
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecorationSpan {
    pub kind: RefKind,
    pub start: usize,
    pub end: usize,
    /// Display text (for widgets)
    pub label: String,
    /// Full matched text
    pub raw_text: String,
    /// Captured groups
    pub captures: HashMap<String, String>,
    /// Styling hints (TS applies mode-aware CSS)
    pub styling: StylingHint,
}

/// Full scan result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedScanResult {
    pub spans: Vec<DecorationSpan>,
    pub stats: UnifiedScanStats,
}

/// Statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UnifiedScanStats {
    pub entity_count: usize,
    pub wikilink_count: usize,
    pub backlink_count: usize,
    pub tag_count: usize,
    pub mention_count: usize,
    pub triple_count: usize,
    pub temporal_count: usize,
    pub implicit_count: usize,
    pub relation_count: usize,
    pub total_spans: usize,
    pub scan_time_us: u64,
}

// Type aliases for test compatibility
pub type ScanResult = UnifiedScanResult;
pub type ScanStats = UnifiedScanStats;

// =============================================================================
// TESTS - THE CONTRACT
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Basic Pattern Detection Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_wikilink_simple() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("Visit [[Rivendell]] today");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Wikilink);
        assert_eq!(span.start, 6);
        assert_eq!(span.end, 19);
        assert_eq!(span.label, "Rivendell");
        assert_eq!(span.captures.get("target").unwrap(), "Rivendell");
    }

    #[test]
    fn test_wikilink_with_display_text() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("Visit [[Rivendell|The Last Homely House]]");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.label, "The Last Homely House");
        assert_eq!(span.captures.get("target").unwrap(), "Rivendell");
        assert_eq!(span.captures.get("displayText").unwrap(), "The Last Homely House");
    }

    #[test]
    fn test_backlink() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("Referenced from <<Chapter One>>");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Backlink);
        assert_eq!(span.captures.get("target").unwrap(), "Chapter One");
    }

    #[test]
    fn test_entity_explicit() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[CHARACTER|Aragorn] is the king");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Entity);
        assert_eq!(span.label, "Aragorn");
        assert_eq!(span.captures.get("entityKind").unwrap(), "CHARACTER");
    }

    #[test]
    fn test_entity_with_subtype() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[CHARACTER:WIZARD|Gandalf]");
        
        let span = &result.spans[0];
        assert_eq!(span.captures.get("entityKind").unwrap(), "CHARACTER");
        assert_eq!(span.captures.get("subtype").unwrap(), "WIZARD");
        assert_eq!(span.label, "Gandalf");
    }

    #[test]
    fn test_tag() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("This is #fantasy content");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Tag);
        assert_eq!(span.captures.get("tagName").unwrap(), "fantasy");
    }

    #[test]
    fn test_tag_not_html_entity() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("Code &#123; is not a tag but #real-tag is");
        
        // Should only match #real-tag, not &#123
        assert_eq!(result.spans.len(), 1);
        assert_eq!(result.spans[0].captures.get("tagName").unwrap(), "real-tag");
    }

    #[test]
    fn test_mention() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("Thanks @tolkien for inspiration");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Mention);
        assert_eq!(span.captures.get("username").unwrap(), "tolkien");
    }

    #[test]
    fn test_triple() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[CHARACTER|Frodo] ->OWNS-> [ITEM|Ring]");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Triple);
        assert_eq!(span.captures.get("subjectKind").unwrap(), "CHARACTER");
        assert_eq!(span.captures.get("subjectLabel").unwrap(), "Frodo");
        assert_eq!(span.captures.get("predicate").unwrap(), "OWNS");
        assert_eq!(span.captures.get("objectKind").unwrap(), "ITEM");
        assert_eq!(span.captures.get("objectLabel").unwrap(), "Ring");
    }

    #[test]
    fn test_inline_relationship() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[CHARACTER|Jon->LOVES->Daenerys]");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Triple); // Inline relationships become triples
        assert_eq!(span.captures.get("subjectLabel").unwrap(), "Jon");
        assert_eq!(span.captures.get("predicate").unwrap(), "LOVES");
        assert_eq!(span.captures.get("objectLabel").unwrap(), "Daenerys");
    }

    // -------------------------------------------------------------------------
    // Overlap Resolution Tests (Critical for correctness)
    // -------------------------------------------------------------------------

    #[test]
    fn test_triple_takes_priority_over_entity() {
        let scanner = UnifiedScanner::new();
        // Triple syntax contains entity-like patterns but should be parsed as ONE triple
        let result = scanner.scan("[CHARACTER|Frodo] ->OWNS-> [ITEM|Ring]");
        
        // Should be 1 triple, NOT 2 entities + 1 triple
        assert_eq!(result.spans.len(), 1);
        assert_eq!(result.spans[0].kind, RefKind::Triple);
    }

    #[test]
    fn test_inline_relation_takes_priority_over_entity() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[CHARACTER|Jon->KNOWS->Sam]");
        
        // Should be 1 inline triple, NOT an entity
        assert_eq!(result.spans.len(), 1);
        assert_eq!(result.spans[0].kind, RefKind::Triple);
    }

    #[test]
    fn test_wikilink_inside_does_not_overlap() {
        let scanner = UnifiedScanner::new();
        // Entity and wikilink at different positions
        let result = scanner.scan("[CHARACTER|Jon] visited [[Winterfell]]");
        
        assert_eq!(result.spans.len(), 2);
        assert_eq!(result.spans[0].kind, RefKind::Entity);
        assert_eq!(result.spans[1].kind, RefKind::Wikilink);
    }

    #[test]
    fn test_multiple_patterns_sorted_by_position() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("#tag1 @mention [[link]] [ITEM|sword]");
        
        assert_eq!(result.spans.len(), 4);
        // Should be sorted by start position
        assert!(result.spans[0].start < result.spans[1].start);
        assert!(result.spans[1].start < result.spans[2].start);
        assert!(result.spans[2].start < result.spans[3].start);
    }

    // -------------------------------------------------------------------------
    // Styling Hint Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_entity_styling_by_kind() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[CHARACTER|Jon]");
        
        let span = &result.spans[0];
        assert_eq!(span.styling.color_key, "entity-character");
        assert_eq!(span.styling.confidence, 1.0);
        assert!(span.styling.widget_mode);
    }

    #[test]
    fn test_tag_styling() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("#important");
        
        let span = &result.spans[0];
        assert_eq!(span.styling.color_key, "tag");
        assert!(!span.styling.widget_mode); // Tags don't use widget mode
    }

    #[test]
    fn test_wikilink_styling() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[[Target]]");
        
        let span = &result.spans[0];
        assert_eq!(span.styling.color_key, "wikilink");
        assert!(span.styling.widget_mode);
    }

    // -------------------------------------------------------------------------
    // Statistics Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_stats_accurate() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan(
            "[CHARACTER|Jon] [[Place]] #tag @user [ITEM|Sword] ->OWNS-> [CHARACTER|Arya]"
        );
        
        // Note: the last part is a triple, not separate entities
        assert_eq!(result.stats.entity_count, 1); // Just [CHARACTER|Jon]
        assert_eq!(result.stats.wikilink_count, 1);
        assert_eq!(result.stats.tag_count, 1);
        assert_eq!(result.stats.mention_count, 1);
        assert_eq!(result.stats.triple_count, 1);
    }

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    #[test]
    fn test_empty_text() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("");
        
        assert!(result.spans.is_empty());
        assert_eq!(result.stats.total_spans, 0);
    }

    #[test]
    fn test_no_patterns() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("Just plain text with no special patterns.");
        
        assert!(result.spans.is_empty());
    }

    #[test]
    fn test_unclosed_wikilink_ignored() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("This [[unclosed should not match");
        
        assert!(result.spans.is_empty());
    }

    #[test]
    fn test_malformed_entity_ignored() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[|NoKind] and [KIND|] should not match");
        
        assert!(result.spans.is_empty());
    }

    #[test]
    fn test_nested_brackets_handled() {
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[[Page with [brackets] inside]]");
        
        // Current behavior: should NOT match because inner brackets break it
        // This is intentional - we don't support nested brackets
        assert!(result.spans.is_empty());
    }

    // -------------------------------------------------------------------------
    // Performance Contract Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_large_document_performance() {
        let scanner = UnifiedScanner::new();
        
        // Generate a 100KB document with mixed patterns
        let mut doc = String::with_capacity(100_000);
        for i in 0..1000 {
            doc.push_str(&format!(
                "Paragraph {} with [[Link{}]] and [CHARACTER|Hero{}] and #tag{} @user{} text. ",
                i, i, i, i, i
            ));
        }
        
        let start = std::time::Instant::now();
        let result = scanner.scan(&doc);
        let elapsed = start.elapsed();
        
        // Contract: Must complete in <100ms for 100KB
        assert!(elapsed.as_millis() < 100, "Scan took {}ms, expected <100ms", elapsed.as_millis());
        
        // Should have 4 patterns per paragraph × 1000 paragraphs = 4000 spans
        assert_eq!(result.spans.len(), 4000);
    }

    #[test]
    fn test_allocation_budget() {
        // This test verifies we don't allocate excessively
        // We can't measure allocations directly in unit tests, but we can
        // at least verify the result structures are reasonably sized
        
        let scanner = UnifiedScanner::new();
        let result = scanner.scan("[CHARACTER|Jon] [[Place]]");
        
        // Each span should be <500 bytes
        let span = &result.spans[0];
        let span_size = std::mem::size_of_val(span);
        assert!(span_size < 500, "Span size is {} bytes, expected <500", span_size);
    }

    #[test]
    fn test_multibyte_prefix_tag_crash() {
        let scanner = UnifiedScanner::new();
        // Emoji '😊' is 4 bytes. Regex (?:^|[^&])# matches "😊#tag".
        // The prefix is '😊'. The code does start + 1, which splits the emoji.
        let result = scanner.scan("😊#crash");
        
        assert_eq!(result.spans.len(), 1);
        let span = &result.spans[0];
        assert_eq!(span.kind, RefKind::Tag);
        assert_eq!(span.raw_text, "#crash"); // Should correctly identify the tag part
        assert_eq!(span.captures.get("tagName").unwrap(), "crash");
    }

    #[test]
    fn test_wano_story_document_crash() {
        // This is the exact user document that causes the WASM crash
        let scanner = UnifiedScanner::new();
        let text = r#"# ----------------------------
# Wano Story Events (high level)
# ----------------------------
[ARC|Wano Country Arc|{"saga":"Four Emperors"}]
[EVENT|Alliance Forms in Wano|{"type":"Political/Military","impact":"Major"}]
[EVENT|Udon Prison Breakout|{"type":"Rebellion","impact":"Major"}]
[EVENT|Raid on Onigashima Begins|{"type":"Invasion","impact":"Major"}]
[EVENT|Rooftop Battle vs Emperors|{"type":"Boss fight","impact":"Major"}]
[EVENT|Luffy Awakens Gear Fifth|{"type":"Power-up","impact":"Massive"}]
[EVENT|Kaidou Defeated|{"type":"Outcome","impact":"World-shaking"}]
[EVENT|Big Mom Defeated|{"type":"Outcome","impact":"World-shaking"}]
[EVENT|Wano Liberation|{"type":"Regime change","impact":"Major"}]
[EVENT|New Emperor Announcements|{"type":"World news","impact":"Major"}]

[ARC|Wano Country Arc] (TAKES_PLACE_IN) [LOCATION|Wano Country]
[EVENT|Alliance Forms in Wano] (OCCURS_IN) [LOCATION|Wano Country]
[EVENT|Udon Prison Breakout] (OCCURS_IN) [LOCATION|Udon]
[EVENT|Raid on Onigashima Begins] (OCCURS_IN) [LOCATION|Tokage Port]
[EVENT|Rooftop Battle vs Emperors] (OCCURS_IN) [LOCATION|Onigashima]
[EVENT|Luffy Awakens Gear Fifth] (OCCURS_IN) [LOCATION|Onigashima]
[EVENT|Kaidou Defeated] (OCCURS_IN) [LOCATION|Onigashima]
[EVENT|Big Mom Defeated] (OCCURS_IN) [LOCATION|Onigashima]
[EVENT|Wano Liberation] (OCCURS_IN) [LOCATION|Flower Capital]

[EVENT|Alliance Forms in Wano] (LEADS_TO) [EVENT|Raid on Onigashima Begins]
[EVENT|Raid on Onigashima Begins] (LEADS_TO) [EVENT|Rooftop Battle vs Emperors]
[EVENT|Rooftop Battle vs Emperors] (PRECEDES) [EVENT|Luffy Awakens Gear Fifth]
[EVENT|Luffy Awakens Gear Fifth] (ENABLES) [EVENT|Kaidou Defeated]
[EVENT|Kaidou Defeated] (TRIGGERS) [EVENT|Wano Liberation]
[EVENT|Big Mom Defeated] (INFLUENCES) [EVENT|New Emperor Announcements]
[EVENT|Kaidou Defeated] (INFLUENCES) [EVENT|New Emperor Announcements]



# ----------------------------
# Wano Participation / Outcomes
# ----------------------------
[CHARACTER|Monkey D. Luffy] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Roronoa Zoro] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Sanji] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Nico Robin] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Jinbe] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Franky] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Brook] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Nami] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Usopp] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]
[CHARACTER|Tony Tony Chopper] (PARTICIPATES_IN) [EVENT|Raid on Onigashima Begins]

Monkey D. Luffy 

Monkey D. Luffy 

Jinbe  

 Franky 



 gu  
"#;
        
        // This should not panic
        let result = scanner.scan(text);
        
        // Verify we got reasonable results (exact count may vary)
        println!("Wano document: {} spans found", result.spans.len());
        assert!(result.spans.len() > 0, "Should find some patterns in the Wano document");
    }
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

use regex::Regex;

/// Pattern definition with compiled regex and metadata
struct PatternDef {
    regex: Regex,
    kind: RefKind,
    priority: u8,  // Higher = matched first for overlap resolution
    capture_names: Vec<(&'static str, usize)>,  // (name, group_index)
    styling: StylingHint,
}

/// Unified document scanner - combines all pattern detection
/// 
/// Design goals (ULTRATHINK):
/// 1. Single-pass: Collect all matches, then sort and filter overlaps
/// 2. Priority-based overlap: Higher priority patterns win
/// 3. Zero-copy where possible: Use slices until final serialization
/// 4. Cached regexes: Compile once, reuse forever
pub struct UnifiedScanner {
    patterns: Vec<PatternDef>,
}

impl UnifiedScanner {
    pub fn new() -> Self {
        let patterns = Self::build_patterns();
        Self { patterns }
    }
    
    fn build_patterns() -> Vec<PatternDef> {
        vec![
            // Priority 110: Inline Relationship (most specific triple form)
            // [KIND|Label->PREDICATE->Target]
            PatternDef {
                regex: Regex::new(r"\[([A-Z_]+)(?::([A-Z_]+))?\|([^\]\->]+)->([A-Z_]+)->([^\]]+)\]").unwrap(),
                kind: RefKind::Triple,
                priority: 110,
                capture_names: vec![
                    ("subjectKind", 1),
                    ("subjectSubtype", 2),
                    ("subjectLabel", 3),
                    ("predicate", 4),
                    ("objectLabel", 5),
                ],
                styling: StylingHint {
                    color_key: "triple".to_string(),
                    confidence: 1.0,
                    widget_mode: true,
                    is_editing: false,
                },
            },
            
            // Priority 105: Full Triple
            // [KIND|Label] ->PREDICATE-> [KIND|Label]
            PatternDef {
                regex: Regex::new(r"\[([A-Z_]+)(?::([A-Z_]+))?\|([^\]]+)\]\s*->([A-Z_]+)->\s*\[([A-Z_]+)(?::([A-Z_]+))?\|([^\]]+)\]").unwrap(),
                kind: RefKind::Triple,
                priority: 105,
                capture_names: vec![
                    ("subjectKind", 1),
                    ("subjectSubtype", 2),
                    ("subjectLabel", 3),
                    ("predicate", 4),
                    ("objectKind", 5),
                    ("objectSubtype", 6),
                    ("objectLabel", 7),
                ],
                styling: StylingHint {
                    color_key: "triple".to_string(),
                    confidence: 1.0,
                    widget_mode: true,
                    is_editing: false,
                },
            },
            
            // Priority 100: Entity
            // [KIND|Label] or [KIND:SUBTYPE|Label]
            PatternDef {
                regex: Regex::new(r"\[([A-Z_]+)(?::([A-Z_]+))?\|([^\]\|]+)(?:\|(\{[^}]+\}))?\]").unwrap(),
                kind: RefKind::Entity,
                priority: 100,
                capture_names: vec![
                    ("entityKind", 1),
                    ("subtype", 2),
                    ("label", 3),
                    ("attributes", 4),
                ],
                styling: StylingHint {
                    color_key: "entity".to_string(), // Will be enriched per kind
                    confidence: 1.0,
                    widget_mode: true,
                    is_editing: false,
                },
            },
            
            // Priority 90: Wikilink
            // [[Target]] or [[Target|Display]]
            PatternDef {
                regex: Regex::new(r"\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]").unwrap(),
                kind: RefKind::Wikilink,
                priority: 90,
                capture_names: vec![
                    ("target", 1),
                    ("displayText", 2),
                ],
                styling: StylingHint {
                    color_key: "wikilink".to_string(),
                    confidence: 1.0,
                    widget_mode: true,
                    is_editing: false,
                },
            },
            
            // Priority 85: Backlink
            // <<Target>> or <<Target|Display>>
            PatternDef {
                regex: Regex::new(r"<<([^>\|]+)(?:\|([^>]+))?>>").unwrap(),
                kind: RefKind::Backlink,
                priority: 85,
                capture_names: vec![
                    ("target", 1),
                    ("displayText", 2),
                ],
                styling: StylingHint {
                    color_key: "backlink".to_string(),
                    confidence: 1.0,
                    widget_mode: true,
                    is_editing: false,
                },
            },
            
            // Priority 70: Tag
            // #tagname (but not &#123; HTML entities)
            PatternDef {
                regex: Regex::new(r"(?:^|[^&])#([\w\-]+)").unwrap(),
                kind: RefKind::Tag,
                priority: 70,
                capture_names: vec![
                    ("tagName", 1),
                ],
                styling: StylingHint {
                    color_key: "tag".to_string(),
                    confidence: 1.0,
                    widget_mode: false,
                    is_editing: false,
                },
            },
            
            // Priority 70: Mention
            // @username
            PatternDef {
                regex: Regex::new(r"@([\w\-]+)").unwrap(),
                kind: RefKind::Mention,
                priority: 70,
                capture_names: vec![
                    ("username", 1),
                ],
                styling: StylingHint {
                    color_key: "mention".to_string(),
                    confidence: 1.0,
                    widget_mode: false,
                    is_editing: false,
                },
            },
        ]
    }
    
    pub fn scan(&self, text: &str) -> ScanResult {
        // Note: std::time::Instant is NOT available in WASM, so we skip timing
        
        // Collect all matches from all patterns
        let mut all_matches: Vec<RawMatch> = Vec::new();
        
        for pattern in &self.patterns {
            for cap in pattern.regex.captures_iter(text) {
                let full_match = cap.get(0).unwrap();
                
                // For tags, we need to adjust the start if there's a preceding char
                let (actual_start, actual_end) = if pattern.kind == RefKind::Tag {
                    // The regex includes a preceding char (or ^), skip it
                    let raw_start = full_match.start();
                    let raw_text = full_match.as_str();
                    if let Some(offset) = raw_text.find('#') {
                        (raw_start + offset, full_match.end())
                    } else {
                        (raw_start, full_match.end())
                    }
                } else {
                    (full_match.start(), full_match.end())
                };
                
                // Validate bounds before proceeding
                if actual_start > text.len() || actual_end > text.len() || actual_start > actual_end {
                    continue; // Skip invalid matches
                }
                
                // Safe string slicing - use get to avoid panics
                let raw_text = match text.get(actual_start..actual_end) {
                    Some(slice) => slice.to_string(),
                    None => {
                        // Invalid slice range, skip this match
                        continue;
                    }
                };
                
                // Extract captures
                let mut captures = HashMap::new();
                for (name, idx) in &pattern.capture_names {
                    if let Some(m) = cap.get(*idx) {
                        captures.insert(name.to_string(), m.as_str().trim().to_string());
                    }
                }
                
                // Determine label based on kind
                let label = match pattern.kind {
                    RefKind::Wikilink | RefKind::Backlink => {
                        captures.get("displayText")
                            .or_else(|| captures.get("target"))
                            .cloned()
                            .unwrap_or_default()
                    }
                    RefKind::Entity => {
                        captures.get("label").cloned().unwrap_or_default()
                    }
                    RefKind::Tag => {
                        captures.get("tagName").cloned().unwrap_or_default()
                    }
                    RefKind::Mention => {
                        captures.get("username").cloned().unwrap_or_default()
                    }
                    RefKind::Triple => {
                        let subj = captures.get("subjectLabel").cloned().unwrap_or_default();
                        let pred = captures.get("predicate").cloned().unwrap_or_default();
                        let obj = captures.get("objectLabel").cloned().unwrap_or_default();
                        format!("{} →{}→ {}", subj, pred, obj)
                    }
                    _ => String::new(),
                };
                
                // Build styling with entity kind awareness
                let mut styling = pattern.styling.clone();
                if pattern.kind == RefKind::Entity {
                    if let Some(kind) = captures.get("entityKind") {
                        styling.color_key = format!("entity-{}", kind.to_lowercase());
                    }
                }
                
                all_matches.push(RawMatch {
                    kind: pattern.kind,
                    priority: pattern.priority,
                    start: actual_start,
                    end: actual_end,
                    label,
                    raw_text,
                    captures,
                    styling,
                });
            }
        }
        
        // Sort by priority (desc), then position (asc), then length (desc)
        all_matches.sort_by(|a, b| {
            if a.priority != b.priority {
                return b.priority.cmp(&a.priority);
            }
            if a.start != b.start {
                return a.start.cmp(&b.start);
            }
            b.end.cmp(&a.end)
        });
        
        // Resolve overlaps: higher priority wins
        let mut covered = vec![false; text.len() + 1];
        let mut result_spans: Vec<DecorationSpan> = Vec::new();
        
        for m in all_matches {
            // Validate bounds for covered array access
            if m.start >= text.len() || m.end > text.len() {
                continue; // Skip matches with invalid bounds
            }
            
            // Check if any position is already covered
            let mut overlaps = false;
            for i in m.start..m.end {
                if i < covered.len() && covered[i] {
                    overlaps = true;
                    break;
                }
            }
            
            if !overlaps {
                // Mark as covered
                for i in m.start..m.end {
                    if i < covered.len() {
                        covered[i] = true;
                    }
                }
                
                result_spans.push(DecorationSpan {
                    kind: m.kind,
                    start: m.start,
                    end: m.end,
                    label: m.label,
                    raw_text: m.raw_text,
                    captures: m.captures,
                    styling: m.styling,
                });
            }
        }
        
        // Sort by position for output
        result_spans.sort_by_key(|s| s.start);
        
        // Build stats
        let mut stats = ScanStats::default();
        for span in &result_spans {
            match span.kind {
                RefKind::Entity => stats.entity_count += 1,
                RefKind::Wikilink => stats.wikilink_count += 1,
                RefKind::Backlink => stats.backlink_count += 1,
                RefKind::Tag => stats.tag_count += 1,
                RefKind::Mention => stats.mention_count += 1,
                RefKind::Triple => stats.triple_count += 1,
                RefKind::Temporal => stats.temporal_count += 1,
                RefKind::Implicit => stats.implicit_count += 1,
                RefKind::Relation | RefKind::InlineRelation => stats.relation_count += 1,
            }
        }
        stats.total_spans = result_spans.len();
        stats.scan_time_us = 0; // Timing not available in WASM
        
        ScanResult {
            spans: result_spans,
            stats,
        }
    }
}

/// Internal struct for sorting before overlap resolution
struct RawMatch {
    kind: RefKind,
    priority: u8,
    start: usize,
    end: usize,
    label: String,
    raw_text: String,
    captures: HashMap<String, String>,
    styling: StylingHint,
}

impl Default for UnifiedScanner {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// WASM BINDINGS
// =============================================================================

use wasm_bindgen::prelude::*;

/// WASM-exported UnifiedScanner
/// 
/// This is the primary entry point for TypeScript.
/// TS calls `scan(text)` and receives decoration spans with styling hints.
#[wasm_bindgen]
pub struct WasmUnifiedScanner {
    inner: UnifiedScanner,
}

#[wasm_bindgen]
impl WasmUnifiedScanner {
    /// Create a new scanner instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: UnifiedScanner::new(),
        }
    }
    
    /// Scan text and return decoration spans as JSON
    /// 
    /// This is the main API for TypeScript. Returns a JSON-serialized
    /// UnifiedScanResult with all spans and statistics.
    #[wasm_bindgen(js_name = scan)]
    pub fn scan(&self, text: &str) -> Result<JsValue, JsValue> {
        // Safety: Catch any panics to prevent WASM from crashing
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            self.inner.scan(text)
        }));
        
        match result {
            Ok(scan_result) => {
                serde_wasm_bindgen::to_value(&scan_result)
                    .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
            }
            Err(panic_info) => {
                // Extract panic message if possible
                let msg = if let Some(s) = panic_info.downcast_ref::<&str>() {
                    format!("Scanner panicked: {}", s)
                } else if let Some(s) = panic_info.downcast_ref::<String>() {
                    format!("Scanner panicked: {}", s)
                } else {
                    "Scanner panicked with unknown error".to_string()
                };
                Err(JsValue::from_str(&msg))
            }
        }
    }
    
    /// Get just the span count (lightweight check)
    #[wasm_bindgen(js_name = countSpans)]
    pub fn count_spans(&self, text: &str) -> usize {
        self.inner.scan(text).spans.len()
    }
}

impl Default for WasmUnifiedScanner {
    fn default() -> Self {
        Self::new()
    }
}
