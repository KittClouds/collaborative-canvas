/**
 * ScannerController - Unified Orchestration for KittCore Scanner
 * 
 * Provides a complete pipeline from text scanning to CozoDB persistence.
 * Manages:
 * - WASM scanner coordination (entities, syntax, temporal, relations)
 * - Persistence layer for CozoDB integration
 * - Entity resolution and deduplication
 * - Relationship extraction and storage
 * 
 * @module scanner-v3/controller
 */

import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';
import { unifiedRegistry, type CozoEntity, type CozoRelationship, type RelationshipProvenance } from '@/lib/cozo/graph/UnifiedRegistry';
import type { EntityKind } from '@/lib/types/entityTypes';
import type { ScanResult, EntityMatch, ExtractedRelation, TemporalMention } from './workers/ScannerWorker';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of persisting scan results to CozoDB
 */
export interface PersistenceResult {
    /** Newly created entities */
    newEntities: CozoEntity[];
    /** Existing entities that were matched */
    matchedEntities: CozoEntity[];
    /** Relationships created */
    relationships: CozoRelationship[];
    /** Temporal mentions associated */
    temporalMentions: number;
    /** Statistics */
    stats: {
        entitiesCreated: number;
        entitiesMatched: number;
        relationshipsCreated: number;
        persistTimeMs: number;
    };
}

/**
 * Options for scan and persist operation
 */
export interface ScanPersistOptions {
    /** Note ID for provenance tracking */
    noteId: string;
    /** Whether to create new entities for unmatched mentions (default: false) */
    createNewEntities?: boolean;
    /** Minimum confidence for relationship creation (default: 0.5) */
    minRelationConfidence?: number;
    /** Whether to persist temporal mentions (default: true) */
    persistTemporal?: boolean;
    /** Entity kind to assign to new entities (default: 'CONCEPT') */
    defaultEntityKind?: EntityKind;
}

/**
 * Result of entity resolution (matching mention to entity)
 */
interface EntityResolution {
    entityId: string;
    entity: CozoEntity;
    isNew: boolean;
}

// ============================================================================
// ScannerController
// ============================================================================

/**
 * Controller for scanner operations and persistence
 */
export class ScannerController {
    private entityCache: Map<string, CozoEntity> = new Map();
    private normalizedLabelCache: Map<string, string> = new Map();

    constructor() {
        // Initialize caches
    }

    // ==========================================================================
    // Public API
    // ==========================================================================

    /**
     * Process scan results and persist to CozoDB
     * 
     * @param scanResult - Results from WASM scanner
     * @param options - Persistence options
     * @returns Persistence result with created/matched entities and relationships
     */
    async persistScanResult(
        scanResult: ScanResult,
        options: ScanPersistOptions
    ): Promise<PersistenceResult> {
        const start = performance.now();

        const newEntities: CozoEntity[] = [];
        const matchedEntities: CozoEntity[] = [];
        const relationships: CozoRelationship[] = [];

        // Step 1: Resolve entities from matches
        const entityResolutions = await this.resolveEntities(
            scanResult.entities,
            options
        );

        // Categorize entities
        for (const resolution of entityResolutions.values()) {
            if (resolution.isNew) {
                newEntities.push(resolution.entity);
            } else {
                matchedEntities.push(resolution.entity);
            }
        }

        // Step 2: Create relationships from extracted relations
        if (scanResult.relations && scanResult.relations.length > 0) {
            const createdRelationships = await this.persistRelationships(
                scanResult.relations,
                entityResolutions,
                options
            );
            relationships.push(...createdRelationships);
        }

        // Step 3: Handle temporal mentions (associate with entities)
        let temporalCount = 0;
        if (options.persistTemporal !== false && scanResult.temporal) {
            temporalCount = await this.associateTemporalMentions(
                scanResult.temporal,
                scanResult.entities,
                entityResolutions,
                options.noteId
            );
        }

        const persistTimeMs = performance.now() - start;

        return {
            newEntities,
            matchedEntities,
            relationships,
            temporalMentions: temporalCount,
            stats: {
                entitiesCreated: newEntities.length,
                entitiesMatched: matchedEntities.length,
                relationshipsCreated: relationships.length,
                persistTimeMs,
            },
        };
    }

