/**
 * Relationship System Exports
 * 
 * Central entry point for relationship management.
 * Redirects to the new Cozo-native adapter for the unified registry.
 */

// Export types
export * from './types';
export * from './relationshipBridgeTypes';

// Export registry instance (from new adapter)
export { relationshipRegistry } from '@/lib/cozo/graph/adapters';

// Export bridge store (Phase 7D - unified Fact Sheet + Blueprint Hub + Networks)
export { relationshipBridgeStore } from './RelationshipBridgeStore';

// Export unified extractor (Phase 7C - consolidated)
export {
    getRelationshipExtractor,
    RelationshipExtractor,
    matchVerbPatterns,
    refreshPatternsFromStorage,
    getActivePatterns,
    getPatternCategories,
    type ExtractedRelationship,
    type EntitySpan,
    type RelationshipPattern,
} from '@/lib/entities/scanner-v3/extractors/RelationshipExtractor';

