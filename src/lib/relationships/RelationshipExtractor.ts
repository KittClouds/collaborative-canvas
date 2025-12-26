/**
 * RelationshipExtractor - Phase 3 Pattern-Based Relationship Extraction
 * 
 * Extracts relationships from documents using linguistic patterns:
 * - SVO (Subject-Verb-Object): "Aragorn defeated the Orcs"
 * - PREP (Prepositional): "Gandalf traveled to Mordor"
 * - POSSESSION: "Frodo's ring", "the king's sword"
 * 
 * Integrates with:
 * - WinkProcessor for linguistic analysis
 * - EntityRegistry for entity resolution
 * - RelationshipRegistry for persistence
 */

import { getWinkProcessor, type Sentence, type Token } from '../entities/nlp/WinkProcessor';
import { entityRegistry, type RegisteredEntity, relationshipRegistry } from '@/lib/cozo/graph/adapters';
import { RelationshipSource, type RelationshipProvenance } from './types';
import { EntityKind } from '../entities/entityTypes';

// ==================== UNIVERSAL POS TAG CONSTANTS ====================

const VERB_POS_TAGS = ['VERB', 'AUX'];  // Universal Dependencies
const PREPOSITION_POS = 'ADP';
const NOUN_POS_TAGS = ['NOUN', 'PROPN'];
const PART_POS = 'PART';  // For possessive markers

// ==================== TYPE DEFINITIONS ====================

export type RelationshipPattern = 'SVO' | 'PREP' | 'POSSESSION';

export interface ExtractedRelationship {
    source: {
        entity: RegisteredEntity;
        text: string;
        position: number;
    };
    target: {
        entity: RegisteredEntity;
        text: string;
        position: number;
    };
    predicate: string;
    pattern: RelationshipPattern;
    confidence: number;
    context: {
        sentence: string;
        sentenceIndex: number;
        verbLemma?: string;
        preposition?: string;
    };
    metadata: {
        extractedAt: Date;
        noteId: string;
    };
}

interface EntityMention {
    entity: RegisteredEntity;
    text: string;
    position: number;
    tokenIndex: number;
}

interface RelationshipTypeRule {
    pattern: RelationshipPattern;
    relationshipType: string;
    verbs?: string[];
    preps?: string[];
    sourceKinds?: EntityKind[];
    targetKinds?: EntityKind[];
    confidence: number;
}

// ==================== RELATIONSHIP TYPE RULES ====================

const RELATIONSHIP_TYPE_RULES: RelationshipTypeRule[] = [
    // SVO Patterns
    { pattern: 'SVO', relationshipType: 'defeated', verbs: ['defeat', 'kill', 'destroy', 'vanquish', 'slay'], confidence: 0.85 },
    { pattern: 'SVO', relationshipType: 'created', verbs: ['create', 'forge', 'make', 'build', 'craft'], confidence: 0.85 },
    { pattern: 'SVO', relationshipType: 'leads', verbs: ['lead', 'command', 'rule', 'govern'], confidence: 0.85 },
    { pattern: 'SVO', relationshipType: 'loves', verbs: ['love', 'adore', 'cherish'], confidence: 0.80 },
    { pattern: 'SVO', relationshipType: 'hates', verbs: ['hate', 'despise', 'loathe'], confidence: 0.80 },
    { pattern: 'SVO', relationshipType: 'betrayed', verbs: ['betray', 'deceive', 'double-cross'], confidence: 0.85 },
    { pattern: 'SVO', relationshipType: 'saved', verbs: ['save', 'rescue', 'free'], confidence: 0.85 },
    { pattern: 'SVO', relationshipType: 'mentored', verbs: ['mentor', 'teach', 'train', 'guide'], confidence: 0.80 },
    { pattern: 'SVO', relationshipType: 'joined', verbs: ['join', 'ally', 'unite'], confidence: 0.75 },

    // Prepositional Patterns
    { pattern: 'PREP', relationshipType: 'located_in', preps: ['in', 'at', 'within'], targetKinds: ['LOCATION'], confidence: 0.80 },
    { pattern: 'PREP', relationshipType: 'traveled_to', preps: ['to', 'toward', 'towards'], targetKinds: ['LOCATION'], confidence: 0.75 },
    { pattern: 'PREP', relationshipType: 'originated_from', preps: ['from', 'out of'], targetKinds: ['LOCATION'], confidence: 0.75 },
    { pattern: 'PREP', relationshipType: 'member_of', preps: ['of', 'in'], targetKinds: ['FACTION'], confidence: 0.70 },
    { pattern: 'PREP', relationshipType: 'with', preps: ['with', 'alongside', 'beside'], confidence: 0.65 },

    // Possession Patterns
    { pattern: 'POSSESSION', relationshipType: 'possesses', confidence: 0.80 },
    { pattern: 'POSSESSION', relationshipType: 'owns', sourceKinds: ['CHARACTER', 'NPC'], targetKinds: ['ITEM'], confidence: 0.85 },
];

