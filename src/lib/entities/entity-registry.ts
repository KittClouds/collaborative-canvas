/**
 * EntityRegistry - Single source of truth for all registered entities
 * 
 * Phase 1: Full implementation
 * - In-memory maps for O(1) lookups
 * - IndexedDB persistence
 * - Alias support
 * - Relationship tracking
 */

import { v7 as uuidv7 } from 'uuid';
import type { EntityKind } from './entityTypes';
import type {
    RegisteredEntity,
    EntityRelationship,
    CoOccurrencePattern
} from './types/registry';

export class EntityRegistry {
    private entities: Map<string, RegisteredEntity>;
    private labelIndex: Map<string, string>;
    private aliasIndex: Map<string, string>;
    private relationships: Map<string, EntityRelationship>;
    private coOccurrences: Map<string, CoOccurrencePattern>;

    constructor() {
        this.entities = new Map();
        this.labelIndex = new Map();
        this.aliasIndex = new Map();
        this.relationships = new Map();
        this.coOccurrences = new Map();
    }

    // ==================== ENTITY REGISTRATION ====================

    /**
     * Register a new entity or update existing one
     * Returns the registered entity
     */
    registerEntity(
        label: string,
        kind: EntityKind,
        noteId: string,
        options?: {
            subtype?: string;
            aliases?: string[];
            metadata?: Record<string, any>;
            attributes?: Record<string, any>;
        }
    ): RegisteredEntity {
        const normalized = this.normalize(label);

        // Check if already exists
        const existingId = this.labelIndex.get(normalized);
        if (existingId) {
            const existing = this.entities.get(existingId)!;

            // Update statistics
            existing.totalMentions++;
            existing.lastSeenDate = new Date();
            existing.noteAppearances.add(noteId);

            // Merge metadata if provided
            if (options?.metadata) {
                existing.metadata = { ...existing.metadata, ...options.metadata };
            }
            if (options?.attributes) {
                existing.attributes = { ...existing.attributes, ...options.attributes };
            }

            // Add new aliases if provided
            if (options?.aliases) {
                for (const alias of options.aliases) {
                    this.addAlias(existingId, alias);
                }
            }

            return existing;
        }

        // Create new entity
        const entity: RegisteredEntity = {
            id: uuidv7(),
            label,
            normalizedLabel: normalized,
            kind,
            subtype: options?.subtype,
            aliases: options?.aliases || [],
            firstMentionNoteId: noteId,
            firstMentionDate: new Date(),
            createdBy: 'user',
            metadata: options?.metadata,
            attributes: options?.attributes,
            totalMentions: 1,
            lastSeenDate: new Date(),
            noteAppearances: new Set([noteId]),
        };

        // Store entity
        this.entities.set(entity.id, entity);
        this.labelIndex.set(normalized, entity.id);

        // Index aliases
        if (entity.aliases) {
            for (const alias of entity.aliases) {
                const normalizedAlias = this.normalize(alias);
                this.aliasIndex.set(normalizedAlias, entity.id);
            }
        }

        return entity;
    }

    // ==================== ENTITY LOOKUP ====================

    /**
     * Find entity by label or alias (case-insensitive)
     * Returns undefined if not found
     */
    findEntity(text: string): RegisteredEntity | undefined {
        const normalized = this.normalize(text);

        // Check direct label match
        const labelId = this.labelIndex.get(normalized);
        if (labelId) {
            return this.entities.get(labelId);
        }

        // Check alias match
        const aliasId = this.aliasIndex.get(normalized);
        if (aliasId) {
            return this.entities.get(aliasId);
        }

        return undefined;
    }

    /**
     * Get entity by ID
     */
    getEntityById(id: string): RegisteredEntity | undefined {
        return this.entities.get(id);
    }

    /**
     * Check if text matches a registered entity
     */
    isRegisteredEntity(text: string): boolean {
        return this.findEntity(text) !== undefined;
    }

