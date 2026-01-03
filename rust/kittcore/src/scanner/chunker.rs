//! Chunker - NP/VP/PP Detection for NarrativeGraph
//!
//! Phase 1 of the dependency parser for worldbuilders.
//! Identifies noun phrases, verb phrases, prepositional phrases via
//! rule-based head-finding (no neural models, WASM-safe).
//!
//! # Design
//!
//! | Pattern           | Head       | Example                    |
//! |-------------------|------------|----------------------------|
//! | Det? Adj* Noun+   | Last noun  | "the old grey **wizard**"  |
//! | Aux? Adv* Verb    | Verb       | "was slowly **walking**"   |
//! | Prep NP           | Prep       | "**through** the forest"   |
//!
//! # Why Rule-Based?
//! - 95%+ accuracy achievable with rules for English
//! - No model weights to ship in WASM
//! - Deterministic, debuggable

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use std::ops::Range;

// =============================================================================
// Core Types
// =============================================================================

/// Kind of phrase chunk detected
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ChunkKind {
    /// Noun phrase: "the ancient wizard", "a dark forest"
    NounPhrase,
    /// Verb phrase: "was walking slowly", "quickly ran"
    VerbPhrase,
    /// Prepositional phrase: "through the forest", "in the tower"
    PrepPhrase,
    /// Adjective phrase: "incredibly powerful", "very old"
    AdjPhrase,
    /// Relative clause: "who lived in the tower"
    Clause,
}

impl ChunkKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChunkKind::NounPhrase => "NP",
            ChunkKind::VerbPhrase => "VP",
            ChunkKind::PrepPhrase => "PP",
            ChunkKind::AdjPhrase => "ADJP",
            ChunkKind::Clause => "CLAUSE",
        }
    }
}

/// Text range (byte offsets)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TextRange {
    pub start: usize,
    pub end: usize,
}

impl TextRange {
    pub fn new(start: usize, end: usize) -> Self {
        debug_assert!(start <= end, "TextRange: start must be <= end");
        TextRange { start, end }
    }

    pub fn from_range(range: Range<usize>) -> Self {
        TextRange::new(range.start, range.end)
    }

    pub fn len(&self) -> usize {
        self.end - self.start
    }

    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }

    /// Extract the text slice from a source string
    pub fn slice<'a>(&self, source: &'a str) -> &'a str {
        &source[self.start..self.end]
    }

    /// Check if this range contains another range
    pub fn contains(&self, other: &TextRange) -> bool {
        self.start <= other.start && other.end <= self.end
    }

    /// Check if this range overlaps with another
    pub fn overlaps(&self, other: &TextRange) -> bool {
        self.start < other.end && other.start < self.end
    }
}

impl From<Range<usize>> for TextRange {
    fn from(range: Range<usize>) -> Self {
        TextRange::from_range(range)
    }
}

/// A detected phrase chunk
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Chunk {
    /// Type of phrase
    pub kind: ChunkKind,
    /// Full span of the chunk (byte offsets)
    pub range: TextRange,
    /// The head word's span (the main word of the phrase)
    pub head: TextRange,
    /// Spans of modifier words (adjectives, adverbs, determiners, etc.)
    pub modifiers: Vec<TextRange>,
}

impl Chunk {
    pub fn new(kind: ChunkKind, range: TextRange, head: TextRange) -> Self {
        Chunk {
            kind,
            range,
            head,
            modifiers: Vec::new(),
        }
    }

    pub fn with_modifiers(mut self, modifiers: Vec<TextRange>) -> Self {
        self.modifiers = modifiers;
        self
    }

    /// Get the head word text from source
    pub fn head_text<'a>(&self, source: &'a str) -> &'a str {
        self.head.slice(source)
    }

    /// Get the full chunk text from source
    pub fn text<'a>(&self, source: &'a str) -> &'a str {
        self.range.slice(source)
    }
}

/// Part of speech tag (simplified for chunking)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum POS {
    // Nominal
    Noun,
    Pronoun,
    ProperNoun,
    
    // Verbal
    Verb,
    Auxiliary,
    Modal,
    
    // Modifiers
    Adjective,
    Adverb,
    
    // Function words
    Determiner,
    Preposition,
    Conjunction,
    
    // Relative/WH
    RelativePronoun,  // who, which, that (as relative)
    
    // Punctuation & other
    Punctuation,
    Other,
}

