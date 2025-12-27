/**
 * Unified Relationship Extractor
 * 
 * Consolidates all relationship extraction strategies:
 * - SVO (Subject-Verb-Object): "Jon defeated the Orcs"
 * - PREP (Prepositional): "Gandalf traveled to Mordor"
 * - POSSESSION: "Frodo's ring"
 * - VERB PATTERNS: Custom user-defined patterns (met, allied, etc.)
 * - CO-OCCURRENCE: Weak signals from entity proximity
 * 
 * Integrates with:
 * - WinkProcessor for linguistic analysis
 * - EntityRegistry for entity resolution
 * - RelationshipRegistry for persistence
 */

import { getWinkProcessor, type Sentence, type Token } from '@/lib/entities/nlp/WinkProcessor';
import { entityRegistry, relationshipRegistry } from '@/lib/cozo/graph/adapters';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';
import { RelationshipSource } from '@/lib/relationships/types';
import { EntityKind } from '@/lib/entities/entityTypes';

// ==================== TYPE DEFINITIONS ====================

export type RelationshipPattern = 'SVO' | 'PREP' | 'POSSESSION' | 'VERB_PATTERN' | 'CO_OCCURRENCE';

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
        verbMatch?: string;
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

export interface EntitySpan {
    label: string;
    start: number;
    end: number;
    kind?: string;
}

interface VerbPatternRule {
    id: string;
    relationshipType: string;
    inverseType?: string;
    verbs: string[];
    confidence: number;
    category: string;
    bidirectional: boolean;
    // Optional entity kind constraints
    sourceKinds?: EntityKind[];
    targetKinds?: EntityKind[];
}

interface PrepPatternRule {
    relationshipType: string;
    preps: string[];
    targetKinds?: EntityKind[];
    confidence: number;
}

// ==================== CONSTANTS ====================

const VERB_POS_TAGS = ['VERB', 'AUX'];
const PREPOSITION_POS = 'ADP';

// ==================== PATTERN RULES ====================

/**
 * Built-in verb patterns
 */
