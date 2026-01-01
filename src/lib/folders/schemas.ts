/**
 * Folder Relationship Schema Types
 * 
 * Defines how typed folders create implicit relationships between entities.
 * Folder structure = knowledge graph with zero extra user effort.
 */

import type { EntityKind } from '@/lib/types/entityTypes';

/**
 * Relationship created by folder nesting.
 * When a subfolder or note is placed under a typed folder,
 * this defines what semantic relationship is automatically created.
 */
export interface FolderRelationshipDefinition {
    /** Relationship type label (e.g., 'ALLY_OF', 'LOCATED_IN', 'OWNS') */
    relationshipType: string;

    /** Which entity is the source: PARENT (folder) or CHILD (subfolder/note) */
    sourceType: 'PARENT' | 'CHILD';

    /** Which entity is the target: PARENT (folder) or CHILD (subfolder/note) */
    targetType: 'PARENT' | 'CHILD';

    /** If true, auto-create inverse relationship */
    bidirectional?: boolean;

    /** Inverse relationship type (e.g., 'ALLIED_WITH' ↔ 'ALLY_OF') */
    inverseType?: string;

    /** Cardinality constraints */
    cardinality?: {
        min?: number;
        max?: number;
    };

    /** Confidence score for auto-created relationships (default: 1.0 for explicit folder structure) */
    defaultConfidence?: number;

    /** Relationship category for filtering/grouping */
    category?: 'social' | 'spatial' | 'ownership' | 'organizational' | 'temporal' | 'custom';
}

/**
 * Allowed subfolder type definition.
 * Each typed folder can spawn specific subfolder types, each with its own relationship semantics.
 */
export interface AllowedSubfolderDefinition {
    /** Entity kind for the subfolder */
    entityKind: EntityKind;

    /** Optional subtype for more specific typing */
    subtype?: string;

    /** Display label in creation menu */
    label: string;

    /** Lucide icon name */
    icon?: string;

    /** Description for tooltip/help text */
    description?: string;

    /** Relationship created when this subfolder type is nested */
    relationship: FolderRelationshipDefinition;

    /** Optional default color override */
    defaultColor?: string;

    // ===== Network Auto-Creation Configuration =====

    /** If true, automatically create a network when children reach threshold */
    autoCreateNetwork?: boolean;

    /** Network schema ID to use (e.g., 'SOCIAL_CIRCLE', 'FACTION_TREE') */
    networkSchemaId?: string;

    /** Minimum children count to trigger network creation (default: 2) */
    networkCreationThreshold?: number;
}

/**
 * Allowed note type definition.
 * Defines what kinds of notes can be created within a typed folder.
 */
export interface AllowedNoteTypeDefinition {
    /** Entity kind for the note */
    entityKind: EntityKind;

    /** Optional subtype */
    subtype?: string;

    /** Display label in creation menu */
    label: string;

    /** Lucide icon name */
    icon?: string;

    /** Optional relationship to parent folder (note-to-folder relationship) */
    relationship?: FolderRelationshipDefinition;

    /** Template to use when creating notes of this type */
    templateId?: string;
}

/**
 * Complete schema for a typed folder.
 * Defines behavior, allowed children, and visual properties.
 */
export interface FolderSchema {
    /** Primary entity kind this folder represents */
    entityKind: EntityKind;

    /** Optional subtype for more specific schemas (e.g., PROTAGONIST vs ANTAGONIST) */
    subtype?: string;

    /** Human-readable name for this schema */
    name?: string;

    /** Description of what this folder type represents */
    description?: string;

    /** What subfolder types can be created under this folder */
    allowedSubfolders: AllowedSubfolderDefinition[];

    /** What note types can be created within this folder */
    allowedNoteTypes?: AllowedNoteTypeDefinition[];

    /** Default color for folders with this schema */
    color?: string;

    /** Lucide icon name */
    icon?: string;

    /** Whether this is a container-only folder (cannot have notes, only subfolders) */
    containerOnly?: boolean;

    /** Whether subfolders inherit this schema's entity kind */
    propagateKindToChildren?: boolean;

    /** Relationship this entity has with its container (parent folder) if applicable */
    parentRelationship?: FolderRelationshipDefinition;

    /** Custom attributes tracked for entities in this folder */
    customAttributes?: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'date' | 'entity_ref';
        required?: boolean;
        defaultValue?: any;
    }>;
}

/**
 * Provenance source types for relationships.
 * Tracks how relationships were created.
 */
export type RelationshipProvenanceType =
    | 'FOLDER_STRUCTURE'  // Created by folder hierarchy
    | 'MANUAL'            // User explicitly created
    | 'NER_EXTRACTION'    // Extracted by NER
    | 'LLM_EXTRACTION'    // Extracted by LLM
    | 'IMPORT'            // Imported from external source
    | 'TEMPLATE';         // Created by template

/**
 * Lightweight provenance record for relationships.
 */
export interface RelationshipProvenance {
    type: RelationshipProvenanceType;
    originId: string;       // Folder ID, note ID, or extraction ID
    timestamp: Date;
    confidence: number;
}
