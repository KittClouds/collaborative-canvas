use regex::Regex;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// =============================================================================
// Types
// =============================================================================

/// An extracted triple relationship
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExtractedTriple {
    pub source: String,
    pub predicate: String,
    pub target: String,
    pub start: usize,
    pub end: usize,
    pub raw_text: String,
    /// Optional: entity kind for source (if explicit syntax used)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<String>,
    /// Optional: entity kind for target (if explicit syntax used)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_kind: Option<String>,
}

// =============================================================================
// TripleCortex
// =============================================================================

/// Triple syntax extractor - supports multiple syntaxes
#[wasm_bindgen]
pub struct TripleCortex {
    // Pattern 1: [[source->predicate->target]] (wiki-style, keep for compat)
    wiki_regex: Regex,
    // Pattern 2: Source ->RELATION-> Target (forward arrow - simple!)
    forward_regex: Regex,
    // Pattern 3: Target <-RELATION<- Source (backward arrow)
    backward_regex: Regex,
    // Pattern 4: A <->RELATION<-> B (bidirectional)
    bidir_regex: Regex,
    // Pattern 5: [KIND|Label] (RELATION) [KIND|Label] (parenthesized, most readable)
    paren_regex: Regex,
    // Pattern 6: [KIND|Label] ->RELATION-> [KIND|Label] (arrow with kinds)
    arrow_kind_regex: Regex,
}

impl Default for TripleCortex {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl TripleCortex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        // Pattern 1: [[source->predicate->target]] (wiki-style, backwards compat)
        let wiki_regex = Regex::new(
            r"\[\[\s*([^\[\]>]+?)\s*->\s*([^\[\]>]+?)\s*->\s*([^\[\]>]+?)\s*\]\]"
        ).expect("Wiki triple regex should compile");

        // Pattern 2: Source ->RELATION-> Target (forward, captures text before/after arrows)
        // Matches: "Luffy ->CAPTAIN_OF-> Straw Hats"
        // Excludes: <, >, [, ], newlines to avoid matching inside wiki brackets or other patterns
        let forward_regex = Regex::new(
            r"(\S[^<>\[\]\n]*?)\s*->([A-Z][A-Z0-9_]*)->\s*([^<>\[\]\n]*\S)"
        ).expect("Forward arrow regex should compile");

        // Pattern 3: Target <-RELATION<- Source (backward)
        // Matches: "Straw Hats <-CAPTAIN_OF<- Luffy"
        let backward_regex = Regex::new(
            r"(\S[^<>\[\]\n]*?)\s*<-([A-Z][A-Z0-9_]*)<-\s*([^<>\[\]\n]*\S)"
        ).expect("Backward arrow regex should compile");

        // Pattern 4: A <->RELATION<-> B (bidirectional)
        // Matches: "Luffy <->ALLIES<-> Zoro"
        let bidir_regex = Regex::new(
            r"(\S[^<>\[\]\n]*?)\s*<->([A-Z][A-Z0-9_]*)<->\s*([^<>\[\]\n]*\S)"
        ).expect("Bidirectional arrow regex should compile");

        // Pattern 5: [KIND|Label] (RELATION) [KIND|Label] (parenthesized - MOST READABLE)
        // Matches: "[EVENT|Raid on Onigashima Begins] (OCCURS_IN) [LOCATION|Tokage Port]"
        // Captures: 1=source_kind, 2=source_label, 3=predicate, 4=target_kind, 5=target_label
        // NOTE: Predicate allows mixed case (e.g., ADMires, LOCATED_IN) and spaces between are flexible
        let paren_regex = Regex::new(
            r"(?m)\[([A-Z_]+)\|([^\]]+)\][\s\n]*\(([A-Za-z][A-Za-z0-9_]*)\)[\s\n]*\[([A-Z_]+)\|([^\]]+)\]"
        ).expect("Parenthesized triple regex should compile");