const VERB_PATTERN_RULES: VerbPatternRule[] = [
    { id: 'knows', relationshipType: 'KNOWS', inverseType: 'KNOWN_BY', verbs: ['meet', 'know', 'met', 'knew', 'befriend', 'encounter', 'recognize'], confidence: 0.70, category: 'social', bidirectional: true },
    { id: 'ally', relationshipType: 'ALLY_OF', inverseType: 'ALLY_OF', verbs: ['ally', 'allied', 'partner', 'partnered', 'side', 'sided'], confidence: 0.75, category: 'social', bidirectional: true },
    { id: 'enemy', relationshipType: 'ENEMY_OF', inverseType: 'ENEMY_OF', verbs: ['fight', 'fought', 'oppose', 'opposed', 'battle', 'battled', 'hate', 'hated'], confidence: 0.75, category: 'social', bidirectional: true },
    { id: 'defeat', relationshipType: 'DEFEATED', inverseType: 'DEFEATED_BY', verbs: ['defeat', 'defeated', 'kill', 'killed', 'destroy', 'destroyed', 'vanquish', 'vanquished', 'slay', 'slew', 'slain'], confidence: 0.85, category: 'combat', bidirectional: false },
    { id: 'create', relationshipType: 'CREATED', inverseType: 'CREATED_BY', verbs: ['create', 'created', 'forge', 'forged', 'make', 'made', 'build', 'built', 'craft', 'crafted'], confidence: 0.85, category: 'creation', bidirectional: false },
    { id: 'lead', relationshipType: 'LEADS', inverseType: 'LED_BY', verbs: ['lead', 'led', 'command', 'commanded', 'rule', 'ruled', 'govern', 'governed'], confidence: 0.85, category: 'hierarchy', bidirectional: false },
    { id: 'love', relationshipType: 'LOVES', inverseType: 'LOVED_BY', verbs: ['love', 'loved', 'adore', 'adored', 'cherish', 'cherished'], confidence: 0.80, category: 'emotional', bidirectional: false },
    { id: 'hate', relationshipType: 'HATES', inverseType: 'HATED_BY', verbs: ['hate', 'hated', 'despise', 'despised', 'loathe', 'loathed'], confidence: 0.80, category: 'emotional', bidirectional: false },
    { id: 'betray', relationshipType: 'BETRAYED', inverseType: 'BETRAYED_BY', verbs: ['betray', 'betrayed', 'deceive', 'deceived'], confidence: 0.85, category: 'social', bidirectional: false },
    { id: 'save', relationshipType: 'SAVED', inverseType: 'SAVED_BY', verbs: ['save', 'saved', 'rescue', 'rescued', 'free', 'freed'], confidence: 0.85, category: 'heroic', bidirectional: false },
    { id: 'mentor', relationshipType: 'MENTORED', inverseType: 'MENTORED_BY', verbs: ['mentor', 'mentored', 'teach', 'taught', 'train', 'trained', 'guide', 'guided'], confidence: 0.80, category: 'education', bidirectional: false },
    { id: 'join', relationshipType: 'JOINED', inverseType: 'JOINED_BY', verbs: ['join', 'joined', 'unite', 'united'], confidence: 0.75, category: 'social', bidirectional: false },
    { id: 'own', relationshipType: 'OWNS', inverseType: 'OWNED_BY', verbs: ['own', 'owned', 'possess', 'possessed', 'carry', 'carried', 'hold', 'held', 'wield', 'wielded'], confidence: 0.75, category: 'possession', bidirectional: false },
    { id: 'member', relationshipType: 'MEMBER_OF', inverseType: 'HAS_MEMBER', verbs: ['serve', 'served'], confidence: 0.80, category: 'organizational', bidirectional: false },
    { id: 'parent', relationshipType: 'PARENT_OF', inverseType: 'CHILD_OF', verbs: ['parent', 'parented', 'raise', 'raised', 'bear', 'bore'], confidence: 0.90, category: 'familial', bidirectional: false },
    { id: 'child', relationshipType: 'CHILD_OF', inverseType: 'PARENT_OF', verbs: ['born'], confidence: 0.90, category: 'familial', bidirectional: false },
    { id: 'sibling', relationshipType: 'SIBLING_OF', inverseType: 'SIBLING_OF', verbs: [], confidence: 0.90, category: 'familial', bidirectional: true },
    { id: 'marry', relationshipType: 'MARRIED_TO', inverseType: 'MARRIED_TO', verbs: ['marry', 'married', 'wed', 'wedded'], confidence: 0.90, category: 'familial', bidirectional: true },
    { id: 'mention', relationshipType: 'MENTIONS', inverseType: 'MENTIONED_BY', verbs: ['mention', 'mentioned', 'refer', 'referred', 'speak', 'spoke', 'discuss', 'discussed'], confidence: 0.50, category: 'reference', bidirectional: false },
    { id: 'participate', relationshipType: 'PARTICIPATES_IN', inverseType: 'HAS_PARTICIPANT', verbs: ['participate', 'participated', 'attend', 'attended', 'witness', 'witnessed'], confidence: 0.70, category: 'event', bidirectional: false },
    { id: 'located', relationshipType: 'LOCATED_IN', inverseType: 'CONTAINS', verbs: ['live', 'lived', 'reside', 'resided', 'dwell', 'dwelled'], confidence: 0.80, category: 'spatial', bidirectional: false },
    { id: 'travel', relationshipType: 'TRAVELED_TO', inverseType: 'VISITED_BY', verbs: ['travel', 'traveled', 'went', 'go', 'journey', 'journeyed', 'arrive', 'arrived', 'reach', 'reached', 'visit', 'visited'], confidence: 0.65, category: 'spatial', bidirectional: false },
];

/**
 * Prepositional patterns
 */
const PREP_PATTERN_RULES: PrepPatternRule[] = [
    { relationshipType: 'LOCATED_IN', preps: ['in', 'at', 'within'], targetKinds: ['LOCATION'], confidence: 0.80 },
    { relationshipType: 'TRAVELED_TO', preps: ['to', 'toward', 'towards'], targetKinds: ['LOCATION'], confidence: 0.75 },
    { relationshipType: 'ORIGINATED_FROM', preps: ['from'], targetKinds: ['LOCATION'], confidence: 0.75 },
    { relationshipType: 'MEMBER_OF', preps: ['of', 'in'], targetKinds: ['FACTION'], confidence: 0.70 },
    { relationshipType: 'WITH', preps: ['with', 'alongside', 'beside'], confidence: 0.65 },
];

const STORAGE_KEY = 'blueprint_relationship_patterns';

// ==================== MAIN EXTRACTOR CLASS ====================

export class RelationshipExtractor {
    private wink = getWinkProcessor();
    private verbLookup = new Map<string, VerbPatternRule[]>();
    private prepLookup = new Map<string, PrepPatternRule[]>();
    private customVerbPatterns: VerbPatternRule[] = [];
    private cozoPatterns: VerbPatternRule[] = [];
    private cozoPatternsLoaded = false;

