import { BaseProjection } from '../BaseProjection';
import { EntityScope } from '../types/entity';
import { GraphProjection } from '../types/base';
import { CozoDbService } from '@/lib/cozo/db';

export class NoteEntityProjection extends BaseProjection<EntityScope> {
    constructor(db: CozoDbService, scope: EntityScope) {
        if (scope.target !== 'note' || !scope.contextId) {
            throw new Error('NoteEntityProjection requires note target and contextId.');
        }
        super(db, scope);
    }

    async project(): Promise<GraphProjection<EntityScope>> {
        if (!this.scope.contextId) return this.getErrorProjection();

        const sanitize = (str: string) => str.replace(/"/g, '\\"');
        const noteId = sanitize(this.scope.contextId);

        // Common Scope logic
        const scopeLogic = `
      $note_id = "${noteId}"
      scope_entities[id] := *note_entity_links{source_id: $note_id, target_id: id}
    `;

        const nodesQ = `
      ${scopeLogic}
      ?[id, label, type, metadata, weight] := 
        scope_entities[id],
        *entity{id, name, entity_kind, frequency},
        label = name,
        type = entity_kind,
        frequency = frequency, # Needed for metadata?
        metadata = json_object("frequency", frequency),
        weight = frequency
    `;

        const edgesQ = `
      ${scopeLogic}
      ?[id, source, target, type, weight, metadata] := 
        *entity_edge{id, source_id, target_id, edge_type, confidence},
        scope_entities[source_id],
        scope_entities[target_id],
        source = source_id, target = target_id, type = edge_type, weight = confidence,
        metadata = json_object()
    `;

        const nodes: any[] = [];
        const edges: any[] = [];

        const nRes = await this.db.runQuery(nodesQ);
        if (nRes.rows) {
            nodes.push(...nRes.rows.map((r: any[]) => ({
                id: r[0], label: r[1], type: r[2], metadata: JSON.parse(r[3]), weight: r[4],
                color: this.getColorForType(r[2])
            })));
        }

        const eRes = await this.db.runQuery(edgesQ);
        if (eRes.rows) {
            edges.push(...eRes.rows.map((r: any[]) => ({
                id: r[0], source: r[1], target: r[2], type: r[3], weight: r[4], metadata: JSON.parse(r[5])
            })));
        }

        return {
            nodes,
            edges,
            stats: this.calculateStats(nodes.length, edges.length),
            scope: this.scope,
            timestamp: Date.now()
        };
    }

    private getErrorProjection(): GraphProjection<EntityScope> {
        return {
            nodes: [],
            edges: [],
            stats: { nodeCount: 0, edgeCount: 0, density: 0 },
            scope: this.scope,
            timestamp: Date.now()
        };
    }

    private getColorForType(type: string): string {
        const colors: Record<string, string> = {
            'CHARACTER': '#e63946',
            'LOCATION': '#2a9d8f',
            'ITEM': '#e9c46a',
            'EVENT': '#f4a261',
            'CONCEPT': '#8d99ae',
            'FACTION': '#1d3557'
        };
        return colors[type] || '#cccccc';
    }
}