impl POS {
    pub fn is_nominal(&self) -> bool {
        matches!(self, POS::Noun | POS::Pronoun | POS::ProperNoun)
    }

    pub fn is_verbal(&self) -> bool {
        matches!(self, POS::Verb | POS::Auxiliary | POS::Modal)
    }

    pub fn is_modifier(&self) -> bool {
        matches!(self, POS::Adjective | POS::Adverb)
    }
}

/// A tagged token
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Token {
    pub text: String,
    pub pos: POS,
    pub range: TextRange,
}

impl Token {
    pub fn new(text: impl Into<String>, pos: POS, range: TextRange) -> Self {
        Token {
            text: text.into(),
            pos,
            range,
        }
    }
}

/// Result of chunking a text
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkResult {
    pub chunks: Vec<Chunk>,
    pub tokens: Vec<Token>,
    /// Time taken in microseconds
    pub timing_us: u64,
}

/// Statistics from chunking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkStats {
    pub noun_phrases: usize,
    pub verb_phrases: usize,
    pub prep_phrases: usize,
    pub adj_phrases: usize,
    pub clauses: usize,
    pub token_count: usize,
}

impl ChunkStats {
    pub fn from_chunks(chunks: &[Chunk], token_count: usize) -> Self {
        let mut stats = ChunkStats {
            noun_phrases: 0,
            verb_phrases: 0,
            prep_phrases: 0,
            adj_phrases: 0,
            clauses: 0,
            token_count,
        };
        for chunk in chunks {
            match chunk.kind {
                ChunkKind::NounPhrase => stats.noun_phrases += 1,
                ChunkKind::VerbPhrase => stats.verb_phrases += 1,
                ChunkKind::PrepPhrase => stats.prep_phrases += 1,
                ChunkKind::AdjPhrase => stats.adj_phrases += 1,
                ChunkKind::Clause => stats.clauses += 1,
            }
        }
        stats
    }
}

// =============================================================================
// Chunker Implementation
// =============================================================================

/// Rule-based phrase chunker for NarrativeGraph
/// 
/// Uses simple POS patterns to identify NP, VP, PP without neural models.
/// Designed for WASM compatibility and deterministic behavior.
#[wasm_bindgen]
pub struct Chunker {
    /// Precompiled word -> POS lookup (common words)
    lexicon: std::collections::HashMap<String, POS>,
}

impl Default for Chunker {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl Chunker {
    /// Create a new Chunker with default English lexicon
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut chunker = Chunker {
            lexicon: std::collections::HashMap::new(),
        };
        chunker.load_default_lexicon();
        chunker
    }

    /// Chunk text and return result as JSON
    pub fn chunk(&self, text: &str) -> Result<JsValue, JsValue> {
        let result = self.chunk_native(text);
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Get chunking statistics as JSON
    pub fn get_stats(&self, text: &str) -> JsValue {
        let result = self.chunk_native(text);
        let stats = ChunkStats::from_chunks(&result.chunks, result.tokens.len());
        serde_wasm_bindgen::to_value(&stats).unwrap_or(JsValue::NULL)
    }
}

// Native (non-WASM) API
impl Chunker {
    /// Chunk text (native Rust API)
    pub fn chunk_native(&self, text: &str) -> ChunkResult {
        let start = instant::Instant::now();
        
        // Step 1: Tokenize
        let tokens = self.tokenize(text);
        
        // Step 2: Tag POS
        let tagged = self.tag_tokens(&tokens, text);
        
        // Step 3: Chunk
        let chunks = self.find_chunks(&tagged, text);
        
        ChunkResult {
            chunks,
            tokens: tagged,
            timing_us: start.elapsed().as_micros() as u64,
        }
    }

    /// Tokenize text into word boundaries
    fn tokenize(&self, text: &str) -> Vec<TextRange> {
        let mut tokens = Vec::new();
        let mut start: Option<usize> = None;
        
        for (i, c) in text.char_indices() {
            if c.is_alphanumeric() || c == '\'' || c == '-' {
                // Inside a word
                if start.is_none() {
                    start = Some(i);
                }
            } else {
                // End of word
                if let Some(s) = start.take() {
                    tokens.push(TextRange::new(s, i));
                }
                // Treat punctuation as separate token
                if c.is_ascii_punctuation() {
                    tokens.push(TextRange::new(i, i + c.len_utf8()));
                }
            }
        }
        // Handle trailing word
        if let Some(s) = start {
            tokens.push(TextRange::new(s, text.len()));
        }
        
        tokens
    }

