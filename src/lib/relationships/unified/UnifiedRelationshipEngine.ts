/**
 * UnifiedRelationshipEngine - Orchestrates Wink + ResoRank + Extractors
 * 
 * ZERO-COPY INTEGRATION:
 * - Receives WinkAnalysis + EntityMentions from DocumentScanner
 * - Shares ResoRank scorer instance
 * - No redundant parsing/tokenization
 */

import type { LinguisticAnalysis } from '@/lib/entities/nlp/WinkProcessor';
import type { EntityRegistry } from '@/lib/entities/entity-registry';
import { RelationshipRegistry } from '../relationship-registry';
import { RelationshipSource } from '../types';
import type { ResoRankScorer } from '@/lib/resorank';
import { DocumentContext, type EntityMention } from '../core/DocumentContext';
import { EntityMentionResolver } from '../core/EntityMentionResolver';
import { SVOExtractor } from './SVOExtractor';
import { PrepExtractor } from './PrepExtractor';
import { PossessionExtractor } from './PossessionExtractor';
import { CoOccurrenceExtractor } from './CoOccurrenceExtractor';
import type {
    ExtractedRelationship,
    UnifiedCoOccurrence,
    ExtractionStats,
    ExtractionResult
} from '@/lib/relationships/unified-types';

export class UnifiedRelationshipEngine {
    private entityResolver: EntityMentionResolver;
    private svoExtractor: SVOExtractor;
    private prepExtractor: PrepExtractor;
    private possessionExtractor: PossessionExtractor;
    private coOccurrenceExtractor: CoOccurrenceExtractor;

    constructor(
        private resoScorer: ResoRankScorer<string>,
        private entityRegistry: EntityRegistry,
        private relationshipRegistry: RelationshipRegistry
    ) {
        this.entityResolver = new EntityMentionResolver(resoScorer, entityRegistry);
        this.svoExtractor = new SVOExtractor();
        this.prepExtractor = new PrepExtractor();
        this.possessionExtractor = new PossessionExtractor();
        this.coOccurrenceExtractor = new CoOccurrenceExtractor();
    }

    /**
     * Extract relationships from a document
     * 
     * INTEGRATES with DocumentScanner output (zero-copy)
     */
    async extractFromDocument(
        noteId: string,
        plainText: string,
        winkAnalysis: LinguisticAnalysis,
        entityMentions: EntityMention[],
        overrideScorer?: ResoRankScorer<string>
    ): Promise<ExtractionResult> {
        const startTime = performance.now();

        // Build shared context (zero-copy from DocumentScanner)
        const context = new DocumentContext(
            noteId,
            plainText,
            winkAnalysis,
            entityMentions,
            overrideScorer || this.resoScorer
        );

        // Run extractors in parallel (independent operations)
        const [svoRels, prepRels, possRels, coOccs] = await Promise.all([
            Promise.resolve(this.svoExtractor.extract(context)),
            Promise.resolve(this.prepExtractor.extract(context)),
            Promise.resolve(this.possessionExtractor.extract(context)),
            Promise.resolve(this.coOccurrenceExtractor.extract(context))
        ]);

        const allRelationships = [...svoRels, ...prepRels, ...possRels];

        // Persist to relationship registry (batch operation)
        await this.persistRelationships(allRelationships);

        const elapsedMs = performance.now() - startTime;

        return {
            relationships: allRelationships,
            coOccurrences: coOccs,
            stats: {
                totalRelationships: allRelationships.length,
                svoCount: svoRels.length,
                prepCount: prepRels.length,
                possessionCount: possRels.length,
                coOccurrenceCount: coOccs.length,
                elapsedMs,
                throughputRelsPerSec: (allRelationships.length / elapsedMs) * 1000,
                contextStats: context.getStats()
            }
        };
    }

