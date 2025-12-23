/**
 * Network Editor Type Definitions
 * 
 * Defines typed hierarchical networks (families, orgs, factions) with 
 * strict relationship schemas. This layer is SEPARATE from the content
 * graph - network relationships are explicitly declared, not inferred.
 * 
 * Architecture:
 * - NetworkSchema: Defines allowed relationships for a network type
 * - NetworkInstance: A specific family, org, or faction
 * - NetworkRelationshipInstance: An actual relationship between entities
 */

import type { EntityKind } from '@/lib/entities/entityTypes';
import type { NodeId } from '@/lib/graph/types';

// ===== NETWORK KINDS =====

/**
 * Available network types
 */
export const NETWORK_KINDS = [
    'FAMILY',
    'ORGANIZATION',
    'FACTION',
    'ALLIANCE',
    'GUILD',
    'FRIENDSHIP',
    'RIVALRY',
    'CUSTOM',
] as const;

export type NetworkKind = typeof NETWORK_KINDS[number];

/**
 * Subtypes for each network kind
 */
export const NETWORK_SUBTYPES: Record<NetworkKind, readonly string[]> = {
    FAMILY: ['NUCLEAR', 'EXTENDED', 'CLAN', 'DYNASTY', 'ROYAL', 'ADOPTED'] as const,
    ORGANIZATION: ['MILITARY', 'CORPORATE', 'GOVERNMENT', 'RELIGIOUS', 'ACADEMIC'] as const,
    FACTION: ['POLITICAL', 'REBEL', 'CULT', 'GANG', 'TRIBE'] as const,
    ALLIANCE: ['STRATEGIC', 'ECONOMIC', 'DEFENSIVE', 'TEMPORARY', 'PERMANENT'] as const,
    GUILD: ['TRADE', 'CRAFT', 'MERCHANT', 'THIEVES', 'MAGES'] as const,
    FRIENDSHIP: ['CLOSE', 'CASUAL', 'CHILDHOOD', 'PROFESSIONAL'] as const,
    RIVALRY: ['COMPETITIVE', 'HOSTILE', 'DEADLY', 'PROFESSIONAL'] as const,
    CUSTOM: [] as const,
};

/**
 * Colors for network kinds (purple palette for networks)
 */
export const NETWORK_COLORS: Record<NetworkKind, string> = {
    FAMILY: '#9333ea',      // Purple
    ORGANIZATION: '#3b82f6', // Blue
    FACTION: '#ef4444',      // Red
    ALLIANCE: '#10b981',     // Emerald
    GUILD: '#f59e0b',        // Amber
    FRIENDSHIP: '#ec4899',   // Pink
    RIVALRY: '#dc2626',      // Red-600
    CUSTOM: '#6b7280',       // Gray
};

// ===== RELATIONSHIP DEFINITIONS =====

/**
 * Relationship direction
 */
export type NetworkRelationshipDirection = 'OUTBOUND' | 'INBOUND' | 'BIDIRECTIONAL';

/**
 * Relationship definition for a network type
 * 
 * This is part of the SCHEMA - defines what relationships are POSSIBLE
 */
export interface NetworkRelationshipDef {
    id: string;
    label: string;
    code: string; // e.g., 'PARENT_OF', 'CHILD_OF', 'SPOUSE_OF'

    // Source/target constraints
    sourceKind: EntityKind;
    targetKind: EntityKind;

    // Directionality
    direction: NetworkRelationshipDirection;
    inverseRelationship?: string; // Code of inverse (e.g., PARENT_OF ↔ CHILD_OF)

    // Cardinality constraints
    minCount?: number; // Min connections required (e.g., 0)
    maxCount?: number; // Max connections allowed (e.g., spouse: 1, children: unlimited)

    // Metadata
    description?: string;
    icon?: string;
    color?: string;

    // Validation
    allowSelfLoop?: boolean; // Can entity have relationship with itself?
    allowDuplicates?: boolean; // Can same relationship exist twice between same entities?
}

// ===== NETWORK SCHEMA =====

/**
 * Network schema defines the structure and rules for a network type
 * 
 * Think of this as a BLUEPRINT for networks - it defines what relationships
 * are allowed and how the network should be structured.
 */
export interface NetworkSchema {
    id: string;
    name: string;
    kind: NetworkKind;
    subtype?: string;
    description: string;

    // Allowed entity types in this network
    allowedEntityKinds: EntityKind[];

    // Relationship definitions
    relationships: NetworkRelationshipDef[];

    // Hierarchy rules
    isHierarchical: boolean;
    rootEntityKind?: EntityKind; // e.g., CHARACTER for families
    maxDepth?: number; // Unlimited if undefined

    // Validation rules
    allowCycles: boolean; // Can A → B → A exist?
    requireRootNode: boolean; // Must have patriarch/matriarch?

    // Whether this is a built-in schema
    isSystem: boolean;

    // Auto-create options
    autoCreateInverse: boolean; // Auto-create CHILD_OF when PARENT_OF is added

    // Metadata
    icon?: string;
    color?: string;

    createdAt: Date;
    updatedAt: Date;
}

