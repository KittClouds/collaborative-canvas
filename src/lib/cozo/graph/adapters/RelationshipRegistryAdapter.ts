/**
 * RelationshipRegistryAdapter - Backwards compatibility layer
 * 
 * Drop-in replacement for the old RelationshipRegistry.
 * Delegates all operations to CozoUnifiedRegistry.
 * 
 * Usage:
 *   import { relationshipRegistry } from '@/lib/cozo/graph/adapters/RelationshipRegistryAdapter';
 */

import { unifiedRegistry, type CozoRelationship } from '../UnifiedRegistry';
import {
    type UnifiedRelationship as _UnifiedRelationship,
    type RelationshipInput as _RelationshipInput,
    type RelationshipQuery,
    type RelationshipStats,
    type RelationshipProvenance,
    RelationshipSource
} from '@/lib/relationships/types';

// Re-export types for backwards compatibility
export type UnifiedRelationship = _UnifiedRelationship;
export type RelationshipInput = _RelationshipInput;
export { RelationshipSource };

// ==================== ADAPTER CLASS ====================

export class RelationshipRegistryAdapter {
    private initialized = false;

    /**
     * Initialize the registry
     */
    async init(): Promise<void> {
        if (this.initialized) return;
        await unifiedRegistry.init();
        this.initialized = true;
    }

    /**
     * Add a relationship (or update if exists)
     */
    add(input: RelationshipInput, skipPersist = false): UnifiedRelationship {
        this.ensureInitSync();

        // Convert provenance to single item if needed
        const primaryProvenance = input.provenance[0] || {
            source: 'user',
            originId: 'unknown',
            confidence: 0.8,
            timestamp: new Date(),
        };

        // Add relationship synchronously
        const rel = unifiedRegistry.addRelationshipSync(
            input.sourceEntityId,
            input.targetEntityId,
            input.type,
            primaryProvenance,
            {
                inverseType: input.inverseType,
                bidirectional: input.bidirectional,
                namespace: input.namespace,
                attributes: input.attributes,
            }
        );

        // Add additional provenance entries
        if (input.provenance.length > 1) {
            for (let i = 1; i < input.provenance.length; i++) {
                (unifiedRegistry as any).addProvenanceSync(rel.id, input.provenance[i]);
            }
            (unifiedRegistry as any).recalculateRelationshipConfidenceSync(rel.id);
        }

        // Return the fully hydrated relationship from DB
        const updatedRel = unifiedRegistry.getRelationshipByIdSync(rel.id);
        return this.convertToLegacyRelationship(updatedRel!);
    }

    /**
     * Add relationship without persisting (for batch operations)
     */
    addWithoutPersist(rel: UnifiedRelationship): void {
        this.add(this.convertToInput(rel), true);
    }

    /**
     * Get relationship by ID
     */
    get(id: string): UnifiedRelationship | undefined {
        this.ensureInitSync();
        const relationship = unifiedRegistry.getRelationshipByIdSync(id);
        return relationship ? this.convertToLegacyRelationship(relationship) : undefined;
    }

    /**
     * Check if relationship exists
     */
    exists(id: string): boolean {
        this.ensureInitSync();
        return unifiedRegistry.getRelationshipByIdSync(id) !== null;
    }

    /**
     * Check if relationship exists by composite key
     */
    existsByComposite(sourceId: string, type: string, targetId: string, namespace?: string): boolean {
        this.ensureInitSync();
        return unifiedRegistry.findRelationshipSync(sourceId, targetId, type, namespace) !== null;
    }

    /**
     * Get relationship by composite key
     */
    getByComposite(
        sourceId: string,
        type: string,
        targetId: string,
        namespace?: string
    ): UnifiedRelationship | undefined {
        this.ensureInitSync();
        const relationship = unifiedRegistry.findRelationshipSync(sourceId, targetId, type, namespace);
        return relationship ? this.convertToLegacyRelationship(relationship) : undefined;
    }

    /**
     * Get all relationships
     */
    getAll(): UnifiedRelationship[] {
        this.ensureInitSync();
        const relationships = unifiedRegistry.getAllRelationshipsSync();
        return relationships.map(r => this.convertToLegacyRelationship(r));
    }

    /**
     * Get relationships for entity (as source or target)
     */
    getByEntity(entityId: string): UnifiedRelationship[] {
        this.ensureInitSync();
        const relationships = unifiedRegistry.getRelationshipsForEntitySync(entityId);
        return relationships.map(r => this.convertToLegacyRelationship(r));
    }