        // Pattern 6: [KIND|Label] ->RELATION-> [KIND|Label] (arrow with kinds)
        // Matches: "[CHARACTER|Frodo] ->OWNS-> [ITEM|Ring]"
        let arrow_kind_regex = Regex::new(
            r"\[([A-Z_]+)\|([^\]]+)\]\s*->([A-Z][A-Z0-9_]*)->\s*\[([A-Z_]+)\|([^\]]+)\]"
        ).expect("Arrow-kind triple regex should compile");

        Self { wiki_regex, forward_regex, backward_regex, bidir_regex, paren_regex, arrow_kind_regex }
    }

    /// Extract and return as JsValue for WASM
    #[wasm_bindgen(js_name = extract)]
    pub fn js_extract(&self, text: &str) -> JsValue {
        let triples = self.extract(text);
        serde_wasm_bindgen::to_value(&triples).unwrap_or(JsValue::NULL)
    }
}

impl TripleCortex {
    /// Extract all triples from text using all supported syntaxes
    pub fn extract(&self, text: &str) -> Vec<ExtractedTriple> {
        let mut triples = Vec::new();
        let mut matched_ranges: Vec<(usize, usize)> = Vec::new();

        // Pattern 5: [KIND|Label] (RELATION) [KIND|Label] (parenthesized - HIGHEST PRIORITY)
        // This is the most common user syntax, process FIRST
        for cap in self.paren_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_kind_triple(&cap) {
                matched_ranges.push((triple.start, triple.end));
                triples.push(triple);
            }
        }

        // Pattern 6: [KIND|Label] ->RELATION-> [KIND|Label] (arrow with kinds)
        for cap in self.arrow_kind_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_kind_triple(&cap) {
                let start = triple.start;
                let end = triple.end;
                // Skip if overlaps with already matched ranges
                let overlaps = matched_ranges.iter().any(|(s, e)| {
                    (start >= *s && start < *e) || (end > *s && end <= *e)
                });
                if !overlaps {
                    matched_ranges.push((start, end));
                    triples.push(triple);
                }
            }
        }

        // Pattern 1: [[source->pred->target]] (wiki-style)
        for cap in self.wiki_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_wiki_triple(&cap) {
                let start = triple.start;
                let end = triple.end;
                let overlaps = matched_ranges.iter().any(|(s, e)| {
                    (start >= *s && start < *e) || (end > *s && end <= *e)
                });
                if !overlaps {
                    matched_ranges.push((start, end));
                    triples.push(triple);
                }
            }
        }

        // Helper: check if a position should be skipped (for plain text arrow patterns)
        let should_skip = |start: usize, end: usize| -> bool {
            // Check if overlaps with any already matched range
            matched_ranges.iter().any(|(s, e)| {
                (start >= *s && start < *e) || (end > *s && end <= *e)
            })
        };

        // Pattern 2: Source ->RELATION-> Target (forward arrow, plain text)
        for cap in self.forward_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_arrow_triple(&cap, false) {
                if !should_skip(triple.start, triple.end) {
                    triples.push(triple);
                }
            }
        }

        // Pattern 3: Target <-RELATION<- Source (backward arrow - swap source/target)
        for cap in self.backward_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_arrow_triple(&cap, true) {
                if !should_skip(triple.start, triple.end) {
                    triples.push(triple);
                }
            }
        }

        // Pattern 4: A <->RELATION<-> B (bidirectional - emit both directions)
        for cap in self.bidir_regex.captures_iter(text) {
            if let Some(triple) = Self::extract_arrow_triple(&cap, false) {
                if !should_skip(triple.start, triple.end) {
                    // Forward direction
                    triples.push(triple.clone());
                    // Reverse direction (swap source and target)
                    triples.push(ExtractedTriple {
                        source: triple.target.clone(),
                        target: triple.source.clone(),
                        ..triple
                    });
                }
            }
        }

        // Sort by position and dedupe
        triples.sort_by_key(|t| t.start);
        triples.dedup_by(|a, b| a.start == b.start && a.source == b.source && a.target == b.target);
        triples
    }

    fn extract_wiki_triple(cap: &regex::Captures) -> Option<ExtractedTriple> {
        let full_match = cap.get(0)?;
        let source = cap.get(1)?.as_str().trim();
        let predicate = cap.get(2)?.as_str().trim();
        let target = cap.get(3)?.as_str().trim();

        if source.is_empty() || predicate.is_empty() || target.is_empty() {
            return None;
        }

        Some(ExtractedTriple {
            source: source.to_string(),
            predicate: predicate.to_string(),
            target: target.to_string(),
            start: full_match.start(),
            end: full_match.end(),
            raw_text: full_match.as_str().to_string(),
            source_kind: None,
            target_kind: None,
        })
    }

    /// Extract kind-annotated triple: [KIND|Label] (REL) [KIND|Label] or [KIND|Label] ->REL-> [KIND|Label]
    /// Captures: 1=source_kind, 2=source_label, 3=predicate, 4=target_kind, 5=target_label
    fn extract_kind_triple(cap: &regex::Captures) -> Option<ExtractedTriple> {
        let full_match = cap.get(0)?;
        let source_kind = cap.get(1)?.as_str().trim();
        let source_label = cap.get(2)?.as_str().trim();
        let predicate = cap.get(3)?.as_str().trim();
        let target_kind = cap.get(4)?.as_str().trim();
        let target_label = cap.get(5)?.as_str().trim();

        if source_label.is_empty() || predicate.is_empty() || target_label.is_empty() {
            return None;
        }

        Some(ExtractedTriple {
            source: source_label.to_string(),
            predicate: predicate.to_string(),
            target: target_label.to_string(),
            start: full_match.start(),
            end: full_match.end(),
            raw_text: full_match.as_str().to_string(),
            source_kind: Some(source_kind.to_string()),
            target_kind: Some(target_kind.to_string()),
        })
    }

    /// Extract arrow-style triple: Source ->REL-> Target or Target <-REL<- Source
    /// If `swap` is true, the first capture becomes target (backward arrow)
    fn extract_arrow_triple(cap: &regex::Captures, swap: bool) -> Option<ExtractedTriple> {
        let full_match = cap.get(0)?;
        let first = cap.get(1)?.as_str().trim();
        let predicate = cap.get(2)?.as_str().trim();
        let second = cap.get(3)?.as_str().trim();

        if first.is_empty() || predicate.is_empty() || second.is_empty() {
            return None;
        }

        // For backward arrows, the syntax is Target <-REL<- Source
        // so we swap: source=second, target=first
        let (source, target) = if swap {
            (second, first)
        } else {
            (first, second)
        };

        Some(ExtractedTriple {
            source: source.to_string(),
            predicate: predicate.to_string(),
            target: target.to_string(),
            start: full_match.start(),
            end: full_match.end(),
            raw_text: full_match.as_str().to_string(),
            source_kind: None,
            target_kind: None,
        })
    }
}