// ===== NETWORK INSTANCE =====

/**
 * Network instance - a specific family, org, faction, etc.
 * 
 * This is created when a user makes a "[NETWORK|Stark Family]" folder
 */
export interface NetworkInstance {
    id: string;
    name: string;
    schemaId: string; // References NetworkSchema

    // Root folder in file tree
    rootFolderId: NodeId;

    // Root entity (optional, e.g., family patriarch)
    rootEntityId?: NodeId;

    // All members
    entityIds: NodeId[];

    // Namespace for story/world isolation
    namespace: string;

    // Metadata
    description?: string;
    tags?: string[];

    // Statistics (computed, cached)
    stats?: NetworkStats;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Statistics for a network instance
 */
export interface NetworkStats {
    memberCount: number;
    relationshipCount: number;
    maxDepth: number;
    generationCount?: number; // For family trees
    lastUpdated: Date;
}

// ===== RELATIONSHIP INSTANCE =====

/**
 * Instance of a relationship in a specific network
 * 
 * This is created when a user adds a "child" to a family, etc.
 */
export interface NetworkRelationshipInstance {
    id: string;
    networkId: string;
    relationshipCode: string; // References NetworkRelationshipDef.code

    sourceEntityId: NodeId;
    targetEntityId: NodeId;

    // Temporal metadata (when relationship existed)
    startDate?: Date; // When relationship started (e.g., marriage date)
    endDate?: Date;   // When it ended (e.g., divorce, death)

    // Relationship strength (0-1)
    strength?: number;

    // Optional notes
    notes?: string;

    // Custom attributes (schema-defined)
    attributes?: Record<string, unknown>;

    createdAt: Date;
    updatedAt: Date;
}

// ===== FOLDER/NOTE EXTENSIONS =====

/**
 * Network-specific folder metadata
 * 
 * Extends base Folder type when folder is part of a network
 */
export interface NetworkFolderMeta {
    networkId?: string;           // If this folder IS a network root
    networkSchemaId?: string;     // Schema this network uses
    memberRole?: string;          // Role within network (e.g., "PARENT", "CHILD")
    allowedRelationships?: string[]; // Which relationships can spawn from here
}

/**
 * Network-specific note metadata
 * 
 * Extends base Note type when note is part of a network
 */
export interface NetworkNoteMeta {
    networkIds?: string[];        // Networks this entity belongs to
    networkRoles?: Record<string, string>; // Role in each network { networkId: role }
}

// ===== QUERY TYPES =====

/**
 * Result of ancestor/descendant queries
 */
export interface NetworkLineageResult {
    entityId: NodeId;
    depth: number;
    relationship: string; // Relationship used to reach this entity
    path: NodeId[]; // Full path from origin
}

/**
 * Network query options
 */
export interface NetworkQueryOptions {
    networkId: string;
    startEntityId?: NodeId;
    maxDepth?: number;
    relationshipCodes?: string[]; // Filter by specific relationships
    includeInactive?: boolean; // Include ended relationships?
}

// ===== VALIDATION TYPES =====

/**
 * Validation result
 */
export interface NetworkValidationResult {
    valid: boolean;
    errors: NetworkValidationError[];
    warnings: NetworkValidationWarning[];
}

export interface NetworkValidationError {
    code: string;
    message: string;
    entityId?: NodeId;
    relationshipId?: string;
}

export interface NetworkValidationWarning {
    code: string;
    message: string;
    entityId?: NodeId;
    suggestion?: string;
}

// ===== UTILITY TYPES =====

/**
 * Type guard for network kind
 */
export function isNetworkKind(value: string): value is NetworkKind {
    return NETWORK_KINDS.includes(value as NetworkKind);
}

/**
 * Get relationship by code from schema
 */
export function getRelationshipDef(
    schema: NetworkSchema,
    code: string
): NetworkRelationshipDef | undefined {
    return schema.relationships.find(r => r.code === code);
}

/**
 * Get inverse relationship code
 */
export function getInverseRelationshipCode(
    schema: NetworkSchema,
    code: string
): string | undefined {
    const rel = getRelationshipDef(schema, code);
    return rel?.inverseRelationship;
}

/**
 * Check if relationship is hierarchical (creates parent-child structure)
 */
export function isHierarchicalRelationship(rel: NetworkRelationshipDef): boolean {
    const hierarchicalCodes = [
        'PARENT_OF', 'CHILD_OF',
        'REPORTS_TO', 'MANAGES',
        'GRANDPARENT_OF', 'GRANDCHILD_OF',
        'ADOPTIVE_PARENT_OF', 'ADOPTED_BY',
    ];
    return hierarchicalCodes.includes(rel.code);
}

/**
 * Check if relationship creates a lineage (ancestors/descendants)
 */
export function isLineageRelationship(code: string): boolean {
    const lineageCodes = [
        'PARENT_OF', 'CHILD_OF',
        'GRANDPARENT_OF', 'GRANDCHILD_OF',
        'ANCESTOR_OF', 'DESCENDANT_OF',
        'ADOPTIVE_PARENT_OF', 'ADOPTED_BY',
    ];
    return lineageCodes.includes(code);
}
