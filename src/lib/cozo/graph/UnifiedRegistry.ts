/**
 * CozoUnifiedRegistry - Single source of truth for entities and relationships
 * 
 * Built directly on CozoDB with:
 * - Native graph storage and indexing
 * - Datalog queries for complex patterns
 * - IndexedDB persistence layer
 * - Backwards-compatible API with EntityRegistry & RelationshipRegistry
 */

import { cozoDb } from '../db';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { EntityKind } from '@/lib/entities/entityTypes';

// ==================== TYPES ====================

export interface CozoEntity {
    id: string;
    label: string;
    normalized: string;
    kind: EntityKind;
    subtype?: string;
    firstNote: string;
    createdAt: Date;
    createdBy: 'user' | 'extraction' | 'auto';

    // Computed fields (not stored in Cozo directly)
    aliases?: string[];
    mentionsByNote?: Map<string, number>;
    totalMentions?: number;
    lastSeenDate?: Date;
    metadata?: Record<string, any>;
    attributes?: Record<string, any>;
}

export interface CozoRelationship {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    inverseType?: string;
    bidirectional: boolean;
    confidence: number;
    namespace?: string;
    createdAt: Date;
    updatedAt: Date;

    // Computed fields
    provenance?: RelationshipProvenance[];
    attributes?: Record<string, any>;
}

export interface RelationshipProvenance {
    source: 'user' | 'extraction' | 'llm' | 'pattern' | 'folder' | 'hierarchy' |
    'MANUAL' | 'NER_EXTRACTION' | 'LLM_EXTRACTION' | 'FOLDER_STRUCTURE' |
    'CO_OCCURRENCE' | 'IMPORT' | 'TIMELINE' | 'NETWORK' | string;
    originId: string;
    confidence: number;
    timestamp: Date;
    context?: string;
}

export interface EntityStats {
    totalMentions: number;
    noteCount: number;
    relationshipCount: number;
    aliases: string[];
}

export interface GlobalStats {
    totalEntities: number;
    totalRelationships: number;
    totalProvenance: number;
    entitiesByKind: Record<string, number>;
    relationshipsByType: Record<string, number>;
}

// ==================== INDEXEDDB SCHEMA ====================

interface CozoRegistryDB extends DBSchema {
    'cozo_snapshots': {
        key: string;
        value: {
            id: string;
            timestamp: number;
            data: string;
            stats: GlobalStats;
        };
    };
    'metadata': {
        key: string;
        value: any;
    };
}

// ==================== UNIFIED REGISTRY ====================

export class CozoUnifiedRegistry {
    private db: IDBPDatabase<CozoRegistryDB> | null = null;
    private initialized = false;

    private entityCache = new Map<string, CozoEntity>();
    private relationshipCache = new Map<string, CozoRelationship>();
    private cacheMaxSize = 500;

    private onEntityDeleteCallback?: (entityId: string) => void;
    private onEntityMergeCallback?: (oldId: string, newId: string) => void;

    async init(): Promise<void> {
        if (this.initialized) return;

        console.log('[CozoUnifiedRegistry] Initializing...');

        await cozoDb.init();
        await this.createSchema();

        this.db = await openDB<CozoRegistryDB>('cozo-registry-v1', 1, {
            upgrade(db) {
                db.createObjectStore('cozo_snapshots', { keyPath: 'id' });
                db.createObjectStore('metadata');
            },
        });

        await this.restoreLatestSnapshot();

        this.initialized = true;
        console.log('[CozoUnifiedRegistry] ✅ Initialized');
    }

    private async createSchema(): Promise<void> {
        const schemas = [
            { name: 'entities', script: `::create entities { id: String, label: String, normalized: String, kind: String, subtype: String?, first_note: String, created_at: Int, created_by: String, => id }` },
            { name: 'entity_aliases', script: `::create entity_aliases { entity_id: String, alias: String, normalized: String, => entity_id, normalized }` },
            { name: 'entity_mentions', script: `::create entity_mentions { entity_id: String, note_id: String, mention_count: Int, last_seen: Int, => entity_id, note_id }` },
            { name: 'entity_metadata', script: `::create entity_metadata { entity_id: String, key: String, value: String, => entity_id, key }` },
            { name: 'relationships', script: `::create relationships { id: String, source_id: String, target_id: String, type: String, inverse_type: String?, bidirectional: Bool, confidence: Float, namespace: String?, created_at: Int, updated_at: Int, => id }` },
            { name: 'relationship_provenance', script: `::create relationship_provenance { relationship_id: String, source: String, origin_id: String, confidence: Float, timestamp: Int, context: String?, => relationship_id, source, origin_id }` },
            { name: 'relationship_attributes', script: `::create relationship_attributes { relationship_id: String, key: String, value: String, => relationship_id, key }` },
        ];

        for (const { name, script } of schemas) {
            try {
                cozoDb.run(script.trim());
            } catch (err) {
                const errMsg = String(err);
                if (!errMsg.includes('already exists')) {
                    console.error(`[CozoUnifiedRegistry] Schema creation failed for ${name}:`, err);
                }
            }
        }
    }

    // ==================== ENTITY OPERATIONS ====================

    async registerEntity(
        label: string,
        kind: EntityKind,
        noteId: string,
        options?: {
            subtype?: string;
            aliases?: string[];
            metadata?: Record<string, any>;
            attributes?: Record<string, any>;
        }
    ): Promise<CozoEntity> {
        const normalized = this.normalize(label);
        const existing = await this.findEntityByLabel(label);

        if (existing) {
            await this.incrementMention(existing.id, noteId);
            if (options?.metadata) {
                for (const [key, value] of Object.entries(options.metadata)) {
                    await this.setEntityMetadata(existing.id, key, value);
                }
            }
            if (options?.aliases) {
                for (const alias of options.aliases) {
                    await this.addAlias(existing.id, alias);
                }
            }
            this.entityCache.delete(existing.id);
            return this.getEntityById(existing.id)!;
        }

        const id = this.generateId();
        const now = Date.now();

        const insertQuery = `
      ?[id, label, normalized, kind, subtype, first_note, created_at, created_by] <- [[
        "${id}", "${this.escape(label)}", "${normalized}", "${kind}", 
        ${options?.subtype ? `"${this.escape(options.subtype)}"` : 'null'}, 
        "${noteId}", ${now}, "user"
      ]]
      :put entities {id, label, normalized, kind, subtype, first_note, created_at, created_by}
    `;

        cozoDb.run(insertQuery);

        if (options?.aliases) {
            for (const alias of options.aliases) await this.addAlias(id, alias);
        }
        if (options?.metadata) {
            for (const [key, value] of Object.entries(options.metadata)) {
                await this.setEntityMetadata(id, key, value);
            }
        }
        await this.incrementMention(id, noteId);
        this.scheduleSnapshot();

        return (await this.getEntityById(id))!;
    }

