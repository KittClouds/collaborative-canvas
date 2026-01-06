//! Verb Morphology - Inflection-based verb recognition
//!
//! Template-based verb conjugation system that generates all inflected forms
//! from base verbs. Domain-agnostic, compact storage (~100 bases → 400+ forms).
//!
//! # Design
//! - Store base forms with conjugation patterns
//! - Auto-generate 3rd singular, past, past participle, present participle
//! - HashMap lookup for O(1) verb detection
//!
//! # Usage
//! ```rust
//! let morphology = VerbMorphology::default();
//! assert!(morphology.is_verb("leads"));
//! assert!(morphology.is_verb("taught"));
//! assert!(!morphology.is_verb("wizard"));
//! ```

use std::collections::HashSet;

// =============================================================================
// Core Types
// =============================================================================

/// Conjugation pattern for English verbs
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerbPattern {
    /// Regular: walk → walks, walked, walking
    Regular,
    /// -e ending: love → loves, loved, loving (drop e for -ing)
    RegularE,
    /// Consonant doubling: stop → stops, stopped, stopping
    DoubleConsonant,
    /// -y to -ies/-ied: carry → carries, carried, carrying
    YToI,
    /// Irregular with explicit past and past participle
    Irregular {
        past: &'static str,
        past_participle: &'static str,
    },
}

/// A verb entry with base form and conjugation pattern
#[derive(Debug, Clone)]
pub struct VerbEntry {
    pub base: &'static str,
    pub pattern: VerbPattern,
}

impl VerbEntry {
    /// Create a regular verb entry
    pub const fn regular(base: &'static str) -> Self {
        Self { base, pattern: VerbPattern::Regular }
    }

    /// Create a verb ending in -e (love, hate, etc.)
    pub const fn e_ending(base: &'static str) -> Self {
        Self { base, pattern: VerbPattern::RegularE }
    }

    /// Create a verb that doubles final consonant (stop, plan, etc.)
    pub const fn double_consonant(base: &'static str) -> Self {
        Self { base, pattern: VerbPattern::DoubleConsonant }
    }

    /// Create a verb ending in consonant + y (carry, marry, etc.)
    pub const fn y_to_i(base: &'static str) -> Self {
        Self { base, pattern: VerbPattern::YToI }
    }

    /// Create an irregular verb with explicit past forms
    pub const fn irregular(base: &'static str, past: &'static str, past_participle: &'static str) -> Self {
        Self { base, pattern: VerbPattern::Irregular { past, past_participle } }
    }

    /// Generate all inflected forms of this verb
    pub fn inflections(&self) -> Vec<String> {
        let base = self.base;
        
        match &self.pattern {
            VerbPattern::Regular => {
                let third_singular = Self::third_person_singular(base);
                
                vec![
                    base.to_string(),                         // walk / possess
                    third_singular,                           // walks / possesses
                    format!("{}ed", base),                    // walked / possessed
                    format!("{}ing", base),                   // walking / possessing
                ]
            },
            
            VerbPattern::RegularE => {
                let stem = &base[..base.len() - 1]; // Remove trailing 'e'
                vec![
                    base.to_string(),                     // love
                    format!("{}s", base),                 // loves
                    format!("{}d", base),                 // loved
                    format!("{}ing", stem),               // loving
                ]
            },
            
            VerbPattern::DoubleConsonant => {
                let last_char = base.chars().last().unwrap();
                vec![
                    base.to_string(),                          // stop
                    format!("{}s", base),                      // stops
                    format!("{}{}ed", base, last_char),        // stopped
                    format!("{}{}ing", base, last_char),       // stopping
                ]
            },
            
            VerbPattern::YToI => {
                let stem = &base[..base.len() - 1]; // Remove trailing 'y'
                vec![
                    base.to_string(),                     // carry
                    format!("{}ies", stem),               // carries
                    format!("{}ied", stem),               // carried
                    format!("{}ying", stem),              // carrying
                ]
            },
            
            VerbPattern::Irregular { past, past_participle } => {
                let third_singular = Self::third_person_singular(base);
                let mut forms = vec![
                    base.to_string(),
                    third_singular,
                    past.to_string(),
                    format!("{}ing", base),
                ];
                // Only add past_participle if different from past
                if past != past_participle {
                    forms.push(past_participle.to_string());
                }
                forms
            },
        }
    }
    
