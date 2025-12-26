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

// Export extractors (optional, based on usage)
export * from './RelationshipExtractor';
