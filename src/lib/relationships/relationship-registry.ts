/**
 * RelationshipRegistry - Unified relationship management
 * 
 * Central registry for all relationships with:
 * - Multi-source aggregation
 * - Confidence scoring
 * - Provenance tracking
 * - O(1) lookups via index structures
 */

import { generateId } from '@/lib/utils/ids';
import {
    type UnifiedRelationship,
    type RelationshipQuery,
    type RelationshipInput,
    type RelationshipProvenance,
    type RelationshipStats,
    RelationshipSource,
    SOURCE_WEIGHTS
} from './types';

export class RelationshipRegistry {
    private relationships: Map<string, UnifiedRelationship> = new Map();
    private sourceIndex: Map<string, Set<string>> = new Map();
    private targetIndex: Map<string, Set<string>> = new Map();
    private typeIndex: Map<string, Set<string>> = new Map();
    private namespaceIndex: Map<string, Set<string>> = new Map();
    private compositeIndex: Map<string, string> = new Map();

    private persistCallback?: (rel: UnifiedRelationship) => Promise<void>;
    private deleteCallback?: (id: string) => Promise<void>;

    setPersistCallback(cb: (rel: UnifiedRelationship) => Promise<void>): void {
        this.persistCallback = cb;
    }

    setDeleteCallback(cb: (id: string) => Promise<void>): void {
        this.deleteCallback = cb;
    }

    private makeCompositeKey(sourceId: string, type: string, targetId: string, namespace?: string): string {
        return `${sourceId}:${type}:${targetId}:${namespace || ''}`;
    }

    private addToIndex(index: Map<string, Set<string>>, key: string, relId: string): void {
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        index.get(key)!.add(relId);
    }

    private removeFromIndex(index: Map<string, Set<string>>, key: string, relId: string): void {
        const set = index.get(key);
        if (set) {
            set.delete(relId);
            if (set.size === 0) {
                index.delete(key);
            }
        }
    }

    private indexRelationship(rel: UnifiedRelationship): void {
        this.addToIndex(this.sourceIndex, rel.sourceEntityId, rel.id);
        this.addToIndex(this.targetIndex, rel.targetEntityId, rel.id);
        this.addToIndex(this.typeIndex, rel.type, rel.id);
        if (rel.namespace) {
            this.addToIndex(this.namespaceIndex, rel.namespace, rel.id);
        }
        const compositeKey = this.makeCompositeKey(rel.sourceEntityId, rel.type, rel.targetEntityId, rel.namespace);
        this.compositeIndex.set(compositeKey, rel.id);
    }

    private unindexRelationship(rel: UnifiedRelationship): void {
        this.removeFromIndex(this.sourceIndex, rel.sourceEntityId, rel.id);
        this.removeFromIndex(this.targetIndex, rel.targetEntityId, rel.id);
        this.removeFromIndex(this.typeIndex, rel.type, rel.id);
        if (rel.namespace) {
            this.removeFromIndex(this.namespaceIndex, rel.namespace, rel.id);
        }
        const compositeKey = this.makeCompositeKey(rel.sourceEntityId, rel.type, rel.targetEntityId, rel.namespace);
        this.compositeIndex.delete(compositeKey);
    }

    private aggregateConfidence(provenance: RelationshipProvenance[]): number {
        if (provenance.length === 0) return 0;

        let totalWeight = 0;
        let weightedSum = 0;

        for (const p of provenance) {
            const w = SOURCE_WEIGHTS[p.source] || 0.5;
            weightedSum += p.confidence * w;
            totalWeight += w;
        }

        return totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0;
    }

    private computeConfidenceBySource(provenance: RelationshipProvenance[]): Partial<Record<RelationshipSource, number>> {
        const result: Partial<Record<RelationshipSource, number>> = {};

        for (const p of provenance) {
            const existing = result[p.source];
            if (existing === undefined || p.confidence > existing) {
                result[p.source] = p.confidence;
            }
        }

        return result;
    }

