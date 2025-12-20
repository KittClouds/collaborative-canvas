import { getResoRankSearch, resetResoRankSearch } from '../queries/ResoRankSearchQueries';
import type { NodeId } from '../types';

export class GraphResoRankSync {
  private pendingUpdates: Set<NodeId> = new Set();
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchDelayMs = 100;

  onNodeAdded(nodeId: NodeId): void {
    this.scheduleBatchUpdate(nodeId);
  }

  onNodeUpdated(nodeId: NodeId): void {
    this.scheduleBatchUpdate(nodeId);
  }

  onNodeRemoved(nodeId: NodeId): void {
    const search = getResoRankSearch();
    search.removeNode(nodeId);
  }

  private scheduleBatchUpdate(nodeId: NodeId): void {
    this.pendingUpdates.add(nodeId);

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, this.batchDelayMs);
  }

  private processBatch(): void {
    if (this.pendingUpdates.size === 0) return;

    const search = getResoRankSearch();
    
    for (const nodeId of this.pendingUpdates) {
      search.reindexNode(nodeId);
    }

    this.pendingUpdates.clear();
    this.batchTimeout = null;
  }

  flush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.processBatch();
  }

  rebuildIndex(): void {
    resetResoRankSearch();
    const search = getResoRankSearch();
    search.buildIndex();
  }

  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.pendingUpdates.clear();
    resetResoRankSearch();
  }
}

let resoRankSync: GraphResoRankSync | null = null;

export function getGraphResoRankSync(): GraphResoRankSync {
  if (!resoRankSync) {
    resoRankSync = new GraphResoRankSync();
  }
  return resoRankSync;
}

export function resetGraphResoRankSync(): void {
  if (resoRankSync) {
    resoRankSync.clear();
  }
  resoRankSync = null;
}