    constructor() {
        this.buildLookupMaps();
        this.loadCustomPatterns();
    }

    /**
     * Load relationship patterns from CoZo blueprint_relationship_type table.
     * Should be called once during scanner initialization.
     */
    async loadPatternsFromCoZo(): Promise<void> {
        try {
            // Import dynamically to avoid circular dependencies
            const { getBlueprintStoreImpl } = await import('@/lib/storage/impl/BlueprintStoreImpl');
            const store = getBlueprintStoreImpl();

            // Get all relationship types from all versions
            const allRelTypes: Array<{
                relationship_name: string;
                display_label: string;
                source_entity_kind: string;
                target_entity_kind: string;
                is_symmetric: boolean;
                verb_patterns?: string[];
                confidence?: number;
                pattern_category?: string;
            }> = [];

            // Get relationship types from the store (in-memory for now)
            // In production, you'd query CoZo directly here
            const { getAllRelationshipTypesByVersion } = await import('@/features/blueprint-hub/api/storage');
            const { useBlueprintHub } = await import('@/features/blueprint-hub/hooks/useBlueprintHub');

            // Fallback: try to access the store directly and iterate versions
            // For now, we'll collect from all relationship types in the store
            const relationshipTypes = Array.from(
                (store as any).relationshipTypes?.values?.() || []
            );

            allRelTypes.push(...(relationshipTypes as any[]));

            // Clear existing CoZo patterns
            this.cozoPatterns = [];

            for (const rel of allRelTypes) {
                if (!rel.verb_patterns || rel.verb_patterns.length === 0) continue;

                const rule: VerbPatternRule = {
                    id: `cozo_${rel.relationship_name}`,
                    relationshipType: rel.display_label.toUpperCase().replace(/\s+/g, '_'),
                    verbs: rel.verb_patterns,
                    confidence: rel.confidence ?? 0.75,
                    category: rel.pattern_category || 'custom',
                    bidirectional: rel.is_symmetric,
                    sourceKinds: rel.source_entity_kind ? [rel.source_entity_kind as EntityKind] : undefined,
                    targetKinds: rel.target_entity_kind ? [rel.target_entity_kind as EntityKind] : undefined,
                };

                this.cozoPatterns.push(rule);
            }

            // Rebuild lookup maps with CoZo patterns
            this.rebuildLookupMapsWithCozoPatterns();
            this.cozoPatternsLoaded = true;

            console.log(
                `[RelationshipExtractor] Loaded ${this.cozoPatterns.length} patterns from CoZo`
            );
        } catch (error) {
            console.warn('[RelationshipExtractor] Failed to load CoZo patterns:', error);
            // Continue with built-in patterns only
        }
    }

    /**
     * Rebuild lookup maps including CoZo patterns (higher priority)
     */
    private rebuildLookupMapsWithCozoPatterns(): void {
        // Add CoZo patterns to verb lookup (prepend for priority)
        for (const rule of this.cozoPatterns) {
            for (const verb of rule.verbs) {
                if (!this.verbLookup.has(verb)) {
                    this.verbLookup.set(verb, []);
                }
                // Prepend CoZo patterns (higher priority than built-in)
                this.verbLookup.get(verb)!.unshift(rule);
            }
        }
    }

    /**
     * Check if CoZo patterns have been loaded
     */
    areCozoPatternsLoaded(): boolean {
        return this.cozoPatternsLoaded;
    }

    private buildLookupMaps(): void {
        // Clear existing
        this.verbLookup.clear();
        this.prepLookup.clear();

        // Build verb lookup from built-in rules
        for (const rule of VERB_PATTERN_RULES) {
            for (const verb of rule.verbs) {
                if (!this.verbLookup.has(verb)) {
                    this.verbLookup.set(verb, []);
                }
                this.verbLookup.get(verb)!.push(rule);
            }
        }

        // Build prep lookup
        for (const rule of PREP_PATTERN_RULES) {
            for (const prep of rule.preps) {
                if (!this.prepLookup.has(prep)) {
                    this.prepLookup.set(prep, []);
                }
                this.prepLookup.get(prep)!.push(rule);
            }
        }
    }

