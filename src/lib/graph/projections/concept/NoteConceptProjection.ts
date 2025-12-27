import { BaseProjection } from '../BaseProjection';
import { ConceptScope } from '../types/concept';
import { GraphProjection } from '../types/base';
import { ConceptQueries } from '../../queries/concept.queries';
import { CozoDbService } from '@/lib/cozo/db';

export class NoteConceptProjection extends BaseProjection<ConceptScope> {
    constructor(db: CozoDbService, scope: ConceptScope) {
        if (scope.target !== 'note' || !scope.contextId) {
            throw new Error('NoteConceptProjection requires note target and contextId.');
        }
        super(db, scope);
    }

    async project(): Promise<GraphProjection<ConceptScope>> {
        if (!this.scope.contextId) return this.getErrorProjection();

        const sanitize = (str: string) => str.replace(/"/g, '\\"');
        const noteId = sanitize(this.scope.contextId);

        // Strategy: 
        // 1. Fetch co-occurrence edges
        // 2. Derive nodes from those edges

        const edgesQ = `
        $note_id = "${noteId}"
        edges[source, target, weight] := 
          *term_cooccurrence{note_id, term1, term2, frequency},
          note_id == $note_id,
          source = term1, target = term2, weight = frequency
        
        ?[id, source, target, type, weight, metadata] := 
          edges[source, target, weight],
          id = concat(source, "_", target), 
          type = "co_occurrence",
          metadata = json_object("weight", weight)
     `;

        // Nodes can be derived from edges if we don't have a terms table readily available in schema
        // or just use unique terms from the edges
        // Cozo doesn't let us easily iterate the resulting edges in JS to make nodes if we want to do it all in query.
        // But we can query for unique terms involved in the edges.

        const nodesQ = `
        $note_id = "${noteId}"
        edges[source, target, weight] := 
          *term_cooccurrence{note_id, term1, term2, frequency},
          note_id == $note_id,
          source = term1, target = term2, weight = frequency

        relevant_terms[term] := edges[term, _, _]
        relevant_terms[term] := edges[_, term, _]

        ?[id, label, type, metadata, weight] := 
          relevant_terms[id],
          label = id,
          weight = 1,
          type = "concept",
          metadata = json_object()
     `;

        const nodes: any[] = [];
        const edges: any[] = [];

        // Note: We need check if term_cooccurrence table exists. 
        // We will assume it does for this implementation as per instructions.

        try {
            const nRes = await this.db.runQuery(nodesQ);
            if (nRes.rows) {
                nodes.push(...nRes.rows.map((r: any[]) => ({
                    id: r[0], label: r[1], type: r[2], metadata: JSON.parse(r[3]), weight: r[4],
                    color: '#8d99ae'
                })));
            }

            const eRes = await this.db.runQuery(edgesQ);
            if (eRes.rows) {
                edges.push(...eRes.rows.map((r: any[]) => ({
                    id: r[0], source: r[1], target: r[2], type: r[3], weight: r[4], metadata: JSON.parse(r[5])
                })));
            }
        } catch (e) {
            console.warn("Concept projection failed, likely missing schema", e);
        }

        return {
            nodes,
            edges,
            stats: this.calculateStats(nodes.length, edges.length),
            scope: this.scope,
            timestamp: Date.now()
        };
    }

    private getErrorProjection(): GraphProjection<ConceptScope> {
        return {
            nodes: [],
            edges: [],
            stats: { nodeCount: 0, edgeCount: 0, density: 0 },
            scope: this.scope,
            timestamp: Date.now()
        };
    }
}