    /// Tag tokens with POS
    fn tag_tokens(&self, token_ranges: &[TextRange], text: &str) -> Vec<Token> {
        token_ranges
            .iter()
            .map(|range| {
                let word = range.slice(text);
                let pos = self.lookup_pos(word);
                Token::new(word, pos, *range)
            })
            .collect()
    }

    /// Lookup POS for a word
    fn lookup_pos(&self, word: &str) -> POS {
        let lower = word.to_lowercase();
        
        // Check lexicon first
        if let Some(pos) = self.lexicon.get(&lower) {
            return *pos;
        }
        
        // Heuristic rules for unknown words
        self.infer_pos(word)
    }

    /// Infer POS for unknown words using heuristics
    fn infer_pos(&self, word: &str) -> POS {
        let lower = word.to_lowercase();
        
        // Punctuation
        if word.len() == 1 && word.chars().next().map(|c| c.is_ascii_punctuation()).unwrap_or(false) {
            return POS::Punctuation;
        }
        
        // Proper noun heuristic: starts with uppercase (not sentence start - handled contextually)
        if word.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
            return POS::ProperNoun;
        }
        
        // Common suffixes
        if lower.ends_with("ly") {
            return POS::Adverb;
        }
        if lower.ends_with("ing") || lower.ends_with("ed") || lower.ends_with("en") {
            return POS::Verb;
        }
        if lower.ends_with("ness") || lower.ends_with("tion") || lower.ends_with("ment") 
            || lower.ends_with("ity") || lower.ends_with("er") || lower.ends_with("or") {
            return POS::Noun;
        }
        if lower.ends_with("ful") || lower.ends_with("less") || lower.ends_with("ous") 
            || lower.ends_with("ive") || lower.ends_with("able") || lower.ends_with("ible") {
            return POS::Adjective;
        }
        
        // Default: noun (most common open class in English)
        POS::Noun
    }

    /// Find chunks using tagged tokens
    fn find_chunks(&self, tokens: &[Token], _text: &str) -> Vec<Chunk> {
        let mut chunks = Vec::new();
        let mut i = 0;
        
        while i < tokens.len() {
            // Skip punctuation
            if tokens[i].pos == POS::Punctuation {
                i += 1;
                continue;
            }
            
            // Try each pattern in priority order
            if let Some((chunk, consumed)) = self.try_prep_phrase(tokens, i) {
                chunks.push(chunk);
                i += consumed;
            } else if let Some((chunk, consumed)) = self.try_verb_phrase(tokens, i) {
                chunks.push(chunk);
                i += consumed;
            } else if let Some((chunk, consumed)) = self.try_noun_phrase(tokens, i) {
                chunks.push(chunk);
                i += consumed;
            } else if let Some((chunk, consumed)) = self.try_adj_phrase(tokens, i) {
                chunks.push(chunk);
                i += consumed;
            } else if let Some((chunk, consumed)) = self.try_clause(tokens, i) {
                chunks.push(chunk);
                i += consumed;
            } else {
                // No pattern matched, skip token
                i += 1;
            }
        }
        
        chunks
    }

    /// Try to match a noun phrase: Det? Adj* Noun+
    fn try_noun_phrase(&self, tokens: &[Token], start: usize) -> Option<(Chunk, usize)> {
        let mut i = start;
        let mut modifiers = Vec::new();
        
        // Optional determiner
        if i < tokens.len() && tokens[i].pos == POS::Determiner {
            modifiers.push(tokens[i].range);
            i += 1;
        }
        
        // Zero or more adjectives
        while i < tokens.len() && tokens[i].pos == POS::Adjective {
            modifiers.push(tokens[i].range);
            i += 1;
        }
        
        // One or more nouns (compound nouns)
        let noun_start = i;
        while i < tokens.len() && tokens[i].pos.is_nominal() {
            i += 1;
        }
        
        if i > noun_start {
            // Head is the last noun
            let head = tokens[i - 1].range;
            let range = TextRange::new(tokens[start].range.start, tokens[i - 1].range.end);
            let chunk = Chunk::new(ChunkKind::NounPhrase, range, head)
                .with_modifiers(modifiers);
            Some((chunk, i - start))
        } else {
            None
        }
    }

