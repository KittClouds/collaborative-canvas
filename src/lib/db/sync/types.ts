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

// ============================================
// DELTA-BASED SYNC TYPES (Weapons-Grade Engine)
// ============================================

/**
 * Immer-style patch for field-level tracking
 */
export interface DeltaPatch {
  op: 'replace' | 'add' | 'remove';
  path: (string | number)[];
  value?: unknown;
}

/**
 * Delta representing a single entity change
 */
export interface Delta {
  id: string;
  type: 'node' | 'edge';
  operation: DirtyOperation;
  patches?: DeltaPatch[];  // For UPDATE operations (field-level diffs)
  fullData?: unknown;      // For INSERT operations (full object)
  timestamp: number;
  version: number;         // Vector clock for CRDT
}

/**
 * Result of atomic transaction execution
 */
export interface TransactionResult {
  success: boolean;
  processedCount: number;
  insertedNodes: number;
  updatedNodes: number;
  deletedNodes: number;
  insertedEdges: number;
  updatedEdges: number;
  deletedEdges: number;
  errors: Array<{ id: string; message: string }>;
  duration: number;
}

/**
 * Configuration for SyncEngineV2
 */
export interface SyncEngineConfig {
  /** Debounce delay before flushing (ms) */
  debounceMs: number;
  /** Max time to wait before forcing flush (ms) */
  maxWaitMs: number;
  /** Max deltas before forcing flush */
  maxDeltasBeforeFlush: number;
  /** Enable CozoDB streaming sync */
  enableCozoSync: boolean;
  /** Enable edge syncing */
  enableEdgeSync: boolean;
  /** Retry attempts for failed transactions */
  retryAttempts: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: number;
}

export const DEFAULT_SYNC_ENGINE_CONFIG: SyncEngineConfig = {
  debounceMs: 50,
  maxWaitMs: 200,
  maxDeltasBeforeFlush: 100,
  enableCozoSync: true,
  enableEdgeSync: true,
  retryAttempts: 3,
  retryBaseDelayMs: 100,
};

/**
 * Telemetry for sync operations
 */
export interface SyncTelemetry {
  totalFlushes: number;
  totalDeltas: number;
  totalDuration: number;
  averageFlushDuration: number;
  lastFlushTime: number | null;
  errorCount: number;
}
