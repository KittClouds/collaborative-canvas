/**
 * Unified Relationship Engine - Type Definitions
 * 
 * These types are used by the unified extraction pipeline
 * and are compatible with the existing relationship-registry.
 */

import type { RegisteredEntity } from '@/lib/entities/entity-registry';
import type { EntityKind } from '@/lib/entities/entityTypes';

// ==================== EXTRACTION TYPES ====================

/**
 * Extraction pattern types
 */
export type ExtractionPattern = 'SVO' | 'PREP' | 'POSSESSION' | 'CO_OCCURRENCE';

/**
 * Entity reference in an extracted relationship
 */
export interface EntityRef {
    entity: RegisteredEntity;
    text: string;              // Matched text
    position: number;          // Character position in document
}

/**
 * Extraction context metadata
 */
export interface ExtractionContext {
    sentence: string;          // Full sentence text
    sentenceIndex: number;     // Sentence position in document
    verbLemma?: string;        // For SVO patterns
    preposition?: string;      // For PREP patterns
    possessiveType?: 'apostrophe' | 'of';  // For POSSESSION patterns
}

/**
 * Extraction metadata
 */
export interface ExtractionMetadata {
    extractedAt: Date;
    noteId: string;
    extractorVersion?: string;
}

/**
 * An extracted relationship (before persistence)
 */
export interface ExtractedRelationship {
    source: EntityRef;
    target: EntityRef;
    predicate: string;         // Relationship type
    inversePredicate?: string; // Inverse relationship type
    pattern: ExtractionPattern;
    confidence: number;        // 0-1
    context: ExtractionContext;
    metadata: ExtractionMetadata;
}

// ==================== CO-OCCURRENCE TYPES ====================

/**
 * Simplified entity reference for co-occurrences
 */
export interface CoOccurrenceEntityRef {
    id: string;
    label: string;
    kind: EntityKind;
}

/**
 * A co-occurrence between two entities
 */
export interface UnifiedCoOccurrence {
    entity1: CoOccurrenceEntityRef;
    entity2: CoOccurrenceEntityRef;
    context: string;           // Sentence text
    tokenDistance: number;     // Token distance between entities
    segmentOverlap: number;    // ResoRank segment overlap (0-16)
    salience: number;          // IDF-weighted importance
    confidence: number;        // Combined ResoRank scores
    sentenceIndex: number;
    noteId: string;
}

// ==================== STATISTICS TYPES ====================

/**
 * Document context statistics
 */
export interface ContextStats {
    sentenceCount: number;
    tokenCount: number;
    entityMentionCount: number;
    uniqueEntityCount: number;
    verbCount: number;
    prepCount: number;
}

/**
 * Extraction run statistics
 */
export interface ExtractionStats {
    totalRelationships: number;
    svoCount: number;
    prepCount: number;
    possessionCount: number;
    coOccurrenceCount: number;
    elapsedMs: number;
    throughputRelsPerSec: number;
    contextStats: ContextStats;
}

// ==================== RESULT TYPES ====================

/**
 * Complete extraction result
 */
export interface ExtractionResult {
    relationships: ExtractedRelationship[];
    coOccurrences: UnifiedCoOccurrence[];
    stats: ExtractionStats;
}

// ==================== COMPATIBILITY TYPES ====================

/**
 * Legacy CoOccurrence type (for backward compatibility)
 * Used by older extractors and consumers
 */
export interface CoOccurrence {
    entity1: string;
    entity2: string;
    context: string;
    tokenDistance: number;
    segmentOverlap: number;
    salience: number;
    confidence: number;
}

/**
 * Convert UnifiedCoOccurrence to legacy format
 */
export function tolegacyCoOccurrence(unified: UnifiedCoOccurrence): CoOccurrence {
    return {
        entity1: unified.entity1.label,
        entity2: unified.entity2.label,
        context: unified.context,
        tokenDistance: unified.tokenDistance,
        segmentOverlap: unified.segmentOverlap,
        salience: unified.salience,
        confidence: unified.confidence
    };
}

/**
 * Pattern info for relationship registry
 */
export interface RelationshipPattern {
    type: ExtractionPattern;
    verbLemma?: string;
    preposition?: string;
    possessiveType?: string;
}