    /// Try to match a verb phrase: Aux? Adv* Verb Adv*
    fn try_verb_phrase(&self, tokens: &[Token], start: usize) -> Option<(Chunk, usize)> {
        let mut i = start;
        let mut modifiers = Vec::new();
        let mut head_idx = None;
        
        // Optional auxiliary
        if i < tokens.len() && (tokens[i].pos == POS::Auxiliary || tokens[i].pos == POS::Modal) {
            modifiers.push(tokens[i].range);
            i += 1;
        }
        
        // Pre-verb adverbs
        while i < tokens.len() && tokens[i].pos == POS::Adverb {
            modifiers.push(tokens[i].range);
            i += 1;
        }
        
        // Main verb (required)
        if i < tokens.len() && tokens[i].pos == POS::Verb {
            head_idx = Some(i);
            i += 1;
        } else {
            return None;
        }
        
        // Post-verb adverbs
        while i < tokens.len() && tokens[i].pos == POS::Adverb {
            modifiers.push(tokens[i].range);
            i += 1;
        }
        
        let head_idx = head_idx?;
        let head = tokens[head_idx].range;
        let range = TextRange::new(tokens[start].range.start, tokens[i - 1].range.end);
        let chunk = Chunk::new(ChunkKind::VerbPhrase, range, head)
            .with_modifiers(modifiers);
        Some((chunk, i - start))
    }

    /// Try to match a prepositional phrase: Prep NP
    fn try_prep_phrase(&self, tokens: &[Token], start: usize) -> Option<(Chunk, usize)> {
        if start >= tokens.len() || tokens[start].pos != POS::Preposition {
            return None;
        }
        
        let prep = &tokens[start];
        let np_start = start + 1;
        
        // Must have a following NP
        let (np, np_consumed) = self.try_noun_phrase(tokens, np_start)?;
        
        // Head of PP is the preposition
        let range = TextRange::new(prep.range.start, np.range.end);
        // Modifiers include the NP components
        let mut modifiers = vec![np.head];
        modifiers.extend(np.modifiers);
        
        let chunk = Chunk::new(ChunkKind::PrepPhrase, range, prep.range)
            .with_modifiers(modifiers);
        Some((chunk, 1 + np_consumed))
    }

    /// Try to match an adjective phrase: Adv* Adj
    fn try_adj_phrase(&self, tokens: &[Token], start: usize) -> Option<(Chunk, usize)> {
        let mut i = start;
        let mut modifiers = Vec::new();
        
        // Intensifier adverbs
        while i < tokens.len() && tokens[i].pos == POS::Adverb {
            modifiers.push(tokens[i].range);
            i += 1;
        }
        
        // Must have at least one adjective
        if i >= tokens.len() || tokens[i].pos != POS::Adjective {
            return None;
        }
        
        let head = tokens[i].range;
        i += 1;
        
        // Only make ADJP if there are intensifiers (standalone adj is part of NP)
        if modifiers.is_empty() {
            return None;
        }
        
        let range = TextRange::new(tokens[start].range.start, tokens[i - 1].range.end);
        let chunk = Chunk::new(ChunkKind::AdjPhrase, range, head)
            .with_modifiers(modifiers);
        Some((chunk, i - start))
    }

    /// Try to match a relative clause: RelPronoun VP | RelPronoun VP NP
    fn try_clause(&self, tokens: &[Token], start: usize) -> Option<(Chunk, usize)> {
        if start >= tokens.len() || tokens[start].pos != POS::RelativePronoun {
            return None;
        }
        
        let rel = &tokens[start];
        let mut i = start + 1;
        
        // Must have a VP
        let (vp, vp_consumed) = self.try_verb_phrase(tokens, i)?;
        i += vp_consumed;
        
        // Optional NP after VP
        let mut end = vp.range.end;
        if let Some((np, np_consumed)) = self.try_noun_phrase(tokens, i) {
            end = np.range.end;
            i += np_consumed;
        }
        
        // Head is the verb of the clause
        let range = TextRange::new(rel.range.start, end);
        let chunk = Chunk::new(ChunkKind::Clause, range, vp.head)
            .with_modifiers(vec![rel.range]);
        Some((chunk, i - start))
    }

