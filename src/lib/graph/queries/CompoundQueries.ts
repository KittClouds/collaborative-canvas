import { getGraph } from '@/lib/graph/graphInstance';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, NodeId } from '@/lib/graph/types';

export interface FolderHierarchy {
  folder: UnifiedNode;
  depth: number;
  children: FolderHierarchy[];
  notes: UnifiedNode[];
  totalNotes: number;
  totalFolders: number;
}

export interface AncestorPath {
  path: UnifiedNode[];
  depth: number;
}

export class CompoundQueries {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  getRootFolders(): UnifiedNode[] {
    return this.graph.filterNodes(node => 
      node.data.type === 'FOLDER' && !node.data.parentId
    );
  }

  getChildFolders(folderId: NodeId): UnifiedNode[] {
    return this.graph.filterNodes(node =>
      node.data.type === 'FOLDER' && node.data.parentId === folderId
    );
  }

  getChildNotes(folderId: NodeId): UnifiedNode[] {
    return this.graph.filterNodes(node =>
      node.data.type === 'NOTE' && node.data.parentId === folderId
    );
  }

  getAncestors(nodeId: NodeId): AncestorPath {
    const path: UnifiedNode[] = [];
    let currentId: NodeId | undefined = nodeId;

    while (currentId) {
      const node = this.graph.getNode(currentId);
      if (!node) break;
      path.unshift(node);
      currentId = node.data.parentId;
    }

    return {
      path,
      depth: path.length - 1,
    };
  }

  getDescendants(folderId: NodeId, includeNotes: boolean = true): UnifiedNode[] {
    const result: UnifiedNode[] = [];
    const queue: NodeId[] = [folderId];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = this.graph.filterNodes(node =>
        node.data.parentId === currentId
      );

      for (const child of children) {
        if (child.data.type === 'FOLDER') {
          result.push(child);
          queue.push(child.data.id);
        } else if (includeNotes && child.data.type === 'NOTE') {
          result.push(child);
        }
      }
    }

    return result;
  }

  getSiblings(nodeId: NodeId): UnifiedNode[] {
    const node = this.graph.getNode(nodeId);
    if (!node) return [];

    const parentId = node.data.parentId;

    return this.graph.filterNodes(n =>
      n.data.id !== nodeId && n.data.parentId === parentId
    );
  }

  buildFolderTree(rootId?: NodeId): FolderHierarchy[] {
    const roots = rootId 
      ? [this.graph.getNode(rootId)].filter((n): n is UnifiedNode => n !== null)
      : this.getRootFolders();

    return roots.map(folder => this.buildSubtree(folder, 0));
  }

  private buildSubtree(folder: UnifiedNode, depth: number): FolderHierarchy {
    const childFolders = this.getChildFolders(folder.data.id);
    const notes = this.getChildNotes(folder.data.id);

    const children = childFolders.map(child => this.buildSubtree(child, depth + 1));

    const totalNotes = notes.length + children.reduce((sum, c) => sum + c.totalNotes, 0);
    const totalFolders = children.length + children.reduce((sum, c) => sum + c.totalFolders, 0);

    return {
      folder,
      depth,
      children,
      notes,
      totalNotes,
      totalFolders,
    };
  }

  getFolderDepth(folderId: NodeId): number {
    const ancestors = this.getAncestors(folderId);
    return ancestors.depth;
  }

  getDeepestFolders(): UnifiedNode[] {
    const folders = this.graph.getNodesByType('FOLDER');
    if (folders.length === 0) return [];

    let maxDepth = 0;
    const depthMap = new Map<NodeId, number>();

    for (const folder of folders) {
      const depth = this.getFolderDepth(folder.data.id);
      depthMap.set(folder.data.id, depth);
      maxDepth = Math.max(maxDepth, depth);
    }

    return folders.filter(f => depthMap.get(f.data.id) === maxDepth);
  }

  getEmptyFolders(): UnifiedNode[] {
    const folders = this.graph.getNodesByType('FOLDER');

    return folders.filter(folder => {
      const children = this.graph.filterNodes(n => n.data.parentId === folder.data.id);
      return children.length === 0;
    });
  }

  getFolderStats(folderId: NodeId): {
    noteCount: number;
    folderCount: number;
    entityCount: number;
    maxDepth: number;
  } {
    const descendants = this.getDescendants(folderId, true);

    const notes = descendants.filter(n => n.data.type === 'NOTE');
    const folders = descendants.filter(n => n.data.type === 'FOLDER');
    const entities = descendants.filter(n => n.data.isEntity);

    let maxDepth = 0;
    for (const folder of folders) {
      const depth = this.getFolderDepth(folder.data.id);
      maxDepth = Math.max(maxDepth, depth);
    }

    return {
      noteCount: notes.length,
      folderCount: folders.length,
      entityCount: entities.length,
      maxDepth,
    };
  }

  moveNode(nodeId: NodeId, newParentId: NodeId | undefined): void {
    this.graph.updateNode(nodeId, { parentId: newParentId });
  }

  getOrphanNotes(): UnifiedNode[] {
    return this.graph.filterNodes(node =>
      node.data.type === 'NOTE' && !node.data.parentId
    );
  }

  getFoldersByEntityKind(kind: string): UnifiedNode[] {
    return this.graph.filterNodes(node =>
      node.data.type === 'FOLDER' && 
      (node.data.entityKind === kind || node.data.inheritedKind === kind)
    );
  }
}

let compoundQueries: CompoundQueries | null = null;

export function getCompoundQueries(): CompoundQueries {
  if (!compoundQueries) {
    compoundQueries = new CompoundQueries();
  }
  return compoundQueries;
}
