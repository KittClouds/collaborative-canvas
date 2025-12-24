/**
 * DocumentContext - Shared Analysis State
 * 
 * Central container for all parsed document data.
 * Prevents redundant tokenization/analysis between Scanner and Relationship Extractor.
 * 
 * DESIGN PRINCIPLES:
 * - Zero-copy architecture: Shares WinkAnalysis from DocumentScanner
 * - Lazy evaluation: Indexes built on-demand
 * - Type-safe: All caches are strictly typed
 * - Memory-efficient: Uses Map structures with O(1) lookups
 */

import type { LinguisticAnalysis, Sentence, Token } from '@/lib/entities/nlp/WinkProcessor';
import type { RegisteredEntity } from '@/lib/entities/entity-registry';
import type { ResoRankScorer } from '@/lib/resorank';

// Export WinkAnalysis as an alias for consistency
export type WinkAnalysis = LinguisticAnalysis;

// ==================== CORE TYPES ====================

/**
 * Extended entity mention with ResoRank metadata
 */
export interface EntityMention {
    entity: RegisteredEntity;
    text: string;              // Matched text (label or alias)
    position: number;          // Absolute character position in document
    tokenIndex: number;        // Index within sentence tokens
    sentenceIndex?: number;    // Index of containing sentence
    segmentMask: number;       // ResoRank proximity mask (bitfield)
    score: number;             // ResoRank match confidence (0-1)
    idf: number;               // Inverse document frequency (salience)
}

/**
 * Verb occurrence with linguistic metadata
 */
export interface VerbOccurrence {
    lemma: string;             // Base form (e.g., "run" from "running")
    text: string;              // Surface form
    position: number;          // Absolute character position
    sentenceIndex: number;     // Containing sentence
    tokenIndex: number;        // Index within sentence
    pos: string;               // POS tag (VERB, AUX)
}

/**
 * Preposition occurrence
 */
export interface PrepOccurrence {
    prep: string;              // Normalized preposition
    position: number;
    sentenceIndex: number;
    tokenIndex: number;
}

/**
 * Possessive marker occurrence ("'s", "of")
 */
export interface PossessiveOccurrence {
    type: 'apostrophe' | 'of';
    position: number;
    sentenceIndex: number;
    ownerMention?: EntityMention;   // Entity before marker
    ownedMention?: EntityMention;   // Entity after marker
}

// ==================== POS TAG CONSTANTS ====================

const VERB_POS_TAGS = ['VERB', 'AUX'];
const PREPOSITION_POS = 'ADP';

// ==================== DOCUMENT CONTEXT ====================

/**
 * Shared analysis context for all relationship extraction modules.
 * 
 * USAGE:
 * ```
 * const context = new DocumentContext(noteId, plainText, winkAnalysis, entityMentions, resoScorer);
 * 
 * // Get entities in sentence 5
 * const entities = context.getEntitiesInSentence(5);
 * 
 * // Get all verbs
 * const verbs = context.getVerbIndex();
 * ```
 */
export class DocumentContext {
    readonly noteId: string;
    readonly plainText: string;
    readonly winkAnalysis: WinkAnalysis;
    readonly entityMentions: EntityMention[];
    readonly resoScorer: ResoRankScorer<string>;

    // ===== LAZY-LOADED CACHES =====
    private _sentenceEntityMap?: Map<number, EntityMention[]>;
    private _verbIndex?: Map<string, VerbOccurrence[]>;
    private _prepIndex?: Map<string, PrepOccurrence[]>;
    private _possessiveIndex?: PossessiveOccurrence[];
    private _entityPairProximity?: Map<string, number>;  // Segment overlap cache

    constructor(
        noteId: string,
        plainText: string,
        winkAnalysis: WinkAnalysis,
        entityMentions: EntityMention[],
        resoScorer: ResoRankScorer<string>
    ) {
        this.noteId = noteId;
        this.plainText = plainText;
        this.winkAnalysis = winkAnalysis;
        this.entityMentions = entityMentions;
        this.resoScorer = resoScorer;
    }

    // ==================== ENTITY QUERIES ====================

    /**
     * Get entities in a specific sentence (lazy indexed)
     * O(1) after first call
     */
    getEntitiesInSentence(sentenceIndex: number): EntityMention[] {
        if (!this._sentenceEntityMap) {
            this._buildSentenceEntityMap();
        }

        return this._sentenceEntityMap!.get(sentenceIndex) || [];
    }

