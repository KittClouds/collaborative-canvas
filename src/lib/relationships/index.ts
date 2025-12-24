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

export * from './extractors';

export * from './adapters';

// ==================== UNIFIED EXTRACTION ENGINE ====================

export {
    UnifiedRelationshipEngine,
    getUnifiedRelationshipEngine,
    resetUnifiedRelationshipEngine,
    SVOExtractor,
    PrepExtractor,
    PossessionExtractor,
    CoOccurrenceExtractor
} from './unified';

// ==================== CORE UTILITIES ====================

export {
    DocumentContext,
    EntityMentionResolver,
    type WinkAnalysis,
    type EntityMention,
    type VerbOccurrence,
    type PrepOccurrence,
    type PossessiveOccurrence
} from './core';

// ==================== RELATIONSHIP RULES ====================

export {
    inferRelationshipType,
    VERB_PATTERN_RULES,
    PREP_PATTERN_RULES,
    POSSESSIVE_RULES,
    RELATIONSHIP_TYPE_RULES,
    type RelationshipTypeRule,
    type VerbPatternRule,
    type PrepPatternRule,
    type PossessiveTypeRule
} from './rules';

// ==================== UNIFIED TYPES ====================

export type {
    ExtractionPattern,
    EntityRef,
    ExtractionContext,
    ExtractionMetadata,
    ExtractedRelationship,
    CoOccurrenceEntityRef,
    UnifiedCoOccurrence,
    ContextStats,
    ExtractionStats,
    ExtractionResult,
    CoOccurrence,
    RelationshipPattern
} from './unified-types';

export { tolegacyCoOccurrence } from './unified-types';
