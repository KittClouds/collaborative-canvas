export { dbClient } from './client/db-client';
export { graphSQLiteSync } from './sync/GraphSQLiteSync';
export { syncState } from './sync/SyncState';
export * from './client/types';
export * from './sync/types';

export {
  initializeSQLiteAndHydrate,
} from './sync/sqliteInit';
export type { SQLiteInitResult } from './sync/sqliteInit';

// Legacy sync components (deprecated, kept for backward compatibility)
export { DirtyTracker } from './sync/DirtyTracker';
export { BatchWriter } from './sync/BatchWriter';
export { Hydration } from './sync/Hydration';
export { SyncState } from './sync/SyncState';

// Weapons-Grade Sync Engine V2 (new, recommended)
export { SyncEngineV2, syncEngineV2 } from './sync/SyncEngineV2';
export { DeltaCollector } from './sync/DeltaCollector';
export { TransactionBuilder } from './sync/TransactionBuilder';
export { StreamingCozoSync, streamingCozoSync } from './sync/StreamingCozoSync';
