import type { SQLiteNodeInput, SQLiteEdgeInput } from '../client/types';
import type { DirtyNodeEntry, DirtyEdgeEntry, DirtyOperation } from './types';

export class DirtyTracker {
  private dirtyNodes: Map<string, DirtyNodeEntry> = new Map();
  private dirtyEdges: Map<string, DirtyEdgeEntry> = new Map();
  private deletedNodes: Set<string> = new Set();
  private deletedEdges: Set<string> = new Set();

  markNodeDirty(
    id: string,
    operation: DirtyOperation,
    data?: SQLiteNodeInput & { id: string },
    changedFields?: string[]
  ): void {
    const now = Date.now();
    const existing = this.dirtyNodes.get(id);

    if (operation === 'DELETE') {
      this.dirtyNodes.delete(id);
      this.deletedNodes.add(id);
      return;
    }

    if (this.deletedNodes.has(id)) {
      return;
    }

    if (existing) {
      const coalesced = this.coalesceNodeOps(existing.operation, operation);
      const mergedFields = new Set([
        ...(existing.changedFields || []),
        ...(changedFields || []),
      ]);
      
      this.dirtyNodes.set(id, {
        id,
        operation: coalesced,
        data: data || existing.data,
        changedFields: mergedFields.size > 0 ? mergedFields : undefined,
        timestamp: now,
      });
    } else {
      this.dirtyNodes.set(id, {
        id,
        operation,
        data,
        changedFields: changedFields ? new Set(changedFields) : undefined,
        timestamp: now,
      });
    }
  }

  markEdgeDirty(
    id: string,
    operation: DirtyOperation,
    data?: SQLiteEdgeInput & { id: string },
    changedFields?: string[]
  ): void {
    const now = Date.now();
    const existing = this.dirtyEdges.get(id);

    if (operation === 'DELETE') {
      this.dirtyEdges.delete(id);
      this.deletedEdges.add(id);
      return;
    }

    if (this.deletedEdges.has(id)) {
      return;
    }

    if (existing) {
      const coalesced = this.coalesceEdgeOps(existing.operation, operation);
      const mergedFields = new Set([
        ...(existing.changedFields || []),
        ...(changedFields || []),
      ]);
      
      this.dirtyEdges.set(id, {
        id,
        operation: coalesced,
        data: data || existing.data,
        changedFields: mergedFields.size > 0 ? mergedFields : undefined,
        timestamp: now,
      });
    } else {
      this.dirtyEdges.set(id, {
        id,
        operation,
        data,
        changedFields: changedFields ? new Set(changedFields) : undefined,
        timestamp: now,
      });
    }
  }

  private coalesceNodeOps(prev: DirtyOperation, next: DirtyOperation): DirtyOperation {
    if (prev === 'INSERT' && next === 'UPDATE') return 'INSERT';
    if (prev === 'INSERT' && next === 'DELETE') return 'DELETE';
    if (prev === 'UPDATE' && next === 'DELETE') return 'DELETE';
    return next;
  }

  private coalesceEdgeOps(prev: DirtyOperation, next: DirtyOperation): DirtyOperation {
    if (prev === 'INSERT' && next === 'UPDATE') return 'INSERT';
    if (prev === 'INSERT' && next === 'DELETE') return 'DELETE';
    if (prev === 'UPDATE' && next === 'DELETE') return 'DELETE';
    return next;
  }

  getDirtyNodes(): DirtyNodeEntry[] {
    return Array.from(this.dirtyNodes.values());
  }

  getDirtyEdges(): DirtyEdgeEntry[] {
    return Array.from(this.dirtyEdges.values());
  }

  getDeletedNodeIds(): string[] {
    return Array.from(this.deletedNodes);
  }

  getDeletedEdgeIds(): string[] {
    return Array.from(this.deletedEdges);
  }

  clearNodes(): void {
    this.dirtyNodes.clear();
    this.deletedNodes.clear();
  }

  clearEdges(): void {
    this.dirtyEdges.clear();
    this.deletedEdges.clear();
  }

  clear(): void {
    this.clearNodes();
    this.clearEdges();
  }

  hasChanges(): boolean {
    return (
      this.dirtyNodes.size > 0 ||
      this.dirtyEdges.size > 0 ||
      this.deletedNodes.size > 0 ||
      this.deletedEdges.size > 0
    );
  }

  getDirtyNodeCount(): number {
    return this.dirtyNodes.size + this.deletedNodes.size;
  }

  getDirtyEdgeCount(): number {
    return this.dirtyEdges.size + this.deletedEdges.size;
  }

  removeNode(id: string): void {
    this.dirtyNodes.delete(id);
    this.deletedNodes.delete(id);
  }

  removeEdge(id: string): void {
    this.dirtyEdges.delete(id);
    this.deletedEdges.delete(id);
  }
}
