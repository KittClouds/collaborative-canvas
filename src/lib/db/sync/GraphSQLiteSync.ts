import { dbClient } from '../client/db-client';
import type { SQLiteNodeInput, SQLiteEdgeInput, NodeType } from '../client/types';
import { DirtyTracker } from './DirtyTracker';
import { BatchWriter } from './BatchWriter';
import { syncState } from './SyncState';
import type { SyncConfig, DirtyOperation } from './types';
import { DEFAULT_SYNC_CONFIG } from './types';

class GraphSQLiteSync {
  private dirtyTracker: DirtyTracker;
  private batchWriter: BatchWriter;
  private config: SyncConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private lastChangeTime: number = 0;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.dirtyTracker = new DirtyTracker();
    this.batchWriter = new BatchWriter(this.config);
  }

  markNodeDirty(
    id: string,
    operation: DirtyOperation,
    data?: SQLiteNodeInput & { id: string },
    changedFields?: string[]
  ): void {
    if (!dbClient.isReady()) return;

    this.dirtyTracker.markNodeDirty(id, operation, data, changedFields);
    this.lastChangeTime = Date.now();
    this.updateDirtyCounts();
    this.scheduleFlush();
  }

  markEdgeDirty(
    id: string,
    operation: DirtyOperation,
    data?: SQLiteEdgeInput & { id: string },
    changedFields?: string[]
  ): void {
    if (!dbClient.isReady() || !this.config.enableEdgeSync) return;

    this.dirtyTracker.markEdgeDirty(id, operation, data, changedFields);
    this.lastChangeTime = Date.now();
    this.updateDirtyCounts();
    this.scheduleFlush();
  }

  async syncNodeCreate(node: SQLiteNodeInput & { id: string }): Promise<void> {
    if (!dbClient.isReady()) {
      console.warn('[GraphSQLiteSync] DB not ready, skipping create sync');
      return;
    }

    try {
      await dbClient.insertNode(node);
    } catch (err) {
      console.error('[GraphSQLiteSync] Failed to sync node create:', err);
      this.markNodeDirty(node.id, 'INSERT', node);
    }
  }

  async syncEdgeCreate(edge: SQLiteEdgeInput & { id: string }): Promise<void> {
    if (!dbClient.isReady() || !this.config.enableEdgeSync) {
      console.warn('[GraphSQLiteSync] DB not ready, skipping edge create sync');
      return;
    }

    try {
      await dbClient.insertEdge(edge);
    } catch (err) {
      console.error('[GraphSQLiteSync] Failed to sync edge create:', err);
      this.markEdgeDirty(edge.id, 'INSERT', edge);
    }
  }

  async syncNodeDelete(nodeId: string): Promise<void> {
    if (!dbClient.isReady()) {
      console.warn('[GraphSQLiteSync] DB not ready, skipping delete sync');
      return;
    }

    this.dirtyTracker.removeNode(nodeId);

    try {
      await dbClient.deleteNode(nodeId);
    } catch (err) {
      console.error('[GraphSQLiteSync] Failed to sync node delete:', err);
    }
  }

  async syncEdgeDelete(edgeId: string): Promise<void> {
    if (!dbClient.isReady() || !this.config.enableEdgeSync) {
      console.warn('[GraphSQLiteSync] DB not ready, skipping edge delete sync');
      return;
    }

    this.dirtyTracker.removeEdge(edgeId);

    try {
      await dbClient.deleteEdge(edgeId);
    } catch (err) {
      console.error('[GraphSQLiteSync] Failed to sync edge delete:', err);
    }
  }

  private updateDirtyCounts(): void {
    syncState.setDirtyCounts(
      this.dirtyTracker.getDirtyNodeCount(),
      this.dirtyTracker.getDirtyEdgeCount()
    );
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => this.flush(), this.config.debounceMs);

    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(() => {
        this.maxWaitTimer = null;
        this.flush();
      }, this.config.maxWaitMs);
    }
  }

  async flush(): Promise<void> {
    if (this.isFlushing || !this.dirtyTracker.hasChanges()) {
      return;
    }

    this.isFlushing = true;
    syncState.setSyncing(true);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }

    const dirtyNodes = this.dirtyTracker.getDirtyNodes();
    const dirtyEdges = this.dirtyTracker.getDirtyEdges();
    const deletedNodeIds = this.dirtyTracker.getDeletedNodeIds();
    const deletedEdgeIds = this.dirtyTracker.getDeletedEdgeIds();

    this.dirtyTracker.clear();
    this.updateDirtyCounts();

    try {
      const result = await this.batchWriter.flush(
        dirtyNodes,
        dirtyEdges,
        deletedNodeIds,
        deletedEdgeIds
      );

      if (result.errors.length > 0) {
        console.error('[GraphSQLiteSync] Flush completed with errors:', result.errors);
      }

      const total = 
        result.insertedNodes + result.updatedNodes + result.deletedNodes +
        result.insertedEdges + result.updatedEdges + result.deletedEdges;
      
      if (total > 0) {
        console.log(
          `[GraphSQLiteSync] Flushed: ${result.insertedNodes} inserted, ` +
          `${result.updatedNodes} updated, ${result.deletedNodes} deleted nodes; ` +
          `${result.insertedEdges} inserted, ${result.updatedEdges} updated, ` +
          `${result.deletedEdges} deleted edges`
        );
      }

      syncState.setSyncComplete();
    } catch (err) {
      console.error('[GraphSQLiteSync] Flush failed:', err);
      syncState.setSyncError(err instanceof Error ? err : new Error(String(err)));

      for (const entry of dirtyNodes) {
        if (entry.data) {
          this.dirtyTracker.markNodeDirty(entry.id, entry.operation, entry.data);
        }
      }
      for (const entry of dirtyEdges) {
        if (entry.data) {
          this.dirtyTracker.markEdgeDirty(entry.id, entry.operation, entry.data);
        }
      }
      this.updateDirtyCounts();
    } finally {
      this.isFlushing = false;
    }
  }

  async forceFlush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
    await this.flush();
  }

  hasPendingChanges(): boolean {
    return this.dirtyTracker.hasChanges();
  }

  getPendingCount(): number {
    return this.dirtyTracker.getDirtyNodeCount() + this.dirtyTracker.getDirtyEdgeCount();
  }

  setConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.batchWriter = new BatchWriter(this.config);
  }
}

export const graphSQLiteSync = new GraphSQLiteSync();
