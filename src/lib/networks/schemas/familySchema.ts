/**
 * Family Tree Schema
 * 
 * The flagship network schema - defines biological and adoptive family
 * relationships with multi-generational support.
 * 
 * Relationships:
 * - PARENT_OF / CHILD_OF (biological)
 * - ADOPTIVE_PARENT_OF / ADOPTED_BY
 * - SPOUSE_OF (bidirectional)
 * - SIBLING_OF (bidirectional)
 * - GRANDPARENT_OF / GRANDCHILD_OF (derived)
 */

import type { NetworkSchema, NetworkRelationshipDef } from '../types';

/**
 * Family relationship definitions
 */
export const FAMILY_RELATIONSHIPS: NetworkRelationshipDef[] = [
    // === Parent-Child (Biological) ===
    {
        id: 'parent-of',
        label: 'Parent Of',
        code: 'PARENT_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'CHILD_OF',
        maxCount: undefined, // Unlimited children
        description: 'Biological or guardianship parent relationship',
        icon: 'Users',
        color: '#10b981', // Emerald
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'child-of',
        label: 'Child Of',
        code: 'CHILD_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'PARENT_OF',
        maxCount: 2, // Max 2 biological parents (can be overridden for fantasy settings)
        description: 'Biological or guardianship child relationship',
        icon: 'User',
        color: '#10b981',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Spousal Relationships ===
    {
        id: 'spouse-of',
        label: 'Spouse Of',
        code: 'SPOUSE_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'SPOUSE_OF', // Self-inverse
        maxCount: 1, // Monogamous by default (override in schema for polyamory)
        description: 'Married or life partner relationship',
        icon: 'Heart',
        color: '#ec4899', // Pink
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'ex-spouse-of',
        label: 'Former Spouse Of',
        code: 'EX_SPOUSE_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'EX_SPOUSE_OF',
        maxCount: undefined, // No limit on ex-spouses
        description: 'Former married or life partner relationship',
        icon: 'HeartCrack',
        color: '#9ca3af', // Gray
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'betrothed-to',
        label: 'Betrothed To',
        code: 'BETROTHED_TO',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'BETROTHED_TO',
        maxCount: 1,
        description: 'Engaged to be married',
        icon: 'Ring',
        color: '#f97316', // Orange
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Sibling Relationships ===
    {
        id: 'sibling-of',
        label: 'Sibling Of',
        code: 'SIBLING_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'SIBLING_OF',
        maxCount: undefined,
        description: 'Full sibling (same parents)',
        icon: 'Users2',
        color: '#f59e0b', // Amber
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'half-sibling-of',
        label: 'Half-Sibling Of',
        code: 'HALF_SIBLING_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'HALF_SIBLING_OF',
        maxCount: undefined,
        description: 'Half sibling (one shared parent)',
        icon: 'Users2',
        color: '#eab308', // Yellow
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'step-sibling-of',
        label: 'Step-Sibling Of',
        code: 'STEP_SIBLING_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'STEP_SIBLING_OF',
        maxCount: undefined,
        description: 'Step sibling (through remarriage)',
        icon: 'Users2',
        color: '#a3e635', // Lime
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'twin-of',
        label: 'Twin Of',
        code: 'TWIN_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'TWIN_OF',
        maxCount: undefined, // Triplets, etc.
        description: 'Twin sibling',
        icon: 'Sparkles',
        color: '#8b5cf6', // Violet
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Extended Family ===
    {
        id: 'grandparent-of',
        label: 'Grandparent Of',
        code: 'GRANDPARENT_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'GRANDCHILD_OF',
        maxCount: undefined,
        description: 'Grandparent relationship',
        icon: 'Users',
        color: '#8b5cf6', // Violet
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'grandchild-of',
        label: 'Grandchild Of',
        code: 'GRANDCHILD_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'GRANDPARENT_OF',
        maxCount: 4, // Max 4 grandparents
        description: 'Grandchild relationship',
        icon: 'User',
        color: '#8b5cf6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'aunt-uncle-of',
        label: 'Aunt/Uncle Of',
        code: 'AUNT_UNCLE_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'NIECE_NEPHEW_OF',
        maxCount: undefined,
        description: 'Aunt or uncle relationship',
        icon: 'Users',
        color: '#06b6d4', // Cyan
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'niece-nephew-of',
        label: 'Niece/Nephew Of',
        code: 'NIECE_NEPHEW_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'AUNT_UNCLE_OF',
        maxCount: undefined,
        description: 'Niece or nephew relationship',
        icon: 'User',
        color: '#06b6d4',
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'cousin-of',
        label: 'Cousin Of',
        code: 'COUSIN_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'COUSIN_OF',
        maxCount: undefined,
        description: 'Cousin relationship',
        icon: 'Users2',
        color: '#14b8a6', // Teal
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Adoptive Relationships ===
    {
        id: 'adoptive-parent-of',
        label: 'Adoptive Parent Of',
        code: 'ADOPTIVE_PARENT_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'ADOPTED_BY',
        maxCount: undefined,
        description: 'Adoptive parent relationship',
        icon: 'UserPlus',
        color: '#14b8a6', // Teal
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'adopted-by',
        label: 'Adopted By',
        code: 'ADOPTED_BY',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'ADOPTIVE_PARENT_OF',
        maxCount: undefined, // Multiple adoptive parents allowed
        description: 'Adopted child relationship',
        icon: 'UserPlus',
        color: '#14b8a6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Guardian Relationships ===
    {
        id: 'guardian-of',
        label: 'Guardian Of',
        code: 'GUARDIAN_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'WARD_OF',
        maxCount: undefined,
        description: 'Legal guardian relationship',
        icon: 'Shield',
        color: '#3b82f6', // Blue
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'ward-of',
        label: 'Ward Of',
        code: 'WARD_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'GUARDIAN_OF',
        maxCount: undefined,
        description: 'Under guardianship of',
        icon: 'Shield',
        color: '#3b82f6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },
];

/**
 * The Family Tree Schema
 */
export const FAMILY_SCHEMA: NetworkSchema = {
    id: 'family-tree-v1',
    name: 'Family Tree',
    kind: 'FAMILY',
    description: 'Biological and adoptive family relationships with multi-generational support. ' +
        'Tracks parents, children, spouses, siblings, and extended family connections.',

    allowedEntityKinds: ['CHARACTER', 'NPC'],

    relationships: FAMILY_RELATIONSHIPS,

    isHierarchical: true,
    rootEntityKind: 'CHARACTER',
    maxDepth: undefined, // Unlimited generations

    allowCycles: false, // No circular family trees (can't be your own ancestor)
    requireRootNode: false, // Can start without a patriarch/matriarch

    isSystem: true,
    autoCreateInverse: true, // Auto-create CHILD_OF when PARENT_OF is added

    icon: 'Users',
    color: '#9333ea', // Purple

    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

/**
 * Get primary relationships (most commonly used)
 */
export function getPrimaryFamilyRelationships(): NetworkRelationshipDef[] {
    const primaryCodes = ['PARENT_OF', 'CHILD_OF', 'SPOUSE_OF', 'SIBLING_OF'];
    return FAMILY_RELATIONSHIPS.filter(r => primaryCodes.includes(r.code));
}

/**
 * Get extended family relationships
 */
export function getExtendedFamilyRelationships(): NetworkRelationshipDef[] {
    const extendedCodes = [
        'GRANDPARENT_OF', 'GRANDCHILD_OF',
        'AUNT_UNCLE_OF', 'NIECE_NEPHEW_OF',
        'COUSIN_OF'
    ];
    return FAMILY_RELATIONSHIPS.filter(r => extendedCodes.includes(r.code));
}

/**
 * Get adoptive/guardian relationships
 */
export function getAdoptiveRelationships(): NetworkRelationshipDef[] {
    const adoptiveCodes = [
        'ADOPTIVE_PARENT_OF', 'ADOPTED_BY',
        'GUARDIAN_OF', 'WARD_OF'
    ];
    return FAMILY_RELATIONSHIPS.filter(r => adoptiveCodes.includes(r.code));
}

export default FAMILY_SCHEMA;
