import type { CozoDb } from 'cozo-lib-wasm';
import type { Database } from '@sqliteai/sqlite-wasm';
import type {
    NodeId,
    GraphSyncResult,
    EntityMention
} from './types';
import type { Concept, ConceptRelation } from '../entities/nlp/ConceptExtractor';
import { generateId } from '@/lib/utils/ids';

// ==================== CONCEPT GRAPH BUILDER (CozoDB) ====================

/**
 * ConceptGraphBuilder - Phase 5 Feature: Concept Graph Construction
 * 
 * Bridges ConceptExtractor results into CozoDB and SQLite.
 * Enables the "Concept Mesh" layer in the knowledge graph.
 * 
 * Ported from Cytoscape to CozoDB direct writes.
 */
export class ConceptGraphBuilder {
    private cozo: CozoDb;
    private sqlite: Database;
    private conceptNodeCache = new Map<string, NodeId>();

    constructor(cozo: CozoDb, sqlite: Database) {
        this.cozo = cozo;
        this.sqlite = sqlite;
    }

    /**
     * Clear local concept node cache
     */
    clearCache(): void {
        this.conceptNodeCache.clear();
    }

    /**
     * Sync concepts and relations to CozoDB graph
     */
    async syncConceptsToGraph(
        concepts: Concept[],
        relations: ConceptRelation[],
        noteId: string
    ): Promise<GraphSyncResult> {
        const startTime = performance.now();
        const result: GraphSyncResult = {
            createdNodes: [],
            updatedNodes: [],
            createdEdges: [],
            updatedEdges: [],
            errors: [],
            stats: {
                entitiesSynced: 0,
                relationshipsSynced: 0,
                coOccurrencesSynced: 0,
                duration: 0
            }
        };

        const groupId = `note:${noteId}`;

        try {
            // 1. Sync concept nodes (batch insert to CozoDB)
            const nodeInserts: string[] = [];
            const sqliteInserts: Array<{ id: string; label: string; kind: string }> = [];

            for (const concept of concepts) {
                try {
                    const nodeId = await this.findOrCreateConceptNode(concept, noteId);

                    if (this.conceptNodeCache.has(concept.label)) {
                        result.updatedNodes.push(nodeId);
                    } else {
                        result.createdNodes.push(nodeId);

                        // CozoDB entity schema: id, name, normalized_name, entity_kind, entity_subtype, group_id, scope_type, created_at, frequency
                        nodeInserts.push(`["${nodeId}", "${this.escapeString(concept.label)}", "${this.escapeString(concept.label.toLowerCase())}", "CONCEPT", null, "${groupId}", "note", ${Date.now()}, ${concept.frequency}]`);
                        sqliteInserts.push({ id: nodeId, label: concept.label, kind: 'CONCEPT' });
                    }

                    this.conceptNodeCache.set(concept.label, nodeId);
                    result.stats.entitiesSynced++;
                } catch (error) {
                    result.errors.push({
                        entity: concept.label,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Batch insert into CozoDB
            if (nodeInserts.length > 0) {
                // @ts-ignore - TS expects 3 args but docs/usage imply 2
                this.cozo.run(`
          ?[id, name, normalized_name, entity_kind, entity_subtype, group_id, scope_type, created_at, frequency] <- [
            ${nodeInserts.join(',\n            ')}
          ]
          :put entity {id, name, normalized_name, entity_kind, entity_subtype, group_id, scope_type, created_at, frequency}
        `, '{}');

                // Also sync to SQLite (source of truth)
                const stmt = (this.sqlite as any).prepare(`
          INSERT OR IGNORE INTO nodes (id, label, type, entity_kind, created_at, updated_at)
          VALUES (?, ?, 'ENTITY', 'CONCEPT', ?, ?)
        `);

                const now = Date.now();
                for (const entity of sqliteInserts) {
                    (stmt as any).run([entity.id, entity.label, now, now]);
                }
                (stmt as any).free();
            }

            // 2. Sync relationships (co-occurrences)
            const edgeInserts: string[] = [];

            for (const rel of relations) {
                try {
                    const nodeA = this.conceptNodeCache.get(rel.concept1);
                    const nodeB = this.conceptNodeCache.get(rel.concept2);

                    if (!nodeA || !nodeB) continue;

                    const edgeId = generateId();

                    // CozoDB entity_edge schema: id, source_id, target_id, group_id, scope_type, edge_type, created_at, weight
                    edgeInserts.push(
                        `["${edgeId}", "${nodeA}", "${nodeB}", "${groupId}", "note", "CO_OCCURS", ${Date.now()}, ${rel.frequency}]`
                    );

                    result.createdEdges.push(edgeId);
                    result.stats.coOccurrencesSynced++;
                } catch (error) {
                    result.errors.push({
                        relationship: `${rel.concept1} <-> ${rel.concept2}`,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Batch insert edges into CozoDB
            if (edgeInserts.length > 0) {
                // @ts-ignore - TS expects 3 args but docs/usage imply 2
                this.cozo.run(`
          ?[id, source_id, target_id, group_id, scope_type, edge_type, created_at, weight] <- [
            ${edgeInserts.join(',\n            ')}
          ]
          :put entity_edge {id, source_id, target_id, group_id, scope_type, edge_type, created_at, weight}
        `, '{}');

                // Also sync to SQLite (edges table)
                const stmt = (this.sqlite as any).prepare(`
          INSERT OR IGNORE INTO edges (id, source, target, type, weight, created_at)
          VALUES (?, ?, ?, 'CO_OCCURS', ?, ?)
        `);

                const now = Date.now();
                for (let i = 0; i < edgeInserts.length; i++) {
                    const match = edgeInserts[i].match(/"([^"]+)"/g);
                    if (match && match.length >= 3) {
                        const id = match[0].slice(1, -1);
                        const from = match[1].slice(1, -1);
                        const to = match[2].slice(1, -1);
                        const parts = edgeInserts[i].split(',');
                        const weight = parseFloat(parts[parts.length - 1].replace(']', '').trim());
                        (stmt as any).run([id, from, to, weight, now]);
                    }
                }
                (stmt as any).free();
            }

        } catch (error) {
            result.errors.push({
                entity: 'BATCH_SYNC',
                error: error instanceof Error ? error.message : String(error)
            });
        }

        result.stats.duration = performance.now() - startTime;
        return result;
    }

    /**
     * Internal helper to find or create a concept node
     */
    private async findOrCreateConceptNode(concept: Concept, sourceNoteId: string): Promise<NodeId> {
        // Check CozoDB for existing entity
        // @ts-ignore - TS expects 3 args but docs/usage imply 2
        const resultStr = this.cozo.run(`
      ?[id] := *entity{id, entity_kind, name},
               entity_kind == "CONCEPT",
               name == "${this.escapeString(concept.label)}"
    `, '{}');

        const result = JSON.parse(resultStr);

        if (result.rows && result.rows.length > 0) {
            const existingId = result.rows[0][0] as string;

            // Update frequency in SQLite (stored in extraction JSON)
            const res = (this.sqlite as any).exec({
                sql: 'SELECT extraction FROM nodes WHERE id = ?',
                bind: [existingId],
                returnValue: 'resultRows',
                rowMode: 'array'
            });

            if (res && res.length > 0) {
                try {
                    const extractionStr = res[0][0] || '{}';
                    const extraction = JSON.parse(extractionStr);
                    extraction.frequency = (extraction.frequency || 0) + concept.frequency;

                    (this.sqlite as any).exec({
                        sql: 'UPDATE nodes SET extraction = ?, updated_at = ? WHERE id = ?',
                        bind: [JSON.stringify(extraction), Date.now(), existingId]
                    });
                } catch (e) {
                    console.warn('Failed to parse extraction JSON for frequency update', e);
                }
            }

            return existingId;
        }

        // Create new node ID
        return generateId();
    }

    /**
     * Link concepts to explicit entities in the graph
     */
    async linkConceptsToEntities(noteId: string): Promise<void> {
        const groupId = `note:${noteId}`;
        try {
            // Query concepts and other entities from CozoDB
            // @ts-ignore - TS expects 3 args but docs/usage imply 2
            const resultStr = this.cozo.run(`
        concepts[id, name] := *entity{id, entity_kind, name}, entity_kind == "CONCEPT"
        
        other_entities[id, name] := 
          *entity{id, entity_kind, name},
          entity_kind != "CONCEPT"
        
        ?[concept_id, entity_id, c_name, e_name] :=
          concepts[concept_id, c_name],
          other_entities[entity_id, e_name],
          (contains(lowercase(e_name), lowercase(c_name)) || contains(lowercase(c_name), lowercase(e_name)))
      `, '{}');

            const result = JSON.parse(resultStr);

            // Batch insert concept links
            if (result.rows && result.rows.length > 0) {
                const linkInserts = result.rows.map(([conceptId, entityId]) =>
                    `["${generateId()}", "${conceptId}", "${entityId}", "${groupId}", "note", "RELATED_TO", ${Date.now()}, 0.6]`
                ).join(',\n          ');

                // @ts-ignore - TS expects 3 args but docs/usage imply 2
                this.cozo.run(`
          ?[id, source_id, target_id, group_id, scope_type, edge_type, created_at, weight] <- [
            ${linkInserts}
          ]
          :put entity_edge {id, source_id, target_id, group_id, scope_type, edge_type, created_at, weight}
        `, '{}');

                // Sync to SQLite (edges table)
                const stmt = (this.sqlite as any).prepare(`
          INSERT OR IGNORE INTO edges (id, source, target, type, weight, created_at)
          VALUES (?, ?, ?, 'RELATED_TO', 0.6, ?)
        `);

                const now = Date.now();
                for (const row of result.rows) {
                    (stmt as any).run([generateId(), row[0], row[1], now]);
                }
                (stmt as any).free();
            }
        } catch (error) {
            console.error('Failed to link concepts to entities:', error);
        }
    }

    /**
     * Escape string for CozoDB Datalog queries
     */
    private escapeString(str: string): string {
        return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
}

// ==================== SINGLETON WRAPPERS ====================

let builderInstance: ConceptGraphBuilder | null = null;
let lastCozo: CozoDb | null = null;
let lastSqlite: Database | null = null;

export function getConceptGraphBuilder(cozo: CozoDb, sqlite: Database): ConceptGraphBuilder {
    if (!builderInstance || lastCozo !== cozo || lastSqlite !== sqlite) {
        builderInstance = new ConceptGraphBuilder(cozo, sqlite);
        lastCozo = cozo;
        lastSqlite = sqlite;
    }

    return builderInstance;
}