    add(input: RelationshipInput, skipPersist = false): UnifiedRelationship {
        const compositeKey = this.makeCompositeKey(
            input.sourceEntityId,
            input.type,
            input.targetEntityId,
            input.namespace
        );

        const existingId = this.compositeIndex.get(compositeKey);
        if (existingId) {
            const existing = this.relationships.get(existingId)!;
            existing.provenance.push(...input.provenance);
            existing.confidence = this.aggregateConfidence(existing.provenance);
            existing.confidenceBySource = this.computeConfidenceBySource(existing.provenance);
            existing.updatedAt = new Date();

            if (input.attributes) {
                existing.attributes = { ...existing.attributes, ...input.attributes };
            }

            if (!skipPersist && this.persistCallback) {
                this.persistCallback(existing).catch(console.error);
            }

            return existing;
        }

        const relationship: UnifiedRelationship = {
            id: generateId(),
            sourceEntityId: input.sourceEntityId,
            targetEntityId: input.targetEntityId,
            type: input.type,
            inverseType: input.inverseType,
            bidirectional: input.bidirectional ?? false,
            confidence: this.aggregateConfidence(input.provenance),
            confidenceBySource: this.computeConfidenceBySource(input.provenance),
            provenance: input.provenance,
            namespace: input.namespace,
            attributes: input.attributes || {},
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.relationships.set(relationship.id, relationship);
        this.indexRelationship(relationship);

        if (!skipPersist && this.persistCallback) {
            this.persistCallback(relationship).catch(console.error);
        }

        return relationship;
    }

    addWithoutPersist(rel: UnifiedRelationship): void {
        this.relationships.set(rel.id, rel);
        this.indexRelationship(rel);
    }

    get(id: string): UnifiedRelationship | undefined {
        return this.relationships.get(id);
    }

    exists(id: string): boolean {
        return this.relationships.has(id);
    }

    existsByComposite(sourceId: string, type: string, targetId: string, namespace?: string): boolean {
        const key = this.makeCompositeKey(sourceId, type, targetId, namespace);
        return this.compositeIndex.has(key);
    }

    getByComposite(sourceId: string, type: string, targetId: string, namespace?: string): UnifiedRelationship | undefined {
        const key = this.makeCompositeKey(sourceId, type, targetId, namespace);
        const id = this.compositeIndex.get(key);
        return id ? this.relationships.get(id) : undefined;
    }

    getAll(): UnifiedRelationship[] {
        return Array.from(this.relationships.values());
    }

    getByEntity(entityId: string): UnifiedRelationship[] {
        const sourceIds = this.sourceIndex.get(entityId) || new Set();
        const targetIds = this.targetIndex.get(entityId) || new Set();
        const allIds = new Set([...sourceIds, ...targetIds]);
        return Array.from(allIds).map(id => this.relationships.get(id)!).filter(Boolean);
    }

    getBySource(sourceId: string): UnifiedRelationship[] {
        const ids = this.sourceIndex.get(sourceId) || new Set();
        return Array.from(ids).map(id => this.relationships.get(id)!).filter(Boolean);
    }

    getByTarget(targetId: string): UnifiedRelationship[] {
        const ids = this.targetIndex.get(targetId) || new Set();
        return Array.from(ids).map(id => this.relationships.get(id)!).filter(Boolean);
    }

    getByType(type: string): UnifiedRelationship[] {
        const ids = this.typeIndex.get(type) || new Set();
        return Array.from(ids).map(id => this.relationships.get(id)!).filter(Boolean);
    }

    getByNamespace(namespace: string): UnifiedRelationship[] {
        const ids = this.namespaceIndex.get(namespace) || new Set();
        return Array.from(ids).map(id => this.relationships.get(id)!).filter(Boolean);
    }

    query(q: RelationshipQuery): UnifiedRelationship[] {
        let candidates: UnifiedRelationship[];

        if (q.sourceId) {
            candidates = this.getBySource(q.sourceId);
        } else if (q.targetId) {
            candidates = this.getByTarget(q.targetId);
        } else if (q.entityId) {
            candidates = this.getByEntity(q.entityId);
        } else if (q.type && typeof q.type === 'string') {
            candidates = this.getByType(q.type);
        } else if (q.namespace) {
            candidates = this.getByNamespace(q.namespace);
        } else {
            candidates = this.getAll();
        }

        let results = candidates.filter(rel => {
            if (q.sourceId && rel.sourceEntityId !== q.sourceId) return false;
            if (q.targetId && rel.targetEntityId !== q.targetId) return false;
            if (q.entityId && rel.sourceEntityId !== q.entityId && rel.targetEntityId !== q.entityId) return false;

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
                const relSources = rel.provenance.map(p => p.source);
                if (!q.sources.some(s => relSources.includes(s))) return false;
            }

            return true;
        });

        results.sort((a, b) => b.confidence - a.confidence);

        if (q.offset) {
            results = results.slice(q.offset);
        }
        if (q.limit) {
            results = results.slice(0, q.limit);
        }

        return results;
    }