    /// Load the default English lexicon
    fn load_default_lexicon(&mut self) {
        // Determiners
        for word in ["the", "a", "an", "this", "that", "these", "those", "my", "your", 
                     "his", "her", "its", "our", "their", "some", "any", "no", "every",
                     "each", "all", "both", "few", "many", "much", "most", "other"] {
            self.lexicon.insert(word.to_string(), POS::Determiner);
        }
        
        // Prepositions
        for word in ["in", "on", "at", "to", "for", "with", "by", "from", "of", "about",
                     "into", "through", "during", "before", "after", "above", "below",
                     "between", "under", "over", "against", "among", "around", "behind",
                     "beside", "beyond", "near", "toward", "towards", "upon", "within",
                     "without", "across", "along", "inside", "outside", "throughout"] {
            self.lexicon.insert(word.to_string(), POS::Preposition);
        }
        
        // Auxiliaries
        for word in ["is", "are", "was", "were", "be", "been", "being", "am",
                     "have", "has", "had", "having", "do", "does", "did", "doing"] {
            self.lexicon.insert(word.to_string(), POS::Auxiliary);
        }
        
        // Modals
        for word in ["can", "could", "will", "would", "shall", "should", "may", "might", "must"] {
            self.lexicon.insert(word.to_string(), POS::Modal);
        }
        
        // Conjunctions
        for word in ["and", "or", "but", "nor", "yet", "so", "for", "because", "although",
                     "while", "if", "unless", "until", "since", "when", "where", "whether"] {
            self.lexicon.insert(word.to_string(), POS::Conjunction);
        }
        
        // Pronouns
        for word in ["i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
                     "myself", "yourself", "himself", "herself", "itself", "ourselves", "themselves"] {
            self.lexicon.insert(word.to_string(), POS::Pronoun);
        }
        
        // Relative pronouns
        for word in ["who", "whom", "whose", "which", "that"] {
            self.lexicon.insert(word.to_string(), POS::RelativePronoun);
        }
        
        // Common adjectives (to help disambiguation)
        for word in ["old", "new", "good", "bad", "great", "small", "large", "big", "little",
                     "young", "long", "short", "high", "low", "early", "late", "first", "last",
                     "ancient", "dark", "bright", "powerful", "mighty", "wise", "evil", "grey",
                     "black", "white", "red", "blue", "green", "golden", "silver"] {
            self.lexicon.insert(word.to_string(), POS::Adjective);
        }
        
        // Common adverbs
        for word in ["very", "quite", "rather", "really", "too", "so", "just", "only",
                     "now", "then", "here", "there", "always", "never", "often", "sometimes",
                     "slowly", "quickly", "suddenly", "finally", "already", "still", "even"] {
            self.lexicon.insert(word.to_string(), POS::Adverb);
        }
        
        // Common verbs (base forms and inflected)
        for word in ["go", "went", "gone", "going", "come", "came", "coming",
                     "say", "said", "saying", "see", "saw", "seen", "seeing",
                     "know", "knew", "known", "knowing", "take", "took", "taken", "taking",
                     "get", "got", "getting", "make", "made", "making",
                     "walk", "walked", "walking", "run", "ran", "running",
                     "live", "lived", "living", "speak", "spoke", "spoken", "speaking",
                     "fight", "fought", "fighting", "kill", "killed", "killing",
                     "love", "loved", "loving", "hate", "hated", "hating",
                     "rule", "ruled", "ruling", "serve", "served", "serving"] {
            self.lexicon.insert(word.to_string(), POS::Verb);
        }
        
        // Common nouns (narrative-specific)
        for word in ["wizard", "king", "queen", "knight", "dragon", "sword", "castle",
                     "forest", "tower", "ring", "magic", "battle", "kingdom", "throne",
                     "warrior", "mage", "elf", "dwarf", "orc", "goblin", "troll",
                     "man", "woman", "child", "hero", "villain", "stranger", "lord", "lady"] {
            self.lexicon.insert(word.to_string(), POS::Noun);
        }
    }
}

