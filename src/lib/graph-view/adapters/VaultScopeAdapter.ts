import { cozoDb } from '@/lib/cozo/db';
import type { GraphData, GraphNode, GraphEdge, AdapterOptions } from '../types';
import { buildNodeVisual, buildEdgeVisual } from '../utils/styling';

interface FolderRow {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  entityKind: string | null;
  entitySubtype: string | null;
  isTypedRoot: boolean;
}

interface NoteRow {
  id: string;
  title: string;
  folderId: string | null;
  entityKind: string | null;
  entitySubtype: string | null;
  isCanonicalEntity: boolean;
  createdAt: number;
  updatedAt: number;
}

interface WikilinkRow {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  linkType: string;
}

export class VaultScopeAdapter {
  async build(options: AdapterOptions = {}): Promise<GraphData> {
    const [folders, notes, wikilinks, backlinkCounts] = await Promise.all([
      this.queryFolders(),
      this.queryNotes(),
      this.queryWikilinks(),
      this.queryBacklinkCounts(),
    ]);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const backlinkMap = new Map(backlinkCounts);

    for (const folder of folders) {
      const isTyped = !!folder.entityKind;
      nodes.push({
        id: folder.id,
        type: 'folder',
        label: folder.name,
        scope: 'vault',
        metadata: {
          entityKind: folder.entityKind || undefined,
          entitySubtype: folder.entitySubtype || undefined,
          isTyped,
          parentId: folder.parentId || undefined,
          path: folder.path,
        },
        visual: buildNodeVisual('folder', folder.entityKind || undefined),
      });

      if (folder.parentId) {
        edges.push({
          id: `contains:${folder.parentId}:${folder.id}`,
          source: folder.parentId,
          target: folder.id,
          type: 'contains',
          scope: 'vault',
          visual: buildEdgeVisual('contains'),
        });
      }
    }

    for (const note of notes) {
      const backlinkCount = backlinkMap.get(note.id) || 0;
      const isTyped = !!note.entityKind;

      nodes.push({
        id: note.id,
        type: 'note',
        label: note.title,
        scope: 'vault',
        metadata: {
          entityKind: note.entityKind || undefined,
          entitySubtype: note.entitySubtype || undefined,
          isTyped,
          isCanonical: note.isCanonicalEntity,
          frequency: backlinkCount,
          folderId: note.folderId || undefined,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
        visual: buildNodeVisual('note', note.entityKind || undefined, backlinkCount),
      });

      if (note.folderId) {
        edges.push({
          id: `contains:${note.folderId}:${note.id}`,
          source: note.folderId,
          target: note.id,
          type: 'contains',
          scope: 'vault',
          visual: buildEdgeVisual('contains'),
        });
      }
    }

    for (const link of wikilinks) {
      edges.push({
        id: link.id,
        source: link.sourceNoteId,
        target: link.targetNoteId,
        type: link.linkType === 'backlink' ? 'backlink' : 'wikilink',
        scope: 'vault',
        visual: buildEdgeVisual(link.linkType === 'backlink' ? 'backlink' : 'wikilink'),
      });
    }

    if (!options.includeOrphans) {
      const connectedIds = new Set<string>();
      for (const edge of edges) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
      }
      const filteredNodes = nodes.filter(n => connectedIds.has(n.id) || n.type === 'folder');
      return this.buildGraphData(filteredNodes, edges);
    }

    return this.buildGraphData(nodes, edges);
  }

  async updateNote(noteId: string): Promise<GraphNode | null> {
    const query = `
      ?[id, title, folder_id, entity_kind, entity_subtype, is_canonical_entity, created_at, updated_at] := 
        *note{id, title, folder_id, entity_kind, entity_subtype, is_canonical_entity, created_at, updated_at},
        id == $id
    `;

    try {
      const result = cozoDb.runQuery(query, { id: noteId });
      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0] as unknown[];
      const note = this.parseNoteRow(row);
      const backlinkCount = await this.getBacklinkCountForNote(noteId);

      return {
        id: note.id,
        type: 'note',
        label: note.title,
        scope: 'vault',
        metadata: {
          entityKind: note.entityKind || undefined,
          entitySubtype: note.entitySubtype || undefined,
          isTyped: !!note.entityKind,
          isCanonical: note.isCanonicalEntity,
          frequency: backlinkCount,
          folderId: note.folderId || undefined,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
        visual: buildNodeVisual('note', note.entityKind || undefined, backlinkCount),
      };
    } catch (err) {
      console.error('[VaultScopeAdapter] Failed to update note:', err);
      return null;
    }
  }