    /// Generate third person singular form (handles sibilants)
    fn third_person_singular(base: &str) -> String {
        if base.ends_with('s') || base.ends_with('x') 
            || base.ends_with('z') || base.ends_with("sh") || base.ends_with("ch") {
            format!("{}es", base)
        } else if base.ends_with('y') && !base.ends_with("ay") && !base.ends_with("ey") 
            && !base.ends_with("oy") && !base.ends_with("uy") {
            // consonant + y: fly → flies, but play → plays
            format!("{}ies", &base[..base.len()-1])
        } else {
            format!("{}s", base)
        }
    }
}

// =============================================================================
// Verb Table (Compact Storage)
// =============================================================================

/// Core verb table - organized by semantic category for maintainability
/// but stored flat for fast iteration
const VERB_TABLE: &[VerbEntry] = &[
    // -------------------------------------------------------------------------
    // Leadership / Authority
    // -------------------------------------------------------------------------
    VerbEntry::irregular("lead", "led", "led"),
    VerbEntry::regular("command"),
    VerbEntry::e_ending("rule"),
    VerbEntry::regular("govern"),
    VerbEntry::regular("control"),
    VerbEntry::regular("direct"),
    
    // -------------------------------------------------------------------------
    // Teaching / Mentorship
    // -------------------------------------------------------------------------
    VerbEntry::irregular("teach", "taught", "taught"),
    VerbEntry::regular("mentor"),
    VerbEntry::regular("train"),
    VerbEntry::e_ending("guide"),
    VerbEntry::regular("instruct"),
    VerbEntry::regular("tutor"),
    
    // -------------------------------------------------------------------------
    // Protection / Defense
    // -------------------------------------------------------------------------
    VerbEntry::regular("guard"),
    VerbEntry::regular("protect"),
    VerbEntry::regular("defend"),
    VerbEntry::regular("shield"),
    VerbEntry::regular("watch"),
    
    // -------------------------------------------------------------------------
    // Possession / Ownership
    // -------------------------------------------------------------------------
    VerbEntry::irregular("hold", "held", "held"),
    VerbEntry::regular("own"),
    VerbEntry::regular("possess"),
    VerbEntry::irregular("keep", "kept", "kept"),
    VerbEntry::regular("control"),
    VerbEntry::e_ending("have"), // Special: has/had/having - handled separately
    
    // -------------------------------------------------------------------------
    // Combat / Conflict
    // -------------------------------------------------------------------------
    VerbEntry::irregular("fight", "fought", "fought"),
    VerbEntry::regular("defeat"),
    VerbEntry::regular("kill"),
    VerbEntry::regular("attack"),
    VerbEntry::e_ending("battle"),
    VerbEntry::regular("destroy"),
    VerbEntry::regular("conquer"),
    
    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------
    VerbEntry::e_ending("love"),
    VerbEntry::e_ending("hate"),
    VerbEntry::y_to_i("marry"),
    VerbEntry::regular("befriend"),
    VerbEntry::regular("betray"),
    VerbEntry::regular("trust"),
    
    // -------------------------------------------------------------------------
    // Movement
    // -------------------------------------------------------------------------
    VerbEntry::irregular("go", "went", "gone"),
    VerbEntry::irregular("come", "came", "come"),
    VerbEntry::irregular("run", "ran", "run"),
    VerbEntry::regular("walk"),
    VerbEntry::e_ending("move"),
    VerbEntry::irregular("fly", "flew", "flown"),
    VerbEntry::regular("travel"),
    
    // -------------------------------------------------------------------------
    // Communication
    // -------------------------------------------------------------------------
    VerbEntry::irregular("say", "said", "said"),
    VerbEntry::irregular("tell", "told", "told"),
    VerbEntry::irregular("speak", "spoke", "spoken"),
    VerbEntry::regular("talk"),
    VerbEntry::regular("ask"),
    VerbEntry::regular("answer"),
    VerbEntry::regular("call"),
    
    // -------------------------------------------------------------------------
    // Cognition / Perception
    // -------------------------------------------------------------------------
    VerbEntry::irregular("know", "knew", "known"),
    VerbEntry::irregular("think", "thought", "thought"),
    VerbEntry::irregular("see", "saw", "seen"),
    VerbEntry::irregular("hear", "heard", "heard"),
    VerbEntry::irregular("understand", "understood", "understood"),
    VerbEntry::e_ending("believe"),
    VerbEntry::regular("remember"),
    
    // -------------------------------------------------------------------------
    // Creation / Modification
    // -------------------------------------------------------------------------
    VerbEntry::irregular("make", "made", "made"),
    VerbEntry::e_ending("create"),
    VerbEntry::irregular("build", "built", "built"),
    VerbEntry::irregular("write", "wrote", "written"),
    VerbEntry::e_ending("forge"),
    VerbEntry::irregular("draw", "drew", "drawn"),
    
    // -------------------------------------------------------------------------
    // State / Existence
    // -------------------------------------------------------------------------
    VerbEntry::irregular("be", "was", "been"),
    VerbEntry::e_ending("become"),
    VerbEntry::regular("remain"),
    VerbEntry::regular("exist"),
    VerbEntry::e_ending("live"),
    VerbEntry::irregular("die", "died", "died"),
    
    // -------------------------------------------------------------------------
    // Acquisition / Transfer
    // -------------------------------------------------------------------------
    VerbEntry::irregular("get", "got", "gotten"),
    VerbEntry::irregular("take", "took", "taken"),
    VerbEntry::irregular("give", "gave", "given"),
    VerbEntry::irregular("find", "found", "found"),
    VerbEntry::irregular("lose", "lost", "lost"),
    VerbEntry::irregular("steal", "stole", "stolen"),
    VerbEntry::irregular("send", "sent", "sent"),
    VerbEntry::e_ending("receive"),
    
    // -------------------------------------------------------------------------
    // Emotion / Desire
    // -------------------------------------------------------------------------
    VerbEntry::regular("want"),
    VerbEntry::regular("need"),
    VerbEntry::e_ending("desire"),
    VerbEntry::regular("fear"),
    VerbEntry::regular("enjoy"),
    VerbEntry::regular("wish"),
    
    // -------------------------------------------------------------------------
    // Social / Interaction
    // -------------------------------------------------------------------------
    VerbEntry::irregular("meet", "met", "met"),
    VerbEntry::regular("join"),
    VerbEntry::e_ending("serve"),
    VerbEntry::regular("help"),
    VerbEntry::regular("follow"),
    VerbEntry::regular("support"),
];

