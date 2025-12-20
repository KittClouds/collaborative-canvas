import type { 
  NodeId, 
  NodeType, 
  UnifiedNode, 
  UnifiedNodeData,
  EntityKind 
} from './types';

export class GraphIndexManager {
  private byType: Map<NodeType, Set<NodeId>> = new Map();
  private byKind: Map<EntityKind, Set<NodeId>> = new Map();
  private byFolder: Map<NodeId, Set<NodeId>> = new Map();
  private byBlueprint: Map<NodeId, Set<NodeId>> = new Map();
  private byLabel: Map<string, Set<NodeId>> = new Map();
  private bySourceNote: Map<NodeId, Set<NodeId>> = new Map();

  constructor() {
    this.clear();
  }

  indexNode(node: UnifiedNode): void {
    const data = node.data;
    
    this.addToSetMap(this.byType, data.type, data.id);
    
    if (data.entityKind) {
      this.addToSetMap(this.byKind, data.entityKind, data.id);
    }
    
    if (data.parentId) {
      this.addToSetMap(this.byFolder, data.parentId, data.id);
    }
    
    if (data.blueprintId) {
      this.addToSetMap(this.byBlueprint, data.blueprintId, data.id);
    }
    
    const normalizedLabel = this.normalizeLabel(data.label);
    this.addToSetMap(this.byLabel, normalizedLabel, data.id);
    
    if (data.sourceNoteId) {
      this.addToSetMap(this.bySourceNote, data.sourceNoteId, data.id);
    }
  }

  unindexNode(nodeId: NodeId, data: UnifiedNodeData): void {
    this.removeFromSetMap(this.byType, data.type, nodeId);
    
    if (data.entityKind) {
      this.removeFromSetMap(this.byKind, data.entityKind, nodeId);
    }
    
    if (data.parentId) {
      this.removeFromSetMap(this.byFolder, data.parentId, nodeId);
    }
    
    if (data.blueprintId) {
      this.removeFromSetMap(this.byBlueprint, data.blueprintId, nodeId);
    }
    
    const normalizedLabel = this.normalizeLabel(data.label);
    this.removeFromSetMap(this.byLabel, normalizedLabel, nodeId);
    
    if (data.sourceNoteId) {
      this.removeFromSetMap(this.bySourceNote, data.sourceNoteId, nodeId);
    }
  }

  updateNodeIndex(
    nodeId: NodeId, 
    oldData: Partial<UnifiedNodeData>, 
    newData: Partial<UnifiedNodeData>
  ): void {
    if (oldData.type !== newData.type && oldData.type && newData.type) {
      this.removeFromSetMap(this.byType, oldData.type, nodeId);
      this.addToSetMap(this.byType, newData.type, nodeId);
    }
    
    if (oldData.entityKind !== newData.entityKind) {
      if (oldData.entityKind) {
        this.removeFromSetMap(this.byKind, oldData.entityKind, nodeId);
      }
      if (newData.entityKind) {
        this.addToSetMap(this.byKind, newData.entityKind, nodeId);
      }
    }
    
    if (oldData.parentId !== newData.parentId) {
      if (oldData.parentId) {
        this.removeFromSetMap(this.byFolder, oldData.parentId, nodeId);
      }
      if (newData.parentId) {
        this.addToSetMap(this.byFolder, newData.parentId, nodeId);
      }
    }
    
    if (oldData.blueprintId !== newData.blueprintId) {
      if (oldData.blueprintId) {
        this.removeFromSetMap(this.byBlueprint, oldData.blueprintId, nodeId);
      }
      if (newData.blueprintId) {
        this.addToSetMap(this.byBlueprint, newData.blueprintId, nodeId);
      }
    }
    
    if (oldData.label !== newData.label) {
      if (oldData.label) {
        const oldNormalized = this.normalizeLabel(oldData.label);
        this.removeFromSetMap(this.byLabel, oldNormalized, nodeId);
      }
      if (newData.label) {
        const newNormalized = this.normalizeLabel(newData.label);
        this.addToSetMap(this.byLabel, newNormalized, nodeId);
      }
    }
    
    if (oldData.sourceNoteId !== newData.sourceNoteId) {
      if (oldData.sourceNoteId) {
        this.removeFromSetMap(this.bySourceNote, oldData.sourceNoteId, nodeId);
      }
      if (newData.sourceNoteId) {
        this.addToSetMap(this.bySourceNote, newData.sourceNoteId, nodeId);
      }
    }
  }

  getByType(type: NodeType): NodeId[] {
    return Array.from(this.byType.get(type) || []);
  }

  getByKind(kind: EntityKind): NodeId[] {
    return Array.from(this.byKind.get(kind) || []);
  }

  getByFolder(folderId: NodeId): NodeId[] {
    return Array.from(this.byFolder.get(folderId) || []);
  }

  getByBlueprint(blueprintId: NodeId): NodeId[] {
    return Array.from(this.byBlueprint.get(blueprintId) || []);
  }

  getByLabel(label: string): NodeId[] {
    const normalized = this.normalizeLabel(label);
    return Array.from(this.byLabel.get(normalized) || []);
  }

  getBySourceNote(noteId: NodeId): NodeId[] {
    return Array.from(this.bySourceNote.get(noteId) || []);
  }

  searchByLabel(query: string, fuzzy: boolean = false): NodeId[] {
    const normalizedQuery = this.normalizeLabel(query);
    
    if (!fuzzy) {
      return this.getByLabel(query);
    }
    
    const results: NodeId[] = [];
    for (const [label, ids] of this.byLabel) {
      if (label.includes(normalizedQuery)) {
        results.push(...ids);
      }
    }
    return results;
  }

  clear(): void {
    this.byType = new Map([
      ['NOTE', new Set()],
      ['FOLDER', new Set()],
      ['ENTITY', new Set()],
      ['BLUEPRINT', new Set()],
      ['TEMPORAL', new Set()],
    ]);
    this.byKind = new Map();
    this.byFolder = new Map();
    this.byBlueprint = new Map();
    this.byLabel = new Map();
    this.bySourceNote = new Map();
  }

  rebuildFromNodes(nodes: UnifiedNode[]): void {
    this.clear();
    for (const node of nodes) {
      this.indexNode(node);
    }
  }

  private addToSetMap<K>(map: Map<K, Set<NodeId>>, key: K, nodeId: NodeId): void {
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key)!.add(nodeId);
  }

  private removeFromSetMap<K>(map: Map<K, Set<NodeId>>, key: K, nodeId: NodeId): void {
    const set = map.get(key);
    if (set) {
      set.delete(nodeId);
      if (set.size === 0) {
        map.delete(key);
      }
    }
  }

  private normalizeLabel(label: string): string {
    return label.trim().toLowerCase();
  }

  getStats(): {
    typeCount: Record<NodeType, number>;
    kindCount: Record<string, number>;
    folderCount: number;
    blueprintCount: number;
  } {
    const typeCount: Record<NodeType, number> = {
      NOTE: this.byType.get('NOTE')?.size || 0,
      FOLDER: this.byType.get('FOLDER')?.size || 0,
      ENTITY: this.byType.get('ENTITY')?.size || 0,
      BLUEPRINT: this.byType.get('BLUEPRINT')?.size || 0,
      TEMPORAL: this.byType.get('TEMPORAL')?.size || 0,
    };
    
    const kindCount: Record<string, number> = {};
    for (const [kind, ids] of this.byKind) {
      kindCount[kind] = ids.size;
    }
    
    return {
      typeCount,
      kindCount,
      folderCount: this.byFolder.size,
      blueprintCount: this.byBlueprint.size,
    };
  }
}