    /**
     * Extract without persisting (for preview/testing)
     */
    extractWithoutPersist(
        noteId: string,
        plainText: string,
        winkAnalysis: LinguisticAnalysis,
        entityMentions: EntityMention[]
    ): ExtractionResult {
        const startTime = performance.now();

        const context = new DocumentContext(
            noteId,
            plainText,
            winkAnalysis,
            entityMentions,
            this.resoScorer
        );

        const svoRels = this.svoExtractor.extract(context);
        const prepRels = this.prepExtractor.extract(context);
        const possRels = this.possessionExtractor.extract(context);
        const coOccs = this.coOccurrenceExtractor.extract(context);

        const allRelationships = [...svoRels, ...prepRels, ...possRels];
        const elapsedMs = performance.now() - startTime;

        return {
            relationships: allRelationships,
            coOccurrences: coOccs,
            stats: {
                totalRelationships: allRelationships.length,
                svoCount: svoRels.length,
                prepCount: prepRels.length,
                possessionCount: possRels.length,
                coOccurrenceCount: coOccs.length,
                elapsedMs,
                throughputRelsPerSec: (allRelationships.length / elapsedMs) * 1000,
                contextStats: context.getStats()
            }
        };
    }

    /**
     * Resolve entity mentions in sentences (useful for scanner integration)
     */
    resolveEntitiesInDocument(winkAnalysis: LinguisticAnalysis): EntityMention[] {
        const mentions: EntityMention[] = [];

        for (const sentence of winkAnalysis.sentences) {
            const sentenceMentions = this.entityResolver.resolveInSentence(sentence);
            mentions.push(...sentenceMentions);
        }

        return mentions;
    }

    private async persistRelationships(
        relationships: ExtractedRelationship[]
    ): Promise<void> {
        // Group by (source, target, predicate) for deduplication
        const grouped = new Map<string, ExtractedRelationship[]>();

        for (const rel of relationships) {
            const key = `${rel.source.entity.id}::${rel.target.entity.id}::${rel.predicate}`;

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(rel);
        }

        // Batch persist
        const operations: Promise<any>[] = [];

        for (const [key, rels] of grouped) {
            const [sourceId, targetId, predicate] = key.split('::');

            const existing = this.relationshipRegistry.findByEntities(
                sourceId,
                targetId,
                predicate
            );

            const provenance = rels.map(r => ({
                source: RelationshipSource.NER_EXTRACTION,
                originId: r.metadata.noteId,
                timestamp: r.metadata.extractedAt,
                confidence: r.confidence,
                context: r.context.sentence,
                metadata: { pattern: r.pattern }
            }));

            if (existing) {
                operations.push(
                    Promise.resolve(
                        this.relationshipRegistry.update(existing.id, {
                            provenance: [...existing.provenance, ...provenance]
                        })
                    )
                );
            } else {
                operations.push(
                    Promise.resolve(
                        this.relationshipRegistry.add({
                            sourceEntityId: sourceId,
                            targetEntityId: targetId,
                            type: predicate,
                            inverseType: rels[0].inversePredicate,
                            bidirectional: false,
                            provenance,
                            attributes: { pattern: rels[0].pattern }
                        })
                    )
                );
            }
        }

        await Promise.all(operations);
    }

    /**
     * Get extraction statistics for the engine
     */
    getEngineStats(): {
        registrySize: number;
        entityCount: number;
    } {
        return {
            registrySize: this.relationshipRegistry.getAll().length,
            entityCount: this.entityRegistry.getAllEntities().length
        };
    }
}

// ==================== SINGLETON INSTANCE ====================

let engineInstance: UnifiedRelationshipEngine | null = null;

export function getUnifiedRelationshipEngine(
    resoScorer: ResoRankScorer<string>,
    entityRegistry: EntityRegistry,
    relationshipRegistry: RelationshipRegistry
): UnifiedRelationshipEngine {
    if (!engineInstance) {
        engineInstance = new UnifiedRelationshipEngine(
            resoScorer,
            entityRegistry,
            relationshipRegistry
        );
    }
    return engineInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetUnifiedRelationshipEngine(): void {
    engineInstance = null;
}
