/**
 * Content Relationship Extractor - Unified extraction interface
 * 
 * Bridges NER (NeuroBERT) and LLM (LFM2-350M-Extract) models under a single interface.
 * Provides relationship extraction from document content using:
 * - NER mode: Entity extraction + verb pattern matching + co-occurrence
 * - LLM mode: Full structured extraction with relationships
 * - Hybrid mode: NER first, then LLM for relationship enrichment
 * - Temporal extraction: PRECEDES/FOLLOWS/CONCURRENT relationships from timeline data
 */

import { runExtraction } from '@/lib/extraction/ExtractionService';
import { extractionService, type StructuredExtraction } from '@/lib/extraction/ExtractionService';
import { promptTemplateBuilder } from '@/lib/extraction/PromptTemplateBuilder';
import { entityRegistry } from '@/lib/entities/entity-registry';
import { relationshipRegistry } from '../relationship-registry';
import { RelationshipSource } from '../types';
import {
    matchVerbPatterns,
    type EntitySpan,
    type ExtractedRelationship,
    type VerbPattern,
} from './verb-patterns';
import {
    detectCoOccurrences,
    coOccurrenceToRelationship,
    type CoOccurrence,
    type CoOccurrenceOptions,
} from './cooccurrence-detector';
import {
    getTimelineExtractor,
    type TemporalRelationship,
} from './timeline-extractor';
import type { EntityKind } from '@/lib/entities/entityTypes';

export type ExtractionMode = 'ner' | 'llm' | 'hybrid';

export interface ExtractedEntity {
    label: string;
    kind: EntityKind;
    confidence: number;
    start?: number;
    end?: number;
    context?: string;
}

export interface ContentExtractionResult {
    entities: ExtractedEntity[];
    relationships: ExtractedRelationship[];
    coOccurrences: CoOccurrence[];
    temporalRelationships: TemporalRelationship[];
    metadata: {
        noteId: string;
        mode: ExtractionMode;
        processingTime: number;
        entityCount: number;
        relationshipCount: number;
        coOccurrenceCount: number;
        temporalRelationshipCount: number;
    };
}

export interface ExtractionOptions {
    confidenceThreshold?: number;
    coOccurrenceOptions?: CoOccurrenceOptions;
    includeCoOccurrences?: boolean;
    includeTemporal?: boolean;
    customPatterns?: VerbPattern[];
}

const NER_TO_ENTITY_KIND: Record<string, EntityKind> = {
    'PERSON': 'CHARACTER',
    'PER': 'CHARACTER',
    'LOC': 'LOCATION',
    'LOCATION': 'LOCATION',
    'GPE': 'LOCATION',
    'ORG': 'FACTION',
    'ORGANIZATION': 'FACTION',
    'EVENT': 'EVENT',
    'FAC': 'LOCATION',
    'PRODUCT': 'ITEM',
    'WORK_OF_ART': 'CONCEPT',
    'MISC': 'CONCEPT',
};

export class ContentRelationshipExtractor {
    async extractFromNote(
        noteId: string,
        content: string,
        mode: ExtractionMode = 'ner',
        options: ExtractionOptions = {}
    ): Promise<ContentExtractionResult> {
        const startTime = performance.now();
        const { 
            confidenceThreshold = 0.4, 
            includeCoOccurrences = true,
            includeTemporal = true 
        } = options;

        let entities: ExtractedEntity[] = [];
        let relationships: ExtractedRelationship[] = [];
        let coOccurrences: CoOccurrence[] = [];
        let temporalRelationships: TemporalRelationship[] = [];

        try {
            switch (mode) {
                case 'ner':
                    ({ entities, relationships, coOccurrences } = await this.extractWithNER(
                        content,
                        noteId,
                        confidenceThreshold,
                        includeCoOccurrences,
                        options.coOccurrenceOptions
                    ));
                    break;

                case 'llm':
                    ({ entities, relationships, coOccurrences } = await this.extractWithLLM(
                        content,
                        noteId
                    ));
                    break;

                case 'hybrid':
                    ({ entities, relationships, coOccurrences } = await this.extractHybrid(
                        content,
                        noteId,
                        confidenceThreshold,
                        options.coOccurrenceOptions
                    ));
                    break;
            }

            if (includeTemporal && entities.length > 0) {
                const entityMentions = entities
                    .filter(e => e.start !== undefined && e.end !== undefined)
                    .map(e => ({
                        id: entityRegistry.findEntity(e.label)?.id || e.label,
                        name: e.label,
                        start: e.start!,
                        end: e.end!,
                    }));

                if (entityMentions.length > 0) {
                    const timelineExtractor = getTimelineExtractor();
                    const temporalResult = timelineExtractor.extractFromContent(
                        noteId,
                        content,
                        entityMentions
                    );
                    temporalRelationships = temporalResult.relationships;
                }
            }
        } catch (error) {
            console.error(`[ContentExtractor] Extraction failed (mode: ${mode}):`, error);
        }

        const processingTime = performance.now() - startTime;

        return {
            entities,
            relationships,
            coOccurrences,
            temporalRelationships,
            metadata: {
                noteId,
                mode,
                processingTime,
                entityCount: entities.length,
                relationshipCount: relationships.length,
                coOccurrenceCount: coOccurrences.length,
                temporalRelationshipCount: temporalRelationships.length,
            },
        };
    }

