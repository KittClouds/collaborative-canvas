// Existing exports (unchanged)
export * from './entityTypes';
export * from './titleParser';
export * from './migration';
export { parseNoteConnectionsFromDocument, hasRawEntitySyntax } from './documentScanner';

// Phase 0: New type exports
export type {
    RegisteredEntity,
    ParsedEntity,
    EntityRelationship,
    CoOccurrencePattern,
    ScanResult
} from './types/registry';

// Phase 1: New class exports (stub for now)
export * from './entity-registry';
export * from './regex-entity-parser';