    /**
     * Load custom patterns from localStorage (backward compatibility)
     */
    private loadCustomPatterns(): void {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return;
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;

            const parsed: Array<{
                pattern_id: string;
                verb_pattern: string;
                relationship_type: string;
                inverse_type?: string;
                confidence: number;
                category: string;
                bidirectional: boolean;
                enabled: boolean;
            }> = JSON.parse(stored);

            this.customVerbPatterns = parsed
                .filter(p => p.enabled)
                .map(p => ({
                    id: p.pattern_id,
                    relationshipType: p.relationship_type,
                    inverseType: p.inverse_type,
                    verbs: p.verb_pattern.split('|'),
                    confidence: p.confidence,
                    category: p.category,
                    bidirectional: p.bidirectional,
                }));

            // Add to verb lookup
            for (const rule of this.customVerbPatterns) {
                for (const verb of rule.verbs) {
                    if (!this.verbLookup.has(verb)) {
                        this.verbLookup.set(verb, []);
                    }
                    this.verbLookup.get(verb)!.push(rule);
                }
            }
        } catch (error) {
            console.warn('[RelationshipExtractor] Failed to load custom patterns:', error);
        }
    }

    /**
     * Reload custom patterns (called when patterns are updated)
     */
    reloadCustomPatterns(): void {
        // Clear existing custom patterns from lookup
        for (const rule of this.customVerbPatterns) {
            for (const verb of rule.verbs) {
                const rules = this.verbLookup.get(verb);
                if (rules) {
                    const idx = rules.indexOf(rule);
                    if (idx !== -1) rules.splice(idx, 1);
                }
            }
        }
        this.customVerbPatterns = [];
        this.loadCustomPatterns();
    }

    /**
     * Extract all relationships from text
     */
    extractFromText(text: string, noteId: string): ExtractedRelationship[] {
        const analysis = this.wink.analyze(text);
        const allRelationships: ExtractedRelationship[] = [];

        for (const sentence of analysis.sentences) {
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
     * Extract relationships from entity spans (for verb pattern matching)
     */
    extractFromEntitySpans(
        text: string,
        entitySpans: EntitySpan[],
        noteId: string
    ): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];

        // Sort by position
        const sorted = [...entitySpans].sort((a, b) => a.start - b.start);

        for (let i = 0; i < sorted.length - 1; i++) {
            const span1 = sorted[i];

            for (let j = i + 1; j < sorted.length; j++) {
                const span2 = sorted[j];

                // Skip if too far apart
                if (span2.start - span1.end > 200) break;

                const textBetween = text.slice(span1.end, span2.start);

                // Check verb patterns
                for (const [verb, rules] of this.verbLookup.entries()) {
                    const regex = new RegExp(`\\b${verb}\\w*\\b`, 'i');
                    const match = textBetween.match(regex);

                    if (match) {
                        const rule = rules[0]; // Use first matching rule

                        const source = entityRegistry.findEntityByLabel(span1.label);
                        const target = entityRegistry.findEntityByLabel(span2.label);

                        if (!source || !target) continue;

                        const contextStart = Math.max(0, span1.start - 20);
                        const contextEnd = Math.min(text.length, span2.end + 20);

                        relationships.push({
                            source: { entity: source, text: span1.label, position: span1.start },
                            target: { entity: target, text: span2.label, position: span2.start },
                            predicate: rule.relationshipType,
                            pattern: 'VERB_PATTERN',
                            confidence: rule.confidence,
                            context: {
                                sentence: text.slice(contextStart, contextEnd),
                                sentenceIndex: -1,
                                verbMatch: match[0],
                            },
                            metadata: { extractedAt: new Date(), noteId },
                        });

                        break; // Only match first pattern
                    }
                }
            }
        }

        return relationships;
    }

    /**
     * Extract co-occurrence relationships (weak signals)
     */
    extractCoOccurrences(
        text: string,
        entitySpans: EntitySpan[],
        noteId: string,
        options: {
            useSentenceBoundaries: boolean;
            maxProximity: number;
            minStrength: number;
        }
    ): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];
        const analysis = this.wink.analyze(text);

        if (options.useSentenceBoundaries) {
            for (const sentence of analysis.sentences) {
                const spansInSentence = entitySpans.filter(
                    e => e.start >= sentence.start && e.end <= sentence.end
                );

                if (spansInSentence.length < 2) continue;

                // Create pairs
                for (let i = 0; i < spansInSentence.length - 1; i++) {
                    for (let j = i + 1; j < spansInSentence.length; j++) {
                        const span1 = spansInSentence[i];
                        const span2 = spansInSentence[j];

                        const source = entityRegistry.findEntityByLabel(span1.label);
                        const target = entityRegistry.findEntityByLabel(span2.label);

                        if (!source || !target) continue;

                        const proximity = span2.end - span1.start;
                        const strength = this.calculateCoOccurrenceStrength(proximity, options.maxProximity);

                        if (strength >= options.minStrength) {
                            relationships.push({
                                source: { entity: source, text: span1.label, position: span1.start },
                                target: { entity: target, text: span2.label, position: span2.start },
                                predicate: 'CO_OCCURS_WITH',
                                pattern: 'CO_OCCURRENCE',
                                confidence: strength,
                                context: {
                                    sentence: sentence.text,
                                    sentenceIndex: sentence.index,
                                },
                                metadata: { extractedAt: new Date(), noteId },
                            });
                        }
                    }
                }
            }
        }

        return relationships;
    }

    /**
     * Find entity mentions in sentence
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

        return this.deduplicateMentions(mentions);
    }

    private deduplicateMentions(mentions: EntityMention[]): EntityMention[] {
        mentions.sort((a, b) => a.position - b.position);
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
     * Extract SVO relationships
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
                const tokenDistance = target.tokenIndex - source.tokenIndex;

                if (tokenDistance > MAX_TOKEN_DISTANCE) break;

                const tokensBetween = sentence.tokens.slice(
                    source.tokenIndex + 1,
                    target.tokenIndex
                );

                const verbsBetween = tokensBetween.filter(t => VERB_POS_TAGS.includes(t.pos));
                if (verbsBetween.length === 0) continue;

                const verb = verbsBetween[0];
                const verbLemma = verb.lemma.toLowerCase();

                // Check verb lookup
                const rules = this.verbLookup.get(verbLemma);
                if (rules) {
                    const rule = rules[0];

                    relationships.push({
                        source: { entity: source.entity, text: source.text, position: source.position },
                        target: { entity: target.entity, text: target.text, position: target.position },
                        predicate: rule.relationshipType,
                        pattern: 'SVO',
                        confidence: rule.confidence,
                        context: { sentence: sentence.text, sentenceIndex: sentence.index, verbLemma },
                        metadata: { extractedAt: new Date(), noteId },
                    });
                } else {
                    // Fallback: use raw verb as predicate
                    relationships.push({
                        source: { entity: source.entity, text: source.text, position: source.position },
                        target: { entity: target.entity, text: target.text, position: target.position },
                        predicate: verbLemma.toUpperCase(),
                        pattern: 'SVO',
                        confidence: 0.6,
                        context: { sentence: sentence.text, sentenceIndex: sentence.index, verbLemma },
                        metadata: { extractedAt: new Date(), noteId },
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * Extract prepositional relationships
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

                const tokensBetween = sentence.tokens.slice(
                    source.tokenIndex + 1,
                    target.tokenIndex
                );

                const preps = tokensBetween.filter(t => t.pos === PREPOSITION_POS);
                if (preps.length === 0) continue;

                const prep = preps[0];
                const prepText = prep.text.toLowerCase();

                // Check prep lookup
                const rules = this.prepLookup.get(prepText);
                if (rules) {
                    // Find best matching rule
                    const rule = rules.find(r =>
                        !r.targetKinds || r.targetKinds.includes(target.entity.kind)
                    ) || rules[0];

                    relationships.push({
                        source: { entity: source.entity, text: source.text, position: source.position },
                        target: { entity: target.entity, text: target.text, position: target.position },
                        predicate: rule.relationshipType,
                        pattern: 'PREP',
                        confidence: rule.confidence,
                        context: { sentence: sentence.text, sentenceIndex: sentence.index, preposition: prepText },
                        metadata: { extractedAt: new Date(), noteId },
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * Extract possession relationships
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

            const textAfter = sentence.text.substring(
                sourceEnd - sentence.start,
                sourceEnd - sentence.start + 3
            );

            if (!textAfter.startsWith("'s") && !textAfter.startsWith("'")) continue;

            for (let j = i + 1; j < mentions.length; j++) {
                const target = mentions[j];
                if (target.position - sourceEnd > 20) break;

                relationships.push({
                    source: { entity: source.entity, text: source.text, position: source.position },
                    target: { entity: target.entity, text: target.text, position: target.position },
                    predicate: 'POSSESSES',
                    pattern: 'POSSESSION',
                    confidence: 0.80,
                    context: { sentence: sentence.text, sentenceIndex: sentence.index },
                    metadata: { extractedAt: new Date(), noteId },
                });

                break;
            }
        }

        return relationships;
    }

    /**
     * Calculate co-occurrence strength based on proximity
     */
    private calculateCoOccurrenceStrength(proximity: number, maxProximity: number): number {
        if (proximity <= 0) return 1.0;
        if (proximity >= maxProximity) return 0.1;
        return 1.0 - (proximity / maxProximity) * 0.6;
    }

    /**
     * Deduplicate and merge relationships
     */
    deduplicateRelationships(relationships: ExtractedRelationship[]): ExtractedRelationship[] {
        const map = new Map<string, ExtractedRelationship>();

        for (const rel of relationships) {
            const key = `${rel.source.entity.id}|${rel.target.entity.id}|${rel.predicate}`;

            const existing = map.get(key);
            if (existing) {
                // Boost confidence
                existing.confidence = Math.min(1.0, existing.confidence + rel.confidence * 0.2);
            } else {
                map.set(key, { ...rel });
            }
        }

        return Array.from(map.values());
    }

    /**
     * Persist relationships to registry
     */
    async persistRelationships(
        relationships: ExtractedRelationship[]
    ): Promise<{ added: number; updated: number; failed: number }> {
        let added = 0;
        let updated = 0;
        let failed = 0;

        for (const rel of relationships) {
            try {
                relationshipRegistry.add({
                    sourceEntityId: rel.source.entity.id,
                    targetEntityId: rel.target.entity.id,
                    type: rel.predicate,
                    provenance: [{
                        source: RelationshipSource.NER_EXTRACTION,
                        originId: rel.metadata.noteId,
                        confidence: rel.confidence,
                        timestamp: rel.metadata.extractedAt,
                    }],
                    attributes: {
                        context: rel.context.sentence,
                        pattern: rel.pattern,
                        verbLemma: rel.context.verbLemma,
                        preposition: rel.context.preposition,
                    },
                });
                added++;
            } catch (error) {
                failed++;
                console.error('[RelationshipExtractor] Persist failed:', error);
            }
        }

        return { added, updated, failed };
    }

    /**
     * Get active verb patterns (for UI display)
     */
    getActivePatterns(): VerbPatternRule[] {
        if (this.customVerbPatterns.length > 0) {
            return this.customVerbPatterns;
        }
        return VERB_PATTERN_RULES;
    }

    /**
     * Get pattern categories
     */
    getPatternCategories(): string[] {
        const categories = new Set<string>();
        for (const pattern of this.getActivePatterns()) {
            categories.add(pattern.category);
        }
        return Array.from(categories).sort();
    }
}

