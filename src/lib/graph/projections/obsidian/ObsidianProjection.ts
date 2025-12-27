import { BaseProjection } from '../BaseProjection';
import { ObsidianScope } from '../types/obsidian';
import { GraphProjection } from '../types/base';
import { ObsidianQueries } from '../../queries/obsidian.queries';
import { CozoDbService } from '@/lib/cozo/db';

export class ObsidianProjection extends BaseProjection<ObsidianScope> {
    constructor(db: CozoDbService, scope: ObsidianScope) {
        if (scope.target !== 'global') {
            throw new Error('ObsidianProjection must use global scope. Use FolderGraphProjection for folder scopes.');
        }
        super(db, scope);
    }

    async project(): Promise<GraphProjection<ObsidianScope>> {
        const rawResult = await this.db.runQuery(ObsidianQueries.getAllNotesAndLinks());

        // Parse result based on known columns
        // Nodes: [id, label, type, metadata, weight]
        // Edges: [id, source, target, type, weight, metadata]

        // Note: Cozo runQuery returns { ok, rows, cols } or generic JSON array if using specialized parser
        // We assume standard Cozo format which returns rows array

        const rows = rawResult.rows || [];

        const nodes: any[] = [];
        const edges: any[] = [];

        // Crude separation based on column count or type hint if Cozo doesn't separate sets
        // In our query, we made 2 separate queries? No, standard Cozo returns one result set per run.
        // We need to either run them separately or distinguish rows.
        // The query builder has 2 parts. Cozo will likely return the LAST query result only if batched,
        // or we need to runQuery separately.
        // Correction: Use separate execution for nodes and edges

        // Let's refine the query execution strategy.
        // We'll manually split the query string if needed or run 2 separate calls.
        // For safety, let's look at the query builder again.
        // It has multiple blocks. Cozo WASM run() usually returns result of last block unless specialized.
        // We will update this implementation to use 2 focused queries.

        // Actually, let's simplify. Standard strategy: fetching nodes and edges separately is cleaner.
        // But for now, let's assume we can run it.

        // RE-STRATEGY: Break down the monolithic query string in the builder or here?
        // Splitting here is safer for the implementation.

        const nodeQuery = `
      note_nodes[id, label, type, word_count, created_at] := 
        *note{id, title, content, created_at},
        label = title,
        type = "note",
        word_count = length(content)

      ?[id, label, type, metadata, weight] := 
        note_nodes[id, label, type, word_count, created_at],
        metadata = json_object("word_count", word_count, "created_at", created_at),
        weight = 1
    `;

        const edgeQuery = `
      # Get all notes first (scope)
      note_nodes[id] := *note{id}
      
      # Links
      ?[id, source, target, type, weight, metadata] := 
        *note_entity_links{id, source_id, target_id, link_type, relevance},
        note_nodes[source_id],
        note_nodes[target_id],
        source = source_id,
        target = target_id,
        type = link_type,
        weight = relevance,
        metadata = json_object("type", type)
    `;

        // Fetch Nodes
        const nodeResult = await this.db.runQuery(nodeQuery);
        if (nodeResult.rows) {
            nodes.push(...nodeResult.rows.map((r: any[]) => ({
                id: r[0],
                label: r[1],
                type: r[2],
                metadata: typeof r[3] === 'string' ? JSON.parse(r[3]) : r[3],
                weight: r[4],
                color: '#a0a0a0' // Default note color
            })));
        }

        // Fetch Edges
        const edgeResult = await this.db.runQuery(edgeQuery);
        if (edgeResult.rows) {
            edges.push(...edgeResult.rows.map((r: any[]) => ({
                id: r[0],
                source: r[1],
                target: r[2],
                type: r[3],
                weight: r[4],
                metadata: typeof r[5] === 'string' ? JSON.parse(r[5]) : r[5]
            })));
        }

        const stats = this.calculateStats(nodes.length, edges.length);

        return {
            nodes,
            edges,
            stats,
            scope: this.scope,
            timestamp: Date.now()
        };
    }
}
