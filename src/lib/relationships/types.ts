/**
 * Relationship Engine - Core Type Definitions
 * 
 * Unified relationship management system that aggregates relationships
 * from multiple sources with confidence scoring and provenance tracking.
 */

export enum RelationshipSource {
    FOLDER_STRUCTURE = 'FOLDER_STRUCTURE',
    MANUAL = 'MANUAL',
    NER_EXTRACTION = 'NER_EXTRACTION',
    LLM_EXTRACTION = 'LLM_EXTRACTION',
    CO_OCCURRENCE = 'CO_OCCURRENCE',
    IMPORT = 'IMPORT',
    TIMELINE = 'TIMELINE',
    NETWORK = 'NETWORK',
    EXPLICIT_SYNTAX = 'EXPLICIT_SYNTAX'  // From [X] (REL) [Y] inline syntax
}

export interface RelationshipProvenance {
    source: RelationshipSource;
    originId: string;
    timestamp: Date;
    confidence: number;
    context?: string;
    metadata?: Record<string, any>;
}

export interface UnifiedRelationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    inverseType?: string;
    bidirectional: boolean;
    confidence: number;
    confidenceBySource: Partial<Record<RelationshipSource, number>>;
    provenance: RelationshipProvenance[];
    namespace?: string;
    attributes: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface RelationshipQuery {
    entityId?: string;
    sourceId?: string;
    targetId?: string;
    type?: string | string[];
    namespace?: string;
    minConfidence?: number;
    sources?: RelationshipSource[];
    limit?: number;
    offset?: number;
}

export interface RelationshipInput {
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    inverseType?: string;
    bidirectional?: boolean;
    namespace?: string;
    attributes?: Record<string, any>;
    provenance: RelationshipProvenance[];
}

export interface IntegrityIssue {
    type: 'ORPHAN_SOURCE' | 'ORPHAN_TARGET' | 'DUPLICATE' | 'INVALID_TYPE';
    relationshipId: string;
    entityId?: string;
    message: string;
}

export interface RepairResult {
    removed: number;
    merged: number;
}

export interface RelationshipStats {
    total: number;
    byType: Record<string, number>;
    bySource: Partial<Record<RelationshipSource, number>>;
    byNamespace: Record<string, number>;
    averageConfidence: number;
}

export const SOURCE_WEIGHTS: Record<RelationshipSource, number> = {
    [RelationshipSource.FOLDER_STRUCTURE]: 1.0,
    [RelationshipSource.MANUAL]: 1.0,
    [RelationshipSource.LLM_EXTRACTION]: 0.7,
    [RelationshipSource.NER_EXTRACTION]: 0.6,
    [RelationshipSource.CO_OCCURRENCE]: 0.4,
    [RelationshipSource.IMPORT]: 0.8,
    [RelationshipSource.TIMELINE]: 0.9,
    [RelationshipSource.NETWORK]: 1.0,
    [RelationshipSource.EXPLICIT_SYNTAX]: 1.0  // User-authored = highest confidence
};