    update(id: string, updates: Partial<UnifiedRelationship>): boolean {
        const rel = this.relationships.get(id);
        if (!rel) return false;

        const needsReindex = updates.sourceEntityId || updates.targetEntityId || updates.type || updates.namespace;

        if (needsReindex) {
            this.unindexRelationship(rel);
        }

        if (updates.sourceEntityId) rel.sourceEntityId = updates.sourceEntityId;
        if (updates.targetEntityId) rel.targetEntityId = updates.targetEntityId;
        if (updates.type) rel.type = updates.type;
        if (updates.inverseType !== undefined) rel.inverseType = updates.inverseType;
        if (updates.bidirectional !== undefined) rel.bidirectional = updates.bidirectional;
        if (updates.namespace !== undefined) rel.namespace = updates.namespace;
        if (updates.attributes) rel.attributes = { ...rel.attributes, ...updates.attributes };
        if (updates.provenance) {
            rel.provenance = updates.provenance;
            rel.confidence = this.aggregateConfidence(rel.provenance);
            rel.confidenceBySource = this.computeConfidenceBySource(rel.provenance);
        }

        rel.updatedAt = new Date();

        if (needsReindex) {
            this.indexRelationship(rel);
        }

        if (this.persistCallback) {
            this.persistCallback(rel).catch(console.error);
        }

        return true;
    }

    delete(id: string): boolean {
        const rel = this.relationships.get(id);
        if (!rel) return false;

        this.unindexRelationship(rel);
        this.relationships.delete(id);

        if (this.deleteCallback) {
            this.deleteCallback(id).catch(console.error);
        }

        return true;
    }

    remove(id: string): boolean {
        return this.delete(id);
    }

    findByEntities(sourceId: string, targetId: string, type?: string): UnifiedRelationship | undefined {
        const sourceRels = this.getBySource(sourceId);
        return sourceRels.find(rel => 
            rel.targetEntityId === targetId &&
            (type === undefined || rel.type === type)
        );
    }

    removeProvenance(relationshipId: string, source: RelationshipSource, originId?: string): boolean {
        const rel = this.relationships.get(relationshipId);
        if (!rel) return false;

        const beforeCount = rel.provenance.length;
        rel.provenance = rel.provenance.filter(p => {
            if (p.source !== source) return true;
            if (originId !== undefined && p.originId !== originId) return true;
            return false;
        });

        if (rel.provenance.length === beforeCount) return false;

        if (rel.provenance.length === 0) {
            return this.delete(relationshipId);
        }

        rel.confidence = this.aggregateConfidence(rel.provenance);
        rel.confidenceBySource = this.computeConfidenceBySource(rel.provenance);
        rel.updatedAt = new Date();

        if (this.persistCallback) {
            this.persistCallback(rel).catch(console.error);
        }

        return true;
    }