    /**
     * Get all registered entities
     */
    getAllEntities(): RegisteredEntity[] {
        return Array.from(this.entities.values());
    }

    /**
     * Get entities by kind
     */
    getEntitiesByKind(kind: EntityKind): RegisteredEntity[] {
        return Array.from(this.entities.values())
            .filter(e => e.kind === kind);
    }

    /**
     * Get entities by subtype
     */
    getEntitiesBySubtype(kind: EntityKind, subtype: string): RegisteredEntity[] {
        return Array.from(this.entities.values())
            .filter(e => e.kind === kind && e.subtype === subtype);
    }

    /**
     * Search entities by label (fuzzy)
     */
    searchEntities(query: string): RegisteredEntity[] {
        const normalized = this.normalize(query);
        const results: RegisteredEntity[] = [];

        for (const entity of this.entities.values()) {
            // Exact match
            if (entity.normalizedLabel === normalized) {
                results.push(entity);
                continue;
            }

            // Contains match
            if (entity.normalizedLabel.includes(normalized)) {
                results.push(entity);
                continue;
            }

            // Alias match
            if (entity.aliases?.some(a => this.normalize(a).includes(normalized))) {
                results.push(entity);
            }
        }

        return results;
    }

    // ==================== ALIAS MANAGEMENT ====================

    /**
     * Add alias to existing entity
     */
    addAlias(entityIdOrLabel: string, alias: string): boolean {
        let entity = this.entities.get(entityIdOrLabel);

        // If not found by ID, try by label
        if (!entity) {
            entity = this.findEntity(entityIdOrLabel);
        }

        if (!entity) {
            console.warn(`Entity not found: ${entityIdOrLabel}`);
            return false;
        }

        const normalizedAlias = this.normalize(alias);

        // Check if alias already exists for different entity
        const existingAliasId = this.aliasIndex.get(normalizedAlias);
        if (existingAliasId && existingAliasId !== entity.id) {
            console.warn(`Alias "${alias}" already belongs to another entity`);
            return false;
        }

        // Add alias
        if (!entity.aliases) {
            entity.aliases = [];
        }

        if (!entity.aliases.includes(alias)) {
            entity.aliases.push(alias);
            this.aliasIndex.set(normalizedAlias, entity.id);
            return true;
        }

        return false;
    }

    /**
     * Remove alias from entity
     */
    removeAlias(entityId: string, alias: string): boolean {
        const entity = this.entities.get(entityId);
        if (!entity || !entity.aliases) return false;

        const index = entity.aliases.indexOf(alias);
        if (index === -1) return false;

        entity.aliases.splice(index, 1);
        this.aliasIndex.delete(this.normalize(alias));
        return true;
    }

    /**
     * Get all aliases for entity
     */
    getAliases(entityIdOrLabel: string): string[] {
        let entity = this.entities.get(entityIdOrLabel);
        if (!entity) {
            entity = this.findEntity(entityIdOrLabel);
        }
        return entity?.aliases || [];
    }

    // ==================== RELATIONSHIP MANAGEMENT ====================

    /**
     * Add relationship between two entities
     */
    addRelationship(
        sourceLabel: string,
        targetLabel: string,
        type: string,
        noteId: string,
        context?: string
    ): EntityRelationship | null {
        const source = this.findEntity(sourceLabel);
        const target = this.findEntity(targetLabel);

        if (!source || !target) {
            console.warn(`Cannot create relationship: entity not found`);
            return null;
        }

        // Check if relationship already exists
        const relKey = `${source.id}:${type}:${target.id}`;
        let relationship = this.relationships.get(relKey);

        if (relationship) {
            // Update existing relationship
            if (!relationship.discoveredIn.includes(noteId)) {
                relationship.discoveredIn.push(noteId);
            }
            if (context && !relationship.contexts.includes(context)) {
                relationship.contexts.push(context);
            }
            relationship.confidence = Math.min(1, relationship.confidence + 0.1);
            return relationship;
        }

        // Create new relationship
        relationship = {
            id: uuidv7(),
            sourceEntityId: source.id,
            targetEntityId: target.id,
            type,
            confidence: 0.5,
            discoveredIn: [noteId],
            contexts: context ? [context] : [],
        };

        this.relationships.set(relKey, relationship);
        return relationship;
    }