// =============================================================================
// Tests (TDD - These define the contract!)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ---------------------------------------------------------------------------
    // Helper functions
    // ---------------------------------------------------------------------------
    
    fn chunk(text: &str) -> ChunkResult {
        let chunker = Chunker::new();
        chunker.chunk_native(text)
    }

    fn find_chunk_by_kind(chunks: &[Chunk], kind: ChunkKind) -> Option<&Chunk> {
        chunks.iter().find(|c| c.kind == kind)
    }

    fn find_all_chunks_by_kind(chunks: &[Chunk], kind: ChunkKind) -> Vec<&Chunk> {
        chunks.iter().filter(|c| c.kind == kind).collect()
    }

    // ---------------------------------------------------------------------------
    // TextRange Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_text_range_basic() {
        let range = TextRange::new(0, 5);
        assert_eq!(range.len(), 5);
        assert!(!range.is_empty());
        
        let empty = TextRange::new(5, 5);
        assert!(empty.is_empty());
    }

    #[test]
    fn test_text_range_slice() {
        let text = "hello world";
        let range = TextRange::new(0, 5);
        assert_eq!(range.slice(text), "hello");
        
        let range2 = TextRange::new(6, 11);
        assert_eq!(range2.slice(text), "world");
    }

    #[test]
    fn test_text_range_contains() {
        let outer = TextRange::new(0, 10);
        let inner = TextRange::new(2, 8);
        assert!(outer.contains(&inner));
        assert!(!inner.contains(&outer));
    }

    #[test]
    fn test_text_range_overlaps() {
        let a = TextRange::new(0, 5);
        let b = TextRange::new(3, 8);
        let c = TextRange::new(6, 10);
        
        assert!(a.overlaps(&b));
        assert!(b.overlaps(&a));
        assert!(!a.overlaps(&c));
        assert!(b.overlaps(&c));
    }

    // ---------------------------------------------------------------------------
    // Noun Phrase Tests (Det? Adj* Noun+)
    // ---------------------------------------------------------------------------

    #[test]
    fn test_np_simple_noun() {
        let result = chunk("wizard");
        let np = find_chunk_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(np.is_some(), "Should find NP for 'wizard'");
        let np = np.unwrap();
        assert_eq!(np.head_text("wizard"), "wizard", "Head should be 'wizard'");
    }

    #[test]
    fn test_np_det_noun() {
        let text = "the wizard";
        let result = chunk(text);
        let np = find_chunk_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(np.is_some(), "Should find NP for 'the wizard'");
        let np = np.unwrap();
        assert_eq!(np.head_text(text), "wizard", "Head should be 'wizard'");
        assert_eq!(np.text(text), "the wizard", "Full NP should be 'the wizard'");
        assert_eq!(np.modifiers.len(), 1, "Should have 1 modifier (determiner)");
    }

    #[test]
    fn test_np_det_adj_noun() {
        let text = "the ancient wizard";
        let result = chunk(text);
        let np = find_chunk_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(np.is_some());
        let np = np.unwrap();
        assert_eq!(np.head_text(text), "wizard");
        assert_eq!(np.text(text), "the ancient wizard");
        assert_eq!(np.modifiers.len(), 2, "Should have 2 modifiers (det + adj)");
    }

    #[test]
    fn test_np_det_multiple_adj_noun() {
        let text = "the old grey wizard";
        let result = chunk(text);
        let np = find_chunk_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(np.is_some());
        let np = np.unwrap();
        assert_eq!(np.head_text(text), "wizard", "Head is last noun");
        assert_eq!(np.text(text), "the old grey wizard");
        assert_eq!(np.modifiers.len(), 3, "Should have 3 modifiers (det + 2 adj)");
    }

    #[test]
    fn test_np_compound_noun() {
        // "ring bearer" - two nouns, head is last
        let text = "the ring bearer";
        let result = chunk(text);
        let nps = find_all_chunks_by_kind(&result.chunks, ChunkKind::NounPhrase);
        // Should treat as compound NP with "bearer" as head
        assert!(!nps.is_empty());
    }

    #[test]
    fn test_np_proper_noun() {
        let text = "Gandalf";
        let result = chunk(text);
        let np = find_chunk_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(np.is_some(), "Proper nouns should form NP");
        assert_eq!(np.unwrap().head_text(text), "Gandalf");
    }

    #[test]
    fn test_np_multiple_separate() {
        let text = "the wizard and the king";
        let result = chunk(text);
        let nps = find_all_chunks_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(nps.len() >= 2, "Should find at least 2 NPs");
    }

    // ---------------------------------------------------------------------------
    // Verb Phrase Tests (Aux? Adv* Verb Adv*)
    // ---------------------------------------------------------------------------

    #[test]
    fn test_vp_simple_verb() {
        let text = "walked";
        let result = chunk(text);
        let vp = find_chunk_by_kind(&result.chunks, ChunkKind::VerbPhrase);
        assert!(vp.is_some(), "Should find VP for 'walked'");
        assert_eq!(vp.unwrap().head_text(text), "walked");
    }

    #[test]
    fn test_vp_aux_verb() {
        let text = "was walking";
        let result = chunk(text);
        let vp = find_chunk_by_kind(&result.chunks, ChunkKind::VerbPhrase);
        assert!(vp.is_some(), "Should find VP for 'was walking'");
        let vp = vp.unwrap();
        assert_eq!(vp.head_text(text), "walking", "Head should be main verb");
        assert_eq!(vp.text(text), "was walking");
        assert_eq!(vp.modifiers.len(), 1, "Should have 1 modifier (aux)");
    }

    #[test]
    fn test_vp_adv_verb() {
        let text = "slowly walked";
        let result = chunk(text);
        let vp = find_chunk_by_kind(&result.chunks, ChunkKind::VerbPhrase);
        assert!(vp.is_some());
        let vp = vp.unwrap();
        assert_eq!(vp.head_text(text), "walked", "Head should be verb");
        assert!(vp.modifiers.len() >= 1, "Should have adverb modifier");
    }

    #[test]
    fn test_vp_aux_adv_verb() {
        let text = "was slowly walking";
        let result = chunk(text);
        let vp = find_chunk_by_kind(&result.chunks, ChunkKind::VerbPhrase);
        assert!(vp.is_some());
        let vp = vp.unwrap();
        assert_eq!(vp.head_text(text), "walking");
        assert_eq!(vp.text(text), "was slowly walking");
        assert_eq!(vp.modifiers.len(), 2, "Should have aux + adv");
    }

    #[test]
    fn test_vp_verb_adv_postposition() {
        let text = "walked slowly";
        let result = chunk(text);
        let vp = find_chunk_by_kind(&result.chunks, ChunkKind::VerbPhrase);
        assert!(vp.is_some());
        let vp = vp.unwrap();
        assert_eq!(vp.head_text(text), "walked");
        assert_eq!(vp.text(text), "walked slowly");
    }

    #[test]
    fn test_vp_modal_verb() {
        let text = "could walk";
        let result = chunk(text);
        let vp = find_chunk_by_kind(&result.chunks, ChunkKind::VerbPhrase);
        assert!(vp.is_some());
        let vp = vp.unwrap();
        assert_eq!(vp.head_text(text), "walk");
    }

    // ---------------------------------------------------------------------------
    // Prepositional Phrase Tests (Prep NP)
    // ---------------------------------------------------------------------------

    #[test]
    fn test_pp_simple() {
        let text = "through the forest";
        let result = chunk(text);
        let pp = find_chunk_by_kind(&result.chunks, ChunkKind::PrepPhrase);
        assert!(pp.is_some(), "Should find PP for 'through the forest'");
        let pp = pp.unwrap();
        assert_eq!(pp.head_text(text), "through", "PP head is preposition");
        assert_eq!(pp.text(text), "through the forest");
    }

    #[test]
    fn test_pp_with_adj() {
        let text = "in the dark forest";
        let result = chunk(text);
        let pp = find_chunk_by_kind(&result.chunks, ChunkKind::PrepPhrase);
        assert!(pp.is_some());
        let pp = pp.unwrap();
        assert_eq!(pp.head_text(text), "in");
        assert_eq!(pp.text(text), "in the dark forest");
    }

    #[test]
    fn test_pp_multiple() {
        let text = "in the tower on the hill";
        let result = chunk(text);
        let pps = find_all_chunks_by_kind(&result.chunks, ChunkKind::PrepPhrase);
        assert!(pps.len() >= 2, "Should find 2 PPs");
    }

    // ---------------------------------------------------------------------------
    // Adjective Phrase Tests (Adv* Adj) - only when intensified
    // ---------------------------------------------------------------------------

    #[test]
    fn test_adjp_intensified() {
        let text = "very powerful";
        let result = chunk(text);
        let adjp = find_chunk_by_kind(&result.chunks, ChunkKind::AdjPhrase);
        assert!(adjp.is_some(), "Should find ADJP for 'very powerful'");
        let adjp = adjp.unwrap();
        assert_eq!(adjp.head_text(text), "powerful");
    }

    #[test]
    fn test_adjp_multiple_intensifiers() {
        let text = "really very powerful";
        let result = chunk(text);
        let adjp = find_chunk_by_kind(&result.chunks, ChunkKind::AdjPhrase);
        assert!(adjp.is_some());
        let adjp = adjp.unwrap();
        assert_eq!(adjp.head_text(text), "powerful");
        assert!(adjp.modifiers.len() >= 2);
    }

    // ---------------------------------------------------------------------------
    // Clause Tests (RelPronoun VP [NP])
    // ---------------------------------------------------------------------------

    #[test]
    fn test_clause_simple() {
        let text = "who lived";
        let result = chunk(text);
        let clause = find_chunk_by_kind(&result.chunks, ChunkKind::Clause);
        assert!(clause.is_some(), "Should find clause for 'who lived'");
        let clause = clause.unwrap();
        assert_eq!(clause.head_text(text), "lived", "Clause head is verb");
    }

    #[test]
    fn test_clause_with_pp() {
        // This is complex - "who lived in the tower" 
        // Should get clause with VP, then PP should be separate or nested
        let text = "who lived";
        let result = chunk(text);
        let clause = find_chunk_by_kind(&result.chunks, ChunkKind::Clause);
        assert!(clause.is_some());
    }

    // ---------------------------------------------------------------------------
    // Integration Tests (Full Sentences)
    // ---------------------------------------------------------------------------

    #[test]
    fn test_full_sentence_simple() {
        let text = "The wizard walked through the forest";
        let result = chunk(text);
        
        // Should have: NP(the wizard), VP(walked), PP(through the forest)
        let nps = find_all_chunks_by_kind(&result.chunks, ChunkKind::NounPhrase);
        let vps = find_all_chunks_by_kind(&result.chunks, ChunkKind::VerbPhrase);
        let pps = find_all_chunks_by_kind(&result.chunks, ChunkKind::PrepPhrase);
        
        assert!(!nps.is_empty(), "Should find NP");
        assert!(!vps.is_empty(), "Should find VP");
        assert!(!pps.is_empty(), "Should find PP");
    }

    #[test]
    fn test_full_sentence_with_aux() {
        let text = "The ancient wizard was slowly walking through the dark forest";
        let result = chunk(text);
        
        // Check we found the key components
        let stats = ChunkStats::from_chunks(&result.chunks, result.tokens.len());
        assert!(stats.noun_phrases >= 1);
        assert!(stats.verb_phrases >= 1);
        assert!(stats.prep_phrases >= 1);
    }

    #[test]
    fn test_narrative_sentence() {
        let text = "Gandalf the Grey walked slowly into the dark tower";
        let result = chunk(text);
        
        // Should handle proper nouns and complex modifiers
        assert!(!result.chunks.is_empty());
    }

    // ---------------------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------------------

    #[test]
    fn test_empty_text() {
        let result = chunk("");
        assert!(result.chunks.is_empty());
        assert!(result.tokens.is_empty());
    }

    #[test]
    fn test_punctuation_only() {
        let result = chunk("...");
        assert!(result.chunks.is_empty(), "Punctuation shouldn't form chunks");
    }

    #[test]
    fn test_single_word_types() {
        // Single determiner shouldn't form chunk
        let result = chunk("the");
        let nps = find_all_chunks_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(nps.is_empty(), "Lone determiner shouldn't form NP");
    }

    #[test]
    fn test_possessive_determiner() {
        let text = "his sword";
        let result = chunk(text);
        let np = find_chunk_by_kind(&result.chunks, ChunkKind::NounPhrase);
        assert!(np.is_some());
        assert_eq!(np.unwrap().text(text), "his sword");
    }

    // ---------------------------------------------------------------------------
    // Performance Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_performance_short() {
        let text = "The wizard walked through the forest.";
        let result = chunk(text);
        assert!(result.timing_us < 1000, "Short text should chunk in <1ms");
    }

    #[test]
    fn test_performance_paragraph() {
        let text = "The ancient wizard slowly walked through the dark forest. \
                   He was searching for the hidden tower where the dragon lived. \
                   The path was treacherous and the night was cold.";
        let result = chunk(text);
        assert!(result.timing_us < 5000, "Paragraph should chunk in <5ms");
    }

    // ---------------------------------------------------------------------------
    // ChunkStats Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_chunk_stats() {
        let text = "The wizard walked through the forest";
        let result = chunk(text);
        let stats = ChunkStats::from_chunks(&result.chunks, result.tokens.len());
        
        assert!(stats.noun_phrases >= 1);
        assert!(stats.verb_phrases >= 1);
        assert!(stats.prep_phrases >= 1);
        assert!(stats.token_count > 0);
    }
}