    deleteByEntity(entityId: string): number {
        const rels = this.getByEntity(entityId);
        for (const rel of rels) {
            this.delete(rel.id);
        }
        return rels.length;
    }

    deleteByNamespace(namespace: string): number {
        const rels = this.getByNamespace(namespace);
        for (const rel of rels) {
            this.delete(rel.id);
        }
        return rels.length;
    }

    migrateEntity(oldEntityId: string, newEntityId: string): number {
        const rels = this.getByEntity(oldEntityId);
        let migrated = 0;

        for (const rel of rels) {
            this.unindexRelationship(rel);

            if (rel.sourceEntityId === oldEntityId) {
                rel.sourceEntityId = newEntityId;
            }
            if (rel.targetEntityId === oldEntityId) {
                rel.targetEntityId = newEntityId;
            }

            rel.updatedAt = new Date();
            this.indexRelationship(rel);

            if (this.persistCallback) {
                this.persistCallback(rel).catch(console.error);
            }

            migrated++;
        }

        return migrated;
    }

    mergeRelationships(targetId: string, sourceId: string): boolean {
        const target = this.relationships.get(targetId);
        const source = this.relationships.get(sourceId);

        if (!target || !source) return false;

        target.provenance.push(...source.provenance);
        target.confidence = this.aggregateConfidence(target.provenance);
        target.confidenceBySource = this.computeConfidenceBySource(target.provenance);
        target.attributes = { ...source.attributes, ...target.attributes };
        target.updatedAt = new Date();

        this.delete(sourceId);

        if (this.persistCallback) {
            this.persistCallback(target).catch(console.error);
        }

        return true;
    }

    getStats(): RelationshipStats {
        const byType: Record<string, number> = {};
        const bySource: Partial<Record<RelationshipSource, number>> = {};
        const byNamespace: Record<string, number> = {};
        let totalConfidence = 0;

        for (const rel of this.relationships.values()) {
            byType[rel.type] = (byType[rel.type] || 0) + 1;

            if (rel.namespace) {
                byNamespace[rel.namespace] = (byNamespace[rel.namespace] || 0) + 1;
            }

            for (const p of rel.provenance) {
                bySource[p.source] = (bySource[p.source] || 0) + 1;
            }

            totalConfidence += rel.confidence;
        }

        return {
            total: this.relationships.size,
            byType,
            bySource,
            byNamespace,
            averageConfidence: this.relationships.size > 0 ? totalConfidence / this.relationships.size : 0
        };
    }

    clear(): void {
        this.relationships.clear();
        this.sourceIndex.clear();
        this.targetIndex.clear();
        this.typeIndex.clear();
        this.namespaceIndex.clear();
        this.compositeIndex.clear();
    }

    toJSON(): any {
        return {
            relationships: Array.from(this.relationships.values()).map(rel => ({
                ...rel,
                createdAt: rel.createdAt.toISOString(),
                updatedAt: rel.updatedAt.toISOString(),
                provenance: rel.provenance.map(p => ({
                    ...p,
                    timestamp: p.timestamp.toISOString()
                }))
            })),
            version: '1.0',
            exportedAt: new Date().toISOString()
        };
    }

    static fromJSON(data: any): RelationshipRegistry {
        const registry = new RelationshipRegistry();

        if (data.relationships) {
            for (const relData of data.relationships) {
                const rel: UnifiedRelationship = {
                    ...relData,
                    createdAt: new Date(relData.createdAt),
                    updatedAt: new Date(relData.updatedAt),
                    provenance: relData.provenance.map((p: any) => ({
                        ...p,
                        timestamp: new Date(p.timestamp)
                    }))
                };
                registry.addWithoutPersist(rel);
            }
        }

        return registry;
    }
}

export const relationshipRegistry = new RelationshipRegistry();