// =============================================================================
// VerbMorphology (Runtime Lookup)
// =============================================================================

/// Fast verb recognition using pre-computed inflection lookup
#[derive(Debug, Clone)]
pub struct VerbMorphology {
    /// Set of all recognized verb forms (lowercase)
    verbs: HashSet<String>,
}

impl Default for VerbMorphology {
    fn default() -> Self {
        Self::new()
    }
}

impl VerbMorphology {
    /// Create a new VerbMorphology with the default verb table
    pub fn new() -> Self {
        let mut verbs = HashSet::new();
        
        for entry in VERB_TABLE {
            for form in entry.inflections() {
                verbs.insert(form.to_lowercase());
            }
        }
        
        // Add special cases not easily handled by patterns
        Self::add_special_cases(&mut verbs);
        
        Self { verbs }
    }
    
    /// Add verb forms that don't fit standard patterns
    fn add_special_cases(verbs: &mut HashSet<String>) {
        // "have" is highly irregular
        for form in ["have", "has", "had", "having"] {
            verbs.insert(form.to_string());
        }
        
        // "be" conjugations
        for form in ["be", "am", "is", "are", "was", "were", "been", "being"] {
            verbs.insert(form.to_string());
        }
        
        // "do" conjugations
        for form in ["do", "does", "did", "done", "doing"] {
            verbs.insert(form.to_string());
        }
    }
    
    /// Check if a word is a recognized verb form
    pub fn is_verb(&self, word: &str) -> bool {
        self.verbs.contains(&word.to_lowercase())
    }
    
    /// Add a custom verb (for runtime hydration)
    pub fn add_verb(&mut self, entry: VerbEntry) {
        for form in entry.inflections() {
            self.verbs.insert(form.to_lowercase());
        }
    }
    