// ==================== MAIN EXTRACTOR CLASS ====================

export class RelationshipExtractor {
    private wink = getWinkProcessor();

    // Lookup maps for fast rule matching
    private verbLookup = new Map<string, RelationshipTypeRule[]>();
    private prepLookup = new Map<string, RelationshipTypeRule[]>();

    constructor() {
        this.buildLookupMaps();
    }

    private buildLookupMaps(): void {
        for (const rule of RELATIONSHIP_TYPE_RULES) {
            if (rule.verbs) {
                for (const verb of rule.verbs) {
                    if (!this.verbLookup.has(verb)) {
                        this.verbLookup.set(verb, []);
                    }
                    this.verbLookup.get(verb)!.push(rule);
                }
            }
            if (rule.preps) {
                for (const prep of rule.preps) {
                    if (!this.prepLookup.has(prep)) {
                        this.prepLookup.set(prep, []);
                    }
                    this.prepLookup.get(prep)!.push(rule);
                }
            }
        }
    }

    /**
     * Extract relationships from plain text
     */
    extractFromText(text: string, noteId: string): ExtractedRelationship[] {
        const analysis = this.wink.analyze(text);
        const allRelationships: ExtractedRelationship[] = [];

        for (const sentence of analysis.sentences) {
            // Find entity mentions in this sentence
            const mentions = this.findEntityMentionsInSentence(sentence, text);

            if (mentions.length < 2) continue;

            // Extract using all patterns
            allRelationships.push(...this.extractSVO(sentence, mentions, noteId));
            allRelationships.push(...this.extractPrep(sentence, mentions, noteId));
            allRelationships.push(...this.extractPossession(sentence, mentions, noteId));
        }

        return allRelationships;
    }

    /**
     * Find registered entity mentions within a sentence
     */
    private findEntityMentionsInSentence(
        sentence: Sentence,
        fullText: string
    ): EntityMention[] {
        const mentions: EntityMention[] = [];
        const allEntities = entityRegistry.getAllEntities();

        for (const entity of allEntities) {
            const searchTerms = [entity.label, ...(entity.aliases || [])];

            for (const term of searchTerms) {
                const lowerSentence = sentence.text.toLowerCase();
                const lowerTerm = term.toLowerCase();

                let searchStart = 0;
                let idx: number;

                while ((idx = lowerSentence.indexOf(lowerTerm, searchStart)) !== -1) {
                    const absolutePosition = sentence.start + idx;

                    // Find corresponding token index
                    const tokenIndex = sentence.tokens.findIndex(
                        t => t.start <= absolutePosition && t.end > absolutePosition
                    );

                    mentions.push({
                        entity,
                        text: term,
                        position: absolutePosition,
                        tokenIndex: tokenIndex !== -1 ? tokenIndex : 0,
                    });

                    searchStart = idx + term.length;
                }
            }
        }

        // Sort by position and deduplicate overlapping mentions
        mentions.sort((a, b) => a.position - b.position);
        return this.deduplicateMentions(mentions);
    }

    private deduplicateMentions(mentions: EntityMention[]): EntityMention[] {
        const result: EntityMention[] = [];
        let lastEnd = -1;

        for (const mention of mentions) {
            if (mention.position >= lastEnd) {
                result.push(mention);
                lastEnd = mention.position + mention.text.length;
            }
        }

        return result;
    }

