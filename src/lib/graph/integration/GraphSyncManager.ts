import { getGraph } from '../graphInstance';
import type { UnifiedGraph } from '../UnifiedGraph';
import type { Note, Folder } from '@/contexts/NotesContext';
import type { NodeId, UnifiedNode } from '../types';
import type { EntityKind } from '@/lib/entities/entityTypes';

export interface SyncOptions {
  extractEntities?: boolean;
  syncBacklinks?: boolean;
  syncMentions?: boolean;
}

const BACKLINK_REGEX = /<<([^>]+)>>/g;
const MENTION_REGEX = /\[\[([^\]]+)\]\]/g;

export class GraphSyncManager {
  private graph: UnifiedGraph;
  private noteIdMap: Map<string, NodeId> = new Map();
  private folderIdMap: Map<string, NodeId> = new Map();
  private options: SyncOptions;

  constructor(options: SyncOptions = {}) {
    this.graph = getGraph();
    this.options = {
      extractEntities: options.extractEntities ?? true,
      syncBacklinks: options.syncBacklinks ?? true,
      syncMentions: options.syncMentions ?? true,
    };
  }

  hydrateFromNotesContext(notes: Note[], folders: Folder[]): void {
    this.graph.clear();
    this.noteIdMap.clear();
    this.folderIdMap.clear();

    for (const folder of folders) {
      this.syncFolderToGraph(folder);
    }

    for (const note of notes) {
      this.syncNoteToGraph(note);
    }

    if (this.options.syncBacklinks || this.options.syncMentions) {
      for (const note of notes) {
        this.syncNoteRelationships(note, notes);
      }
    }
  }

  private syncFolderToGraph(folder: Folder): NodeId {
    const existingId = this.folderIdMap.get(folder.id);
    if (existingId && this.graph.hasNode(existingId)) {
      return existingId;
    }

    let parentGraphId: NodeId | undefined;
    if (folder.parentId) {
      parentGraphId = this.folderIdMap.get(folder.parentId);
    }

    const node = this.graph.createFolder(folder.name, parentGraphId, {
      entityKind: folder.entityKind,
      entitySubtype: folder.entitySubtype,
      isTypedRoot: folder.isTypedRoot,
      isSubtypeRoot: folder.isSubtypeRoot,
      color: folder.color,
    });

    const graphId = node.data.id;
    this.folderIdMap.set(folder.id, graphId);

    this.graph.updateNode(graphId, {
      createdAt: folder.createdAt instanceof Date 
        ? folder.createdAt.getTime() 
        : new Date(folder.createdAt).getTime(),
      inheritedKind: folder.inheritedKind,
      inheritedSubtype: folder.inheritedSubtype,
    });

    return graphId;
  }

  private syncNoteToGraph(note: Note): NodeId {
    const existingId = this.noteIdMap.get(note.id);
    if (existingId && this.graph.hasNode(existingId)) {
      return existingId;
    }

    let folderGraphId: NodeId | undefined;
    if (note.folderId) {
      folderGraphId = this.folderIdMap.get(note.folderId);
    }

    const node = this.graph.createNote(note.title, note.content, folderGraphId, {
      entityKind: note.entityKind,
      entitySubtype: note.entitySubtype,
      isEntity: note.isEntity,
      tags: note.tags,
    });

    const graphId = node.data.id;
    this.noteIdMap.set(note.id, graphId);

    this.graph.updateNode(graphId, {
      createdAt: note.createdAt instanceof Date 
        ? note.createdAt.getTime() 
        : new Date(note.createdAt).getTime(),
      updatedAt: note.updatedAt instanceof Date 
        ? note.updatedAt.getTime() 
        : new Date(note.updatedAt).getTime(),
      isPinned: note.isPinned,
      favorite: note.favorite,
    });

    return graphId;
  }

  private syncNoteRelationships(note: Note, allNotes: Note[]): void {
    const noteGraphId = this.noteIdMap.get(note.id);
    if (!noteGraphId) return;

    const content = note.content || '';

    if (this.options.syncBacklinks) {
      const backlinkMatches = content.matchAll(BACKLINK_REGEX);
      for (const match of backlinkMatches) {
        const targetTitle = match[1];
        const targetNote = allNotes.find(n => n.title === targetTitle);
        if (targetNote) {
          const targetGraphId = this.noteIdMap.get(targetNote.id);
          if (targetGraphId) {
            const existingEdges = this.graph.getEdgesBetween(noteGraphId, targetGraphId);
            const hasBacklink = existingEdges.some(e => e.data.type === 'BACKLINK');
            if (!hasBacklink) {
              this.graph.createBacklink(noteGraphId, targetGraphId);
            }
          }
        }
      }
    }

    if (this.options.syncMentions) {
      const mentionMatches = content.matchAll(MENTION_REGEX);
      for (const match of mentionMatches) {
        const entityLabel = match[1];
        const entityNote = allNotes.find(n => n.isEntity && n.entityLabel === entityLabel);
        if (entityNote) {
          const entityGraphId = this.noteIdMap.get(entityNote.id);
          if (entityGraphId) {
            const existingEdges = this.graph.getEdgesBetween(noteGraphId, entityGraphId);
            const hasMention = existingEdges.some(e => e.data.type === 'MENTIONS');
            if (!hasMention) {
              this.graph.createMentionEdge(noteGraphId, entityGraphId, match[0]);
            }
          }
        }
      }
    }
  }

