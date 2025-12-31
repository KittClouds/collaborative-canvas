/**
 * Relationship Bridge Types
 * 
 * Central type definitions for the unified relationship management system.
 * Bridges Fact Sheets ↔ Blueprint Hub ↔ Networks ↔ SQLite/CozoDB.
 */

import type { EntityKind } from '@/lib/entities/entityTypes';
import type { RelationshipSource } from '@/lib/relationships/types';
import type { RelationshipDirection, RelationshipCardinality } from '@/features/blueprint-hub/types';
import type { NetworkKind } from '@/lib/networks/types';

// ============================================
// RELATIONSHIP INSTANCE TYPES
// ============================================

/**
 * Input for creating a relationship instance
 * Works across Fact Sheets, Networks, and Blueprint Hub
 */
export interface RelationshipInstanceInput {
    /** Source entity ID */
    sourceEntityId: string;

    /** Target entity ID */
    targetEntityId: string;

    /** Type reference from Blueprint Hub (preferred) */
    relationshipTypeId?: string;

    /** Direct type name if no Blueprint type exists */
    relationshipTypeName?: string;

    /** Network context (optional) */
    networkId?: string;

    /** Source of creation */
    source: RelationshipSource;

    /** Confidence score (1.0 for manual) */
    confidence?: number;

    /** Temporal validity start */
    validFrom?: Date;

    /** Temporal validity end */
    validTo?: Date;

    /** Custom attributes (defined by relationship type) */
    attributes?: Record<string, unknown>;

    /** Namespace for isolation */
    namespace?: string;
}

/**
 * Input for updating a relationship instance
 */
export interface RelationshipInstanceUpdate {
    /** Confidence score */
    confidence?: number;

    /** Temporal validity start */
    validFrom?: Date | null;

    /** Temporal validity end */
    validTo?: Date | null;

    /** Custom attributes */
    attributes?: Record<string, unknown>;
}

/**
 * Resolved relationship instance with full context
 * Used for display in Fact Sheets
 */
export interface ResolvedRelationshipInstance {
    id: string;

    /** Source entity (resolved) */
    sourceEntity: ResolvedEntityRef;

    /** Target entity (resolved) */
    targetEntity: ResolvedEntityRef;

    /** Relationship type definition (from Blueprint Hub) */
    relationshipType: ResolvedRelationshipType;

    /** Network context (if applicable) */
    network?: ResolvedNetworkRef;

    /** All networks this relationship belongs to (Phase 5: Network Auto-Membership) */
    networkMemberships?: Array<{
        networkId: string;
        networkName: string;
        schemaName: string;
        relationshipCode: string;
        networkRelationshipId: string;
        color?: string;
    }>;

    /** Combined confidence score */
    confidence: number;

    /** All sources that contributed this relationship */
    sources: RelationshipSource[];

    /** Temporal bounds */
    validFrom?: Date;
    validTo?: Date;

    /** Custom attributes */
    attributes: Record<string, unknown>;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Resolved entity reference for relationship display
 */
export interface ResolvedEntityRef {
    id: string;
    name: string;
    kind: EntityKind;
    color?: string;
    noteId?: string;
}

/**
 * Resolved relationship type for display
 */
export interface ResolvedRelationshipType {
    id: string;
    name: string;
    displayLabel: string;
    inverseLabel?: string;
    direction: RelationshipDirection;
    cardinality: RelationshipCardinality;
    color?: string;
    icon?: string;
    /** Verb patterns for NLP matching */
    verbPatterns?: string[];
}

/**
 * Resolved network reference for display
 */
export interface ResolvedNetworkRef {
    id: string;
    name: string;
    kind: NetworkKind;
    color?: string;
}

// ============================================
// RELATIONSHIP QUERY TYPES
// ============================================

/**
 * Query options for relationship instances
 */
export interface RelationshipInstanceQuery {
    /** Entity ID (as source or target) */
    entityId?: string;

    /** Only as source */
    sourceEntityId?: string;

    /** Only as target */
    targetEntityId?: string;

    /** Filter by relationship type ID */
    relationshipTypeId?: string;

    /** Filter by relationship type name */
    relationshipTypeName?: string;

    /** Filter by network */
    networkId?: string;

    /** Minimum confidence */
    minConfidence?: number;

    /** Filter by sources */
    sources?: RelationshipSource[];

    /** Namespace */
    namespace?: string;

    /** Include inactive/ended relationships */
    includeInactive?: boolean;

    /** Pagination */
    limit?: number;
    offset?: number;
}

/**
 * Grouped relationships by type (for Fact Sheet display)
 */
export interface GroupedRelationships {
    /** Relationship type info */
    type: ResolvedRelationshipType;

    /** Outgoing relationships of this type */
    outgoing: ResolvedRelationshipInstance[];

    /** Incoming relationships of this type */
    incoming: ResolvedRelationshipInstance[];

    /** Total count */
    totalCount: number;
}

// ============================================
// CANDIDATE ENTITY TYPES
// ============================================

/**
 * Candidate entity for relationship creation
 */
export interface CandidateEntity {
    id: string;
    name: string;
    kind: EntityKind;
    color?: string;
    noteId?: string;

    /** Already has relationship of this type with source */
    hasExistingRelationship?: boolean;

    /** Relevance score (for sorting suggestions) */
    relevanceScore?: number;
}

// ============================================
// APPLICABLE RELATIONSHIP TYPES
// ============================================

/**
 * Relationship type applicable to an entity kind
 */
export interface ApplicableRelationshipType {
    /** Type ID from Blueprint Hub */
    id: string;

    /** Display info */
    name: string;
    displayLabel: string;
    inverseLabel?: string;

    /** Direction relative to the entity */
    direction: 'outgoing' | 'incoming' | 'both';

    /** Target entity kind when outgoing, source when incoming */
    otherEntityKind: EntityKind;

    /** Cardinality */
    cardinality: RelationshipCardinality;

    /** Current instance count for this entity */
    instanceCount: number;

    /** Max allowed (from cardinality) */
    maxAllowed?: number;

    /** Category for grouping in UI */
    category?: string;
}

// ============================================
// SYNC STATUS TYPES
// ============================================

/**
 * Sync status for relationship bridge
 */
export interface RelationshipBridgeSyncStatus {
    /** Last sync to SQLite */
    lastSQLiteSync?: Date;

    /** Last sync to CozoDB */
    lastCozoDBSync?: Date;

    /** Pending changes count */
    pendingChanges: number;

    /** Error state */
    error?: string;
}

// ============================================
// EVENT TYPES (for cross-system communication)
// ============================================

export type RelationshipBridgeEventType =
    | 'relationship:created'
    | 'relationship:updated'
    | 'relationship:deleted'
    | 'relationship:synced'
    | 'type:created'
    | 'type:updated';

export interface RelationshipBridgeEvent {
    type: RelationshipBridgeEventType;
    payload: {
        relationshipId?: string;
        relationshipTypeId?: string;
        sourceEntityId?: string;
        targetEntityId?: string;
        networkId?: string;
    };
    timestamp: Date;
}