    /**
     * Extract SVO (Subject-Verb-Object) relationships
     */
    private extractSVO(
        sentence: Sentence,
        mentions: EntityMention[],
        noteId: string
    ): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];
        const MAX_TOKEN_DISTANCE = 10;

        for (let i = 0; i < mentions.length - 1; i++) {
            const source = mentions[i];

            for (let j = i + 1; j < mentions.length; j++) {
                const target = mentions[j];

                // Early exit if too far apart
                const tokenDistance = target.tokenIndex - source.tokenIndex;
                if (tokenDistance > MAX_TOKEN_DISTANCE) break;

                // Find verbs between the two mentions
                const tokensBetween = sentence.tokens.slice(
                    source.tokenIndex + 1,
                    target.tokenIndex
                );

                const verbsBetween = tokensBetween.filter(t =>
                    VERB_POS_TAGS.includes(t.pos)
                );

                if (verbsBetween.length === 0) continue;

                // Use first verb as the predicate
                const verb = verbsBetween[0];
                const verbLemma = verb.lemma.toLowerCase();

                // Infer relationship type
                const result = this.inferRelationshipType(
                    'SVO',
                    verbLemma,
                    undefined,
                    source.entity.kind,
                    target.entity.kind
                );

                if (result) {
                    relationships.push({
                        source: {
                            entity: source.entity,
                            text: source.text,
                            position: source.position,
                        },
                        target: {
                            entity: target.entity,
                            text: target.text,
                            position: target.position,
                        },
                        predicate: result.type,
                        pattern: 'SVO',
                        confidence: result.confidence,
                        context: {
                            sentence: sentence.text,
                            sentenceIndex: sentence.index,
                            verbLemma,
                        },
                        metadata: {
                            extractedAt: new Date(),
                            noteId,
                        },
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * Extract Prepositional relationships
     */
    private extractPrep(
        sentence: Sentence,
        mentions: EntityMention[],
        noteId: string
    ): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];

        for (let i = 0; i < mentions.length - 1; i++) {
            const source = mentions[i];

            for (let j = i + 1; j < mentions.length; j++) {
                const target = mentions[j];

                // Find prepositions between mentions
                const tokensBetween = sentence.tokens.slice(
                    source.tokenIndex + 1,
                    target.tokenIndex
                );

                const preps = tokensBetween.filter(t => t.pos === PREPOSITION_POS);

                if (preps.length === 0) continue;

                // Use first preposition
                const prep = preps[0];
                const prepText = prep.text.toLowerCase();

                const result = this.inferRelationshipType(
                    'PREP',
                    undefined,
                    prepText,
                    source.entity.kind,
                    target.entity.kind
                );

                if (result) {
                    relationships.push({
                        source: {
                            entity: source.entity,
                            text: source.text,
                            position: source.position,
                        },
                        target: {
                            entity: target.entity,
                            text: target.text,
                            position: target.position,
                        },
                        predicate: result.type,
                        pattern: 'PREP',
                        confidence: result.confidence,
                        context: {
                            sentence: sentence.text,
                            sentenceIndex: sentence.index,
                            preposition: prepText,
                        },
                        metadata: {
                            extractedAt: new Date(),
                            noteId,
                        },
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * Extract Possession relationships ("Frodo's ring")
     */
    private extractPossession(
        sentence: Sentence,
        mentions: EntityMention[],
        noteId: string
    ): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];

        for (let i = 0; i < mentions.length - 1; i++) {
            const source = mentions[i];
            const sourceEnd = source.position + source.text.length;

            // Check for possessive marker in text right after source
            const textAfter = sentence.text.substring(
                sourceEnd - sentence.start,
                sourceEnd - sentence.start + 3
            );

            const hasPossessive = textAfter.startsWith("'s") || textAfter.startsWith("'");

            if (!hasPossessive) continue;

            // Find next entity within 20 characters
            for (let j = i + 1; j < mentions.length; j++) {
                const target = mentions[j];

                if (target.position - sourceEnd > 20) break;

                const result = this.inferRelationshipType(
                    'POSSESSION',
                    undefined,
                    undefined,
                    source.entity.kind,
                    target.entity.kind
                );

                if (result) {
                    relationships.push({
                        source: {
                            entity: source.entity,
                            text: source.text,
                            position: source.position,
                        },
                        target: {
                            entity: target.entity,
                            text: target.text,
                            position: target.position,
                        },
                        predicate: result.type,
                        pattern: 'POSSESSION',
                        confidence: result.confidence,
                        context: {
                            sentence: sentence.text,
                            sentenceIndex: sentence.index,
                        },
                        metadata: {
                            extractedAt: new Date(),
                            noteId,
                        },
                    });
                    break; // Only match first target after possessive
                }
            }
        }

        return relationships;
    }

    /**
     * Infer relationship type from pattern, verb/prep, and entity kinds
     */
    private inferRelationshipType(
        pattern: RelationshipPattern,
        verb?: string,
        prep?: string,
        sourceKind?: EntityKind,
        targetKind?: EntityKind
    ): { type: string; confidence: number } | null {
        // Fast path: use lookup maps
        if (verb && this.verbLookup.has(verb)) {
            const candidates = this.verbLookup.get(verb)!;
            for (const rule of candidates) {
                if (this.matchesEntityConstraints(rule, sourceKind, targetKind)) {
                    return { type: rule.relationshipType, confidence: rule.confidence };
                }
            }
        }

        if (prep && this.prepLookup.has(prep)) {
            const candidates = this.prepLookup.get(prep)!;
            for (const rule of candidates) {
                if (this.matchesEntityConstraints(rule, sourceKind, targetKind)) {
                    return { type: rule.relationshipType, confidence: rule.confidence };
                }
            }
        }

        // Fallback: iterate all rules for this pattern
        // IMPORTANT: Check rules with constraints FIRST (more specific wins)
        const patternRules = RELATIONSHIP_TYPE_RULES.filter(r => r.pattern === pattern);

        // Sort so rules with more constraints come first
        const sortedRules = patternRules.sort((a, b) => {
            const aConstraints = (a.sourceKinds ? 1 : 0) + (a.targetKinds ? 1 : 0);
            const bConstraints = (b.sourceKinds ? 1 : 0) + (b.targetKinds ? 1 : 0);
            return bConstraints - aConstraints; // More constraints first
        });

        for (const rule of sortedRules) {
            if (verb && rule.verbs && !rule.verbs.includes(verb)) continue;
            if (prep && rule.preps && !rule.preps.includes(prep)) continue;

            if (this.matchesEntityConstraints(rule, sourceKind, targetKind)) {
                return { type: rule.relationshipType, confidence: rule.confidence };
            }
        }

        // Default fallbacks
        if (pattern === 'SVO' && verb) {
            return { type: verb, confidence: 0.6 };
        }
        if (pattern === 'PREP' && prep) {
            return { type: `related_via_${prep}`, confidence: 0.5 };
        }
        if (pattern === 'POSSESSION') {
            return { type: 'possesses', confidence: 0.7 };
        }

        return null;
    }

    private matchesEntityConstraints(
        rule: RelationshipTypeRule,
        sourceKind?: EntityKind,
        targetKind?: EntityKind
    ): boolean {
        if (rule.sourceKinds && sourceKind && !rule.sourceKinds.includes(sourceKind)) {
            return false;
        }
        if (rule.targetKinds && targetKind && !rule.targetKinds.includes(targetKind)) {
            return false;
        }
        return true;
    }

    /**
     * Persist extracted relationships to the registry
     */
    async persistRelationships(
        relationships: ExtractedRelationship[]
    ): Promise<{
        added: number;
        updated: number;
        failed: number;
        errors: Array<{ relationship: ExtractedRelationship; error: string }>;
    }> {
        let added = 0;
        let updated = 0;
        let failed = 0;
        const errors: Array<{ relationship: ExtractedRelationship; error: string }> = [];

        for (const rel of relationships) {
            try {
                const existing = relationshipRegistry.findByEntities(
                    rel.source.entity.id,
                    rel.target.entity.id,
                    rel.predicate
                );

                const provenance: RelationshipProvenance = {
                    source: RelationshipSource.NER_EXTRACTION,
                    originId: rel.metadata.noteId,
                    timestamp: rel.metadata.extractedAt,
                    confidence: rel.confidence,
                    context: rel.context.sentence,
                    metadata: {
                        pattern: rel.pattern,
                        verbLemma: rel.context.verbLemma,
                        preposition: rel.context.preposition,
                    },
                };

                if (existing) {
                    // Update existing: add provenance, recalculate confidence
                    existing.provenance.push(provenance);
                    relationshipRegistry.update(existing.id, {
                        provenance: existing.provenance,
                    });
                    updated++;
                } else {
                    // Add new relationship
                    relationshipRegistry.add({
                        sourceEntityId: rel.source.entity.id,
                        targetEntityId: rel.target.entity.id,
                        type: rel.predicate,
                        bidirectional: false,
                        provenance: [provenance],
                        attributes: {
                            pattern: rel.pattern,
                        },
                    });
                    added++;
                }
            } catch (error) {
                failed++;
                errors.push({
                    relationship: rel,
                    error: error instanceof Error ? error.message : String(error),
                });
                console.error('[RelationshipExtractor] Persist failed:', {
                    source: rel.source.entity.label,
                    target: rel.target.entity.label,
                    error,
                });
            }
        }

        return { added, updated, failed, errors };
    }
}

// ==================== SINGLETON INSTANCE ====================

let extractorInstance: RelationshipExtractor | null = null;

export function getRelationshipExtractor(): RelationshipExtractor {
    if (!extractorInstance) {
        extractorInstance = new RelationshipExtractor();
    }
    return extractorInstance;
}