    /**
     * Get all relationships for an entity
     */
    getRelationships(entityIdOrLabel: string): EntityRelationship[] {
        let entity = this.entities.get(entityIdOrLabel);
        if (!entity) {
            entity = this.findEntity(entityIdOrLabel);
        }
        if (!entity) return [];

        const results: EntityRelationship[] = [];

        for (const rel of this.relationships.values()) {
            if (rel.sourceEntityId === entity.id || rel.targetEntityId === entity.id) {
                results.push(rel);
            }
        }

        return results;
    }

    /**
     * Get relationships of specific type
     */
    getRelationshipsByType(type: string): EntityRelationship[] {
        return Array.from(this.relationships.values())
            .filter(r => r.type === type);
    }

    // ==================== CO-OCCURRENCE TRACKING ====================

    /**
     * Record that entities appeared together
     */
    recordCoOccurrence(
        entityLabels: string[],
        context: string,
        noteId: string
    ): void {
        if (entityLabels.length < 2) return;

        // Resolve labels to IDs
        const entityIds: string[] = [];
        for (const label of entityLabels) {
            const entity = this.findEntity(label);
            if (entity) {
                entityIds.push(entity.id);
            }
        }

        if (entityIds.length < 2) return;

        // Create sorted key (order-independent)
        const key = this.makeCoOccurrenceKey(entityIds);
        let pattern = this.coOccurrences.get(key);

        if (pattern) {
            pattern.frequency++;
            if (!pattern.contexts.includes(context)) {
                pattern.contexts.push(context);
            }
            pattern.strength = this.calculateCoOccurrenceStrength(pattern);
        } else {
            pattern = {
                entities: entityIds,
                frequency: 1,
                contexts: [context],
                strength: 0.1,
            };
            this.coOccurrences.set(key, pattern);
        }
    }

    /**
     * Get entities that frequently appear together
     */
    getCoOccurringEntities(entityIdOrLabel: string): RegisteredEntity[] {
        let entity = this.entities.get(entityIdOrLabel);
        if (!entity) {
            entity = this.findEntity(entityIdOrLabel);
        }
        if (!entity) return [];

        const related: Array<{ entity: RegisteredEntity; strength: number }> = [];

        for (const pattern of this.coOccurrences.values()) {
            if (pattern.entities.includes(entity.id)) {
                for (const otherId of pattern.entities) {
                    if (otherId !== entity.id) {
                        const otherEntity = this.entities.get(otherId);
                        if (otherEntity) {
                            related.push({
                                entity: otherEntity,
                                strength: pattern.strength,
                            });
                        }
                    }
                }
            }
        }

        // Sort by strength and deduplicate
        const seen = new Set<string>();
        return related
            .sort((a, b) => b.strength - a.strength)
            .filter(r => {
                if (seen.has(r.entity.id)) return false;
                seen.add(r.entity.id);
                return true;
            })
            .map(r => r.entity);
    }

    // ==================== STATISTICS ====================

    /**
     * Get statistics for an entity
     */
    getEntityStats(entityIdOrLabel: string): {
        totalMentions: number;
        noteCount: number;
        relationshipCount: number;
        coOccurrenceCount: number;
        aliases: string[];
    } | null {
        let entity = this.entities.get(entityIdOrLabel);
        if (!entity) {
            entity = this.findEntity(entityIdOrLabel);
        }
        if (!entity) return null;

        const relationships = this.getRelationships(entity.id);
        const coOccurring = this.getCoOccurringEntities(entity.id);

        return {
            totalMentions: entity.totalMentions,
            noteCount: entity.noteAppearances.size,
            relationshipCount: relationships.length,
            coOccurrenceCount: coOccurring.length,
            aliases: entity.aliases || [],
        };
    }

