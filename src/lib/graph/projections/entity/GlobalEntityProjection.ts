import { BaseProjection } from '../BaseProjection';
import { EntityScope } from '../types/entity';
import { GraphProjection } from '../types/base';
import { EntityQueries } from '../../queries/entity.queries';
import { CozoDbService } from '@/lib/cozo/db';

export class GlobalEntityProjection extends BaseProjection<EntityScope> {
    constructor(db: CozoDbService, scope: EntityScope) {
        if (scope.target !== 'global') {
            throw new Error('GlobalEntityProjection requires global scope targets.');
        }
        super(db, scope);
    }

    async project(): Promise<GraphProjection<EntityScope>> {
        const rawQuery = EntityQueries.getAllEntities();

        // Deconstruct for execution
        const nodesQ = `
      # Nodes: Entities
      nodes[id, label, type, color, weight] := 
        *entity{id, name, entity_kind, frequency},
        label = name,
        type = entity_kind,
        weight = frequency * 1.0,
        color = "#cccccc"

      ?[id, label, type, metadata, weight, color] := 
        nodes[id, label, type, color, weight],
        metadata = json_object("frequency", weight)
    `;

        const edgesQ = `
      # Edges: Entity Relationships
      edges[id, source, target, type, weight] := 
        *entity_edge{id, source_id, target_id, edge_type, confidence},
        source = source_id,
        target = target_id,
        type = edge_type,
        weight = confidence

      ?[id, source, target, type, weight, metadata] := 
        edges[id, source, target, type, weight],
        metadata = json_object("confidence", weight)
    `;

        const nodes: any[] = [];
        const edges: any[] = [];

        const nRes = await this.db.runQuery(nodesQ);
        if (nRes.rows) {
            nodes.push(...nRes.rows.map((r: any[]) => ({
                id: r[0], label: r[1], type: r[2], metadata: JSON.parse(r[3]), weight: r[4], color: this.getColorForType(r[2])
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