    private async extractWithNER(
        content: string,
        noteId: string,
        threshold: number,
        includeCoOccurrences: boolean,
        coOccurrenceOptions?: CoOccurrenceOptions
    ): Promise<{
        entities: ExtractedEntity[];
        relationships: ExtractedRelationship[];
        coOccurrences: CoOccurrence[];
    }> {
        const spans = await runExtraction(content, { threshold });

        const entities: ExtractedEntity[] = spans.map(span => ({
            label: span.text,
            kind: NER_TO_ENTITY_KIND[span.label] || 'CONCEPT',
            confidence: span.confidence,
            start: span.start,
            end: span.end,
            context: content.slice(
                Math.max(0, span.start - 30),
                Math.min(content.length, span.end + 30)
            ),
        }));

        const entitySpans: EntitySpan[] = spans.map(span => ({
            label: span.text,
            start: span.start,
            end: span.end,
            kind: NER_TO_ENTITY_KIND[span.label] || 'CONCEPT',
        }));

        const relationships = matchVerbPatterns(content, entitySpans);

        let coOccurrences: CoOccurrence[] = [];
        if (includeCoOccurrences) {
            coOccurrences = detectCoOccurrences(content, entitySpans, coOccurrenceOptions);
        }

        return { entities, relationships, coOccurrences };
    }

    private async extractWithLLM(
        content: string,
        noteId: string
    ): Promise<{
        entities: ExtractedEntity[];
        relationships: ExtractedRelationship[];
        coOccurrences: CoOccurrence[];
    }> {
        if (!extractionService.isLoaded() || extractionService.getCurrentModel() !== 'extraction') {
            await extractionService.initialize('extraction');
        }

        const systemPrompt = promptTemplateBuilder.buildSystemPrompt({
            explicitEntities: [],
            registryEntities: entityRegistry.getAllEntities(),
            includeRelationships: true,
            includeCoOccurrences: true,
        });

        const extraction: StructuredExtraction = await extractionService.extractStructured(
            content,
            systemPrompt
        );

        const entities: ExtractedEntity[] = extraction.entities.map(e => ({
            label: e.label,
            kind: e.kind,
            confidence: e.confidence,
        }));

        const relationships: ExtractedRelationship[] = extraction.relationships.map(r => ({
            sourceLabel: r.source,
            targetLabel: r.target,
            type: r.type,
            confidence: r.confidence || 0.7,
            source: RelationshipSource.LLM_EXTRACTION,
            context: '',
            bidirectional: false,
        }));

        const coOccurrences: CoOccurrence[] = extraction.coOccurrences.map((co, idx) => ({
            entities: co.entities,
            entitySpans: [],
            context: co.context,
            proximity: 0,
            sentenceIndex: idx,
            strength: 0.5,
        }));

        return { entities, relationships, coOccurrences };
    }

    private async extractHybrid(
        content: string,
        noteId: string,
        threshold: number,
        coOccurrenceOptions?: CoOccurrenceOptions
    ): Promise<{
        entities: ExtractedEntity[];
        relationships: ExtractedRelationship[];
        coOccurrences: CoOccurrence[];
    }> {
        const nerResult = await this.extractWithNER(content, noteId, threshold, true, coOccurrenceOptions);

        let llmResult: {
            entities: ExtractedEntity[];
            relationships: ExtractedRelationship[];
            coOccurrences: CoOccurrence[];
        } = { entities: [], relationships: [], coOccurrences: [] };

        try {
            llmResult = await this.extractWithLLM(content, noteId);
        } catch (error) {
            console.warn('[ContentExtractor] LLM extraction failed in hybrid mode, using NER only');
        }

        const entityMap = new Map<string, ExtractedEntity>();
        for (const e of nerResult.entities) {
            entityMap.set(e.label.toLowerCase(), e);
        }
        for (const e of llmResult.entities) {
            const key = e.label.toLowerCase();
            const existing = entityMap.get(key);
            if (!existing || e.confidence > existing.confidence) {
                entityMap.set(key, e);
            }
        }

        const relationshipMap = new Map<string, ExtractedRelationship>();
        for (const r of nerResult.relationships) {
            const key = `${r.sourceLabel}:${r.type}:${r.targetLabel}`;
            relationshipMap.set(key, r);
        }
        for (const r of llmResult.relationships) {
            const key = `${r.sourceLabel}:${r.type}:${r.targetLabel}`;
            const existing = relationshipMap.get(key);
            if (!existing || r.confidence > existing.confidence) {
                relationshipMap.set(key, r);
            }
        }

        return {
            entities: Array.from(entityMap.values()),
            relationships: Array.from(relationshipMap.values()),
            coOccurrences: [...nerResult.coOccurrences, ...llmResult.coOccurrences],
        };
    }

