/**
 * Relationship Engine - Main Exports
 * 
 * Unified relationship management system for the knowledge graph.
 */

export {
    RelationshipSource,
    SOURCE_WEIGHTS,
    type UnifiedRelationship,
    type RelationshipProvenance,
    type RelationshipQuery,
    type RelationshipInput,
    type IntegrityIssue,
    type RepairResult,
    type RelationshipStats
} from './types';

export {
    RelationshipRegistry,
    relationshipRegistry
} from './relationship-registry';