    /**
     * Get all sentences with at least N entities
     */
    getSentencesWithMinEntities(minCount: number = 2): Sentence[] {
        if (!this._sentenceEntityMap) {
            this._buildSentenceEntityMap();
        }

        return this.winkAnalysis.sentences.filter(s =>
            (this._sentenceEntityMap!.get(s.index)?.length || 0) >= minCount
        );
    }

    private _buildSentenceEntityMap(): void {
        this._sentenceEntityMap = new Map();

        for (const mention of this.entityMentions) {
            const sentence = this.winkAnalysis.sentences.find(
                s => s.start <= mention.position && s.end > mention.position
            );

            if (sentence) {
                // Update mention with sentence index
                mention.sentenceIndex = sentence.index;

                if (!this._sentenceEntityMap.has(sentence.index)) {
                    this._sentenceEntityMap.set(sentence.index, []);
                }
                this._sentenceEntityMap.get(sentence.index)!.push(mention);
            }
        }
    }

    // ==================== LINGUISTIC QUERIES ====================

    /**
     * Get all verb occurrences (lazy indexed by lemma)
     * O(1) after first call
     */
    getVerbIndex(): Map<string, VerbOccurrence[]> {
        if (!this._verbIndex) {
            this._buildVerbIndex();
        }

        return this._verbIndex!;
    }

    /**
     * Get verbs in a specific sentence
     */
    getVerbsInSentence(sentenceIndex: number): VerbOccurrence[] {
        const verbIndex = this.getVerbIndex();

        return Array.from(verbIndex.values())
            .flat()
            .filter(v => v.sentenceIndex === sentenceIndex);
    }

    private _buildVerbIndex(): void {
        this._verbIndex = new Map();

        for (const sentence of this.winkAnalysis.sentences) {
            for (let i = 0; i < sentence.tokens.length; i++) {
                const token = sentence.tokens[i];

                if (VERB_POS_TAGS.includes(token.pos)) {
                    const lemma = token.lemma.toLowerCase();

                    if (!this._verbIndex.has(lemma)) {
                        this._verbIndex.set(lemma, []);
                    }

                    this._verbIndex.get(lemma)!.push({
                        lemma,
                        text: token.text,
                        position: token.start,
                        sentenceIndex: sentence.index,
                        tokenIndex: i,
                        pos: token.pos
                    });
                }
            }
        }
    }

    /**
     * Get all preposition occurrences (lazy indexed)
     */
    getPrepIndex(): Map<string, PrepOccurrence[]> {
        if (!this._prepIndex) {
            this._buildPrepIndex();
        }

        return this._prepIndex!;
    }

    /**
     * Get prepositions in a specific sentence
     */
    getPrepsInSentence(sentenceIndex: number): PrepOccurrence[] {
        const prepIndex = this.getPrepIndex();

        return Array.from(prepIndex.values())
            .flat()
            .filter(p => p.sentenceIndex === sentenceIndex);
    }

    private _buildPrepIndex(): void {
        this._prepIndex = new Map();

        for (const sentence of this.winkAnalysis.sentences) {
            for (let i = 0; i < sentence.tokens.length; i++) {
                const token = sentence.tokens[i];

                if (token.pos === PREPOSITION_POS) {
                    const prep = token.text.toLowerCase();

                    if (!this._prepIndex.has(prep)) {
                        this._prepIndex.set(prep, []);
                    }

                    this._prepIndex.get(prep)!.push({
                        prep,
                        position: token.start,
                        sentenceIndex: sentence.index,
                        tokenIndex: i
                    });
                }
            }
        }
    }

    /**
     * Get all possessive markers (lazy indexed)
     */
    getPossessiveIndex(): PossessiveOccurrence[] {
        if (!this._possessiveIndex) {
            this._buildPossessiveIndex();
        }

        return this._possessiveIndex!;
    }