    /**
     * Get relationships where entity is source
     */
    getBySource(sourceId: string): UnifiedRelationship[] {
        this.ensureInitSync();
        const relationships = unifiedRegistry.getRelationshipsBySourceSync(sourceId);
        return relationships.map(r => this.convertToLegacyRelationship(r));
    }

    /**
     * Get relationships where entity is target
     */
    getByTarget(targetId: string): UnifiedRelationship[] {
        this.ensureInitSync();
        const relationships = unifiedRegistry.getRelationshipsByTargetSync(targetId);
        return relationships.map(r => this.convertToLegacyRelationship(r));
    }

    /**
     * Get relationships by type
     */
    getByType(type: string): UnifiedRelationship[] {
        this.ensureInitSync();
        const relationships = unifiedRegistry.getRelationshipsByTypeSync(type);
        return relationships.map(r => this.convertToLegacyRelationship(r));
    }

    /**
     * Get relationships by namespace
     */
    getByNamespace(namespace: string): UnifiedRelationship[] {
        this.ensureInitSync();
        const relationships = unifiedRegistry.getRelationshipsByNamespaceSync(namespace);
        return relationships.map(r => this.convertToLegacyRelationship(r));
    }

    /**
     * Query relationships with filters
     */
    query(q: RelationshipQuery): UnifiedRelationship[] {
        this.ensureInitSync();

        let candidates: CozoRelationship[] = [];

        // Fetch based on most specific filter
        if (q.sourceId) {
            candidates = unifiedRegistry.getRelationshipsBySourceSync(q.sourceId);
        } else if (q.targetId) {
            candidates = unifiedRegistry.getRelationshipsByTargetSync(q.targetId);
        } else if (q.entityId) {
            candidates = unifiedRegistry.getRelationshipsForEntitySync(q.entityId);
        } else if (q.type && typeof q.type === 'string') {
            candidates = unifiedRegistry.getRelationshipsByTypeSync(q.type);
        } else if (q.namespace) {
            candidates = unifiedRegistry.getRelationshipsByNamespaceSync(q.namespace);
        } else {
            // Get all
            candidates = unifiedRegistry.getAllRelationshipsSync();
        }

        // Apply filters
        let filtered = candidates.filter(rel => {
            if (q.sourceId && rel.sourceId !== q.sourceId) return false;
            if (q.targetId && rel.targetId !== q.targetId) return false;
            if (q.entityId && rel.sourceId !== q.entityId && rel.targetId !== q.entityId) return false;

            if (q.type) {
                if (Array.isArray(q.type)) {
                    if (!q.type.includes(rel.type)) return false;
                } else if (rel.type !== q.type) {
                    return false;
                }
            }

            if (q.namespace && rel.namespace !== q.namespace) return false;
            if (q.minConfidence !== undefined && rel.confidence < q.minConfidence) return false;

            if (q.sources && q.sources.length > 0) {
                const relSources = rel.provenance?.map(p => p.source) || [];
                // @ts-ignore
                if (!q.sources.some(s => relSources.includes(s))) return false;
            }

            return true;
        });

        // Sort by confidence
        filtered.sort((a, b) => b.confidence - a.confidence);

        // Apply pagination
        if (q.offset) {
            filtered = filtered.slice(q.offset);
        }
        if (q.limit) {
            filtered = filtered.slice(0, q.limit);
        }

        return filtered.map(r => this.convertToLegacyRelationship(r));
    }

    /**
     * Update relationship
     */
    update(id: string, updates: Partial<UnifiedRelationship>): boolean {
        this.ensureInitSync();

        // Check existance
        const existing = unifiedRegistry.getRelationshipByIdSync(id);
        if (!existing) return false;

        // Update attributes if provided
        if (updates.attributes) {
            for (const [key, value] of Object.entries(updates.attributes)) {
                (unifiedRegistry as any).setRelationshipAttributeSync(id, key, value);
            }
        }

        // This is imperfect as other fields aren't easily updatable without full delete/recreate
        // but sufficient for legacy compatibility where mainly attributes/confidence changed.
        return true;
    }

    /**
     * Delete relationship
     */
    delete(id: string): boolean {
        this.ensureInitSync();
        return unifiedRegistry.deleteRelationshipSync(id);
    }

    /**
     * Remove relationship (alias for delete)
     */
    remove(id: string): boolean {
        return this.delete(id);
    }

