import { dbClient } from '../client/db-client';
import type { SQLiteNodeInput, SQLiteEdgeInput } from '../client/types';
import type { DirtyNodeEntry, DirtyEdgeEntry, BatchWriteResult, SyncConfig } from './types';
import { DEFAULT_SYNC_CONFIG } from './types';

export class BatchWriter {
  private config: SyncConfig;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  async flush(
    dirtyNodes: DirtyNodeEntry[],
    dirtyEdges: DirtyEdgeEntry[],
    deletedNodeIds: string[],
    deletedEdgeIds: string[]
  ): Promise<BatchWriteResult> {
    const result: BatchWriteResult = {
      insertedNodes: 0,
      updatedNodes: 0,
      deletedNodes: 0,
      insertedEdges: 0,
      updatedEdges: 0,
      deletedEdges: 0,
      errors: [],
    };

    if (!dbClient.isReady()) {
      result.errors.push(new Error('Database not ready'));
      return result;
    }

    try {
      await this.processDeletedEdges(deletedEdgeIds, result);
      await this.processDeletedNodes(deletedNodeIds, result);
      await this.processNodes(dirtyNodes, result);
      await this.processEdges(dirtyEdges, result);
    } catch (err) {
      result.errors.push(err instanceof Error ? err : new Error(String(err)));
    }

    return result;
  }

  private async processDeletedNodes(ids: string[], result: BatchWriteResult): Promise<void> {
    for (let i = 0; i < ids.length; i += this.config.batchSize) {
      const batch = ids.slice(i, i + this.config.batchSize);
      for (const id of batch) {
        try {
          await dbClient.deleteNode(id);
          result.deletedNodes++;
        } catch (err) {
          result.errors.push(
            new Error(`Failed to delete node ${id}: ${err instanceof Error ? err.message : String(err)}`)
          );
        }
      }
    }
  }

  private async processDeletedEdges(ids: string[], result: BatchWriteResult): Promise<void> {
    for (let i = 0; i < ids.length; i += this.config.batchSize) {
      const batch = ids.slice(i, i + this.config.batchSize);
      for (const id of batch) {
        try {
          await dbClient.deleteEdge(id);
          result.deletedEdges++;
        } catch (err) {
          result.errors.push(
            new Error(`Failed to delete edge ${id}: ${err instanceof Error ? err.message : String(err)}`)
          );
        }
      }
    }
  }

  private async processNodes(entries: DirtyNodeEntry[], result: BatchWriteResult): Promise<void> {
    const inserts: Array<SQLiteNodeInput & { id: string }> = [];
    const updates: Array<{ id: string; entry: DirtyNodeEntry }> = [];

    for (const entry of entries) {
      if (!entry.data) continue;
      
      if (entry.operation === 'INSERT') {
        inserts.push(entry.data);
      } else if (entry.operation === 'UPDATE') {
        updates.push({ id: entry.id, entry });
      }
    }

    for (let i = 0; i < inserts.length; i += this.config.batchSize) {
      const batch = inserts.slice(i, i + this.config.batchSize);
      try {
        await dbClient.batchSync(batch);
        result.insertedNodes += batch.length;
      } catch (err) {
        result.errors.push(
          new Error(`Failed to batch insert nodes: ${err instanceof Error ? err.message : String(err)}`)
        );
      }
    }

    for (const { id, entry } of updates) {
      if (!entry.data) continue;
      try {
        await dbClient.updateNode(id, entry.data);
        result.updatedNodes++;
      } catch (err) {
        result.errors.push(
          new Error(`Failed to update node ${id}: ${err instanceof Error ? err.message : String(err)}`)
        );
      }
    }
  }

  private async processEdges(entries: DirtyEdgeEntry[], result: BatchWriteResult): Promise<void> {
    if (!this.config.enableEdgeSync) return;

    const inserts: Array<SQLiteEdgeInput & { id: string }> = [];
    const updates: Array<{ id: string; entry: DirtyEdgeEntry }> = [];

    for (const entry of entries) {
      if (!entry.data) continue;
      
      if (entry.operation === 'INSERT') {
        inserts.push(entry.data);
      } else if (entry.operation === 'UPDATE') {
        updates.push({ id: entry.id, entry });
      }
    }

    for (let i = 0; i < inserts.length; i += this.config.batchSize) {
      const batch = inserts.slice(i, i + this.config.batchSize);
      try {
        await dbClient.batchInsertEdges(batch);
        result.insertedEdges += batch.length;
      } catch (err) {
        result.errors.push(
          new Error(`Failed to batch insert edges: ${err instanceof Error ? err.message : String(err)}`)
        );
      }
    }

    for (const { id, entry } of updates) {
      if (!entry.data) continue;
      try {
        await dbClient.updateEdge(id, entry.data);
        result.updatedEdges++;
      } catch (err) {
        result.errors.push(
          new Error(`Failed to update edge ${id}: ${err instanceof Error ? err.message : String(err)}`)
        );
      }
    }
  }
}