  onNoteCreated(note: Note): NodeId {
    return this.syncNoteToGraph(note);
  }

  onNoteUpdated(note: Note, allNotes: Note[]): void {
    const graphId = this.noteIdMap.get(note.id);
    if (!graphId || !this.graph.hasNode(graphId)) {
      this.syncNoteToGraph(note);
      return;
    }

    let folderGraphId: NodeId | undefined;
    if (note.folderId) {
      folderGraphId = this.folderIdMap.get(note.folderId);
    }

    this.graph.updateNode(graphId, {
      label: note.title,
      content: note.content,
      parentId: folderGraphId,
      entityKind: note.entityKind,
      entitySubtype: note.entitySubtype,
      isEntity: note.isEntity,
      tags: note.tags,
      isPinned: note.isPinned,
      favorite: note.favorite,
      updatedAt: note.updatedAt instanceof Date 
        ? note.updatedAt.getTime() 
        : new Date(note.updatedAt).getTime(),
    });

    if (this.options.syncBacklinks || this.options.syncMentions) {
      this.clearNoteEdges(graphId, ['BACKLINK', 'MENTIONS']);
      this.syncNoteRelationships(note, allNotes);
    }
  }

  onNoteDeleted(noteId: string): void {
    const graphId = this.noteIdMap.get(noteId);
    if (graphId && this.graph.hasNode(graphId)) {
      this.graph.removeNode(graphId);
    }
    this.noteIdMap.delete(noteId);
  }

  onFolderCreated(folder: Folder): NodeId {
    return this.syncFolderToGraph(folder);
  }

  onFolderUpdated(folder: Folder): void {
    const graphId = this.folderIdMap.get(folder.id);
    if (!graphId || !this.graph.hasNode(graphId)) {
      this.syncFolderToGraph(folder);
      return;
    }

    let parentGraphId: NodeId | undefined;
    if (folder.parentId) {
      parentGraphId = this.folderIdMap.get(folder.parentId);
    }

    this.graph.updateNode(graphId, {
      label: folder.name,
      parentId: parentGraphId,
      entityKind: folder.entityKind,
      entitySubtype: folder.entitySubtype,
      isTypedRoot: folder.isTypedRoot,
      isSubtypeRoot: folder.isSubtypeRoot,
      inheritedKind: folder.inheritedKind,
      inheritedSubtype: folder.inheritedSubtype,
      color: folder.color,
    });
  }

  onFolderDeleted(folderId: string): void {
    const graphId = this.folderIdMap.get(folderId);
    if (graphId && this.graph.hasNode(graphId)) {
      this.graph.removeNode(graphId);
    }
    this.folderIdMap.delete(folderId);
  }

  private clearNoteEdges(noteId: NodeId, edgeTypes: string[]): void {
    const cy = this.graph.getInstance();
    const edges = cy.edges().filter(edge => {
      const data = edge.data();
      return (data.source === noteId || data.target === noteId) 
        && edgeTypes.includes(data.type);
    });
    edges.forEach(edge => {
      this.graph.removeEdge(edge.data('id'));
    });
  }

  getNoteGraphId(noteId: string): NodeId | undefined {
    return this.noteIdMap.get(noteId);
  }

  getFolderGraphId(folderId: string): NodeId | undefined {
    return this.folderIdMap.get(folderId);
  }

  getGraphNodeByNoteId(noteId: string): UnifiedNode | null {
    const graphId = this.noteIdMap.get(noteId);
    if (!graphId) return null;
    return this.graph.getNode(graphId);
  }

  getGraphNodeByFolderId(folderId: string): UnifiedNode | null {
    const graphId = this.folderIdMap.get(folderId);
    if (!graphId) return null;
    return this.graph.getNode(graphId);
  }

  getGraph(): UnifiedGraph {
    return this.graph;
  }
}

let syncManagerInstance: GraphSyncManager | null = null;

export function getGraphSyncManager(options?: SyncOptions): GraphSyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new GraphSyncManager(options);
  }
  return syncManagerInstance;
}

export function resetGraphSyncManager(): void {
  syncManagerInstance = null;
}
