/**
 * Guild Schema
 * 
 * Defines trade guilds, craft guilds, merchant associations,
 * thieves' guilds, and mage circles.
 * 
 * Relationships:
 * - GUILDMASTER_OF / GUILD_LED_BY
 * - APPRENTICE_OF / MASTER_OF
 * - JOURNEYMAN_UNDER / HAS_JOURNEYMAN
 * - GUILD_MEMBER / GUILD_HAS_MEMBER
 */

import type { NetworkSchema, NetworkRelationshipDef } from '../types';

/**
 * Guild relationship definitions
 */
export const GUILD_RELATIONSHIPS: NetworkRelationshipDef[] = [
    // === Leadership ===
    {
        id: 'guildmaster-of',
        label: 'Guildmaster Of',
        code: 'GUILDMASTER_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'GUILD_LED_BY',
        maxCount: undefined, // Can be guildmaster of multiple guilds
        description: 'Guild leadership role',
        icon: 'Crown',
        color: '#eab308', // Yellow
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'guild-led-by',
        label: 'Guild Led By',
        code: 'GUILD_LED_BY',
        sourceKind: 'FACTION',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'GUILDMASTER_OF',
        maxCount: 1, // Usually one guildmaster
        description: 'Guild is led by this guildmaster',
        icon: 'Crown',
        color: '#eab308',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Master-Apprentice ===
    {
        id: 'master-of',
        label: 'Master Of',
        code: 'MASTER_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'APPRENTICE_OF',
        maxCount: undefined,
        description: 'Craft master with apprentice',
        icon: 'GraduationCap',
        color: '#8b5cf6', // Violet
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'apprentice-of',
        label: 'Apprentice Of',
        code: 'APPRENTICE_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'MASTER_OF',
        maxCount: 1, // Usually one master at a time
        description: 'Apprentice learning from master',
        icon: 'BookOpen',
        color: '#8b5cf6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Journeyman ===
    {
        id: 'journeyman-under',
        label: 'Journeyman Under',
        code: 'JOURNEYMAN_UNDER',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'HAS_JOURNEYMAN',
        maxCount: 1,
        description: 'Journeyman working under master',
        icon: 'Briefcase',
        color: '#f59e0b', // Amber
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'has-journeyman',
        label: 'Has Journeyman',
        code: 'HAS_JOURNEYMAN',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'JOURNEYMAN_UNDER',
        maxCount: undefined,
        description: 'Has journeyman working for them',
        icon: 'Briefcase',
        color: '#f59e0b',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Membership ===
    {
        id: 'guild-member',
        label: 'Guild Member Of',
        code: 'GUILD_MEMBER',
        sourceKind: 'CHARACTER',
        targetKind: 'FACTION',
        direction: 'OUTBOUND',
        inverseRelationship: 'GUILD_HAS_MEMBER',
        maxCount: undefined, // Can be member of multiple guilds
        description: 'Member of guild',
        icon: 'Users',
        color: '#10b981', // Emerald
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'guild-has-member',
        label: 'Guild Has Member',
        code: 'GUILD_HAS_MEMBER',
        sourceKind: 'FACTION',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'GUILD_MEMBER',
        maxCount: undefined,
        description: 'Guild includes this member',
        icon: 'Users',
        color: '#10b981',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Ranks ===
    {
        id: 'guild-senior-to',
        label: 'Senior To',
        code: 'GUILD_SENIOR_TO',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'GUILD_JUNIOR_TO',
        maxCount: undefined,
        description: 'Senior rank in guild',
        icon: 'ChevronUp',
        color: '#3b82f6', // Blue
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'guild-junior-to',
        label: 'Junior To',
        code: 'GUILD_JUNIOR_TO',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'GUILD_SENIOR_TO',
        maxCount: undefined,
        description: 'Junior rank in guild',
        icon: 'ChevronDown',
        color: '#3b82f6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Guild Relations ===
    {
        id: 'guild-ally',
        label: 'Guild Allied With',
        code: 'GUILD_ALLY',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'GUILD_ALLY',
        maxCount: undefined,
        description: 'Allied guilds',
        icon: 'Handshake',
        color: '#22c55e', // Green
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'guild-rival',
        label: 'Guild Rival Of',
        code: 'GUILD_RIVAL',
        sourceKind: 'FACTION',
        targetKind: 'FACTION',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'GUILD_RIVAL',
        maxCount: undefined,
        description: 'Rival guilds',
        icon: 'Swords',
        color: '#ef4444', // Red
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Specialization ===
    {
        id: 'specializes-in',
        label: 'Specializes In',
        code: 'SPECIALIZES_IN',
        sourceKind: 'CHARACTER',
        targetKind: 'CONCEPT',
        direction: 'OUTBOUND',
        inverseRelationship: 'SPECIALIST',
        maxCount: undefined,
        description: 'Craft or trade specialization',
        icon: 'Wand2',
        color: '#ec4899', // Pink
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'specialist',
        label: 'Has Specialist',
        code: 'SPECIALIST',
        sourceKind: 'CONCEPT',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'SPECIALIZES_IN',
        maxCount: undefined,
        description: 'Person who specializes in this',
        icon: 'Wand2',
        color: '#ec4899',
        allowSelfLoop: false,
        allowDuplicates: false,
    },
];

/**
 * The Guild Schema
 */
export const GUILD_SCHEMA: NetworkSchema = {
    id: 'guild-v1',
    name: 'Guild Network',
    kind: 'GUILD',
    description: 'Trade guilds, craft guilds, merchant associations, ' +
        'thieves\' guilds, and mage circles with apprenticeship and rank systems.',

    allowedEntityKinds: ['CHARACTER', 'NPC', 'FACTION', 'CONCEPT'],

    relationships: GUILD_RELATIONSHIPS,

    isHierarchical: true,
    rootEntityKind: 'FACTION', // Guild itself
    maxDepth: undefined,

    allowCycles: false,
    requireRootNode: true,

    isSystem: true,
    autoCreateInverse: true,

    icon: 'Hammer',
    color: '#f59e0b', // Amber

    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

export default GUILD_SCHEMA;
