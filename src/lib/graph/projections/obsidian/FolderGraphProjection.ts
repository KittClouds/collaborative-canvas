import { BaseProjection } from '../BaseProjection';
import { ObsidianScope } from '../types/obsidian';
import { GraphProjection } from '../types/base';
import { ObsidianQueries } from '../../queries/obsidian.queries';
import { CozoDbService } from '@/lib/cozo/db';

export class FolderGraphProjection extends BaseProjection<ObsidianScope> {
    constructor(db: CozoDbService, scope: ObsidianScope) {
        if (scope.target !== 'folder' || !scope.folderId) {
            throw new Error('FolderGraphProjection requires scope target folder and folderId.');
        }
        super(db, scope);
    }

    async project(): Promise<GraphProjection<ObsidianScope>> {
        if (!this.scope.folderId) return this.getErrorProjection();

        // Use the builder's query but split for easier fetching
        const fullQuery = ObsidianQueries.getFolderNotesAndLinks(this.scope.folderId);

        // We'll execute the separate parts manually for reliability
        // 1. Define Scope (Folder Tree)
        // 2. Fetch Nodes in Scope
        // 3. Fetch Edges in Scope

        const sanitize = (str: string) => str.replace(/"/g, '\\"');
        const folderId = sanitize(this.scope.folderId);

        const nodeQuery = `
      $folder_id = "${folderId}"
      folder_tree[id] := *folder_hierarchy{parent_id: $folder_id, child_id: id}
      folder_tree[id] := folder_tree[parent], *folder_hierarchy{parent_id: parent, child_id: id}
      
      scope_notes[id] := folder_tree[folder_id], *folder_hierarchy{parent_id: folder_id, child_id: id, child_entity_kind: "NOTE"}
      scope_notes[id] := *folder_hierarchy{parent_id: $folder_id, child_id: id, child_entity_kind: "NOTE"}

      ?[id, label, type, metadata, weight] := 
        scope_notes[id],
        *note{id, title, created_at},
        label = title,
        type = "note",
        metadata = json_object("created_at", created_at),
        weight = 1
    `;

        const edgeQuery = `
      $folder_id = "${folderId}"
      folder_tree[id] := *folder_hierarchy{parent_id: $folder_id, child_id: id}
      folder_tree[id] := folder_tree[parent], *folder_hierarchy{parent_id: parent, child_id: id}
      
      scope_notes[id] := folder_tree[folder_id], *folder_hierarchy{parent_id: folder_id, child_id: id, child_entity_kind: "NOTE"}
      scope_notes[id] := *folder_hierarchy{parent_id: $folder_id, child_id: id, child_entity_kind: "NOTE"}

      ?[id, source, target, type, weight, metadata] := 
        *note_entity_links{id, source_id, target_id, link_type, relevance},
        scope_notes[source_id],
        scope_notes[target_id],
        source = source_id,
        target = target_id,
        type = link_type,
        weight = relevance,
        metadata = json_object()
    `;

        const nodes: any[] = [];
        const edges: any[] = [];

        const nodeResult = await this.db.runQuery(nodeQuery);
        if (nodeResult.rows) {
            nodes.push(...nodeResult.rows.map((r: any[]) => ({
                id: r[0],
                label: r[1],
                type: r[2],
                metadata: typeof r[3] === 'string' ? JSON.parse(r[3]) : r[3],
                weight: r[4],
                color: '#a0a0a0'
            })));
        }

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

    private getErrorProjection(): GraphProjection<ObsidianScope> {
        return {
            nodes: [],
            edges: [],
            stats: { nodeCount: 0, edgeCount: 0, density: 0 },
            scope: this.scope,
            timestamp: Date.now()
        };
    }
}