    /**
     * Clear entity caches (call when entity registry changes)
     */
    clearCache(): void {
        this.entityCache.clear();
        this.normalizedLabelCache.clear();
    }

    /**
     * Get all registered entities for scanner hydration
     */
    async getEntitiesForHydration(): Promise<RegisteredEntity[]> {
        const entities = await unifiedRegistry.getAllEntities();
        return entities.map(e => ({
            id: e.id,
            label: e.label,
            kind: e.kind,
            subtype: e.subtype,
            aliases: e.aliases || [],
            firstNote: e.firstNote,
            mentionsByNote: e.mentionsByNote || new Map(),
            totalMentions: e.totalMentions || 0,
            lastSeenDate: e.lastSeenDate || new Date(),
            createdAt: e.createdAt,
            createdBy: e.createdBy,
            attributes: e.metadata || {},
        }));
    }

    // ==========================================================================
    // Entity Resolution
    // ==========================================================================

    /**
     * Resolve entity matches to actual entities in the registry
     */
    private async resolveEntities(
        matches: EntityMatch[],
        options: ScanPersistOptions
    ): Promise<Map<string, EntityResolution>> {
        const resolutions = new Map<string, EntityResolution>();
        const { noteId, createNewEntities = false, defaultEntityKind = 'CONCEPT' } = options;

        for (const match of matches) {
            // Skip if already resolved (by entity_id)
            if (match.entity_id && resolutions.has(match.entity_id)) {
                continue;
            }

            // Try to find existing entity by ID
            if (match.entity_id) {
                const existing = await this.getEntityById(match.entity_id);
                if (existing) {
                    // Update mention count
                    await unifiedRegistry.updateNoteMentions(existing.id, noteId, 1);
                    resolutions.set(match.entity_id, {
                        entityId: existing.id,
                        entity: existing,
                        isNew: false,
                    });
                    continue;
                }
            }

            // Try to find by label
            const normalizedLabel = this.normalizeLabel(match.matched_text);
            const byLabel = await unifiedRegistry.findEntityByLabel(match.matched_text);

            if (byLabel) {
                await unifiedRegistry.updateNoteMentions(byLabel.id, noteId, 1);
                resolutions.set(byLabel.id, {
                    entityId: byLabel.id,
                    entity: byLabel,
                    isNew: false,
                });
            } else if (createNewEntities) {
                // Create new entity
                const newEntity = await unifiedRegistry.registerEntity(
                    match.matched_text,
                    defaultEntityKind,
                    noteId,
                    { metadata: { confidence: match.confidence, match_type: match.match_type } }
                );
                resolutions.set(newEntity.id, {
                    entityId: newEntity.id,
                    entity: newEntity,
                    isNew: true,
                });
            }
        }

        return resolutions;
    }

    /**
     * Get entity by ID with caching
     */
    private async getEntityById(id: string): Promise<CozoEntity | null> {
        if (this.entityCache.has(id)) {
            return this.entityCache.get(id)!;
        }

        const entity = await unifiedRegistry.getEntityById(id);
        if (entity) {
            this.entityCache.set(id, entity);
        }
        return entity;
    }

    /**
     * Normalize entity label for comparison
     */
    private normalizeLabel(label: string): string {
        if (this.normalizedLabelCache.has(label)) {
            return this.normalizedLabelCache.get(label)!;
        }
        const normalized = label.toLowerCase().trim();
        this.normalizedLabelCache.set(label, normalized);
        return normalized;
    }

    // ==========================================================================
    // Relationship Persistence
    // ==========================================================================

