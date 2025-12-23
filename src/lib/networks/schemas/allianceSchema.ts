/**
 * Alliance Schema
 * 
 * Defines strategic, economic, defensive, and political alliances
 * between characters, factions, and organizations.
 * 
 * Relationships:
 * - ALLIED_WITH (bilateral alliance)
 * - TREATY_WITH (formal agreement)
 * - TRADE_PARTNER_OF (economic)
 * - PLEDGED_TO / HAS_PLEDGE_FROM (loyalty)
 */

import type { NetworkSchema, NetworkRelationshipDef } from '../types';

/**
 * Alliance relationship definitions
 */
export const ALLIANCE_RELATIONSHIPS: NetworkRelationshipDef[] = [
    // === Bilateral Alliance ===
    {
        id: 'allied-with',
        label: 'Allied With',
        code: 'ALLIED_WITH',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'ALLIED_WITH',
        maxCount: undefined,
        description: 'Personal or political alliance',
        icon: 'Handshake',
        color: '#22c55e', // Green
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Treaty ===
    {
        id: 'treaty-with',
        label: 'Treaty With',
        code: 'TREATY_WITH',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'TREATY_WITH',
        maxCount: undefined,
        description: 'Formal treaty agreement',
        icon: 'FileText',
        color: '#3b82f6', // Blue
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Economic ===
    {
        id: 'trade-partner-of',
        label: 'Trade Partner Of',
        code: 'TRADE_PARTNER_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'TRADE_PARTNER_OF',
        maxCount: undefined,
        description: 'Economic trade partnership',
        icon: 'ArrowLeftRight',
        color: '#f59e0b', // Amber
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'economic-dependent-on',
        label: 'Economically Dependent On',
        code: 'ECONOMIC_DEPENDENT_ON',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'ECONOMIC_SUPPORTER_OF',
        maxCount: undefined,
        description: 'Economic dependency relationship',
        icon: 'TrendingDown',
        color: '#ef4444', // Red
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'economic-supporter-of',
        label: 'Economic Supporter Of',
        code: 'ECONOMIC_SUPPORTER_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'ECONOMIC_DEPENDENT_ON',
        maxCount: undefined,
        description: 'Provides economic support to',
        icon: 'TrendingUp',
        color: '#22c55e', // Green
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Loyalty/Pledge ===
    {
        id: 'pledged-to',
        label: 'Pledged To',
        code: 'PLEDGED_TO',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'HAS_PLEDGE_FROM',
        maxCount: 1, // Usually pledge to one liege
        description: 'Sworn loyalty/fealty',
        icon: 'Shield',
        color: '#8b5cf6', // Violet
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'has-pledge-from',
        label: 'Has Pledge From',
        code: 'HAS_PLEDGE_FROM',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'PLEDGED_TO',
        maxCount: undefined,
        description: 'Has sworn loyalty from',
        icon: 'Shield',
        color: '#8b5cf6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Vassalage ===
    {
        id: 'vassal-of',
        label: 'Vassal Of',
        code: 'VASSAL_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'LIEGE_OF',
        maxCount: 1, // One liege
        description: 'Vassal state/faction',
        icon: 'ChevronDown',
        color: '#6366f1', // Indigo
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'liege-of',
        label: 'Liege Of',
        code: 'LIEGE_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'VASSAL_OF',
        maxCount: undefined, // Multiple vassals
        description: 'Liege lord of vassal',
        icon: 'ChevronUp',
        color: '#6366f1',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Defensive Pact ===
    {
        id: 'defensive-pact-with',
        label: 'Defensive Pact With',
        code: 'DEFENSIVE_PACT_WITH',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'DEFENSIVE_PACT_WITH',
        maxCount: undefined,
        description: 'Mutual defense agreement',
        icon: 'ShieldCheck',
        color: '#14b8a6', // Teal
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Protectorate ===
    {
        id: 'protector-of',
        label: 'Protector Of',
        code: 'PROTECTOR_OF',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'PROTECTED_BY',
        maxCount: undefined,
        description: 'Military protector of',
        icon: 'ShieldPlus',
        color: '#0ea5e9', // Sky
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'protected-by',
        label: 'Protected By',
        code: 'PROTECTED_BY',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'PROTECTOR_OF',
        maxCount: undefined,
        description: 'Under military protection of',
        icon: 'Shield',
        color: '#0ea5e9',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === War ===
    {
        id: 'at-war-with',
        label: 'At War With',
        code: 'AT_WAR_WITH',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'AT_WAR_WITH',
        maxCount: undefined,
        description: 'Active state of war',
        icon: 'Swords',
        color: '#dc2626', // Red-600
        allowSelfLoop: false,
        allowDuplicates: false,
    },
];

/**
 * The Alliance Schema
 */
export const ALLIANCE_SCHEMA: NetworkSchema = {
    id: 'alliance-v1',
    name: 'Alliance Network',
    kind: 'ALLIANCE',
    description: 'Strategic, economic, defensive, and political alliances ' +
        'between characters, factions, and organizations.',

    allowedEntityKinds: ['CHARACTER', 'NPC', 'FACTION', 'LOCATION'],

    relationships: ALLIANCE_RELATIONSHIPS,

    isHierarchical: false, // Alliances are generally peer-to-peer
    maxDepth: undefined,

    allowCycles: true, // Alliance cycles are valid (A allies with B, B with C, C with A)
    requireRootNode: false,

    isSystem: true,
    autoCreateInverse: true,

    icon: 'Handshake',
    color: '#22c55e', // Green

    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

export default ALLIANCE_SCHEMA;