    async getEntityById(id: string): Promise<CozoEntity | null> {
        if (this.entityCache.has(id)) return this.entityCache.get(id)!;

        const query = `?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entities{id, label, normalized, kind, subtype, first_note, created_at, created_by}, id == "${id}"`;
        const result = cozoDb.runQuery(query);

        if (!result.rows || result.rows.length === 0) return null;

        const entity = await this.hydrateEntity(result.rows[0]);
        this.cacheEntity(entity);
        return entity;
    }

    async findEntityByLabel(label: string): Promise<CozoEntity | null> {
        const normalized = this.normalize(label);

        let result = cozoDb.runQuery(`?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entities{id, label, normalized, kind, subtype, first_note, created_at, created_by}, normalized == "${normalized}"`);
        if (result.rows?.length > 0) return this.hydrateEntity(result.rows[0]);

        result = cozoDb.runQuery(`?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entity_aliases{entity_id, normalized: alias_norm}, alias_norm == "${normalized}", *entities{id: entity_id, label, normalized, kind, subtype, first_note, created_at, created_by}`);
        if (result.rows?.length > 0) return this.hydrateEntity(result.rows[0]);

        return null;
    }

    async isRegisteredEntity(label: string): Promise<boolean> {
        const normalized = this.normalize(label);
        try {
            const query = `?[exists] := *entities{normalized}, normalized == "${normalized}", exists = true ?[exists] := *entity_aliases{normalized}, normalized == "${normalized}", exists = true`;
            const result = cozoDb.runQuery(query);
            return result.rows?.length > 0;
        } catch { return false; }
    }

    async getAllEntities(filters?: { kind?: EntityKind; subtype?: string; minMentions?: number }): Promise<CozoEntity[]> {
        let whereClauses: string[] = [];
        if (filters?.kind) whereClauses.push(`kind == "${filters.kind}"`);
        if (filters?.subtype) whereClauses.push(`subtype == "${filters.subtype}"`);

        const whereClause = whereClauses.length > 0 ? `,\n        ${whereClauses.join(',\n        ')}` : '';
        const query = `?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entities{id, label, normalized, kind, subtype, first_note, created_at, created_by}${whereClause}`;

        const result = cozoDb.runQuery(query);
        const entities = await Promise.all((result.rows || []).map((row: any) => this.hydrateEntity(row)));

        if (filters?.minMentions) return entities.filter(e => (e.totalMentions || 0) >= filters.minMentions);
        return entities;
    }

    async getEntitiesByKind(kind: EntityKind): Promise<CozoEntity[]> { return this.getAllEntities({ kind }); }
    async getEntitiesBySubtype(kind: EntityKind, subtype: string): Promise<CozoEntity[]> { return this.getAllEntities({ kind, subtype }); }

    async searchEntities(query: string): Promise<CozoEntity[]> {
        const normalized = this.normalize(query);
        const all = await this.getAllEntities();
        return all.filter(entity => {
            if (entity.normalized === normalized) return true;
            if (entity.normalized.includes(normalized)) return true;
            if (entity.aliases?.some(a => this.normalize(a).includes(normalized))) return true;
            return false;
        });
    }

    async updateEntity(id: string, updates: { label?: string; kind?: EntityKind; subtype?: string; metadata?: Record<string, any>; attributes?: Record<string, any> }): Promise<boolean> {
        const entity = await this.getEntityById(id);
        if (!entity) return false;

        if (updates.label || updates.kind || updates.subtype !== undefined) {
            const newLabel = updates.label || entity.label;
            const newNorm = this.normalize(newLabel);
            const newKind = updates.kind || entity.kind;
            const newSubtype = updates.subtype !== undefined ? updates.subtype : entity.subtype;

            const updateQuery = `?[id, label, normalized, kind, subtype, first_note, created_at, created_by] <- [["${id}", "${this.escape(newLabel)}", "${newNorm}", "${newKind}", ${newSubtype ? `"${this.escape(newSubtype)}"` : 'null'}, "${entity.firstNote}", ${entity.createdAt.getTime()}, "${entity.createdBy}"]] :put entities {id, label, normalized, kind, subtype, first_note, created_at, created_by}`;

            try { cozoDb.run(updateQuery); } catch (err) { console.error('[CozoUnifiedRegistry] Update failed:', err); return false; }
        }

        if (updates.metadata) {
            for (const [key, value] of Object.entries(updates.metadata)) await this.setEntityMetadata(id, key, value);
        }

        this.entityCache.delete(id);
        this.scheduleSnapshot();
        return true;
    }

    async deleteEntity(id: string): Promise<boolean> {
        if (this.onEntityDeleteCallback) this.onEntityDeleteCallback(id);

        const relIds = await this.getRelationshipIdsForEntity(id);
        for (const relId of relIds) {
            this.deleteRelationshipProvenance(relId);
            this.deleteRelationshipAttributes(relId);
        }

        cozoDb.run(`?[id] := *relationships{id, source_id, target_id}, (source_id == "${id}" || target_id == "${id}") :rm relationships {id}`);
        cozoDb.run(`?[entity_id, alias, normalized] := *entity_aliases{entity_id, alias, normalized}, entity_id == "${id}" :rm entity_aliases {entity_id, alias, normalized}`);
        cozoDb.run(`?[entity_id, note_id] := *entity_mentions{entity_id, note_id}, entity_id == "${id}" :rm entity_mentions {entity_id, note_id}`);
        cozoDb.run(`?[entity_id, key] := *entity_metadata{entity_id, key}, entity_id == "${id}" :rm entity_metadata {entity_id, key}`);
        cozoDb.run(`?[id] := *entities{id}, id == "${id}" :rm entities {id}`);

        this.entityCache.delete(id);
        this.scheduleSnapshot();
        return true;
    }

