// Existing exports (unchanged)
export * from './entityTypes';
export * from './titleParser';
export * from './migration';
export { parseNoteConnectionsFromDocument, hasRawEntitySyntax } from './documentScanner';

// Phase 0: New type exports
export type {
    ParsedEntity,
    EntityRelationship,
    CoOccurrencePattern,
    ScanResult
} from './types/registry';

// Phase 1: New class exports (stub for now)
// Re-export from Cozo adapters
export { entityRegistry } from '@/lib/cozo/graph/adapters';
export type { RegisteredEntity } from '@/lib/cozo/graph/adapters';
export * from './regex-entity-parser';

// Hot cache and React Query hooks
export { entityHotCache, type HotCacheEntity } from './EntityHotCache';
export {
    useEntity,
    useEntities,
    useEntitySearch,
    useEntityStats,
    useEntityMutations,
} from './useEntityCache';
