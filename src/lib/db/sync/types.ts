import type { NodeType, SQLiteNodeInput, SQLiteEdgeInput } from '../client/types';

export type DirtyOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface DirtyNodeEntry {
  id: string;
  operation: DirtyOperation;
  data?: SQLiteNodeInput & { id: string };
  changedFields?: Set<string>;
  timestamp: number;
}

export interface DirtyEdgeEntry {
  id: string;
  operation: DirtyOperation;
  data?: SQLiteEdgeInput & { id: string };
  changedFields?: Set<string>;
  timestamp: number;
}

export interface SyncConfig {
  debounceMs: number;
  maxWaitMs: number;
  batchSize: number;
  enableEdgeSync: boolean;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  debounceMs: 2000,
  maxWaitMs: 5000,
  batchSize: 100,
  enableEdgeSync: true,
};

export interface SyncStatus {
  isHydrating: boolean;
  isHydrated: boolean;
  isSyncing: boolean;
  dirtyNodeCount: number;
  dirtyEdgeCount: number;
  lastSyncTime: number | null;
  lastError: Error | null;
  hydrationProgress: {
    phase: 'idle' | 'critical' | 'visible' | 'full' | 'complete';
    nodesLoaded: number;
    edgesLoaded: number;
    totalNodes: number;
    totalEdges: number;
  };
}

export const INITIAL_SYNC_STATUS: SyncStatus = {
  isHydrating: false,
  isHydrated: false,
  isSyncing: false,
  dirtyNodeCount: 0,
  dirtyEdgeCount: 0,
  lastSyncTime: null,
  lastError: null,
  hydrationProgress: {
    phase: 'idle',
    nodesLoaded: 0,
    edgesLoaded: 0,
    totalNodes: 0,
    totalEdges: 0,
  },
};

export type SyncStatusListener = (status: SyncStatus) => void;

export interface HydrationOptions {
  progressive: boolean;
  criticalLimit: number;
  visibleLimit: number;
  batchSize: number;
  yieldMs: number;
}

export const DEFAULT_HYDRATION_OPTIONS: HydrationOptions = {
  progressive: true,
  criticalLimit: 100,
  visibleLimit: 500,
  batchSize: 200,
  yieldMs: 10,
};

export interface BatchWriteResult {
  insertedNodes: number;
  updatedNodes: number;
  deletedNodes: number;
  insertedEdges: number;
  updatedEdges: number;
  deletedEdges: number;
  errors: Error[];
}
