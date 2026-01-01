//! SyntaxCortex - Document syntax pattern detection via Regex
//!
//! Detects structured syntax patterns in documents:
//! - Wikilinks: [[Target]] or [[Target|Label]]
//! - Backlinks: <<Target>> or <<Target|Label>>
//! - Entity Syntax: [KIND:Label] or [KIND:Label:Subtype]
//! - Triple Syntax: [Subject] -[Predicate]-> [Object]
//! - Inline Relationships: [Entity@relation]
//! - Tags: #tag or #multi-word-tag
//! - Mentions: @username
//!
//! All patterns use compiled regex for optimal performance.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// ==================== TYPE DEFINITIONS ====================

/// Kind of syntax match detected
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub enum SyntaxKind {
    Wikilink,
    Backlink,
    Entity,
    Triple,
    InlineRelation,
    Tag,
    Mention,
}

impl SyntaxKind {
    fn as_str(&self) -> &'static str {
        match self {
            SyntaxKind::Wikilink => "wikilink",
            SyntaxKind::Backlink => "backlink",
            SyntaxKind::Entity => "entity",
            SyntaxKind::Triple => "triple",
            SyntaxKind::InlineRelation => "inline_relation",
            SyntaxKind::Tag => "tag",
            SyntaxKind::Mention => "mention",
        }
    }
}

/// A single syntax match result
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SyntaxMatch {
    pub kind: String,
    pub start: usize,
    pub end: usize,
    pub content: String,
    pub captures: HashMap<String, String>,
}

/// Statistics about syntax patterns
#[derive(Serialize, Deserialize)]
pub struct SyntaxStats {
    pub wikilinks: usize,
    pub backlinks: usize,
    pub entities: usize,
    pub triples: usize,
    pub inline_relations: usize,
    pub tags: usize,
    pub mentions: usize,
}

// ==================== MAIN IMPLEMENTATION ====================

/// SyntaxCortex - Document syntax pattern detector
/// 
/// Detects all structured syntax patterns in O(n) time per pattern type.
/// Patterns are matched in order to handle overlaps correctly.
#[wasm_bindgen]
pub struct SyntaxCortex {
    // Pre-compiled regex patterns
    wikilink_re: Regex,
    backlink_re: Regex,
    entity_re: Regex,
    triple_re: Regex,
    inline_relation_re: Regex,
    tag_re: Regex,
    mention_re: Regex,
}

#[wasm_bindgen]
impl SyntaxCortex {
    /// Create a new SyntaxCortex with all patterns compiled
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        // Pattern explanations:
        
        // [[Target]] or [[Target|Label]]
        // Group 1: target, Group 2: optional label
        let wikilink_re = Regex::new(r"\[\[([^\|\]]+)(?:\|([^\]]+))?\]\]").unwrap();
        
        // <<Target>> or <<Target|Label>>
        // Group 1: target, Group 2: optional label
        let backlink_re = Regex::new(r"<<([^\|>]+)(?:\|([^>]+))?>>").unwrap();
        
        // OMNI-REGEX: Flexible entity syntax
        // Supports:
        // - [CHARACTER:Luffy]      (standard uppercase)
        // - [character:Luffy]      (lowercase kind)
        // - [#character|Luffy]     (hash prefix, pipe separator)
        // - [@faction:StrawHats]   (@ prefix)
        // - [!item|sword]          (! prefix, pipe separator)
        // - [KIND:Label:Subtype]   (with subtype)
        //
        // Group 1: kind (optional prefix #/@/!, then alphanumeric, _, -)
        // Group 2: label
        // Group 3: optional subtype
        let entity_re = Regex::new(r"\[([#@!]?[a-zA-Z0-9_-]+)[|:]([^\]|:]+)(?:[|:]([^\]]+))?\]").unwrap();
        
        // OMNI-REGEX: Flexible triple syntax
        // [Subject] -[Predicate]-> [Object]
        // Allows flexible kind prefixes and separators on both sides
        // Group 1: subject kind, Group 2: subject label
        // Group 3: predicate
        // Group 4: object kind, Group 5: object label
        let triple_re = Regex::new(
            r"\[([#@!]?[a-zA-Z0-9_-]+)[|:]([^\]]+)\]\s*-\[([^\]]+)\]->\s*\[([#@!]?[a-zA-Z0-9_-]+)[|:]([^\]]+)\]"
        ).unwrap();
        
