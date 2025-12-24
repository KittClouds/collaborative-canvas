/**
 * RelationshipStoreImpl - SQLite persistence for UnifiedRelationship
 * 
 * Stores relationships in the unified_relationships table with
 * JSON serialization for complex fields.
 */

import type { UnifiedRelationship, RelationshipQuery } from '@/lib/relationships/types';
import { RelationshipSource } from '@/lib/relationships/types';

interface SQLiteDB {
    run(sql: string, params?: any[]): Promise<{ changes?: number }>;
    get(sql: string, params?: any[]): Promise<any>;
    all(sql: string, params?: any[]): Promise<any[]>;
}

export class RelationshipStoreImpl {
    constructor(private db: SQLiteDB) {}

    async save(rel: UnifiedRelationship): Promise<void> {
        await this.db.run(`
            INSERT OR REPLACE INTO unified_relationships (
                id, source_entity_id, target_entity_id, type, inverse_type,
                bidirectional, confidence, confidence_by_source, provenance,
                namespace, attributes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            rel.id,
            rel.sourceEntityId,
            rel.targetEntityId,
            rel.type,
            rel.inverseType || null,
            rel.bidirectional ? 1 : 0,
            rel.confidence,
            JSON.stringify(rel.confidenceBySource),
            JSON.stringify(rel.provenance.map(p => ({
                ...p,
                timestamp: p.timestamp.toISOString()
            }))),
            rel.namespace || null,
            JSON.stringify(rel.attributes),
            rel.createdAt.getTime(),
            rel.updatedAt.getTime()
        ]);
    }

    async saveBatch(rels: UnifiedRelationship[]): Promise<void> {
        for (const rel of rels) {
            await this.save(rel);
        }
    }

    async get(id: string): Promise<UnifiedRelationship | null> {
        const row = await this.db.get(
            'SELECT * FROM unified_relationships WHERE id = ?',
            [id]
        );
        return row ? this.rowToRelationship(row) : null;
    }

    async getAll(): Promise<UnifiedRelationship[]> {
        const rows = await this.db.all('SELECT * FROM unified_relationships');
        return rows.map(row => this.rowToRelationship(row));
    }

    async getByEntity(entityId: string): Promise<UnifiedRelationship[]> {
        const rows = await this.db.all(`
            SELECT * FROM unified_relationships
            WHERE source_entity_id = ? OR target_entity_id = ?
        `, [entityId, entityId]);

        return rows.map(row => this.rowToRelationship(row));
    }

    async getBySource(sourceId: string): Promise<UnifiedRelationship[]> {
        const rows = await this.db.all(
            'SELECT * FROM unified_relationships WHERE source_entity_id = ?',
            [sourceId]
        );
        return rows.map(row => this.rowToRelationship(row));
    }

    async getByTarget(targetId: string): Promise<UnifiedRelationship[]> {
        const rows = await this.db.all(
            'SELECT * FROM unified_relationships WHERE target_entity_id = ?',
            [targetId]
        );
        return rows.map(row => this.rowToRelationship(row));
    }

    async getByType(type: string): Promise<UnifiedRelationship[]> {
        const rows = await this.db.all(
            'SELECT * FROM unified_relationships WHERE type = ?',
            [type]
        );
        return rows.map(row => this.rowToRelationship(row));
    }

    async getByNamespace(namespace: string): Promise<UnifiedRelationship[]> {
        const rows = await this.db.all(
            'SELECT * FROM unified_relationships WHERE namespace = ?',
            [namespace]
        );
        return rows.map(row => this.rowToRelationship(row));
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db.run(
            'DELETE FROM unified_relationships WHERE id = ?',
            [id]
        );
        return (result.changes || 0) > 0;
    }

    async deleteByEntity(entityId: string): Promise<number> {
        const result = await this.db.run(`
            DELETE FROM unified_relationships
            WHERE source_entity_id = ? OR target_entity_id = ?
        `, [entityId, entityId]);

        return result.changes || 0;
    }

    async deleteByNamespace(namespace: string): Promise<number> {
        const result = await this.db.run(
            'DELETE FROM unified_relationships WHERE namespace = ?',
            [namespace]
        );
        return result.changes || 0;
    }

    async query(q: RelationshipQuery): Promise<UnifiedRelationship[]> {
        let sql = 'SELECT * FROM unified_relationships WHERE 1=1';
        const params: any[] = [];

        if (q.sourceId) {
            sql += ' AND source_entity_id = ?';
            params.push(q.sourceId);
        }
        if (q.targetId) {
            sql += ' AND target_entity_id = ?';
            params.push(q.targetId);
        }
        if (q.entityId) {
            sql += ' AND (source_entity_id = ? OR target_entity_id = ?)';
            params.push(q.entityId, q.entityId);
        }
        if (q.type) {
            if (Array.isArray(q.type)) {
                sql += ` AND type IN (${q.type.map(() => '?').join(',')})`;
                params.push(...q.type);
            } else {
                sql += ' AND type = ?';
                params.push(q.type);
            }
        }
        if (q.namespace) {
            sql += ' AND namespace = ?';
            params.push(q.namespace);
        }
        if (q.minConfidence !== undefined) {
            sql += ' AND confidence >= ?';
            params.push(q.minConfidence);
        }

        sql += ' ORDER BY confidence DESC';

        if (q.limit) {
            sql += ' LIMIT ?';
            params.push(q.limit);
        }
        if (q.offset) {
            sql += ' OFFSET ?';
            params.push(q.offset);
        }

        const rows = await this.db.all(sql, params);
        return rows.map(row => this.rowToRelationship(row));
    }

    async count(): Promise<number> {
        const result = await this.db.get(
            'SELECT COUNT(*) as count FROM unified_relationships'
        );
        return result?.count || 0;
    }

    async countByType(): Promise<Record<string, number>> {
        const rows = await this.db.all(`
            SELECT type, COUNT(*) as count 
            FROM unified_relationships 
            GROUP BY type
        `);
        
        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.type] = row.count;
        }
        return result;
    }

    private rowToRelationship(row: any): UnifiedRelationship {
        const provenance = JSON.parse(row.provenance || '[]').map((p: any) => ({
            ...p,
            source: p.source as RelationshipSource,
            timestamp: new Date(p.timestamp)
        }));

        return {
            id: row.id,
            sourceEntityId: row.source_entity_id,
            targetEntityId: row.target_entity_id,
            type: row.type,
            inverseType: row.inverse_type || undefined,
            bidirectional: row.bidirectional === 1,
            confidence: row.confidence,
            confidenceBySource: JSON.parse(row.confidence_by_source || '{}'),
            provenance,
            namespace: row.namespace || undefined,
            attributes: JSON.parse(row.attributes || '{}'),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