    async persistToRegistry(
        result: ContentExtractionResult,
        options: { persistCoOccurrences?: boolean; persistTemporal?: boolean } = {}
    ): Promise<{ relationshipsPersisted: number; coOccurrencesPersisted: number; temporalPersisted: number }> {
        const { persistCoOccurrences = true, persistTemporal = true } = options;
        let relationshipsPersisted = 0;
        let coOccurrencesPersisted = 0;
        let temporalPersisted = 0;

        for (const rel of result.relationships) {
            try {
                const sourceEntity = entityRegistry.findEntity(rel.sourceLabel);
                const targetEntity = entityRegistry.findEntity(rel.targetLabel);

                if (!sourceEntity || !targetEntity) {
                    continue;
                }

                relationshipRegistry.add({
                    sourceEntityId: sourceEntity.id,
                    targetEntityId: targetEntity.id,
                    type: rel.type,
                    inverseType: rel.inverseType,
                    bidirectional: rel.bidirectional,
                    namespace: 'content_extraction',
                    attributes: {
                        verbMatch: rel.verbMatch,
                        context: rel.context,
                    },
                    provenance: [{
                        source: rel.source,
                        originId: result.metadata.noteId,
                        timestamp: new Date(),
                        confidence: rel.confidence,
                        context: rel.context,
                    }],
                });

                relationshipsPersisted++;
            } catch (error) {
                console.warn('[ContentExtractor] Failed to persist relationship:', error);
            }
        }

        if (persistCoOccurrences) {
            for (const coOcc of result.coOccurrences) {
                const pairs = coOccurrenceToRelationship(coOcc);

                for (const pair of pairs) {
                    try {
                        const sourceEntity = entityRegistry.findEntity(pair.sourceLabel);
                        const targetEntity = entityRegistry.findEntity(pair.targetLabel);

                        if (!sourceEntity || !targetEntity) {
                            continue;
                        }

                        relationshipRegistry.add({
                            sourceEntityId: sourceEntity.id,
                            targetEntityId: targetEntity.id,
                            type: 'CO_OCCURS_WITH',
                            bidirectional: true,
                            namespace: 'co_occurrence',
                            attributes: {
                                context: coOcc.context,
                                proximity: coOcc.proximity,
                                sentenceIndex: coOcc.sentenceIndex,
                            },
                            provenance: [{
                                source: RelationshipSource.CO_OCCURRENCE,
                                originId: result.metadata.noteId,
                                timestamp: new Date(),
                                confidence: pair.strength * 0.4,
                                context: coOcc.context,
                            }],
                        });

                        coOccurrencesPersisted++;
                    } catch (error) {
                        console.warn('[ContentExtractor] Failed to persist co-occurrence:', error);
                    }
                }
            }
        }

        if (persistTemporal && result.temporalRelationships.length > 0) {
            const timelineExtractor = getTimelineExtractor();
            temporalPersisted = await timelineExtractor.persistToRegistry({
                relationships: result.temporalRelationships,
                metadata: {
                    entitiesProcessed: result.metadata.entityCount,
                    relationshipsCreated: result.temporalRelationships.length,
                    processingTime: 0,
                    source: 'content',
                },
            });
        }

        if (relationshipsPersisted > 0 || coOccurrencesPersisted > 0 || temporalPersisted > 0) {
            console.log(
                `[ContentExtractor] Persisted ${relationshipsPersisted} relationships, ` +
                `${coOccurrencesPersisted} co-occurrences, ${temporalPersisted} temporal ` +
                `for note ${result.metadata.noteId}`
            );
        }

        return { relationshipsPersisted, coOccurrencesPersisted, temporalPersisted };
    }
}

let instance: ContentRelationshipExtractor | null = null;

export function getContentRelationshipExtractor(): ContentRelationshipExtractor {
    if (!instance) {
        instance = new ContentRelationshipExtractor();
    }
    return instance;
}
