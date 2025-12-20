import type { SyncStatus, SyncStatusListener } from './types';
import { INITIAL_SYNC_STATUS } from './types';

export class SyncState {
  private status: SyncStatus = { ...INITIAL_SYNC_STATUS };
  private listeners: Set<SyncStatusListener> = new Set();

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.status);
      } catch (err) {
        console.error('[SyncState] Listener error:', err);
      }
    }
  }

  update(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    this.notify();
  }

  updateHydrationProgress(progress: Partial<SyncStatus['hydrationProgress']>): void {
    this.status = {
      ...this.status,
      hydrationProgress: { ...this.status.hydrationProgress, ...progress },
    };
    this.notify();
  }

  setHydrating(isHydrating: boolean): void {
    this.update({ isHydrating });
  }

  setHydrated(isHydrated: boolean): void {
    this.update({ isHydrated, isHydrating: false });
  }

  setSyncing(isSyncing: boolean): void {
    this.update({ isSyncing });
  }

  setDirtyCounts(nodeCount: number, edgeCount: number): void {
    this.update({
      dirtyNodeCount: nodeCount,
      dirtyEdgeCount: edgeCount,
    });
  }

  setSyncComplete(): void {
    this.update({
      isSyncing: false,
      lastSyncTime: Date.now(),
      lastError: null,
    });
  }

  setSyncError(error: Error): void {
    this.update({
      isSyncing: false,
      lastError: error,
    });
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  isReady(): boolean {
    return this.status.isHydrated && !this.status.isHydrating;
  }

  hasPendingChanges(): boolean {
    return this.status.dirtyNodeCount > 0 || this.status.dirtyEdgeCount > 0;
  }
}

export const syncState = new SyncState();