    /**
     * Persist extracted relationships to CozoDB
     */
    private async persistRelationships(
        relations: ExtractedRelation[],
        entityResolutions: Map<string, EntityResolution>,
        options: ScanPersistOptions
    ): Promise<CozoRelationship[]> {
        const { noteId, minRelationConfidence = 0.5 } = options;
        const created: CozoRelationship[] = [];

        for (const relation of relations) {
            // Skip low-confidence relations
            if (relation.confidence < minRelationConfidence) {
                continue;
            }

            // Find source and target entities
            const sourceEntity = this.findEntityByLabel(relation.head_entity, entityResolutions);
            const targetEntity = this.findEntityByLabel(relation.tail_entity, entityResolutions);

            if (!sourceEntity || !targetEntity) {
                // Can't create relationship without both entities
                continue;
            }

            // Skip self-relationships
            if (sourceEntity.entityId === targetEntity.entityId) {
                continue;
            }

            // Create provenance
            const provenance: RelationshipProvenance = {
                source: 'pattern',
                originId: noteId,
                confidence: relation.confidence,
                timestamp: new Date(),
                context: relation.pattern_matched,
            };

            // Create relationship
            const relationship = await unifiedRegistry.addRelationship(
                sourceEntity.entityId,
                targetEntity.entityId,
                relation.relation_type,
                provenance,
                {
                    bidirectional: false, // RelationCortex handles direction
                    attributes: {
                        pattern_matched: relation.pattern_matched,
                        pattern_start: relation.pattern_start,
                        pattern_end: relation.pattern_end,
                    },
                }
            );

            created.push(relationship);
        }

        return created;
    }

    /**
     * Find entity by label in resolutions map
     */
    private findEntityByLabel(
        label: string,
        resolutions: Map<string, EntityResolution>
    ): EntityResolution | undefined {
        const normalizedLabel = this.normalizeLabel(label);

        for (const resolution of resolutions.values()) {
            if (this.normalizeLabel(resolution.entity.label) === normalizedLabel) {
                return resolution;
            }
            // Check aliases
            if (resolution.entity.aliases) {
                for (const alias of resolution.entity.aliases) {
                    if (this.normalizeLabel(alias) === normalizedLabel) {
                        return resolution;
                    }
                }
            }
        }

        return undefined;
    }

    // ==========================================================================
    // Temporal Association
    // ==========================================================================

    /**
     * Associate temporal mentions with entities
     */
    private async associateTemporalMentions(
        temporalMentions: TemporalMention[],
        entityMatches: EntityMatch[],
        entityResolutions: Map<string, EntityResolution>,
        noteId: string
    ): Promise<number> {
        let count = 0;

        for (const temporal of temporalMentions) {
            // Find entities near this temporal mention
            const nearbyEntities = this.findNearbyEntities(
                temporal.start,
                temporal.end,
                entityMatches,
                100 // Max distance in characters
            );

            for (const match of nearbyEntities) {
                if (match.entity_id) {
                    const resolution = entityResolutions.get(match.entity_id);
                    if (resolution) {
                        // Store temporal association as metadata
                        await unifiedRegistry.setEntityMetadata(
                            resolution.entityId,
                            `temporal_${noteId}_${temporal.start}`,
                            {
                                kind: temporal.kind,
                                text: temporal.text,
                                start: temporal.start,
                                end: temporal.end,
                                confidence: temporal.confidence,
                                metadata: temporal.metadata,
                            }
                        );
                        count++;
                    }
                }
            }
        }

        return count;
    }

    /**
     * Find entities near a text position
     */
    private findNearbyEntities(
        start: number,
        end: number,
        matches: EntityMatch[],
        maxDistance: number
    ): EntityMatch[] {
        return matches.filter(match => {
            // Check if entity is within maxDistance of the temporal mention
            const distance = Math.min(
                Math.abs(match.start - end),
                Math.abs(match.end - start)
            );
            return distance <= maxDistance;
        });
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const scannerController = new ScannerController();