    async mergeEntities(targetId: string, sourceId: string): Promise<boolean> {
        const target = await this.getEntityById(targetId);
        const source = await this.getEntityById(sourceId);
        if (!target || !source || targetId === sourceId) return false;

        if (this.onEntityMergeCallback) this.onEntityMergeCallback(sourceId, targetId);

        if (source.aliases) for (const alias of source.aliases) await this.addAlias(targetId, alias);
        await this.addAlias(targetId, source.label);

        if (source.mentionsByNote) {
            for (const [noteId, count] of source.mentionsByNote.entries()) await this.incrementMention(targetId, noteId, count);
        }

        // Migrate relationships
        const rels = await this.getRelationshipsForEntity(sourceId);
        for (const rel of rels) {
            const newSrc = rel.sourceId === sourceId ? targetId : rel.sourceId;
            const newTgt = rel.targetId === sourceId ? targetId : rel.targetId;
            cozoDb.run(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] <- [["${rel.id}", "${newSrc}", "${newTgt}", "${rel.type}", ${rel.inverseType ? `"${rel.inverseType}"` : 'null'}, ${rel.bidirectional}, ${rel.confidence}, ${rel.namespace ? `"${rel.namespace}"` : 'null'}, ${rel.createdAt.getTime()}, ${Date.now()}]] :put relationships {id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}`);
        }

        if (source.metadata) {
            for (const [key, value] of Object.entries(source.metadata)) await this.setEntityMetadata(targetId, key, value);
        }

        await this.deleteEntity(sourceId);
        this.scheduleSnapshot();
        return true;
    }

    async onNoteDeleted(noteId: string): Promise<void> {
        console.log(`[CozoUnifiedRegistry] Cleaning up note ${noteId}`);
        cozoDb.run(`?[entity_id, note_id] := *entity_mentions{entity_id, note_id}, note_id == "${noteId}" :rm entity_mentions {entity_id, note_id}`);
        cozoDb.run(`?[relationship_id, source, origin_id] := *relationship_provenance{relationship_id, source, origin_id}, origin_id == "${noteId}" :rm relationship_provenance {relationship_id, source, origin_id}`);
        this.scheduleSnapshot();
    }

    // ==================== ALIAS MANAGEMENT ====================

    async addAlias(entityId: string, alias: string): Promise<boolean> {
        const normalized = this.normalize(alias);
        const existing = cozoDb.runQuery(`?[entity_id] := *entity_aliases{entity_id, normalized}, normalized == "${normalized}"`);

        if (existing.rows?.length > 0) {
            if (existing.rows[0][0] !== entityId) {
                console.warn(`[CozoUnifiedRegistry] Alias "${alias}" already belongs to ${existing.rows[0][0]}`);
                return false;
            }
            return true;
        }

        cozoDb.run(`?[entity_id, alias, normalized] <- [["${entityId}", "${this.escape(alias)}", "${normalized}"]] :put entity_aliases {entity_id, alias, normalized}`);
        this.entityCache.delete(entityId);
        return true;
    }

    async removeAlias(entityId: string, alias: string): Promise<boolean> {
        const normalized = this.normalize(alias);
        cozoDb.run(`?[entity_id, alias, normalized] := *entity_aliases{entity_id, alias, normalized}, entity_id == "${entityId}", normalized == "${normalized}" :rm entity_aliases {entity_id, alias, normalized}`);
        this.entityCache.delete(entityId);
        return true;
    }

    async getAliases(entityId: string): Promise<string[]> {
        const result = cozoDb.runQuery(`?[alias] := *entity_aliases{entity_id, alias}, entity_id == "${entityId}"`);
        return (result.rows || []).map((row: any) => row[0]);
    }

    // ==================== MENTION STATISTICS ====================

    private async incrementMention(entityId: string, noteId: string, delta: number = 1): Promise<void> {
        const now = Date.now();
        const result = cozoDb.runQuery(`?[count] := *entity_mentions{entity_id, note_id, mention_count: count}, entity_id == "${entityId}", note_id == "${noteId}"`);
        const currentCount = result.rows?.length > 0 ? result.rows[0][0] : 0;
        cozoDb.run(`?[entity_id, note_id, mention_count, last_seen] <- [["${entityId}", "${noteId}", ${currentCount + delta}, ${now}]] :put entity_mentions {entity_id, note_id, mention_count, last_seen}`);
    }

    async updateNoteMentions(entityId: string, noteId: string, count: number): Promise<void> {
        if (count <= 0) {
            cozoDb.run(`?[entity_id, note_id] := *entity_mentions{entity_id, note_id}, entity_id == "${entityId}", note_id == "${noteId}" :rm entity_mentions {entity_id, note_id}`);
        } else {
            cozoDb.run(`?[entity_id, note_id, mention_count, last_seen] <- [["${entityId}", "${noteId}", ${count}, ${Date.now()}]] :put entity_mentions {entity_id, note_id, mention_count, last_seen}`);
        }
        this.entityCache.delete(entityId);
    }

    // ==================== METADATA MANAGEMENT ====================

    async setEntityMetadata(entityId: string, key: string, value: any): Promise<void> {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        cozoDb.run(`?[entity_id, key, value] <- [["${entityId}", "${this.escape(key)}", "${this.escape(valueStr)}"]] :put entity_metadata {entity_id, key, value}`);
        this.entityCache.delete(entityId);
    }

    async getEntityMetadata(entityId: string): Promise<Record<string, any>> {
        const result = cozoDb.runQuery(`?[key, value] := *entity_metadata{entity_id, key, value}, entity_id == "${entityId}"`);
        const metadata: Record<string, any> = {};
        for (const [key, value] of result.rows || []) {
            try { metadata[key] = JSON.parse(value); } catch { metadata[key] = value; }
        }
        return metadata;
    }

    // ==================== RELATIONSHIP OPERATIONS ====================

    async addRelationship(
        sourceId: string, targetId: string, type: string, provenance: RelationshipProvenance,
        options?: { inverseType?: string; bidirectional?: boolean; namespace?: string; attributes?: Record<string, any> }
    ): Promise<CozoRelationship> {
        const existing = await this.findRelationship(sourceId, targetId, type, options?.namespace);

        if (existing) {
            await this.addProvenance(existing.id, provenance);
            await this.recalculateRelationshipConfidence(existing.id);
            this.relationshipCache.delete(existing.id);
            return (await this.getRelationshipById(existing.id))!;
        }

        const id = this.generateId();
        const now = Date.now();

        cozoDb.run(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] <- [["${id}", "${sourceId}", "${targetId}", "${this.escape(type)}", ${options?.inverseType ? `"${this.escape(options.inverseType)}"` : 'null'}, ${options?.bidirectional || false}, ${provenance.confidence}, ${options?.namespace ? `"${this.escape(options.namespace)}"` : 'null'}, ${now}, ${now}]] :put relationships {id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}`);

        await this.addProvenance(id, provenance);
        if (options?.attributes) {
            for (const [key, value] of Object.entries(options.attributes)) await this.setRelationshipAttribute(id, key, value);
        }

        this.scheduleSnapshot();
        return (await this.getRelationshipById(id))!;
    }