  async updateFolder(folderId: string): Promise<GraphNode | null> {
    const query = `
      ?[id, name, path, parent_id, entity_kind, entity_subtype, is_typed_root] := 
        *folder{id, name, path, parent_id, entity_kind, entity_subtype, is_typed_root},
        id == $id
    `;

    try {
      const result = cozoDb.runQuery(query, { id: folderId });
      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0] as unknown[];
      const folder = this.parseFolderRow(row);

      return {
        id: folder.id,
        type: 'folder',
        label: folder.name,
        scope: 'vault',
        metadata: {
          entityKind: folder.entityKind || undefined,
          entitySubtype: folder.entitySubtype || undefined,
          isTyped: !!folder.entityKind,
          parentId: folder.parentId || undefined,
          path: folder.path,
        },
        visual: buildNodeVisual('folder', folder.entityKind || undefined),
      };
    } catch (err) {
      console.error('[VaultScopeAdapter] Failed to update folder:', err);
      return null;
    }
  }

  async getLinksForNote(noteId: string): Promise<GraphEdge[]> {
    const query = `
      ?[id, source_note_id, target_note_id, link_type] := 
        *wikilink{id, source_note_id, target_note_id, link_type},
        target_note_id != null,
        or(source_note_id == $note_id, target_note_id == $note_id)
    `;

    try {
      const result = cozoDb.runQuery(query, { note_id: noteId });
      if (!result.rows) return [];

      return result.rows.map((row: unknown[]) => {
        const link = this.parseWikilinkRow(row);
        return {
          id: link.id,
          source: link.sourceNoteId,
          target: link.targetNoteId,
          type: link.linkType === 'backlink' ? 'backlink' : 'wikilink',
          scope: 'vault' as const,
          visual: buildEdgeVisual(link.linkType === 'backlink' ? 'backlink' : 'wikilink'),
        };
      });
    } catch (err) {
      console.error('[VaultScopeAdapter] Failed to get links for note:', err);
      return [];
    }
  }

  private async queryFolders(): Promise<FolderRow[]> {
    const query = `
      ?[id, name, path, parent_id, entity_kind, entity_subtype, is_typed_root] := 
        *folder{id, name, path, parent_id, entity_kind, entity_subtype, is_typed_root}
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return [];
      return result.rows.map((row: unknown[]) => this.parseFolderRow(row));
    } catch (err) {
      console.error('[VaultScopeAdapter] Failed to query folders:', err);
      return [];
    }
  }

  private async queryNotes(): Promise<NoteRow[]> {
    const query = `
      ?[id, title, folder_id, entity_kind, entity_subtype, is_canonical_entity, created_at, updated_at] := 
        *note{id, title, folder_id, entity_kind, entity_subtype, is_canonical_entity, created_at, updated_at}
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return [];
      return result.rows.map((row: unknown[]) => this.parseNoteRow(row));
    } catch (err) {
      console.error('[VaultScopeAdapter] Failed to query notes:', err);
      return [];
    }
  }

  private async queryWikilinks(): Promise<WikilinkRow[]> {
    const query = `
      ?[id, source_note_id, target_note_id, link_type] := 
        *wikilink{id, source_note_id, target_note_id, link_type},
        target_note_id != null
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return [];
      return result.rows.map((row: unknown[]) => this.parseWikilinkRow(row));
    } catch (err) {
      console.error('[VaultScopeAdapter] Failed to query wikilinks:', err);
      return [];
    }
  }

  private async queryBacklinkCounts(): Promise<Map<string, number>> {
    const query = `
      counts[note_id, cnt] := 
        *wikilink{target_note_id: note_id},
        note_id != null,
        cnt = count(note_id)
      ?[note_id, cnt] := counts[note_id, cnt]
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return new Map();
      
      const map = new Map<string, number>();
      for (const row of result.rows as unknown[][]) {
        map.set(row[0] as string, row[1] as number);
      }
      return map;
    } catch (err) {
      console.error('[VaultScopeAdapter] Failed to query backlink counts:', err);
      return new Map();
    }
  }

  private async getBacklinkCountForNote(noteId: string): Promise<number> {
    const query = `
      ?[cnt] := 
        *wikilink{target_note_id},
        target_note_id == $note_id,
        cnt = count(target_note_id)
    `;

    try {
      const result = cozoDb.runQuery(query, { note_id: noteId });
      if (!result.rows || result.rows.length === 0) return 0;
      return (result.rows[0] as unknown[])[0] as number;
    } catch {
      return 0;
    }
  }

  private parseFolderRow(row: unknown[]): FolderRow {
    return {
      id: row[0] as string,
      name: row[1] as string,
      path: row[2] as string,
      parentId: row[3] as string | null,
      entityKind: row[4] as string | null,
      entitySubtype: row[5] as string | null,
      isTypedRoot: row[6] as boolean,
    };
  }

  private parseNoteRow(row: unknown[]): NoteRow {
    return {
      id: row[0] as string,
      title: row[1] as string,
      folderId: row[2] as string | null,
      entityKind: row[3] as string | null,
      entitySubtype: row[4] as string | null,
      isCanonicalEntity: row[5] as boolean,
      createdAt: row[6] as number,
      updatedAt: row[7] as number,
    };
  }

  private parseWikilinkRow(row: unknown[]): WikilinkRow {
    return {
      id: row[0] as string,
      sourceNoteId: row[1] as string,
      targetNoteId: row[2] as string,
      linkType: row[3] as string,
    };
  }

  private buildGraphData(nodes: GraphNode[], edges: GraphEdge[]): GraphData {
    return {
      nodes,
      edges,
      scope: 'vault',
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        builtAt: Date.now(),
      },
    };
  }
}