// =============================================================================
// Tests (TDD - written first!)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Requirement 1: Basic triple extraction
    // -------------------------------------------------------------------------
    #[test]
    fn test_basic_triple_extraction() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[Frodo->OWNS->Ring]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Frodo");
        assert_eq!(triples[0].predicate, "OWNS");
        assert_eq!(triples[0].target, "Ring");
    }

    // -------------------------------------------------------------------------
    // Requirement 2: Whitespace handling
    // -------------------------------------------------------------------------
    #[test]
    fn test_whitespace_around_components() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[ Frodo  ->  OWNS  ->  Ring ]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Frodo");
        assert_eq!(triples[0].predicate, "OWNS");
        assert_eq!(triples[0].target, "Ring");
    }

    // -------------------------------------------------------------------------
    // Requirement 3: Position tracking
    // -------------------------------------------------------------------------
    #[test]
    fn test_position_tracking() {
        let cortex = TripleCortex::new();
        let text = "Some text [[A->B->C]] more text";
        let triples = cortex.extract(text);

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].start, 10);
        assert_eq!(triples[0].end, 21);
        assert_eq!(&text[triples[0].start..triples[0].end], "[[A->B->C]]");
    }

    // -------------------------------------------------------------------------
    // Requirement 4: Multiple triples in same text
    // -------------------------------------------------------------------------
    #[test]
    fn test_multiple_triples() {
        let cortex = TripleCortex::new();
        let text = "[[Frodo->OWNS->Ring]] and [[Sam->FRIEND_OF->Frodo]]";
        let triples = cortex.extract(text);

        assert_eq!(triples.len(), 2);
        assert_eq!(triples[0].source, "Frodo");
        assert_eq!(triples[0].predicate, "OWNS");
        assert_eq!(triples[1].source, "Sam");
        assert_eq!(triples[1].predicate, "FRIEND_OF");
    }

    // -------------------------------------------------------------------------
    // Requirement 5: Multi-word entities
    // -------------------------------------------------------------------------
    #[test]
    fn test_multi_word_entities() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[Frodo Baggins->LIVES_IN->The Shire]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Frodo Baggins");
        assert_eq!(triples[0].target, "The Shire");
    }

    // -------------------------------------------------------------------------
    // Requirement 6: Empty text returns empty
    // -------------------------------------------------------------------------
    #[test]
    fn test_empty_text() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("");
        assert!(triples.is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 7: No triples returns empty
    // -------------------------------------------------------------------------
    #[test]
    fn test_no_triples() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("Just some regular text without triples");
        assert!(triples.is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 8: Malformed triples are ignored
    // -------------------------------------------------------------------------
    #[test]
    fn test_malformed_triples_ignored() {
        let cortex = TripleCortex::new();
        
        // Missing target
        assert!(cortex.extract("[[A->B]]").is_empty());
        
        // Only arrows
        assert!(cortex.extract("[[->->]]").is_empty());
        
        // Not closed
        assert!(cortex.extract("[[A->B->C").is_empty());
    }

    // -------------------------------------------------------------------------
    // Requirement 9: Raw text preserved
    // -------------------------------------------------------------------------
    #[test]
    fn test_raw_text_preserved() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[ Frodo -> OWNS -> Ring ]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].raw_text, "[[ Frodo -> OWNS -> Ring ]]");
    }

    // -------------------------------------------------------------------------
    // Requirement 10: Case preserved in extraction
    // -------------------------------------------------------------------------
    #[test]
    fn test_case_preserved() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[[FRODO->owns->Ring Of Power]]");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "FRODO");
        assert_eq!(triples[0].predicate, "owns");
        assert_eq!(triples[0].target, "Ring Of Power");
    }

    // -------------------------------------------------------------------------
    // Requirement 11: Forward arrow syntax
    // Source ->RELATION-> Target
    // -------------------------------------------------------------------------
    #[test]
    fn test_forward_arrow_triple() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("Luffy ->CAPTAIN_OF-> Straw Hats");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Luffy");
        assert_eq!(triples[0].predicate, "CAPTAIN_OF");
        assert_eq!(triples[0].target, "Straw Hats");
        assert!(triples[0].source_kind.is_none()); // Plain arrow has no kind
    }

    #[test]
    fn test_forward_arrow_multiword() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("Monkey D. Luffy ->LEADS-> Straw Hat Pirates");

        assert_eq!(triples.len(), 1);
        assert_eq!(triples[0].source, "Monkey D. Luffy");
        assert_eq!(triples[0].target, "Straw Hat Pirates");
    }

    // -------------------------------------------------------------------------
    // Requirement 12: Backward arrow syntax
    // Target <-RELATION<- Source
    // -------------------------------------------------------------------------
    #[test]
    fn test_backward_arrow_triple() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("Straw Hats <-CAPTAIN_OF<- Luffy");

        assert_eq!(triples.len(), 1);
        // Backward arrow swaps: source=Luffy, target=Straw Hats
        assert_eq!(triples[0].source, "Luffy");
        assert_eq!(triples[0].predicate, "CAPTAIN_OF");
        assert_eq!(triples[0].target, "Straw Hats");
    }

    // -------------------------------------------------------------------------
    // Requirement 13: Bidirectional arrow syntax
    // A <->RELATION<-> B (emits both directions)
    // -------------------------------------------------------------------------
    #[test]
    fn test_bidirectional_arrow_triple() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("Luffy <->ALLIES<-> Zoro");

        // Bidirectional emits 2 triples (both directions)
        assert_eq!(triples.len(), 2);
        assert_eq!(triples[0].source, "Luffy");
        assert_eq!(triples[0].target, "Zoro");
        assert_eq!(triples[1].source, "Zoro");
        assert_eq!(triples[1].target, "Luffy");
    }

    // -------------------------------------------------------------------------
    // Requirement 14: Mixed syntax (wiki + arrows)
    // -------------------------------------------------------------------------
    #[test]
    fn test_mixed_triple_syntaxes() {
        let cortex = TripleCortex::new();
        let text = r#"
            [[Gandalf->MENTORS->Frodo]]
            Aragorn ->LOVES-> Arwen
            Mordor <-ENTERED_BY<- Frodo
        "#;
        
        let triples = cortex.extract(text);

        assert_eq!(triples.len(), 3);
        
        // Wiki style
        assert_eq!(triples[0].source, "Gandalf");
        assert_eq!(triples[0].predicate, "MENTORS");
        assert_eq!(triples[0].target, "Frodo");
        
        // Forward arrow
        assert_eq!(triples[1].source, "Aragorn");
        assert_eq!(triples[1].predicate, "LOVES");
        assert_eq!(triples[1].target, "Arwen");
        
        // Backward arrow (swapped: source/target flipped)
        assert_eq!(triples[2].source, "Frodo");
        assert_eq!(triples[2].predicate, "ENTERED_BY");
        assert_eq!(triples[2].target, "Mordor");
    }

    // -------------------------------------------------------------------------
    // Requirement 15: Parenthesized Triple Syntax [KIND|Label] (REL) [KIND|Label]
    // -------------------------------------------------------------------------
    #[test]
    fn test_parenthesized_triple() {
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[CHARACTER|Lilith] (DISCOVERS) [LOCATION|Ancient Facility]");
        
        println!("Found {} triples", triples.len());
        for t in &triples {
            println!("  {} --{}-> {}", t.source, t.predicate, t.target);
        }

        assert_eq!(triples.len(), 1, "Should find 1 parenthesized triple");
        assert_eq!(triples[0].source, "Lilith");
        assert_eq!(triples[0].predicate, "DISCOVERS");
        assert_eq!(triples[0].target, "Ancient Facility");
        assert_eq!(triples[0].source_kind, Some("CHARACTER".to_string()));
        assert_eq!(triples[0].target_kind, Some("LOCATION".to_string()));
    }

    #[test]
    fn test_parenthesized_triple_with_parens_in_label() {
        // Edge case: Label contains parentheses like "Ancient Facility (Elbaph)"
        let cortex = TripleCortex::new();
        let triples = cortex.extract("[CHARACTER|Lilith] (DISCOVERS) [LOCATION|Ancient Facility (Elbaph)]");
        
        println!("Found {} triples", triples.len());
        for t in &triples {
            println!("  {} --{}-> {}", t.source, t.predicate, t.target);
        }

        assert_eq!(triples.len(), 1, "Should find 1 parenthesized triple");
        assert_eq!(triples[0].source, "Lilith");
        assert_eq!(triples[0].predicate, "DISCOVERS");
        assert_eq!(triples[0].target, "Ancient Facility (Elbaph)");
    }

    #[test]
    fn test_multiple_parenthesized_triples() {
        let cortex = TripleCortex::new();
        let text = r#"
[CHARACTER|Lilith] (DISCOVERS) [LOCATION|Ancient Facility]
[CHARACTER|Shanks] (DEFEATS) [CHARACTER|Loki]
[FACTION|Knights of God] (PURSUES) [EVENT|Knights Aim to Annex Elbaph]
"#;
        let triples = cortex.extract(text);
        
        println!("Found {} triples", triples.len());
        for t in &triples {
            println!("  {} --{}-> {}", t.source, t.predicate, t.target);
        }

        assert!(triples.len() >= 3, "Should find at least 3 parenthesized triples, got {}", triples.len());
    }

    #[test]
    fn test_user_document_full_syntax() {
        // This test uses the EXACT syntax from user's document
        let cortex = TripleCortex::new();
        let text = r#"
# ----------------------------
# Ancient facility / Lilith base
# ----------------------------

[LOCATION|Ancient Facility (Elbaph)|{"type":"Ruins","estimated_age_years":3000}]

[EVENT|Lilith Claims Facility|{"type":"Base setup"}]

[LOCATION|Ancient Facility (Elbaph)] (LOCATED_IN) [LOCATION|Elbaph]

[CHARACTER|Lilith] (DISCOVERS) [LOCATION|Ancient Facility (Elbaph)]

[CHARACTER|Lilith] (ESTABLISHES_BASE_AT) [LOCATION|Ancient Facility (Elbaph)]

[CHARACTER|Lilith] (INITIATES) [EVENT|Lilith Claims Facility]

# ----------------------------
# Extra relationship variety: intra-Straw Hats (graph density)
# ----------------------------

[CHARACTER|Roronoa Zoro] (RIVALS_WITH) [CHARACTER|Sanji]

[CHARACTER|Nami] (DISCIPLINES) [CHARACTER|Monkey D. Luffy]

[CHARACTER|Usopp] (ADMires) [FACTION|Giant Warrior Pirates]

[CHARACTER|Franky] (ADMires) [LOCATION|Treasure Tree Adam]

[CHARACTER|Brook] (SUPPORTS) [CHARACTER|Nico Robin]

[CHARACTER|Jinbe] (ADVISES) [CHARACTER|Monkey D. Luffy]
"#;
        let triples = cortex.extract(text);
        
        println!("User Document Test: Found {} triples", triples.len());
        for (i, t) in triples.iter().enumerate() {
            println!("  {}: {} --{}-> {}", i+1, t.source, t.predicate, t.target);
        }

        // Should find 10 triples:
        // 4 from Lilith section + 6 from Straw Hats section
        assert!(triples.len() >= 10, "Should find at least 10 triples from user document. Got {}", triples.len());
        
        // Verify mixed-case predicate works
        let admires = triples.iter().find(|t| t.predicate == "ADMires");
        assert!(admires.is_some(), "Should find ADMires predicate (mixed case)");
    }

    #[test]
    fn test_full_imu_document_diagnostic() {
        // DIAGNOSTIC: This test uses the EXACT user document to trace what's being matched
        let cortex = TripleCortex::new();
        let text = r#"
# ----------------------------
# Imu possession + demonization chain
# ----------------------------
[EVENT|Imu Takes Control of Gunko|{"type":"Possession"}]
[EVENT|Supreme King Haki Burst|{"type":"Overwhelm"}]
[EVENT|Adults Blasted Away|{"type":"Battlefield control"}]
[EVENT|Giants Demonized|{"type":"Conversion"}]

[CHARACTER|Imu] (POSSESSES) [CHARACTER|Gunko]
[EVENT|Imu Takes Control of Gunko] (LEADS_TO) [EVENT|Supreme King Haki Burst]
[EVENT|Supreme King Haki Burst] (LEADS_TO) [EVENT|Adults Blasted Away]
[EVENT|Adults Blasted Away] (LEADS_TO) [EVENT|Giants Demonized]

[CHARACTER|Imu] (TRIGGERS) [EVENT|Imu Takes Control of Gunko]
[CHARACTER|Imu] (EMITS) [EVENT|Supreme King Haki Burst]
[CHARACTER|Imu] (CONVERTS) [EVENT|Giants Demonized]

# ----------------------------
# Dorry & Brogy under influence thread
# ----------------------------
[EVENT|Dorry and Brogy Turned Against Elbaph|{"type":"Corruption"}]
[EVENT|Order to Kill Jarul|{"type":"Assassination order"}]

[EVENT|Giants Demonized] (INCLUDES) [EVENT|Dorry and Brogy Turned Against Elbaph]
[EVENT|Dorry and Brogy Turned Against Elbaph] (LEADS_TO) [EVENT|Order to Kill Jarul]

[CHARACTER|Dorry] (TARGETS) [CHARACTER|Jarul]
[CHARACTER|Brogy] (TARGETS) [CHARACTER|Jarul]
[CHARACTER|Imu] (ORDERS) [EVENT|Order to Kill Jarul]

# ----------------------------
# Robin vs Sommers + Gaban intervention
# ----------------------------
[EVENT|Robin Attempts to Stop Sommers|{"type":"Clash"}]
[EVENT|Gaban Slices Sommers|{"type":"Intervention"}]
[EVENT|Gaban Falls to Underworld|{"type":"Defeat"}]
[EVENT|Chopper Saves Gaban|{"type":"Medical rescue"}]

[CHARACTER|Nico Robin] (CONFRONTS) [CHARACTER|Saint Sommers]
[CHARACTER|Nico Robin] (INITIATES) [EVENT|Robin Attempts to Stop Sommers]
[CHARACTER|Scopper Gaban] (INTERRUPTS) [EVENT|Robin Attempts to Stop Sommers]
[CHARACTER|Scopper Gaban] (CAUSES) [EVENT|Gaban Slices Sommers]
[CHARACTER|Gunko] (DEFEATS) [CHARACTER|Scopper Gaban]
[CHARACTER|Scopper Gaban] (FALLS_INTO) [LOCATION|Underworld]
[EVENT|Gaban Falls to Underworld] (OCCURS_IN) [LOCATION|Underworld]

[CHARACTER|Tony Tony Chopper] (TREATS) [CHARACTER|Scopper Gaban]
[CHARACTER|Tony Tony Chopper] (CAUSES) [EVENT|Chopper Saves Gaban]
[EVENT|Chopper Saves Gaban] (FOLLOWS) [EVENT|Gaban Falls to Underworld]

# ----------------------------
# Loki hammer strike / Adam disaster coupling
# ----------------------------
[EVENT|Loki Strikes Adam|{"type":"Escalation"}]
[EVENT|Lightning and Fire Outbreak|{"type":"Disaster"}]

[CHARACTER|Loki] (STRIKES) [LOCATION|Treasure Tree Adam]
[CHARACTER|Loki] (CAUSES) [EVENT|Loki Strikes Adam]
[EVENT|Loki Strikes Adam] (TRIGGERS) [EVENT|Lightning and Fire Outbreak]
[EVENT|Lightning and Fire Outbreak] (OCCURS_IN) [LOCATION|Sun World]

# ----------------------------
# Elbaph weaknesses + disaster risk modeling
# ----------------------------
[EVENT|Elbaph Weakness: Fire|{"type":"Vulnerability"}]
[EVENT|Elbaph Weakness: Lightning|{"type":"Vulnerability"}]

[CHARACTER|Ripley] (WARNs_ABOUT) [EVENT|Elbaph Weakness: Fire]
[CHARACTER|Ripley] (WARNs_ABOUT) [EVENT|Elbaph Weakness: Lightning]
[EVENT|Lightning and Fire Outbreak] (CORRELATES_WITH) [EVENT|Elbaph Weakness: Fire]
[EVENT|Lightning and Fire Outbreak] (CORRELATES_WITH) [EVENT|Elbaph Weakness: Lightning]
"#;
        let triples = cortex.extract(text);
        
        println!("=== FULL DIAGNOSTIC TEST ===");
        println!("Document length: {} chars", text.len());
        println!("Found {} triples:", triples.len());
        for (i, t) in triples.iter().enumerate() {
            println!("  {}: [{}|{}] ({}) [{}|{}]", 
                i+1, 
                t.source_kind.as_deref().unwrap_or("?"),
                t.source, 
                t.predicate, 
                t.target_kind.as_deref().unwrap_or("?"),
                t.target
            );
        }
        println!("=== END DIAGNOSTIC ===");

        // Expected: 30 triples total
        // Section 1 (Imu): 7 triples
        // Section 2 (Dorry/Brogy): 5 triples
        // Section 3 (Robin/Gaban): 10 triples
        // Section 4 (Loki): 4 triples
        // Section 5 (Elbaph weakness): 4 triples
        
        assert!(triples.len() >= 25, 
            "DIAGNOSTIC FAILURE: Expected ~30 triples, got {}. Check regex/extraction logic.", 
            triples.len()
        );
    }
}
