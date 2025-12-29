/**
 * Timeline Relationship Extractor
 * 
 * Extracts temporal relationships (PRECEDES/FOLLOWS/CONCURRENT) from:
 * - Aho-Corasick temporal pattern detection (replaces chrono-node)
 * - Sequential markers (Chapter/Act/Scene)
 * - Relative time expressions
 * - Timeline folder sibling ordering
 * 
 * Supports custom temporal relationship types via Blueprint Hub integration.
 */

import { temporalAhoMatcher, type TemporalMention, type TemporalKind } from '@/lib/entities/scanner-v3/extractors/TemporalAhoMatcher';
import { relationshipRegistry, RelationshipSource, type RelationshipInput, type RelationshipProvenance } from '@/lib/relationships';
import type { TemporalPoint, TimeGranularity, TemporalSpan } from '@/types/temporal';
import type { Folder, Note } from '../../../contexts/NotesContext';

export type TemporalRelationshipType =
    | 'PRECEDES'
    | 'FOLLOWS'
    | 'CONCURRENT'
    | 'DURING'
    | 'CONTAINS_TEMPORAL'
    | 'TRIGGERS'
    | 'CAUSED_BY';

export const TEMPORAL_RELATIONSHIP_PAIRS: Record<TemporalRelationshipType, TemporalRelationshipType | null> = {
    'PRECEDES': 'FOLLOWS',
    'FOLLOWS': 'PRECEDES',
    'CONCURRENT': 'CONCURRENT',
    'DURING': 'CONTAINS_TEMPORAL',
    'CONTAINS_TEMPORAL': 'DURING',
    'TRIGGERS': 'CAUSED_BY',
    'CAUSED_BY': 'TRIGGERS',
};

export type TemporalRelationCategory = 'ordering' | 'containment' | 'causality' | 'custom';

export interface CustomTemporalRelationType {
    id?: string;
    type: string;
    inverseType: string;
    displayLabel?: string;
    description: string;
    bidirectional: boolean;
    category?: TemporalRelationCategory;
    enabled?: boolean;
}

export interface TemporalEntity {
    id: string;
    name: string;
    temporal?: TemporalSpan;
    entityKind?: string;
    createdAt?: Date;
    sequence?: number;
}

export interface TemporalRelationship {
    sourceEntityId: string;
    targetEntityId: string;
    type: TemporalRelationshipType | string;
    inverseType?: string;
    confidence: number;
    granularity?: TimeGranularity;
    offsetDays?: number;
    originId: string;
    context: string;
}

export interface TemporalExtractionResult {
    relationships: TemporalRelationship[];
    metadata: {
        entitiesProcessed: number;
        relationshipsCreated: number;
        processingTime: number;
        source: 'content' | 'folder' | 'entities';
    };
}

const GRANULARITY_CONFIDENCE: Record<TimeGranularity, number> = {
    'precise': 0.95,
    'datetime': 0.85,
    'date': 0.80,
    'sequential': 0.90,
    'relative': 0.70,
    'abstract': 0.50,
};

const FOLDER_ORDER_CONFIDENCE = 0.85;
const CONCURRENT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

const STORAGE_KEY = 'temporal_relationship_types';

export class TimelineRelationshipExtractor {
    private customTypes: CustomTemporalRelationType[] = [];
    private customTypePairs: Map<string, string> = new Map();

    constructor() {
        this.loadCustomTypesFromStorage();
    }

    setCustomTypes(types: CustomTemporalRelationType[]): void {
        this.customTypes = types.filter(t => t.enabled !== false);
        this.rebuildCustomTypePairs();
        this.saveCustomTypesToStorage();
    }

    addCustomType(type: CustomTemporalRelationType): void {
        const existing = this.customTypes.findIndex(t => t.type === type.type);
        if (existing >= 0) {
            this.customTypes[existing] = type;
        } else {
            this.customTypes.push(type);
        }
        this.rebuildCustomTypePairs();
        this.saveCustomTypesToStorage();
    }

    removeCustomType(typeName: string): boolean {
        const idx = this.customTypes.findIndex(t => t.type === typeName);
        if (idx >= 0) {
            this.customTypes.splice(idx, 1);
            this.rebuildCustomTypePairs();
            this.saveCustomTypesToStorage();
            return true;
        }
        return false;
    }

    getCustomTypes(): CustomTemporalRelationType[] {
        return [...this.customTypes];
    }