    private _buildPossessiveIndex(): void {
        this._possessiveIndex = [];

        for (const sentence of this.winkAnalysis.sentences) {
            const sentenceMentions = this.getEntitiesInSentence(sentence.index);

            for (let i = 0; i < sentenceMentions.length; i++) {
                const mention = sentenceMentions[i];
                const mentionEnd = mention.position + mention.text.length;

                // Check for "'s" or "'" after entity
                const textAfter = this.plainText.substring(mentionEnd, mentionEnd + 3);

                if (textAfter.startsWith("'s") || textAfter.startsWith("'")) {
                    // Find next entity within 20 characters
                    const nextMentions = sentenceMentions.filter(m =>
                        m.position > mentionEnd && m.position - mentionEnd <= 20
                    );

                    if (nextMentions.length > 0) {
                        this._possessiveIndex.push({
                            type: 'apostrophe',
                            position: mentionEnd,
                            sentenceIndex: sentence.index,
                            ownerMention: mention,
                            ownedMention: nextMentions[0]
                        });
                    }
                }
            }

            // Check for "X of Y" patterns
            const ofPreps = this.getPrepsInSentence(sentence.index).filter(p => p.prep === 'of');

            for (const prep of ofPreps) {
                // Find entities before and after "of"
                const before = sentenceMentions.filter(m => m.position < prep.position);
                const after = sentenceMentions.filter(m => m.position > prep.position);

                if (before.length > 0 && after.length > 0) {
                    const owner = after[0];   // "ring of power" → "power" owns "ring"
                    const owned = before[before.length - 1];

                    this._possessiveIndex.push({
                        type: 'of',
                        position: prep.position,
                        sentenceIndex: sentence.index,
                        ownerMention: owner,
                        ownedMention: owned
                    });
                }
            }
        }
    }

    // ==================== PROXIMITY QUERIES (ResoRank) ====================

    /**
     * Get segment overlap between two entities (cached)
     * Uses ResoRank proximity masks for instant calculation
     */
    getEntityProximity(entity1: EntityMention, entity2: EntityMention): number {
        const cacheKey = `${entity1.entity.id}:${entity2.entity.id}`;

        if (!this._entityPairProximity) {
            this._entityPairProximity = new Map();
        }

        if (this._entityPairProximity.has(cacheKey)) {
            return this._entityPairProximity.get(cacheKey)!;
        }

        // Bitwise AND + popcount for instant proximity
        const overlap = this._popCount(entity1.segmentMask & entity2.segmentMask);

        this._entityPairProximity.set(cacheKey, overlap);
        return overlap;
    }

    /**
     * Find entity pairs with segment overlap >= threshold
     */
    findProximalPairs(minOverlap: number = 1): Array<{
        entity1: EntityMention;
        entity2: EntityMention;
        overlap: number;
    }> {
        const pairs: Array<{ entity1: EntityMention; entity2: EntityMention; overlap: number }> = [];

        for (let i = 0; i < this.entityMentions.length - 1; i++) {
            for (let j = i + 1; j < this.entityMentions.length; j++) {
                const overlap = this.getEntityProximity(
                    this.entityMentions[i],
                    this.entityMentions[j]
                );

                if (overlap >= minOverlap) {
                    pairs.push({
                        entity1: this.entityMentions[i],
                        entity2: this.entityMentions[j],
                        overlap
                    });
                }
            }
        }

        return pairs;
    }

    private _popCount(n: number): number {
        n = n - ((n >>> 1) & 0x55555555);
        n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
        return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    }

    // ==================== UTILITY QUERIES ====================

    /**
     * Get sentence containing a position
     */
    getSentenceAtPosition(position: number): Sentence | undefined {
        return this.winkAnalysis.sentences.find(
            s => s.start <= position && s.end > position
        );
    }

    /**
     * Get token at position
     */
    getTokenAtPosition(position: number): Token | undefined {
        for (const sentence of this.winkAnalysis.sentences) {
            for (const token of sentence.tokens) {
                if (token.start <= position && token.end > position) {
                    return token;
                }
            }
        }
        return undefined;
    }

    /**
     * Check if two positions are in the same sentence
     */
    inSameSentence(pos1: number, pos2: number): boolean {
        const s1 = this.getSentenceAtPosition(pos1);
        const s2 = this.getSentenceAtPosition(pos2);
        return s1 !== undefined && s1 === s2;
    }

    /**
     * Get statistics about the document
     */
    getStats(): {
        sentenceCount: number;
        tokenCount: number;
        entityMentionCount: number;
        uniqueEntityCount: number;
        verbCount: number;
        prepCount: number;
    } {
        const uniqueEntities = new Set(this.entityMentions.map(m => m.entity.id));

        return {
            sentenceCount: this.winkAnalysis.sentences.length,
            tokenCount: this.winkAnalysis.sentences.reduce(
                (sum, s) => sum + s.tokens.length,
                0
            ),
            entityMentionCount: this.entityMentions.length,
            uniqueEntityCount: uniqueEntities.size,
            verbCount: Array.from(this.getVerbIndex().values()).flat().length,
            prepCount: Array.from(this.getPrepIndex().values()).flat().length
        };
    }
}