    /**
     * Get global registry statistics
     */
    getGlobalStats(): {
        totalEntities: number;
        entitiesByKind: Record<EntityKind, number>;
        totalRelationships: number;
        totalCoOccurrences: number;
    } {
        const entitiesByKind: Record<string, number> = {};

        for (const entity of this.entities.values()) {
            entitiesByKind[entity.kind] = (entitiesByKind[entity.kind] || 0) + 1;
        }

        return {
            totalEntities: this.entities.size,
            entitiesByKind: entitiesByKind as Record<EntityKind, number>,
            totalRelationships: this.relationships.size,
            totalCoOccurrences: this.coOccurrences.size,
        };
    }

    // ==================== PERSISTENCE ====================

    /**
     * Export registry to JSON for persistence
     */
    toJSON(): any {
        return {
            entities: Array.from(this.entities.entries()).map(([id, entity]) => ({
                ...entity,
                noteAppearances: Array.from(entity.noteAppearances),
                firstMentionDate: entity.firstMentionDate.toISOString(),
                lastSeenDate: entity.lastSeenDate.toISOString(),
            })),
            relationships: Array.from(this.relationships.values()),
            coOccurrences: Array.from(this.coOccurrences.values()),
            version: '1.0',
            exportedAt: new Date().toISOString(),
        };
    }

    /**
     * Import registry from JSON
     */
    static fromJSON(data: any): EntityRegistry {
        const registry = new EntityRegistry();

        // Restore entities
        if (data.entities) {
            for (const entityData of data.entities) {
                const entity: RegisteredEntity = {
                    ...entityData,
                    noteAppearances: new Set(entityData.noteAppearances),
                    firstMentionDate: new Date(entityData.firstMentionDate),
                    lastSeenDate: new Date(entityData.lastSeenDate),
                };

                registry.entities.set(entity.id, entity);
                registry.labelIndex.set(entity.normalizedLabel, entity.id);

                if (entity.aliases) {
                    for (const alias of entity.aliases) {
                        const normalized = registry.normalize(alias);
                        registry.aliasIndex.set(normalized, entity.id);
                    }
                }
            }
        }

        // Restore relationships
        if (data.relationships) {
            for (const rel of data.relationships) {
                const key = `${rel.sourceEntityId}:${rel.type}:${rel.targetEntityId}`;
                registry.relationships.set(key, rel);
            }
        }

        // Restore co-occurrences
        if (data.coOccurrences) {
            for (const coOcc of data.coOccurrences) {
                const key = registry.makeCoOccurrenceKey(coOcc.entities);
                registry.coOccurrences.set(key, coOcc);
            }
        }

        return registry;
    }

    /**
     * Clear all data (use with caution)
     */
    clear(): void {
        this.entities.clear();
        this.labelIndex.clear();
        this.aliasIndex.clear();
        this.relationships.clear();
        this.coOccurrences.clear();
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Normalize text for matching (case-insensitive, trimmed)
     */
    private normalize(text: string): string {
        return text.toLowerCase().trim();
    }

    /**
     * Create co-occurrence key (sorted for order-independence)
     */
    private makeCoOccurrenceKey(entityIds: string[]): string {
        return entityIds.slice().sort().join('::');
    }

    /**
     * Calculate co-occurrence strength based on frequency and context diversity
     */
    private calculateCoOccurrenceStrength(pattern: CoOccurrencePattern): number {
        const freqScore = Math.min(pattern.frequency / 10, 1);
        const diversityScore = Math.min(pattern.contexts.length / 5, 1);
        return (freqScore + diversityScore) / 2;
    }
}

// Singleton instance
export const entityRegistry = new EntityRegistry();