// ==================== SINGLETON ====================

let extractorInstance: RelationshipExtractor | null = null;

export function getRelationshipExtractor(): RelationshipExtractor {
    if (!extractorInstance) {
        extractorInstance = new RelationshipExtractor();
    }
    return extractorInstance;
}

// ==================== LEGACY EXPORTS (for backward compatibility) ====================

/**
 * @deprecated Use getRelationshipExtractor().extractFromEntitySpans() instead
 */
export function matchVerbPatterns(
    text: string,
    entities: EntitySpan[]
): Array<{
    sourceLabel: string;
    targetLabel: string;
    type: string;
    inverseType?: string;
    confidence: number;
    source: RelationshipSource;
    context: string;
    verbMatch?: string;
    bidirectional: boolean;
}> {
    const extractor = getRelationshipExtractor();
    const relationships = extractor.extractFromEntitySpans(text, entities, 'legacy');

    return relationships.map(rel => ({
        sourceLabel: rel.source.text,
        targetLabel: rel.target.text,
        type: rel.predicate,
        inverseType: undefined,
        confidence: rel.confidence,
        source: RelationshipSource.NER_EXTRACTION,
        context: rel.context.sentence,
        verbMatch: rel.context.verbMatch,
        bidirectional: false,
    }));
}

/**
 * @deprecated Use getRelationshipExtractor().reloadCustomPatterns() instead
 */
export function refreshPatternsFromStorage(): void {
    getRelationshipExtractor().reloadCustomPatterns();
}

/**
 * @deprecated Use getRelationshipExtractor().getActivePatterns() instead
 */
export function getActivePatterns() {
    return getRelationshipExtractor().getActivePatterns();
}

/**
 * @deprecated Use getRelationshipExtractor().getPatternCategories() instead
 */
export function getPatternCategories(): string[] {
    return getRelationshipExtractor().getPatternCategories();
}
