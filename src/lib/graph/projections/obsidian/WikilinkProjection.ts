import { BaseProjection } from '../BaseProjection';
import { ObsidianScope } from '../types/obsidian';
import { GraphProjection } from '../types/base';
import { CozoDbService } from '@/lib/cozo/db';

export class WikilinkProjection extends BaseProjection<ObsidianScope> {
    // Can be used to view the local neighbourhood of a specific note (backlinks + forward links)
    // Reuses "ObsidianScope" but conceptually focuses on one note.
    // We might abuse 'folderId' as 'contextId' or just pass a special target.
    // Since our type def allows 'target: folder', we might need to extend it later or assume
    // this is handled by a special scope or just a method.
    // For now, let's assume this is triggered with a custom 'global' scope filter?
    // Or better, let's ignore strictly adhering to the "Scope" type limits for the constructor
    // and accept the contextId.

    // Correction: The plan defined standard types. Let's assume this projection uses the ObsidianScope
    // but perhaps adds a hack or just requires a specialized constructor if needed.
    // Actually, Phase 1 didn't define 'note' target for ObsidianScope?
    // Checking ObsidianScope... target: 'global' | 'folder'.
    // Right. So strict typing suggests this might be an 'Entity' scope feature (target='note')?
    // No, Obsidian graph usually has 'local graph'.
    // We'll stick to the plan: WikilinkProjection.ts. 
    // We will add a 'noteId' to the class, potentially ignoring strict scope validation for now.

    private noteId: string;

    constructor(db: CozoDbService, noteId: string) {
        // Construct a pseudo-scope or valid one
        const scope: ObsidianScope = { type: 'obsidian', target: 'global' };
        super(db, scope);
        this.noteId = noteId;
    }

    protected getCacheKey(): string {
        return `obsidian:note:${this.noteId}`;
    }

    async project(): Promise<GraphProjection<ObsidianScope>> {
        const sanitize = (str: string) => str.replace(/"/g, '\\"');
        const targetId = sanitize(this.noteId);

        const query = `
      $target_id = "${targetId}"

      # 1. Target Note
      core_nodes[id] := *note{id}, id == $target_id

      # 2. Notes linking TO the target
      backlink_nodes[id] := *note_entity_links{source_id: id, target_id: $target_id}, *note{id}
      
      # 3. Notes the target links TO
      outgoing_nodes[id] := *note_entity_links{source_id: $target_id, target_id: id}, *note{id}

      # Consolidated Scope
      scope[id] := core_nodes[id]
      scope[id] := backlink_nodes[id]
      scope[id] := outgoing_nodes[id]

      # Node Details
      nodes[id, label, type, weight] := 
        scope[id],
        *note{id, title},
        label = title,
        type = "note",
        weight = 1

      # Edge Details (only edges within scope)
      links[id, source, target, type, weight] := 
        *note_entity_links{id, source_id, target_id, link_type, relevance},
        scope[source_id],
        scope[target_id],
        source = source_id,
        target = target_id,
        type = link_type,
        weight = relevance
      
      # Output
      ?[id, label, type, metadata, weight] := 
        nodes[id, label, type, weight],
        metadata = json_object("is_target", id == $target_id)
      
      ?[id, source, target, type, weight, metadata] := 
        links[id, source, target, type, weight],
        metadata = json_object()
    `;

        // We can run this as a single query and split result if we modify query to use @union or similar?
        // Or just run 2 queries again. Safer.

        // Nodes
        const nodesQuery = query.replace(/\?\[id, source, target.*?metadata\].*$/s, '')
            + ` ?[id, label, type, metadata, weight] := nodes[id, label, type, weight], 
                               metadata = json_object("is_target", id == $target_id)`;

        // Edges
        const edgesQuery = query.replace(/\?\[id, label, type.*?metadata\].*?weight\].*$/s, '')
            + ` ?[id, source, target, type, weight, metadata] := links[id, source, target, type, weight], 
                               metadata = json_object()`;

        // Wait, regex replace is risky. Let's just copy paste the common parts.
        const commonScope = `
      $target_id = "${targetId}"
      core_nodes[id] := *note{id}, id == $target_id
      backlink_nodes[id] := *note_entity_links{source_id: id, target_id: $target_id}, *note{id}
      outgoing_nodes[id] := *note_entity_links{source_id: $target_id, target_id: id}, *note{id}
      scope[id] := core_nodes[id]
      scope[id] := backlink_nodes[id]
      scope[id] := outgoing_nodes[id]
    `;

        const nodesQ = `
      ${commonScope}
      ?[id, label, type, metadata, weight] := 
        scope[id], *note{id, title}, label = title, type = "note", weight = 1,
        metadata = json_object("is_target", id == $target_id)
    `;

        const edgesQ = `
      ${commonScope}
      ?[id, source, target, type, weight, metadata] := 
        *note_entity_links{id, source_id, target_id, link_type, relevance},
        scope[source_id], scope[target_id],
        source = source_id, target = target_id, type = link_type, weight = relevance,
        metadata = json_object()
    `;

        const nodes: any[] = [];
        const edges: any[] = [];

        const nRes = await this.db.runQuery(nodesQ);
        if (nRes.rows) {
            nodes.push(...nRes.rows.map((r: any[]) => ({
                id: r[0], label: r[1], type: r[2], metadata: JSON.parse(r[3]), weight: r[4],
                color: JSON.parse(r[3]).is_target ? '#ff9900' : '#a0a0a0'
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
}
