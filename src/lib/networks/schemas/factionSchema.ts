/**
 * Faction Schema
 * 
 * Defines political factions, rebel groups, cults, gangs, and tribal
 * organizations with leadership and membership structures.
 * 
 * Relationships:
 * - LEADS / LED_BY (leadership)
 * - MEMBER_OF / HAS_MEMBER (membership)
 * - ALLY_OF / ENEMY_OF (inter-faction)
 * - FOUNDED_BY / FOUNDER_OF (origin)
 */

import type { NetworkSchema, NetworkRelationshipDef } from '../types';

/**
 * Faction relationship definitions
 */
export const FACTION_RELATIONSHIPS: NetworkRelationshipDef[] = [
    // === Leadership ===
    {
        id: 'leads',
        label: 'Leads',
        code: 'LEADS',
        sourceKind: 'CHARACTER',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'LED_BY',
        maxCount: undefined, // Can lead multiple factions
        description: 'Leadership role in faction',
        icon: 'Crown',
        color: '#eab308', // Yellow
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'led-by',
        label: 'Led By',
        code: 'LED_BY',
        sourceKind: 'FACTION',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'LEADS',
        maxCount: undefined, // Can have multiple leaders (council, etc.)
        description: 'Faction is led by this character',
        icon: 'Crown',
        color: '#eab308',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Membership ===
    {
        id: 'member-of-faction',
        label: 'Member Of',
        code: 'FACTION_MEMBER_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'HAS_MEMBER',
        maxCount: undefined, // Can be member of multiple factions
        description: 'Membership in faction',
        icon: 'Users',
        color: '#10b981', // Emerald
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'has-member',
        label: 'Has Member',
        code: 'HAS_MEMBER',
        sourceKind: 'FACTION',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'FACTION_MEMBER_OF',
        maxCount: undefined,
        description: 'Faction includes this member',
        icon: 'Users',
        color: '#10b981',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Ranks ===
    {
        id: 'outranks',
        label: 'Outranks',
        code: 'OUTRANKS',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'OUTRANKED_BY',
        maxCount: undefined,
        description: 'Higher rank within faction',
        icon: 'ChevronUp',
        color: '#3b82f6', // Blue
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'outranked-by',
        label: 'Outranked By',
        code: 'OUTRANKED_BY',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'OUTRANKS',
        maxCount: undefined,
        description: 'Lower rank within faction',
        icon: 'ChevronDown',
        color: '#3b82f6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Origin ===
    {
        id: 'founded-by',
        label: 'Founded By',
        code: 'FOUNDED_BY',
        sourceKind: 'FACTION',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'FOUNDER_OF',
        maxCount: undefined, // Can have multiple founders
        description: 'Faction was founded by',
        icon: 'Sparkles',
        color: '#8b5cf6', // Violet
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'founder-of',
        label: 'Founder Of',
        code: 'FOUNDER_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'FOUNDED_BY',
        maxCount: undefined,
        description: 'Character founded this faction',
        icon: 'Sparkles',
        color: '#8b5cf6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Inter-faction Relations ===
    {
        id: 'faction-ally-of',
        label: 'Allied With',
        code: 'FACTION_ALLY_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'FACTION_ALLY_OF',
        maxCount: undefined,
        description: 'Allied faction',
        icon: 'Handshake',
        color: '#22c55e', // Green
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'faction-enemy-of',
        label: 'Enemy Of',
        code: 'FACTION_ENEMY_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'FACTION_ENEMY_OF',
        maxCount: undefined,
        description: 'Enemy faction',
        icon: 'Swords',
        color: '#ef4444', // Red
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'faction-neutral-with',
        label: 'Neutral With',
        code: 'FACTION_NEUTRAL_WITH',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'FACTION_NEUTRAL_WITH',
        maxCount: undefined,
        description: 'Neutral faction relation',
        icon: 'Scale',
        color: '#6b7280', // Gray
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Subfactions ===
    {
        id: 'subfaction-of',
        label: 'Subfaction Of',
        code: 'SUBFACTION_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'HAS_SUBFACTION',
        maxCount: 1, // Only one parent faction
        description: 'This is a subfaction/chapter of larger faction',
        icon: 'GitBranch',
        color: '#f59e0b', // Amber
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'has-subfaction',
        label: 'Has Subfaction',
        code: 'HAS_SUBFACTION',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'SUBFACTION_OF',
        maxCount: undefined,
        description: 'Contains this subfaction/chapter',
        icon: 'GitBranch',
        color: '#f59e0b',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Defection ===
    {
        id: 'defected-from',
        label: 'Defected From',
        code: 'DEFECTED_FROM',
        sourceKind: 'CHARACTER',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'LOST_MEMBER',
        maxCount: undefined,
        description: 'Character defected from faction',
        icon: 'UserMinus',
        color: '#dc2626', // Red-600
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'lost-member',
        label: 'Lost Member',
        code: 'LOST_MEMBER',
        sourceKind: 'FACTION',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'DEFECTED_FROM',
        maxCount: undefined,
        description: 'Faction lost this member to defection',
        icon: 'UserMinus',
        color: '#dc2626',
        allowSelfLoop: false,
        allowDuplicates: false,
    },
];

/**
 * The Faction Schema
 */
export const FACTION_SCHEMA: NetworkSchema = {
    id: 'faction-v1',
    name: 'Faction Network',
    kind: 'FACTION',
    description: 'Political factions, rebel groups, cults, gangs, and tribal organizations ' +
        'with leadership hierarchies and inter-faction relationships.',

    allowedEntityKinds: ['CHARACTER', 'NPC', 'FACTION'],

    relationships: FACTION_RELATIONSHIPS,

    isHierarchical: true,
    rootEntityKind: 'FACTION', // Faction itself is the root
    maxDepth: undefined,

    allowCycles: false,
    requireRootNode: true, // Need the faction entity

    isSystem: true,
    autoCreateInverse: true,

    icon: 'Flag',
    color: '#ef4444', // Red

    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

export default FACTION_SCHEMA;