    getAllTemporalTypes(): Array<{ type: string; inverseType: string | null; isBuiltin: boolean }> {
        const builtins = Object.entries(TEMPORAL_RELATIONSHIP_PAIRS).map(([type, inverse]) => ({
            type,
            inverseType: inverse,
            isBuiltin: true,
        }));

        const custom = this.customTypes.map(t => ({
            type: t.type,
            inverseType: t.inverseType || null,
            isBuiltin: false,
        }));

        return [...builtins, ...custom];
    }

    getInverseType(type: string): string | null {
        if (type in TEMPORAL_RELATIONSHIP_PAIRS) {
            return TEMPORAL_RELATIONSHIP_PAIRS[type as TemporalRelationshipType];
        }
        return this.customTypePairs.get(type) || null;
    }

    private rebuildCustomTypePairs(): void {
        this.customTypePairs.clear();
        for (const t of this.customTypes) {
            if (t.inverseType) {
                this.customTypePairs.set(t.type, t.inverseType);
                this.customTypePairs.set(t.inverseType, t.type);
            }
        }
    }

    private loadCustomTypesFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.customTypes = parsed.filter(t => t.enabled !== false);
                    this.rebuildCustomTypePairs();
                }
            }
        } catch (error) {
            console.warn('[TimelineExtractor] Failed to load custom types:', error);
        }
    }

    private saveCustomTypesToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customTypes));
        } catch (error) {
            console.warn('[TimelineExtractor] Failed to save custom types:', error);
        }
    }

    extractFromEntities(entities: TemporalEntity[]): TemporalExtractionResult {
        const startTime = performance.now();
        const relationships: TemporalRelationship[] = [];

        const temporalEntities = entities.filter(e =>
            e.temporal?.start || e.sequence !== undefined
        );

        const sorted = this.sortByTemporal(temporalEntities);

        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            const comparison = this.compareTemporalPoints(
                current.temporal?.start,
                next.temporal?.start,
                current.sequence,
                next.sequence
            );

            if (comparison === null) continue;

            const granularity = current.temporal?.start?.granularity ||
                (current.sequence !== undefined ? 'sequential' : 'abstract');
            const confidence = this.calculateConfidence(granularity);

            if (comparison < 0) {
                relationships.push({
                    sourceEntityId: current.id,
                    targetEntityId: next.id,
                    type: 'PRECEDES',
                    inverseType: 'FOLLOWS',
                    confidence,
                    granularity,
                    originId: current.id,
                    context: `${current.name} precedes ${next.name} in timeline`,
                });
            } else if (comparison === 0) {
                relationships.push({
                    sourceEntityId: current.id,
                    targetEntityId: next.id,
                    type: 'CONCURRENT',
                    inverseType: 'CONCURRENT',
                    confidence: confidence * 0.9,
                    granularity,
                    originId: current.id,
                    context: `${current.name} is concurrent with ${next.name}`,
                });
            }
        }

        this.detectDuringRelationships(sorted, relationships);

        return {
            relationships,
            metadata: {
                entitiesProcessed: entities.length,
                relationshipsCreated: relationships.length,
                processingTime: performance.now() - startTime,
                source: 'entities',
            },
        };
    }

    extractFromContent(
        noteId: string,
        content: string,
        entityMentions: Array<{ id: string; name: string; start: number; end: number }>
    ): TemporalExtractionResult {
        const startTime = performance.now();
        const relationships: TemporalRelationship[] = [];

        const temporalExpressions = this.findTemporalExpressions(content);

        for (const expr of temporalExpressions) {
            const nearbyEntities = entityMentions.filter(e =>
                Math.abs(e.start - expr.position) < 200 ||
                Math.abs(e.end - expr.position) < 200
            );

            if (nearbyEntities.length < 2) continue;

            const sorted = nearbyEntities.sort((a, b) => a.start - b.start);

            for (let i = 0; i < sorted.length - 1; i++) {
                const type = this.inferRelationshipFromExpression(expr.text);
                if (!type) continue;

                relationships.push({
                    sourceEntityId: sorted[i].id,
                    targetEntityId: sorted[i + 1].id,
                    type,
                    inverseType: TEMPORAL_RELATIONSHIP_PAIRS[type] || undefined,
                    confidence: expr.confidence,
                    granularity: expr.granularity,
                    originId: noteId,
                    context: `Extracted from: "${expr.text}"`,
                });
            }
        }

        return {
            relationships,
            metadata: {
                entitiesProcessed: entityMentions.length,
                relationshipsCreated: relationships.length,
                processingTime: performance.now() - startTime,
                source: 'content',
            },
        };
    }

    extractFromTimelineFolder(
        folder: Folder,
        children: Array<Note | Folder>
    ): TemporalExtractionResult {
        const startTime = performance.now();
        const relationships: TemporalRelationship[] = [];

        if (folder.entityKind !== 'TIMELINE') {
            return {
                relationships: [],
                metadata: {
                    entitiesProcessed: 0,
                    relationshipsCreated: 0,
                    processingTime: performance.now() - startTime,
                    source: 'folder',
                },
            };
        }

        const sortedChildren = this.sortFolderChildren(children);

        for (let i = 0; i < sortedChildren.length - 1; i++) {
            const current = sortedChildren[i];
            const next = sortedChildren[i + 1];

            relationships.push({
                sourceEntityId: current.id,
                targetEntityId: next.id,
                type: 'PRECEDES',
                inverseType: 'FOLLOWS',
                confidence: FOLDER_ORDER_CONFIDENCE,
                originId: folder.id,
                context: `Folder ordering in ${folder.name}: ${this.getChildName(current)} → ${this.getChildName(next)}`,
            });
        }

        return {
            relationships,
            metadata: {
                entitiesProcessed: children.length,
                relationshipsCreated: relationships.length,
                processingTime: performance.now() - startTime,
                source: 'folder',
            },
        };
    }

    async persistToRegistry(result: TemporalExtractionResult): Promise<number> {
        let persisted = 0;

        for (const rel of result.relationships) {
            const provenance: RelationshipProvenance = {
                source: RelationshipSource.TIMELINE,
                originId: rel.originId,
                timestamp: new Date(),
                confidence: rel.confidence,
                context: rel.context,
                metadata: {
                    granularity: rel.granularity,
                    offsetDays: rel.offsetDays,
                    extractionSource: result.metadata.source,
                },
            };

            const input: RelationshipInput = {
                sourceEntityId: rel.sourceEntityId,
                targetEntityId: rel.targetEntityId,
                type: rel.type,
                inverseType: rel.inverseType,
                bidirectional: rel.type === 'CONCURRENT',
                namespace: 'temporal',
                attributes: {
                    temporalSource: true,
                    granularity: rel.granularity,
                    offsetDays: rel.offsetDays,
                },
                provenance: [provenance],
            };

            try {
                relationshipRegistry.add(input);
                persisted++;
            } catch (error) {
                console.error('Failed to persist temporal relationship:', error);
            }
        }

        return persisted;
    }

    async clearTemporalRelationships(folderId?: string): Promise<number> {
        const query = {
            namespace: 'temporal',
            sources: [RelationshipSource.TIMELINE],
        };

        const existing = relationshipRegistry.query(query);
        let removed = 0;

        for (const rel of existing) {
            if (folderId) {
                const isFromFolder = rel.provenance.some(
                    p => p.source === RelationshipSource.TIMELINE && p.originId === folderId
                );
                if (!isFromFolder) continue;
            }

            relationshipRegistry.remove(rel.id);
            removed++;
        }

        return removed;
    }

    private sortByTemporal(entities: TemporalEntity[]): TemporalEntity[] {
        return [...entities].sort((a, b) => {
            const aTime = a.temporal?.start?.timestamp?.getTime();
            const bTime = b.temporal?.start?.timestamp?.getTime();

            if (aTime !== undefined && bTime !== undefined) {
                return aTime - bTime;
            }

            const aSeq = a.temporal?.start?.sequence ?? a.sequence ?? 0;
            const bSeq = b.temporal?.start?.sequence ?? b.sequence ?? 0;

            if (aSeq !== bSeq) {
                return aSeq - bSeq;
            }

            const aCreated = a.createdAt?.getTime() ?? 0;
            const bCreated = b.createdAt?.getTime() ?? 0;
            return aCreated - bCreated;
        });
    }

    private sortFolderChildren(children: Array<Note | Folder>): Array<Note | Folder> {
        return [...children].sort((a, b) => {
            const aNote = a as Note;
            const bNote = b as Note;

            const aTemporal = (aNote as any).temporal?.start?.timestamp?.getTime();
            const bTemporal = (bNote as any).temporal?.start?.timestamp?.getTime();

            if (aTemporal !== undefined && bTemporal !== undefined) {
                return aTemporal - bTemporal;
            }

            const aSeq = (aNote as any).temporal?.start?.sequence ?? (aNote as any).sequence ?? 0;
            const bSeq = (bNote as any).temporal?.start?.sequence ?? (bNote as any).sequence ?? 0;

            if (aSeq !== bSeq) {
                return aSeq - bSeq;
            }

            const aCreated = new Date(a.createdAt || 0).getTime();
            const bCreated = new Date(b.createdAt || 0).getTime();
            return aCreated - bCreated;
        });
    }

    private compareTemporalPoints(
        a?: TemporalPoint,
        b?: TemporalPoint,
        aSeq?: number,
        bSeq?: number
    ): number | null {
        if (a?.timestamp && b?.timestamp) {
            const diff = a.timestamp.getTime() - b.timestamp.getTime();
            if (Math.abs(diff) < CONCURRENT_THRESHOLD_MS) {
                return 0;
            }
            return diff < 0 ? -1 : 1;
        }

        const aSequence = a?.sequence ?? aSeq;
        const bSequence = b?.sequence ?? bSeq;

        if (aSequence !== undefined && bSequence !== undefined) {
            if (aSequence === bSequence) return 0;
            return aSequence < bSequence ? -1 : 1;
        }

        if (a?.relativeToEventId === b?.id && a?.offsetDirection) {
            return a.offsetDirection === 'after' ? 1 : -1;
        }

        if (b?.relativeToEventId === a?.id && b?.offsetDirection) {
            return b.offsetDirection === 'after' ? -1 : 1;
        }

        return null;
    }

    private calculateConfidence(granularity: TimeGranularity): number {
        return GRANULARITY_CONFIDENCE[granularity] ?? 0.5;
    }

    private detectDuringRelationships(
        sorted: TemporalEntity[],
        relationships: TemporalRelationship[]
    ): void {
        for (const outer of sorted) {
            if (!outer.temporal?.end) continue;

            const outerStart = outer.temporal.start?.timestamp?.getTime();
            const outerEnd = outer.temporal.end?.timestamp?.getTime();

            if (outerStart === undefined || outerEnd === undefined) continue;

            for (const inner of sorted) {
                if (inner.id === outer.id) continue;

                const innerStart = inner.temporal?.start?.timestamp?.getTime();
                if (innerStart === undefined) continue;

                const innerEnd = inner.temporal?.end?.timestamp?.getTime() ?? innerStart;

                if (innerStart >= outerStart && innerEnd <= outerEnd) {
                    const granularity = inner.temporal?.start?.granularity || 'datetime';
                    relationships.push({
                        sourceEntityId: inner.id,
                        targetEntityId: outer.id,
                        type: 'DURING',
                        inverseType: 'CONTAINS_TEMPORAL',
                        confidence: this.calculateConfidence(granularity) * 0.85,
                        granularity,
                        originId: outer.id,
                        context: `${inner.name} occurs during ${outer.name}`,
                    });
                }
            }
        }
    }

    /**
     * Find temporal expressions using Aho-Corasick matcher (O(n) vs O(patterns*n) regex)
     */
    private findTemporalExpressions(content: string): Array<{
        text: string;
        position: number;
        confidence: number;
        granularity: TimeGranularity;
    }> {
        const mentions = temporalAhoMatcher.findMentions(content);

        return mentions.map(m => ({
            text: m.text,
            position: m.start,
            confidence: m.confidence,
            granularity: this.kindToGranularity(m.kind),
        })).sort((a, b) => a.position - b.position);
    }

    /**
     * Convert TemporalKind to TimeGranularity
     */
    private kindToGranularity(kind: TemporalKind): TimeGranularity {
        switch (kind) {
            case 'NARRATIVE_MARKER':
                return 'sequential';
            case 'RELATIVE':
            case 'CONNECTOR':
                return 'relative';
            case 'WEEKDAY':
            case 'MONTH':
            case 'TIME_OF_DAY':
                return 'datetime';
            default:
                return 'abstract';
        }
    }

    private inferRelationshipFromExpression(text: string): TemporalRelationshipType | null {
        const lower = text.toLowerCase();

        if (/\b(before|prior to|preceding|earlier)\b/.test(lower)) {
            return 'PRECEDES';
        }
        if (/\b(after|following|later)\b/.test(lower)) {
            return 'FOLLOWS';
        }
        if (/\b(during|while|throughout)\b/.test(lower)) {
            return 'DURING';
        }
        if (/\b(at the same time|simultaneously|meanwhile|concurrently)\b/.test(lower)) {
            return 'CONCURRENT';
        }
        if (/\b(caused|triggered|led to|resulted in)\b/.test(lower)) {
            return 'TRIGGERS';
        }
        if (/\b(because of|due to|as a result of)\b/.test(lower)) {
            return 'CAUSED_BY';
        }

        return null;
    }

    private getChildName(child: Note | Folder): string {
        return (child as Note).title || (child as Folder).name || child.id;
    }
}

let timelineExtractorInstance: TimelineRelationshipExtractor | null = null;

export function getTimelineExtractor(): TimelineRelationshipExtractor {
    if (!timelineExtractorInstance) {
        timelineExtractorInstance = new TimelineRelationshipExtractor();
    }
    return timelineExtractorInstance;
}