    /// Add multiple custom verbs
    pub fn add_verbs(&mut self, entries: &[VerbEntry]) {
        for entry in entries {
            self.add_verb(entry.clone());
        }
    }
    
    /// Get total number of recognized verb forms
    pub fn form_count(&self) -> usize {
        self.verbs.len()
    }
}

// =============================================================================
// Tests (TDD - Write tests first!)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // VerbEntry Inflection Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_regular_inflections() {
        let entry = VerbEntry::regular("walk");
        let forms = entry.inflections();
        
        assert!(forms.contains(&"walk".to_string()), "Missing base form");
        assert!(forms.contains(&"walks".to_string()), "Missing 3rd singular");
        assert!(forms.contains(&"walked".to_string()), "Missing past");
        assert!(forms.contains(&"walking".to_string()), "Missing present participle");
    }

    #[test]
    fn test_e_ending_inflections() {
        let entry = VerbEntry::e_ending("love");
        let forms = entry.inflections();
        
        assert!(forms.contains(&"love".to_string()), "Missing base form");
        assert!(forms.contains(&"loves".to_string()), "Missing 3rd singular");
        assert!(forms.contains(&"loved".to_string()), "Missing past");
        assert!(forms.contains(&"loving".to_string()), "Missing present participle (should drop e)");
        assert!(!forms.contains(&"loveing".to_string()), "Should not have 'loveing'");
    }

    #[test]
    fn test_double_consonant_inflections() {
        let entry = VerbEntry::double_consonant("stop");
        let forms = entry.inflections();
        
        assert!(forms.contains(&"stop".to_string()));
        assert!(forms.contains(&"stops".to_string()));
        assert!(forms.contains(&"stopped".to_string()), "Should double consonant");
        assert!(forms.contains(&"stopping".to_string()), "Should double consonant");
    }

    #[test]
    fn test_y_to_i_inflections() {
        let entry = VerbEntry::y_to_i("carry");
        let forms = entry.inflections();
        
        assert!(forms.contains(&"carry".to_string()));
        assert!(forms.contains(&"carries".to_string()), "y → ies");
        assert!(forms.contains(&"carried".to_string()), "y → ied");
        assert!(forms.contains(&"carrying".to_string()), "y → ying");
    }

    #[test]
    fn test_irregular_inflections() {
        let entry = VerbEntry::irregular("teach", "taught", "taught");
        let forms = entry.inflections();
        
        assert!(forms.contains(&"teach".to_string()));
        assert!(forms.contains(&"teaches".to_string()));
        assert!(forms.contains(&"taught".to_string()), "Irregular past");
        assert!(forms.contains(&"teaching".to_string()));
    }

    #[test]
    fn test_irregular_different_participle() {
        let entry = VerbEntry::irregular("write", "wrote", "written");
        let forms = entry.inflections();
        
        assert!(forms.contains(&"write".to_string()));
        assert!(forms.contains(&"wrote".to_string()), "Irregular past");
        assert!(forms.contains(&"written".to_string()), "Different past participle");
    }

    // -------------------------------------------------------------------------
    // VerbMorphology Lookup Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_morphology_basic_lookup() {
        let morphology = VerbMorphology::new();
        
        assert!(morphology.is_verb("walk"), "Should recognize 'walk'");
        assert!(morphology.is_verb("walks"), "Should recognize 'walks'");
        assert!(morphology.is_verb("walked"), "Should recognize 'walked'");
        assert!(morphology.is_verb("walking"), "Should recognize 'walking'");
    }

    #[test]
    fn test_morphology_case_insensitive() {
        let morphology = VerbMorphology::new();
        
        assert!(morphology.is_verb("Walk"), "Should be case insensitive");
        assert!(morphology.is_verb("WALK"), "Should be case insensitive");
        assert!(morphology.is_verb("WaLkInG"), "Should be case insensitive");
    }

    #[test]
    fn test_morphology_rejects_non_verbs() {
        let morphology = VerbMorphology::new();
        
        assert!(!morphology.is_verb("wizard"), "Should reject nouns");
        assert!(!morphology.is_verb("castle"), "Should reject nouns");
        assert!(!morphology.is_verb("quickly"), "Should reject adverbs");
    }

    #[test]
    fn test_morphology_irregular_verbs() {
        let morphology = VerbMorphology::new();
        
        // teach → taught
        assert!(morphology.is_verb("teach"), "Should recognize 'teach'");
        assert!(morphology.is_verb("taught"), "Should recognize 'taught'");
        
        // lead → led  
        assert!(morphology.is_verb("lead"), "Should recognize 'lead'");
        assert!(morphology.is_verb("leads"), "Should recognize 'leads'");
        assert!(morphology.is_verb("led"), "Should recognize 'led'");
        
        // fight → fought
        assert!(morphology.is_verb("fight"), "Should recognize 'fight'");
        assert!(morphology.is_verb("fought"), "Should recognize 'fought'");
    }

    #[test]
    fn test_morphology_special_cases() {
        let morphology = VerbMorphology::new();
        
        // have
        assert!(morphology.is_verb("have"));
        assert!(morphology.is_verb("has"));
        assert!(morphology.is_verb("had"));
        assert!(morphology.is_verb("having"));
        
        // be
        assert!(morphology.is_verb("be"));
        assert!(morphology.is_verb("am"));
        assert!(morphology.is_verb("is"));
        assert!(morphology.is_verb("are"));
        assert!(morphology.is_verb("was"));
        assert!(morphology.is_verb("were"));
        assert!(morphology.is_verb("been"));
    }

    #[test]
    fn test_morphology_form_count() {
        let morphology = VerbMorphology::new();
        
        // Should have at least 200 forms (50+ base verbs × 4 forms average)
        assert!(morphology.form_count() > 200, 
            "Expected 200+ verb forms, got {}", morphology.form_count());
    }

    // -------------------------------------------------------------------------
    // Hydration Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_add_custom_verb() {
        let mut morphology = VerbMorphology::new();
        
        // Custom verb not in default table
        assert!(!morphology.is_verb("yeet"), "Should not know 'yeet' initially");
        
        morphology.add_verb(VerbEntry::regular("yeet"));
        
        assert!(morphology.is_verb("yeet"), "Should recognize after adding");
        assert!(morphology.is_verb("yeets"), "Should recognize inflection");
        assert!(morphology.is_verb("yeeted"), "Should recognize inflection");
        assert!(morphology.is_verb("yeeting"), "Should recognize inflection");
    }

    // -------------------------------------------------------------------------
    // Key Verbs for Relation Extraction (Integration-like tests)
    // -------------------------------------------------------------------------

    #[test]
    fn test_leadership_verbs() {
        let morphology = VerbMorphology::new();
        
        for verb in ["leads", "led", "commands", "commanded", "rules", "ruled", "governs"] {
            assert!(morphology.is_verb(verb), "Should recognize leadership verb: {}", verb);
        }
    }

    #[test]
    fn test_teaching_verbs() {
        let morphology = VerbMorphology::new();
        
        for verb in ["teaches", "taught", "mentors", "mentored", "trains", "trained", "guides"] {
            assert!(morphology.is_verb(verb), "Should recognize teaching verb: {}", verb);
        }
    }

    #[test]
    fn test_protection_verbs() {
        let morphology = VerbMorphology::new();
        
        for verb in ["guards", "guarded", "protects", "protected", "defends", "defended"] {
            assert!(morphology.is_verb(verb), "Should recognize protection verb: {}", verb);
        }
    }

    #[test]
    fn test_possession_verbs() {
        let morphology = VerbMorphology::new();
        
        for verb in ["holds", "held", "owns", "owned", "possesses", "possessed", "keeps", "kept"] {
            assert!(morphology.is_verb(verb), "Should recognize possession verb: {}", verb);
        }
    }

    #[test]
    fn test_combat_verbs() {
        let morphology = VerbMorphology::new();
        
        for verb in ["fights", "fought", "defeats", "defeated", "kills", "killed", "attacks", "attacked"] {
            assert!(morphology.is_verb(verb), "Should recognize combat verb: {}", verb);
        }
    }

    #[test]
    fn test_relationship_verbs() {
        let morphology = VerbMorphology::new();
        
        for verb in ["loves", "loved", "hates", "hated", "marries", "married", "befriends"] {
            assert!(morphology.is_verb(verb), "Should recognize relationship verb: {}", verb);
        }
    }
}