        // OMNI-REGEX: Flexible inline relation syntax
        // [Entity@relation] - inline relationship annotation
        // Supports flexible kind prefixes and separators
        // Group 1: entity kind, Group 2: entity label, Group 3: relation
        let inline_relation_re = Regex::new(r"\[([#@!]?[a-zA-Z0-9_-]+)[|:]([^@\]]+)@([^\]]+)\]").unwrap();
        
        // #tag or #multi-word-tag (alphanumeric, -, _, /)
        // Note: Rust regex doesn't support lookbehind. 
        // We use a capturing group approach instead:
        // Match optional preceding char, then #tag. Filter HTML entities in post-processing.
        let tag_re = Regex::new(r"(?:^|[^&])#([\w\-/]+)").unwrap();
        
        // @username (alphanumeric, _, -)
        let mention_re = Regex::new(r"@([\w\-]+)").unwrap();

        Self {
            wikilink_re,
            backlink_re,
            entity_re,
            triple_re,
            inline_relation_re,
            tag_re,
            mention_re,
        }
    }

    /// Scan text for all syntax patterns
    /// 
    /// Returns a JsValue containing an array of SyntaxMatch objects.
    #[wasm_bindgen(js_name = scan)]
    pub fn scan(&self, text: &str) -> Result<JsValue, JsValue> {
        let mut matches = Vec::new();

        // Order matters for overlapping patterns!
        // Process in order of specificity (most specific first)
        
        // 1. Triples (most specific entity-like syntax)
        for cap in self.triple_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            let mut captures = HashMap::new();
            
            if let Some(m) = cap.get(1) { captures.insert("subject_kind".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(2) { captures.insert("subject_label".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(3) { captures.insert("predicate".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(4) { captures.insert("object_kind".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(5) { captures.insert("object_label".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::Triple.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        // 2. Inline relations (before regular entities to avoid double-matching)
        for cap in self.inline_relation_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            
            // Skip if this position is already covered by a triple
            if matches.iter().any(|m| m.start <= full.start() && m.end >= full.end()) {
                continue;
            }
            
            let mut captures = HashMap::new();
            if let Some(m) = cap.get(1) { captures.insert("entity_kind".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(2) { captures.insert("entity_label".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(3) { captures.insert("relation".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::InlineRelation.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        // 3. Regular entity syntax
        for cap in self.entity_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            
            // Skip if already covered
            if matches.iter().any(|m| m.start <= full.start() && m.end >= full.end()) {
                continue;
            }
            
            let mut captures = HashMap::new();
            if let Some(m) = cap.get(1) { captures.insert("entity_kind".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(2) { captures.insert("label".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(3) { captures.insert("subtype".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::Entity.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        // 4. Wikilinks
        for cap in self.wikilink_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            let mut captures = HashMap::new();
            
            if let Some(m) = cap.get(1) { captures.insert("target".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(2) { captures.insert("label".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::Wikilink.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        // 5. Backlinks
        for cap in self.backlink_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            let mut captures = HashMap::new();
            
            if let Some(m) = cap.get(1) { captures.insert("target".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(2) { captures.insert("label".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::Backlink.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        // 6. Tags
        for cap in self.tag_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            let mut captures = HashMap::new();
            
            if let Some(m) = cap.get(1) { captures.insert("tag".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::Tag.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        // 7. Mentions
        for cap in self.mention_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            let mut captures = HashMap::new();
            
            if let Some(m) = cap.get(1) { captures.insert("username".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::Mention.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        // Sort by position
        matches.sort_by_key(|m| m.start);

        serde_wasm_bindgen::to_value(&matches)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Scan for entities only (optimized path)
    #[wasm_bindgen(js_name = scanEntitiesOnly)]
    pub fn scan_entities_only(&self, text: &str) -> Result<JsValue, JsValue> {
        let mut matches = Vec::new();

        for cap in self.entity_re.captures_iter(text) {
            let full = cap.get(0).unwrap();
            let mut captures = HashMap::new();
            
            if let Some(m) = cap.get(1) { captures.insert("entity_kind".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(2) { captures.insert("label".to_string(), m.as_str().to_string()); }
            if let Some(m) = cap.get(3) { captures.insert("subtype".to_string(), m.as_str().to_string()); }
            
            matches.push(SyntaxMatch {
                kind: SyntaxKind::Entity.as_str().to_string(),
                start: full.start(),
                end: full.end(),
                content: full.as_str().to_string(),
                captures,
            });
        }

        serde_wasm_bindgen::to_value(&matches)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Get pattern match statistics for text
    #[wasm_bindgen(js_name = getStats)]
    pub fn get_stats(&self, text: &str) -> JsValue {
        let stats = SyntaxStats {
            wikilinks: self.wikilink_re.find_iter(text).count(),
            backlinks: self.backlink_re.find_iter(text).count(),
            entities: self.entity_re.find_iter(text).count(),
            triples: self.triple_re.find_iter(text).count(),
            inline_relations: self.inline_relation_re.find_iter(text).count(),
            tags: self.tag_re.find_iter(text).count(),
            mentions: self.mention_re.find_iter(text).count(),
        };
        serde_wasm_bindgen::to_value(&stats).unwrap_or(JsValue::NULL)
    }
}

impl Default for SyntaxCortex {
    fn default() -> Self {
        Self::new()
    }
}

// ==================== TESTS ====================

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_matches(result: JsValue) -> Vec<SyntaxMatch> {
        // In tests, we can't use serde_wasm_bindgen::from_value
        // So we test via the rust-native scan_internal
        Vec::new()
    }

    #[test]
    fn test_wikilink_simple() {
        let cortex = SyntaxCortex::new();
        // Manual test since wasm_bindgen isn't available in unit tests
        let text = "Visit [[Rivendell]] today";
        
        let count = cortex.wikilink_re.find_iter(text).count();
        assert_eq!(count, 1);
        
        let cap = cortex.wikilink_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "Rivendell");
    }

    #[test]
    fn test_wikilink_with_label() {
        let cortex = SyntaxCortex::new();
        let text = "Visit [[Rivendell|The Last Homely House]]";
        
        let cap = cortex.wikilink_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "Rivendell");
        assert_eq!(cap.get(2).unwrap().as_str(), "The Last Homely House");
    }

    #[test]
    fn test_backlink() {
        let cortex = SyntaxCortex::new();
        let text = "Referenced from <<Chapter One>>";
        
        let cap = cortex.backlink_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "Chapter One");
    }

    #[test]
    fn test_entity_syntax() {
        let cortex = SyntaxCortex::new();
        let text = "[CHARACTER:Aragorn] is the king";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "CHARACTER");
        assert_eq!(cap.get(2).unwrap().as_str(), "Aragorn");
    }

    #[test]
    fn test_entity_with_subtype() {
        let cortex = SyntaxCortex::new();
        let text = "[CHARACTER:Gandalf:Wizard]";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "CHARACTER");
        assert_eq!(cap.get(2).unwrap().as_str(), "Gandalf");
        assert_eq!(cap.get(3).unwrap().as_str(), "Wizard");
    }

    #[test]
    fn test_triple_syntax() {
        let cortex = SyntaxCortex::new();
        let text = "[CHARACTER:Frodo] -[carries]-> [ITEM:The One Ring]";
        
        let cap = cortex.triple_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "CHARACTER");
        assert_eq!(cap.get(2).unwrap().as_str(), "Frodo");
        assert_eq!(cap.get(3).unwrap().as_str(), "carries");
        assert_eq!(cap.get(4).unwrap().as_str(), "ITEM");
        assert_eq!(cap.get(5).unwrap().as_str(), "The One Ring");
    }

    #[test]
    fn test_inline_relation() {
        let cortex = SyntaxCortex::new();
        let text = "[CHARACTER:Sam@friend_of]";
        
        let cap = cortex.inline_relation_re.captures(text).unwrap();
        assert_eq!(cap.get(2).unwrap().as_str(), "Sam");
        assert_eq!(cap.get(3).unwrap().as_str(), "friend_of");
    }

    #[test]
    fn test_tags() {
        let cortex = SyntaxCortex::new();
        let text = "This is #fantasy and #world-building";
        
        let count = cortex.tag_re.find_iter(text).count();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_tag_not_html_entity() {
        let cortex = SyntaxCortex::new();
        // With the regex (?:^|[^&])#tag, &#123 won't match because & precedes #
        // But #real-tag will match because space precedes it
        let text = "Code: &#123; is not a tag but #real-tag is";
        
        let captures: Vec<_> = cortex.tag_re.captures_iter(text).collect();
        // The &#123 won't match (because & precedes #), only #real-tag matches
        assert_eq!(captures.len(), 1);
        assert_eq!(captures[0].get(1).unwrap().as_str(), "real-tag");
    }

    #[test]
    fn test_mentions() {
        let cortex = SyntaxCortex::new();
        let text = "Thanks @tolkien for the inspiration";
        
        let cap = cortex.mention_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "tolkien");
    }

    // ==================== OMNI-REGEX TESTS ====================

    #[test]
    fn test_entity_hash_prefix_pipe_separator() {
        let cortex = SyntaxCortex::new();
        let text = "[#character|Luffy] is the captain";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "#character");
        assert_eq!(cap.get(2).unwrap().as_str(), "Luffy");
    }

    #[test]
    fn test_entity_at_prefix() {
        let cortex = SyntaxCortex::new();
        let text = "[@faction:StrawHats] rules the seas";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "@faction");
        assert_eq!(cap.get(2).unwrap().as_str(), "StrawHats");
    }

    #[test]
    fn test_entity_bang_prefix_pipe() {
        let cortex = SyntaxCortex::new();
        let text = "[!item|sword] is legendary";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "!item");
        assert_eq!(cap.get(2).unwrap().as_str(), "sword");
    }

    #[test]
    fn test_entity_lowercase_kind() {
        let cortex = SyntaxCortex::new();
        let text = "[character:Zoro] fights with swords";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "character");
        assert_eq!(cap.get(2).unwrap().as_str(), "Zoro");
    }

    #[test]
    fn test_entity_mixed_case_kind() {
        let cortex = SyntaxCortex::new();
        let text = "[Character:Nami] navigates the ship";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "Character");
        assert_eq!(cap.get(2).unwrap().as_str(), "Nami");
    }

    #[test]
    fn test_entity_pipe_separator_with_subtype() {
        let cortex = SyntaxCortex::new();
        let text = "[#character|Sanji|Cook]";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "#character");
        assert_eq!(cap.get(2).unwrap().as_str(), "Sanji");
        assert_eq!(cap.get(3).unwrap().as_str(), "Cook");
    }

    #[test]
    fn test_triple_flexible_syntax() {
        let cortex = SyntaxCortex::new();
        let text = "[#character|Luffy] -[captain_of]-> [@faction:StrawHats]";
        
        let cap = cortex.triple_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "#character");
        assert_eq!(cap.get(2).unwrap().as_str(), "Luffy");
        assert_eq!(cap.get(3).unwrap().as_str(), "captain_of");
        assert_eq!(cap.get(4).unwrap().as_str(), "@faction");
        assert_eq!(cap.get(5).unwrap().as_str(), "StrawHats");
    }

    #[test]
    fn test_triple_lowercase_kinds() {
        let cortex = SyntaxCortex::new();
        let text = "[character:Robin] -[member_of]-> [crew:StrawHats]";
        
        let cap = cortex.triple_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "character");
        assert_eq!(cap.get(2).unwrap().as_str(), "Robin");
        assert_eq!(cap.get(3).unwrap().as_str(), "member_of");
        assert_eq!(cap.get(4).unwrap().as_str(), "crew");
        assert_eq!(cap.get(5).unwrap().as_str(), "StrawHats");
    }

    #[test]
    fn test_inline_relation_flexible() {
        let cortex = SyntaxCortex::new();
        let text = "[#character|Chopper@doctor_of]";
        
        let cap = cortex.inline_relation_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "#character");
        assert_eq!(cap.get(2).unwrap().as_str(), "Chopper");
        assert_eq!(cap.get(3).unwrap().as_str(), "doctor_of");
    }

    #[test]
    fn test_inline_relation_at_prefix() {
        let cortex = SyntaxCortex::new();
        let text = "[@ally:Brook@musician_of]";
        
        let cap = cortex.inline_relation_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "@ally");
        assert_eq!(cap.get(2).unwrap().as_str(), "Brook");
        assert_eq!(cap.get(3).unwrap().as_str(), "musician_of");
    }

    #[test]
    fn test_entity_with_hyphen_in_kind() {
        let cortex = SyntaxCortex::new();
        let text = "[devil-fruit:Gomu-Gomu]";
        
        let cap = cortex.entity_re.captures(text).unwrap();
        assert_eq!(cap.get(1).unwrap().as_str(), "devil-fruit");
        assert_eq!(cap.get(2).unwrap().as_str(), "Gomu-Gomu");
    }
}
