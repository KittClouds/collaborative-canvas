/**
 * Organization Hierarchy Schema
 * 
 * Defines corporate, military, government, and other organizational
 * hierarchies with reporting structures and peer relationships.
 * 
 * Relationships:
 * - REPORTS_TO / MANAGES (direct reporting line)
 * - PEER_OF (same level colleagues)
 * - ADVISOR_TO / ADVISED_BY (non-reporting advisory)
 * - SUBORDINATE_OF / SUPERIOR_OF (chain of command)
 */

import type { NetworkSchema, NetworkRelationshipDef } from '../types';

/**
 * Organization relationship definitions
 */
export const ORG_RELATIONSHIPS: NetworkRelationshipDef[] = [
    // === Direct Reporting ===
    {
        id: 'reports-to',
        label: 'Reports To',
        code: 'REPORTS_TO',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'MANAGES',
        maxCount: 1, // Only one direct manager
        description: 'Direct reporting relationship',
        icon: 'ArrowUp',
        color: '#3b82f6', // Blue
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'manages',
        label: 'Manages',
        code: 'MANAGES',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'REPORTS_TO',
        maxCount: undefined, // Can manage many people
        description: 'Management relationship',
        icon: 'ArrowDown',
        color: '#3b82f6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Peer Relationships ===
    {
        id: 'peer-of',
        label: 'Peer Of',
        code: 'PEER_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'PEER_OF',
        maxCount: undefined,
        description: 'Same hierarchical level colleague',
        icon: 'Users',
        color: '#10b981', // Emerald
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'collaborates-with',
        label: 'Collaborates With',
        code: 'COLLABORATES_WITH',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'BIDIRECTIONAL',
        inverseRelationship: 'COLLABORATES_WITH',
        maxCount: undefined,
        description: 'Cross-functional collaboration',
        icon: 'GitBranch',
        color: '#8b5cf6', // Violet
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Advisory Relationships ===
    {
        id: 'advisor-to',
        label: 'Advisor To',
        code: 'ADVISOR_TO',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'ADVISED_BY',
        maxCount: undefined,
        description: 'Non-reporting advisory role',
        icon: 'Lightbulb',
        color: '#f59e0b', // Amber
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'advised-by',
        label: 'Advised By',
        code: 'ADVISED_BY',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'ADVISOR_TO',
        maxCount: undefined,
        description: 'Receives advice from',
        icon: 'Lightbulb',
        color: '#f59e0b',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Chain of Command (Military/Government) ===
    {
        id: 'subordinate-of',
        label: 'Subordinate Of',
        code: 'SUBORDINATE_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'SUPERIOR_OF',
        maxCount: undefined, // Can have multiple superiors in matrix orgs
        description: 'Chain of command subordinate',
        icon: 'ChevronDown',
        color: '#ef4444', // Red
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'superior-of',
        label: 'Superior Of',
        code: 'SUPERIOR_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'SUBORDINATE_OF',
        maxCount: undefined,
        description: 'Chain of command superior',
        icon: 'ChevronUp',
        color: '#ef4444',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Mentorship ===
    {
        id: 'mentor-of',
        label: 'Mentor Of',
        code: 'MENTOR_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'MENTEE_OF',
        maxCount: undefined,
        description: 'Professional mentorship',
        icon: 'GraduationCap',
        color: '#14b8a6', // Teal
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'mentee-of',
        label: 'Mentee Of',
        code: 'MENTEE_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'MENTOR_OF',
        maxCount: undefined,
        description: 'Being mentored by',
        icon: 'GraduationCap',
        color: '#14b8a6',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Succession ===
    {
        id: 'successor-of',
        label: 'Successor Of',
        code: 'SUCCESSOR_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'PREDECESSOR_OF',
        maxCount: 1, // Usually one predecessor per role
        description: 'Succeeded in role',
        icon: 'ArrowRightLeft',
        color: '#6366f1', // Indigo
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'predecessor-of',
        label: 'Predecessor Of',
        code: 'PREDECESSOR_OF',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'SUCCESSOR_OF',
        maxCount: undefined, // Could have multiple successors (split role)
        description: 'Preceded in role',
        icon: 'ArrowRightLeft',
        color: '#6366f1',
        allowSelfLoop: false,
        allowDuplicates: false,
    },

    // === Assistant Relationships ===
    {
        id: 'assistant-to',
        label: 'Assistant To',
        code: 'ASSISTANT_TO',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'ASSISTED_BY',
        maxCount: 1, // Usually assists one person directly
        description: 'Personal/executive assistant',
        icon: 'Briefcase',
        color: '#ec4899', // Pink
        allowSelfLoop: false,
        allowDuplicates: false,
    },
    {
        id: 'assisted-by',
        label: 'Assisted By',
        code: 'ASSISTED_BY',
        sourceKind: 'CHARACTER',
        targetKind: 'CHARACTER',
        direction: 'OUTBOUND',
        inverseRelationship: 'ASSISTANT_TO',
        maxCount: undefined,
        description: 'Has personal/executive assistant',
        icon: 'Briefcase',
        color: '#ec4899',
        allowSelfLoop: false,
        allowDuplicates: false,
    },
];

/**
 * The Organization Schema
 */
export const ORG_SCHEMA: NetworkSchema = {
    id: 'organization-v1',
    name: 'Organization Hierarchy',
    kind: 'ORGANIZATION',
    description: 'Corporate, military, or government organizational structure with ' +
        'reporting lines, peer relationships, and chains of command.',

    allowedEntityKinds: ['CHARACTER', 'NPC', 'FACTION'],

    relationships: ORG_RELATIONSHIPS,

    isHierarchical: true,
    rootEntityKind: 'CHARACTER', // CEO, General, etc.
    maxDepth: undefined,

    allowCycles: false, // No circular reporting (can't manage your own manager)
    requireRootNode: true, // Organization needs a head

    isSystem: true,
    autoCreateInverse: true,

    icon: 'Building',
    color: '#3b82f6', // Blue

    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

/**
 * Military organization variant
 */
export const MILITARY_ORG_SCHEMA: NetworkSchema = {
    ...ORG_SCHEMA,
    id: 'military-organization-v1',
    name: 'Military Hierarchy',
    subtype: 'MILITARY',
    description: 'Military chain of command with ranks and units.',
    icon: 'Shield',
    color: '#dc2626', // Red
};

/**
 * Corporate organization variant
 */
export const CORPORATE_ORG_SCHEMA: NetworkSchema = {
    ...ORG_SCHEMA,
    id: 'corporate-organization-v1',
    name: 'Corporate Hierarchy',
    subtype: 'CORPORATE',
    description: 'Corporate structure with departments and reporting lines.',
    icon: 'Building2',
    color: '#0ea5e9', // Sky blue
};

/**
 * Get management relationships
 */
export function getManagementRelationships(): NetworkRelationshipDef[] {
    const codes = ['REPORTS_TO', 'MANAGES', 'SUBORDINATE_OF', 'SUPERIOR_OF'];
    return ORG_RELATIONSHIPS.filter(r => codes.includes(r.code));
}

/**
 * Get advisory/peer relationships
 */
export function getCollaborativeRelationships(): NetworkRelationshipDef[] {
    const codes = ['PEER_OF', 'COLLABORATES_WITH', 'ADVISOR_TO', 'ADVISED_BY'];
    return ORG_RELATIONSHIPS.filter(r => codes.includes(r.code));
}

export default ORG_SCHEMA;