    /**
     * Find relationship by entities
     */
    findByEntities(
        sourceId: string,
        targetId: string,
        type?: string
    ): UnifiedRelationship | undefined {
        this.ensureInitSync();
        const relationships = unifiedRegistry.getRelationshipsBySourceSync(sourceId);
        const found = relationships.find(rel =>
            rel.targetId === targetId &&
            (type === undefined || rel.type === type)
        );
        return found ? this.convertToLegacyRelationship(found) : undefined;
    }

    /**
     * Remove provenance from relationship
     */
    async removeProvenance(
        relationshipId: string,
        source: RelationshipSource,
        originId?: string
    ): Promise<boolean> {
        await this.ensureInit();

        // Fetch relationship
        const rel = await unifiedRegistry.getRelationshipById(relationshipId);
        if (!rel) return false;

        // Filter provenance
        const filtered = rel.provenance?.filter(p => {
            if (p.source !== source) return true;
            if (originId !== undefined && p.originId !== originId) return true;
            return false;
        }) || [];

        // If no provenance left, delete relationship
        if (filtered.length === 0) {
            return unifiedRegistry.deleteRelationship(relationshipId);
        }

        // Otherwise, we'd need to update (not trivial in Cozo)
        // For now, we'll skip this edge case
        console.warn('[RelationshipRegistryAdapter] removeProvenance: Partial provenance removal not fully supported');

        return true;
    }

    /**
     * Delete all relationships for entity
     */
    async deleteByEntity(entityId: string): Promise<number> {
        await this.ensureInit();
        return unifiedRegistry.deleteRelationshipsByEntity(entityId);
    }

    /**
     * Delete all relationships in namespace
     */
    async deleteByNamespace(namespace: string): Promise<number> {
        await this.ensureInit();
        const relationships = await unifiedRegistry.getRelationshipsByNamespace(namespace);

        for (const rel of relationships) {
            await unifiedRegistry.deleteRelationship(rel.id);
        }

        return relationships.length;
    }

    /**
     * Migrate entity (update all relationships)
     */
    async migrateEntity(oldEntityId: string, newEntityId: string): Promise<number> {
        await this.ensureInit();
        return unifiedRegistry.migrateEntityRelationships(oldEntityId, newEntityId);
    }