    async getRelationshipById(id: string): Promise<CozoRelationship | null> {
        if (this.relationshipCache.has(id)) return this.relationshipCache.get(id)!;

        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, id == "${id}"`);
        if (!result.rows?.length) return null;

        const relationship = await this.hydrateRelationship(result.rows[0]);
        this.cacheRelationship(relationship);
        return relationship;
    }

    async findRelationship(sourceId: string, targetId: string, type: string, namespace?: string): Promise<CozoRelationship | null> {
        const nsClause = namespace ? `, namespace == "${this.escape(namespace)}"` : '';
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, source_id == "${sourceId}", target_id == "${targetId}", type == "${this.escape(type)}"${nsClause}`);
        if (!result.rows?.length) return null;
        return this.hydrateRelationship(result.rows[0]);
    }

    async getRelationshipsForEntity(entityId: string): Promise<CozoRelationship[]> {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, (source_id == "${entityId}" || target_id == "${entityId}")`);
        return Promise.all((result.rows || []).map((row: any) => this.hydrateRelationship(row)));
    }

    async getRelationshipsBySource(sourceId: string): Promise<CozoRelationship[]> {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, source_id == "${sourceId}"`);
        return Promise.all((result.rows || []).map((row: any) => this.hydrateRelationship(row)));
    }

    async getRelationshipsByTarget(targetId: string): Promise<CozoRelationship[]> {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, target_id == "${targetId}"`);
        return Promise.all((result.rows || []).map((row: any) => this.hydrateRelationship(row)));
    }

    async getRelationshipsByType(type: string): Promise<CozoRelationship[]> {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, type == "${this.escape(type)}"`);
        return Promise.all((result.rows || []).map((row: any) => this.hydrateRelationship(row)));
    }

    async getRelationshipsByNamespace(namespace: string): Promise<CozoRelationship[]> {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, namespace == "${this.escape(namespace)}"`);
        return Promise.all((result.rows || []).map((row: any) => this.hydrateRelationship(row)));
    }

    async deleteRelationship(id: string): Promise<boolean> {
        this.deleteRelationshipProvenance(id);
        this.deleteRelationshipAttributes(id);
        cozoDb.run(`?[id] := *relationships{id}, id == "${id}" :rm relationships {id}`);
        this.relationshipCache.delete(id);
        this.scheduleSnapshot();
        return true;
    }

    async deleteRelationshipsByEntity(entityId: string): Promise<number> {
        const relationships = await this.getRelationshipsForEntity(entityId);
        for (const rel of relationships) await this.deleteRelationship(rel.id);
        return relationships.length;
    }

    async migrateEntityRelationships(oldEntityId: string, newEntityId: string): Promise<number> {
        const relationships = await this.getRelationshipsForEntity(oldEntityId);
        for (const rel of relationships) {
            const newSrc = rel.sourceId === oldEntityId ? newEntityId : rel.sourceId;
            const newTgt = rel.targetId === oldEntityId ? newEntityId : rel.targetId;
            cozoDb.run(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] <- [["${rel.id}", "${newSrc}", "${newTgt}", "${rel.type}", ${rel.inverseType ? `"${rel.inverseType}"` : 'null'}, ${rel.bidirectional}, ${rel.confidence}, ${rel.namespace ? `"${rel.namespace}"` : 'null'}, ${rel.createdAt.getTime()}, ${Date.now()}]] :put relationships {id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}`);
            this.relationshipCache.delete(rel.id);
        }
        return relationships.length;
    }

    // ==================== PROVENANCE MANAGEMENT ====================

    private async addProvenance(relationshipId: string, provenance: RelationshipProvenance): Promise<void> {
        cozoDb.run(`?[relationship_id, source, origin_id, confidence, timestamp, context] <- [["${relationshipId}", "${provenance.source}", "${this.escape(provenance.originId)}", ${provenance.confidence}, ${provenance.timestamp.getTime()}, ${provenance.context ? `"${this.escape(provenance.context)}"` : 'null'}]] :put relationship_provenance {relationship_id, source, origin_id, confidence, timestamp, context}`);
        this.relationshipCache.delete(relationshipId);
    }

    private async getProvenance(relationshipId: string): Promise<RelationshipProvenance[]> {
        const result = cozoDb.runQuery(`?[source, origin_id, confidence, timestamp, context] := *relationship_provenance{relationship_id, source, origin_id, confidence, timestamp, context}, relationship_id == "${relationshipId}"`);
        return (result.rows || []).map((row: any) => ({ source: row[0], originId: row[1], confidence: row[2], timestamp: new Date(row[3]), context: row[4] }));
    }

    private deleteRelationshipProvenance(relationshipId: string): void {
        cozoDb.run(`?[relationship_id, source, origin_id] := *relationship_provenance{relationship_id, source, origin_id}, relationship_id == "${relationshipId}" :rm relationship_provenance {relationship_id, source, origin_id}`);
    }

    private async recalculateRelationshipConfidence(relationshipId: string): Promise<void> {
        const provenance = await this.getProvenance(relationshipId);
        if (provenance.length === 0) { await this.deleteRelationship(relationshipId); return; }

        const weights: Record<string, number> = {
            user: 1.0, extraction: 0.8, llm: 0.7, pattern: 0.6, folder: 0.5, hierarchy: 0.4,
            MANUAL: 1.0, NER_EXTRACTION: 0.6, LLM_EXTRACTION: 0.7, FOLDER_STRUCTURE: 1.0,
            CO_OCCURRENCE: 0.4, IMPORT: 0.8, TIMELINE: 0.9, NETWORK: 1.0
        };
        let totalWeight = 0, weightedSum = 0;

        for (const p of provenance) {
            const weight = weights[p.source] || 0.5;
            weightedSum += p.confidence * weight;
            totalWeight += weight;
        }

        const newConfidence = totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0;
        const rel = await this.getRelationshipById(relationshipId);
        if (rel) {
            cozoDb.run(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] <- [["${relationshipId}", "${rel.sourceId}", "${rel.targetId}", "${rel.type}", ${rel.inverseType ? `"${rel.inverseType}"` : 'null'}, ${rel.bidirectional}, ${newConfidence}, ${rel.namespace ? `"${rel.namespace}"` : 'null'}, ${rel.createdAt.getTime()}, ${Date.now()}]] :put relationships {id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}`);
        }
        this.relationshipCache.delete(relationshipId);
    }

    // ==================== RELATIONSHIP ATTRIBUTES ====================

    async setRelationshipAttribute(relationshipId: string, key: string, value: any): Promise<void> {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        cozoDb.run(`?[relationship_id, key, value] <- [["${relationshipId}", "${this.escape(key)}", "${this.escape(valueStr)}"]] :put relationship_attributes {relationship_id, key, value}`);
        this.relationshipCache.delete(relationshipId);
    }

    private async getRelationshipAttributes(relationshipId: string): Promise<Record<string, any>> {
        const result = cozoDb.runQuery(`?[key, value] := *relationship_attributes{relationship_id, key, value}, relationship_id == "${relationshipId}"`);
        const attributes: Record<string, any> = {};
        for (const [key, value] of result.rows || []) {
            try { attributes[key] = JSON.parse(value); } catch { attributes[key] = value; }
        }
        return attributes;
    }

    private deleteRelationshipAttributes(relationshipId: string): void {
        cozoDb.run(`?[relationship_id, key] := *relationship_attributes{relationship_id, key}, relationship_id == "${relationshipId}" :rm relationship_attributes {relationship_id, key}`);
    }

    // ==================== STATISTICS ====================

    async getEntityStats(entityId: string): Promise<EntityStats | null> {
        const entity = await this.getEntityById(entityId);
        if (!entity) return null;
        const relationships = await this.getRelationshipsForEntity(entityId);
        return { totalMentions: entity.totalMentions || 0, noteCount: entity.mentionsByNote?.size || 0, relationshipCount: relationships.length, aliases: entity.aliases || [] };
    }

    async getGlobalStats(): Promise<GlobalStats> {
        // Safety check - if DB not ready, return zeroes
        if (!this.initialized || !cozoDb) {
            return { totalEntities: 0, totalRelationships: 0, totalProvenance: 0, entitiesByKind: {}, relationshipsByType: {} };
        }

        try {
            const entityResult = cozoDb.runQuery(`?[count(id)] := *entities{id}`);
            const entityCount = entityResult?.rows?.[0]?.[0] ?? 0;

            const relResult = cozoDb.runQuery(`?[count(id)] := *relationships{id}`);
            const relCount = relResult?.rows?.[0]?.[0] ?? 0;

            const provResult = cozoDb.runQuery(`?[count(relationship_id)] := *relationship_provenance{relationship_id}`);
            const provCount = provResult?.rows?.[0]?.[0] ?? 0;

            const kindResult = cozoDb.runQuery(`?[kind, count(id)] := *entities{id, kind} :order kind`);
            const entitiesByKind: Record<string, number> = {};
            for (const [kind, count] of kindResult?.rows || []) entitiesByKind[kind] = count;

            const typeResult = cozoDb.runQuery(`?[type, count(id)] := *relationships{id, type} :order type`);
            const relationshipsByType: Record<string, number> = {};
            for (const [type, count] of typeResult?.rows || []) relationshipsByType[type] = count;

            return { totalEntities: entityCount, totalRelationships: relCount, totalProvenance: provCount, entitiesByKind, relationshipsByType };
        } catch (err) {
            console.error('[CozoUnifiedRegistry] getGlobalStats failed:', err);
            return { totalEntities: 0, totalRelationships: 0, totalProvenance: 0, entitiesByKind: {}, relationshipsByType: {} };
        }
    }

    // ==================== GRAPH ALGORITHMS ====================

    async calculatePageRank(): Promise<Map<string, number>> {
        try {
            const result = cozoDb.runQuery(`page_rank[node, score] <~ PageRank(*relationships[], undirected: false) ?[node, score] := page_rank[node, score] :order -score`);
            const scores = new Map<string, number>();
            for (const [node, score] of result.rows || []) scores.set(node, score);
            return scores;
        } catch (err) { console.error('[CozoUnifiedRegistry] PageRank failed:', err); return new Map(); }
    }

    async findShortestPath(sourceId: string, targetId: string): Promise<string[] | null> {
        try {
            const result = cozoDb.runQuery(`shortest[path] <~ ShortestPathBFS(*relationships[], "${sourceId}", "${targetId}") ?[path] := shortest[path]`);
            return result.rows?.length > 0 ? result.rows[0][0] : null;
        } catch (err) { console.error('[CozoUnifiedRegistry] Shortest path failed:', err); return null; }
    }

    async detectCommunities(): Promise<Map<string, number>> {
        try {
            const result = cozoDb.runQuery(`community[node, community_id] <~ CommunityDetectionLouvain(*relationships[]) ?[node, community_id] := community[node, community_id]`);
            const communities = new Map<string, number>();
            for (const [node, communityId] of result.rows || []) communities.set(node, communityId);
            return communities;
        } catch (err) { console.error('[CozoUnifiedRegistry] Community detection failed:', err); return new Map(); }
    }

    async calculateBetweennessCentrality(): Promise<Map<string, number>> {
        try {
            const result = cozoDb.runQuery(`centrality[node, score] <~ BetweennessCentrality(*relationships[]) ?[node, score] := centrality[node, score] :order -score`);
            const scores = new Map<string, number>();
            for (const [node, score] of result.rows || []) scores.set(node, score);
            return scores;
        } catch (err) { console.error('[CozoUnifiedRegistry] Betweenness centrality failed:', err); return new Map(); }
    }

    // ==================== PERSISTENCE ====================

    private readonly COZO_RELATIONS = [
        'entities',
        'entity_aliases',
        'entity_mentions',
        'entity_metadata',
        'relationships',
        'relationship_provenance',
        'relationship_attributes',
    ];

    /**
     * Create snapshot of current Cozo state → IndexedDB (via CozoDB service)
     */
    async createSnapshot(): Promise<void> {
        try {
            await cozoDb.saveSnapshot(this.COZO_RELATIONS);
            console.log('[CozoUnifiedRegistry] Snapshot saved via CozoDB persistence');
        } catch (err) {
            console.error('[CozoUnifiedRegistry] Failed to create snapshot:', err);
        }
    }

    /**
     * Restore latest snapshot from IndexedDB → CozoDB
     * CozoDB now automatically restores on init, so this just logs the info
     */
    private async restoreLatestSnapshot(): Promise<void> {
        try {
            const info = await cozoDb.getSnapshotInfo();

            if (info) {
                console.log('[CozoUnifiedRegistry] ✅ Restored from snapshot:', info);
            } else {
                console.log('[CozoUnifiedRegistry] No previous snapshot found');
            }
        } catch (err) {
            console.error('[CozoUnifiedRegistry] Failed to get snapshot info:', err);
        }
    }

    /**
     * Export entire registry to downloadable file
     */
    async exportToFile(): Promise<Blob> {
        return cozoDb.exportToFile(this.COZO_RELATIONS);
    }

    /**
     * Import registry data from file
     */
    async importFromFile(fileContent: string): Promise<void> {
        await cozoDb.importFromFile(fileContent);
        // Clear caches since data changed
        this.entityCache.clear();
        this.relationshipCache.clear();
    }

    // ==================== SYNC WRITE HELPERS ====================

    private getProvenanceSync(relationshipId: string): RelationshipProvenance[] {
        const result = cozoDb.runQuery(`?[source, origin_id, confidence, timestamp, context] := *relationship_provenance{relationship_id, source, origin_id, confidence, timestamp, context}, relationship_id == "${relationshipId}"`);
        return (result.rows || []).map((row: any) => ({ source: row[0], originId: row[1], confidence: row[2], timestamp: new Date(row[3]), context: row[4] }));
    }

    private getRelationshipAttributesSync(relationshipId: string): Record<string, any> {
        const result = cozoDb.runQuery(`?[key, value] := *relationship_attributes{relationship_id, key, value}, relationship_id == "${relationshipId}"`);
        const attributes: Record<string, any> = {};
        for (const [key, value] of result.rows || []) {
            try { attributes[key] = JSON.parse(value); } catch { attributes[key] = value; }
        }
        return attributes;
    }

    private addProvenanceSync(relationshipId: string, provenance: RelationshipProvenance): void {
        cozoDb.run(`?[relationship_id, source, origin_id, confidence, timestamp, context] <- [["${relationshipId}", "${provenance.source}", "${this.escape(provenance.originId)}", ${provenance.confidence}, ${provenance.timestamp.getTime()}, ${provenance.context ? `"${this.escape(provenance.context)}"` : 'null'}]] :put relationship_provenance {relationship_id, source, origin_id, confidence, timestamp, context}`);
        this.relationshipCache.delete(relationshipId);
    }

    private recalculateRelationshipConfidenceSync(relationshipId: string): void {
        const provenance = this.getProvenanceSync(relationshipId);
        if (provenance.length === 0) {
            // Delete relationship if no provenance
            this.deleteRelationshipSync(relationshipId);
            return;
        }

        const weights: Record<string, number> = {
            user: 1.0, extraction: 0.8, llm: 0.7, pattern: 0.6, folder: 0.5, hierarchy: 0.4,
            MANUAL: 1.0, NER_EXTRACTION: 0.6, LLM_EXTRACTION: 0.7, FOLDER_STRUCTURE: 1.0,
            CO_OCCURRENCE: 0.4, IMPORT: 0.8, TIMELINE: 0.9, NETWORK: 1.0
        };
        let totalWeight = 0, weightedSum = 0;

        for (const p of provenance) {
            const weight = weights[p.source] || 0.5;
            weightedSum += p.confidence * weight;
            totalWeight += weight;
        }

        const newConfidence = totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0;
        const rel = this.getRelationshipByIdSync(relationshipId);
        if (rel) {
            cozoDb.run(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] <- [["${relationshipId}", "${rel.sourceId}", "${rel.targetId}", "${rel.type}", ${rel.inverseType ? `"${rel.inverseType}"` : 'null'}, ${rel.bidirectional}, ${newConfidence}, ${rel.namespace ? `"${rel.namespace}"` : 'null'}, ${rel.createdAt.getTime()}, ${Date.now()}]] :put relationships {id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}`);
        }
        this.relationshipCache.delete(relationshipId);
    }

    private setRelationshipAttributeSync(relationshipId: string, key: string, value: any): void {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        cozoDb.run(`?[relationship_id, key, value] <- [["${relationshipId}", "${this.escape(key)}", "${this.escape(valueStr)}"]] :put relationship_attributes {relationship_id, key, value}`);
        this.relationshipCache.delete(relationshipId);
    }

    deleteRelationshipSync(id: string): boolean {
        this.deleteRelationshipProvenance(id);
        this.deleteRelationshipAttributes(id);
        cozoDb.run(`?[id] := *relationships{id}, id == "${id}" :rm relationships {id}`);
        this.relationshipCache.delete(id);
        this.scheduleSnapshot();
        return true;
    }

    addRelationshipSync(
        sourceId: string, targetId: string, type: string, provenance: RelationshipProvenance,
        options?: { inverseType?: string; bidirectional?: boolean; namespace?: string; attributes?: Record<string, any> }
    ): CozoRelationship {
        const existing = this.findRelationshipSync(sourceId, targetId, type, options?.namespace);

        if (existing) {
            this.addProvenanceSync(existing.id, provenance);
            this.recalculateRelationshipConfidenceSync(existing.id);
            this.relationshipCache.delete(existing.id);
            return this.getRelationshipByIdSync(existing.id)!;
        }

        const id = this.generateId();
        const now = Date.now();

        cozoDb.run(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] <- [["${id}", "${sourceId}", "${targetId}", "${this.escape(type)}", ${options?.inverseType ? `"${this.escape(options.inverseType)}"` : 'null'}, ${options?.bidirectional || false}, ${provenance.confidence}, ${options?.namespace ? `"${this.escape(options.namespace)}"` : 'null'}, ${now}, ${now}]] :put relationships {id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}`);

        this.addProvenanceSync(id, provenance);
        if (options?.attributes) {
            for (const [key, value] of Object.entries(options.attributes)) {
                this.setRelationshipAttributeSync(id, key, value);
            }
        }

        this.scheduleSnapshot();
        return this.getRelationshipByIdSync(id)!;
    }


    private snapshotDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    private scheduleSnapshot(): void {
        if (this.snapshotDebounceTimer) clearTimeout(this.snapshotDebounceTimer);
        this.snapshotDebounceTimer = setTimeout(() => { this.createSnapshot().catch(err => console.error('[CozoUnifiedRegistry] Snapshot failed:', err)); }, 2000);
    }

    async persist(): Promise<void> { await this.createSnapshot(); }

    async export(): Promise<{ version: string; timestamp: number; stats: GlobalStats; data: string }> {
        return { version: '1.0', timestamp: Date.now(), stats: await this.getGlobalStats(), data: cozoDb.exportRelations(this.COZO_RELATIONS) };
    }

    async import(exported: { data: string }): Promise<void> {
        cozoDb.importRelations(exported.data);
        await this.createSnapshot();
        this.entityCache.clear();
        this.relationshipCache.clear();
    }

    async clear(): Promise<void> {
        const relations = ['entities', 'entity_aliases', 'entity_mentions', 'entity_metadata', 'relationships', 'relationship_provenance', 'relationship_attributes'];
        for (const relation of relations) {
            try { cozoDb.run(`?[...args] := *${relation}{...args} :rm ${relation} {...args}`); } catch (err) { console.error(`[CozoUnifiedRegistry] Failed to clear ${relation}:`, err); }
        }
        this.entityCache.clear();
        this.relationshipCache.clear();
        if (this.db) { await this.db.clear('cozo_snapshots'); await this.db.clear('metadata'); }
        console.warn('[CozoUnifiedRegistry] ⚠️ All data cleared');
    }

    // ==================== CALLBACKS ====================

    setOnEntityDeleteCallback(callback: (entityId: string) => void): void { this.onEntityDeleteCallback = callback; }
    setOnEntityMergeCallback(callback: (oldId: string, newId: string) => void): void { this.onEntityMergeCallback = callback; }

    // ==================== HELPER METHODS ====================

    private normalize(text: string): string { return text.toLowerCase().trim(); }
    private escape(text: string): string { return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
    private generateId(): string { return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }

    private cacheEntity(entity: CozoEntity): void {
        if (this.entityCache.size >= this.cacheMaxSize) { const firstKey = this.entityCache.keys().next().value; if (firstKey) this.entityCache.delete(firstKey); }
        this.entityCache.set(entity.id, entity);
    }

    private cacheRelationship(relationship: CozoRelationship): void {
        if (this.relationshipCache.size >= this.cacheMaxSize) { const firstKey = this.relationshipCache.keys().next().value; if (firstKey) this.relationshipCache.delete(firstKey); }
        this.relationshipCache.set(relationship.id, relationship);
    }

    private async hydrateEntity(row: any[]): Promise<CozoEntity> {
        const [id, label, normalized, kind, subtype, firstNote, createdAt, createdBy] = row;
        const aliases = await this.getAliases(id);

        const mentionsResult = cozoDb.runQuery(`?[note_id, count, last_seen] := *entity_mentions{entity_id, note_id, mention_count: count, last_seen}, entity_id == "${id}"`);
        const mentionsByNote = new Map<string, number>();
        let lastSeenDate = new Date(0);
        for (const [noteId, count, lastSeen] of mentionsResult.rows || []) {
            mentionsByNote.set(noteId, count);
            const date = new Date(lastSeen);
            if (date > lastSeenDate) lastSeenDate = date;
        }

        const totalMentions = Array.from(mentionsByNote.values()).reduce((a, b) => a + b, 0);
        const metadata = await this.getEntityMetadata(id);

        return { id, label, normalized, kind: kind as EntityKind, subtype, firstNote, createdAt: new Date(createdAt), createdBy, aliases, mentionsByNote, totalMentions, lastSeenDate, metadata, attributes: metadata };
    }

    private async hydrateRelationship(row: any[]): Promise<CozoRelationship> {
        const [id, sourceId, targetId, type, inverseType, bidirectional, confidence, namespace, createdAt, updatedAt] = row;
        const provenance = await this.getProvenance(id);
        const attributes = await this.getRelationshipAttributes(id);
        return { id, sourceId, targetId, type, inverseType, bidirectional, confidence, namespace, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt), provenance, attributes };
    }

    async getRelationshipIdsForEntity(entityId: string): Promise<string[]> {
        const result = cozoDb.runQuery(`?[id] := *relationships{id, source_id, target_id}, (source_id == "${entityId}" || target_id == "${entityId}")`);
        return (result.rows || []).map((row: any) => row[0]);
    }

    // ==================== SYNC METHODS (For Legacy Compatibility) ====================

    private hydrateEntitySync(row: any[]): CozoEntity {
        const [id, label, normalized, kind, subtype, firstNote, createdAt, createdBy] = row;

        // Aliases
        const aliasResult = cozoDb.runQuery(`?[alias] := *entity_aliases{entity_id, alias}, entity_id == "${id}"`);
        const aliases = (aliasResult.rows || []).map((row: any) => row[0]);

        // Mentions
        const mentionsResult = cozoDb.runQuery(`?[note_id, count, last_seen] := *entity_mentions{entity_id, note_id, mention_count: count, last_seen}, entity_id == "${id}"`);
        const mentionsByNote = new Map<string, number>();
        let lastSeenDate = new Date(0);
        for (const [noteId, count, lastSeen] of mentionsResult.rows || []) {
            mentionsByNote.set(noteId, count);
            const date = new Date(lastSeen);
            if (date > lastSeenDate) lastSeenDate = date;
        }

        const totalMentions = Array.from(mentionsByNote.values()).reduce((a, b) => a + b, 0);

        // Metadata
        const metaResult = cozoDb.runQuery(`?[key, value] := *entity_metadata{entity_id, key, value}, entity_id == "${id}"`);
        const metadata: Record<string, any> = {};
        for (const [key, value] of metaResult.rows || []) {
            try { metadata[key] = JSON.parse(value); } catch { metadata[key] = value; }
        }

        return { id, label, normalized, kind: kind as EntityKind, subtype, firstNote, createdAt: new Date(createdAt), createdBy, aliases, mentionsByNote, totalMentions, lastSeenDate, metadata, attributes: metadata };
    }

    private hydrateRelationshipSync(row: any[]): CozoRelationship {
        const [id, sourceId, targetId, type, inverseType, bidirectional, confidence, namespace, createdAt, updatedAt] = row;

        // Provenance
        const provResult = cozoDb.runQuery(`?[source, origin_id, confidence, timestamp, context] := *relationship_provenance{relationship_id, source, origin_id, confidence, timestamp, context}, relationship_id == "${id}"`);
        const provenance = (provResult.rows || []).map((row: any) => ({ source: row[0], originId: row[1], confidence: row[2], timestamp: new Date(row[3]), context: row[4] }));

        // Attributes
        const attrResult = cozoDb.runQuery(`?[key, value] := *relationship_attributes{relationship_id, key, value}, relationship_id == "${id}"`);
        const attributes: Record<string, any> = {};
        for (const [key, value] of attrResult.rows || []) {
            try { attributes[key] = JSON.parse(value); } catch { attributes[key] = value; }
        }

        return { id, sourceId, targetId, type, inverseType, bidirectional, confidence, namespace, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt), provenance, attributes };
    }

    getEntityByIdSync(id: string): CozoEntity | null {
        if (this.entityCache.has(id)) return this.entityCache.get(id)!;
        const query = `?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entities{id, label, normalized, kind, subtype, first_note, created_at, created_by}, id == "${id}"`;
        const result = cozoDb.runQuery(query);
        if (!result.rows || result.rows.length === 0) return null;
        const entity = this.hydrateEntitySync(result.rows[0]);
        this.cacheEntity(entity);
        return entity;
    }

    findEntityByLabelSync(label: string): CozoEntity | null {
        const normalized = this.normalize(label);
        let result = cozoDb.runQuery(`?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entities{id, label, normalized, kind, subtype, first_note, created_at, created_by}, normalized == "${normalized}"`);
        if (result.rows?.length > 0) return this.hydrateEntitySync(result.rows[0]);

        result = cozoDb.runQuery(`?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entity_aliases{entity_id, normalized: alias_norm}, alias_norm == "${normalized}", *entities{id: entity_id, label, normalized, kind, subtype, first_note, created_at, created_by}`);
        if (result.rows?.length > 0) return this.hydrateEntitySync(result.rows[0]);

        return null;
    }

    getAllEntitiesSync(filters?: { kind?: EntityKind; subtype?: string; minMentions?: number }): CozoEntity[] {
        let whereClauses: string[] = [];
        if (filters?.kind) whereClauses.push(`kind == "${filters.kind}"`);
        if (filters?.subtype) whereClauses.push(`subtype == "${filters.subtype}"`);

        const whereClause = whereClauses.length > 0 ? `,\n        ${whereClauses.join(',\n        ')}` : '';
        const query = `?[id, label, normalized, kind, subtype, first_note, created_at, created_by] := *entities{id, label, normalized, kind, subtype, first_note, created_at, created_by}${whereClause}`;

        const result = cozoDb.runQuery(query);
        const entities = (result.rows || []).map((row: any) => this.hydrateEntitySync(row));

        if (filters?.minMentions) return entities.filter(e => (e.totalMentions || 0) >= filters.minMentions);
        return entities;
    }

    getRelationshipsForEntitySync(entityId: string): CozoRelationship[] {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, (source_id == "${entityId}" || target_id == "${entityId}")`);
        return (result.rows || []).map((row: any) => this.hydrateRelationshipSync(row));
    }

    getRelationshipByIdSync(id: string): CozoRelationship | null {
        if (this.relationshipCache.has(id)) return this.relationshipCache.get(id)!;
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, id == "${id}"`);
        if (!result.rows?.length) return null;
        const relationship = this.hydrateRelationshipSync(result.rows[0]);
        this.cacheRelationship(relationship);
        return relationship;
    }

    findRelationshipSync(sourceId: string, targetId: string, type: string, namespace?: string): CozoRelationship | null {
        const nsClause = namespace ? `, namespace == "${this.escape(namespace)}"` : '';
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, source_id == "${sourceId}", target_id == "${targetId}", type == "${this.escape(type)}"${nsClause}`);
        if (!result.rows?.length) return null;
        return this.hydrateRelationshipSync(result.rows[0]);
    }

    getRelationshipsBySourceSync(sourceId: string): CozoRelationship[] {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, source_id == "${sourceId}"`);
        return (result.rows || []).map((row: any) => this.hydrateRelationshipSync(row));
    }

    getRelationshipsByTargetSync(targetId: string): CozoRelationship[] {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, target_id == "${targetId}"`);
        return (result.rows || []).map((row: any) => this.hydrateRelationshipSync(row));
    }

    getRelationshipsByTypeSync(type: string): CozoRelationship[] {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, type == "${this.escape(type)}"`);
        return (result.rows || []).map((row: any) => this.hydrateRelationshipSync(row));
    }

    getRelationshipsByNamespaceSync(namespace: string): CozoRelationship[] {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}, namespace == "${this.escape(namespace)}"`);
        return (result.rows || []).map((row: any) => this.hydrateRelationshipSync(row));
    }

    getAllRelationshipsSync(): CozoRelationship[] {
        const result = cozoDb.runQuery(`?[id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at] := *relationships{id, source_id, target_id, type, inverse_type, bidirectional, confidence, namespace, created_at, updated_at}`);
        return (result.rows || []).map((row: any) => this.hydrateRelationshipSync(row));
    }
}

// Singleton instance
export const unifiedRegistry = new CozoUnifiedRegistry();
