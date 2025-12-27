/**
 * Relationship System Exports
 * 
 * Central entry point for relationship management.
 * Redirects to the new Cozo-native adapter for the unified registry.
 */

// Export types
export * from './types';

// Export registry instance (from new adapter)
export { relationshipRegistry } from '@/lib/cozo/graph/adapters';

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