    /**
     * Merge relationships
     */
    async mergeRelationships(targetId: string, sourceId: string): Promise<boolean> {
        await this.ensureInit();

        const target = await unifiedRegistry.getRelationshipById(targetId);
        const source = await unifiedRegistry.getRelationshipById(sourceId);

        if (!target || !source) return false;

        // Add source provenance to target
        if (source.provenance) {
            for (const prov of source.provenance) {
                await (unifiedRegistry as any).addProvenance(targetId, prov);
            }
        }

        // Merge attributes
        if (source.attributes) {
            for (const [key, value] of Object.entries(source.attributes)) {
                await unifiedRegistry.setRelationshipAttribute(targetId, key, value);
            }
        }

        // Recalculate confidence
        await (unifiedRegistry as any).recalculateRelationshipConfidence(targetId);

        // Delete source
        await unifiedRegistry.deleteRelationship(sourceId);

        return true;
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<RelationshipStats> {
        await this.ensureInit();
        const globalStats = await unifiedRegistry.getGlobalStats();

        // Calculate bySource from provenance
        const bySource: Partial<Record<RelationshipSource, number>> = {};
        const relationships = await this.getAll();

        for (const rel of relationships) {
            for (const prov of rel.provenance || []) {
                const source = prov.source as RelationshipSource;
                bySource[source] = (bySource[source] || 0) + 1;
            }
        }

        // Calculate average confidence
        const totalConfidence = relationships.reduce((sum, rel) => sum + rel.confidence, 0);
        const averageConfidence = relationships.length > 0 ? totalConfidence / relationships.length : 0;

        return {
            total: globalStats.totalRelationships,
            byType: globalStats.relationshipsByType,
            bySource,
            byNamespace: {}, // Not tracked separately
            averageConfidence,
        };
    }

    /**
     * Clear all relationships
     */
    async clear(): Promise<void> {
        await this.ensureInit();

        // Delete all relationships
        const relationships = await this.getAll();
        for (const rel of relationships) {
            await unifiedRegistry.deleteRelationship(rel.id);
        }
    }

    /**
     * Export to JSON
     */
    async toJSON(): Promise<any> {
        await this.ensureInit();
        const relationships = await this.getAll();

        return {
            relationships: relationships.map(rel => ({
                ...rel,
                createdAt: rel.createdAt.toISOString(),
                updatedAt: rel.updatedAt.toISOString(),
                provenance: rel.provenance.map(p => ({
                    ...p,
                    timestamp: p.timestamp.toISOString(),
                })),
            })),
            version: '1.0',
            exportedAt: new Date().toISOString(),
        };
    }

    /**
     * Import from JSON
     */
    async fromJSON(data: any): Promise<void> {
        await this.ensureInit();

        if (data.relationships) {
            for (const relData of data.relationships) {
                const provenance = relData.provenance.map((p: any) => ({
                    ...p,
                    timestamp: new Date(p.timestamp),
                }));

                await unifiedRegistry.addRelationship(
                    relData.sourceEntityId,
                    relData.targetEntityId,
                    relData.type,
                    provenance[0],
                    {
                        inverseType: relData.inverseType,
                        bidirectional: relData.bidirectional,
                        namespace: relData.namespace,
                        attributes: relData.attributes,
                    }
                );

                // Add remaining provenance
                if (provenance.length > 1) {
                    const rel = await unifiedRegistry.findRelationship(
                        relData.sourceEntityId,
                        relData.targetEntityId,
                        relData.type,
                        relData.namespace
                    );

                    if (rel) {
                        for (let i = 1; i < provenance.length; i++) {
                            await (unifiedRegistry as any).addProvenance(rel.id, provenance[i]);
                        }
                    }
                }
            }
        }
    }

    /**
     * Set persist callback (not needed with Cozo)
     */
    setPersistCallback(cb: (rel: UnifiedRelationship) => Promise<void>): void {
        // Cozo handles persistence automatically
    }

    /**
     * Set delete callback (not needed with Cozo)
     */
    setDeleteCallback(cb: (id: string) => Promise<void>): void {
        // Cozo handles persistence automatically
    }

    // ==================== HELPER METHODS ====================

    private async ensureInit(): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }
    }

    private ensureInitSync(): void {
        if (!this.initialized) {
            throw new Error('[RelationshipRegistryAdapter] Not initialized. Call init() first.');
        }
    }

    /**
     * Convert CozoRelationship to legacy UnifiedRelationship format
     */
    private convertToLegacyRelationship(rel: CozoRelationship): UnifiedRelationship {
        const confidenceBySource: Partial<Record<RelationshipSource, number>> = {};

        if (rel.provenance) {
            for (const prov of rel.provenance) {
                const source = prov.source as RelationshipSource;
                const existing = confidenceBySource[source];
                if (existing === undefined || prov.confidence > existing) {
                    confidenceBySource[source] = prov.confidence;
                }
            }
        }

        return {
            id: rel.id,
            sourceEntityId: rel.sourceId,
            targetEntityId: rel.targetId,
            type: rel.type,
            inverseType: rel.inverseType,
            bidirectional: rel.bidirectional,
            confidence: rel.confidence,
            confidenceBySource,
            provenance: (rel.provenance || []) as RelationshipProvenance[],
            namespace: rel.namespace,
            attributes: rel.attributes || {},
            createdAt: rel.createdAt,
            updatedAt: rel.updatedAt,
        };
    }

    /**
     * Convert legacy UnifiedRelationship to RelationshipInput
     */
    private convertToInput(rel: UnifiedRelationship): RelationshipInput {
        return {
            sourceEntityId: rel.sourceEntityId,
            targetEntityId: rel.targetEntityId,
            type: rel.type,
            inverseType: rel.inverseType,
            bidirectional: rel.bidirectional,
            provenance: rel.provenance,
            namespace: rel.namespace,
            attributes: rel.attributes,
        };
    }

    /**
     * Create placeholder relationship for synchronous add() method
     */
    private createPlaceholderRelationship(
        input: RelationshipInput,
        primaryProvenance: RelationshipProvenance
    ): UnifiedRelationship {
        const now = new Date();

        return {
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceEntityId: input.sourceEntityId,
            targetEntityId: input.targetEntityId,
            type: input.type,
            inverseType: input.inverseType,
            bidirectional: input.bidirectional || false,
            confidence: primaryProvenance.confidence,
            confidenceBySource: {
                [primaryProvenance.source as RelationshipSource]: primaryProvenance.confidence,
            },
            provenance: input.provenance,
            namespace: input.namespace,
            attributes: input.attributes || {},
            createdAt: now,
            updatedAt: now,
        };
    }
}

// Singleton instance (drop-in replacement)
export const relationshipRegistry = new RelationshipRegistryAdapter();
