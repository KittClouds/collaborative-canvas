/**
 * Network Auto-Membership Service
 * 
 * Detects when a relationship matches a NetworkRelationshipDef and
 * automatically manages network membership:
 * 
 * 1. Detects matching relationship types from network schemas
 * 2. Auto-creates NetworkRelationshipInstance in appropriate networks
 * 3. Provides network membership badge information for UI
 * 4. Supports manual "Add to Network" action
 */

import { v4 as generateId } from 'uuid';
import type { EntityKind } from '@/lib/types/entityTypes';
import type { RelationshipTypeDef } from '@/features/blueprint-hub/types';
import type {
    NetworkSchema,
    NetworkRelationshipDef,
    NetworkInstance,
    NetworkRelationshipInstance,
} from './types';
import {
    loadAllNetworks,
    loadNetworkInstance,
    saveNetworkRelationship,
    loadNetworkRelationships,
    addEntityToNetwork,
    deleteNetworkRelationship,
} from './storage';
import { BUILTIN_SCHEMAS, getSchemaById } from './schemas';

// ============================================
// TYPES
// ============================================

/**
 * Result of matching a relationship to network schemas
 */
export interface NetworkMatchResult {
    /** The network schema that matched */
    schema: NetworkSchema;
    /** The specific relationship definition that matched */
    relationshipDef: NetworkRelationshipDef;
    /** Matching networks that use this schema */
    matchingNetworks: NetworkInstance[];
    /** Confidence score (0-1) */
    matchConfidence: number;
}

/**
 * Network membership info for a relationship (for UI badges)
 */
export interface RelationshipNetworkMembership {
    relationshipId: string;
    networkMemberships: Array<{
        networkId: string;
        networkName: string;
        schemaName: string;
        relationshipCode: string;
        networkRelationshipId: string;
        color?: string;
    }>;
}

/**
 * Input for adding a relationship to a network
 */
export interface AddToNetworkInput {
    /** Relationship source entity ID */
    sourceEntityId: string;
    /** Relationship target entity ID */
    targetEntityId: string;
    /** Network to add to */
    networkId: string;
    /** Relationship code (e.g., PARENT_OF) */
    relationshipCode: string;
    /** Optional attributes */
    attributes?: Record<string, unknown>;
    /** Optional notes */
    notes?: string;
}

// ============================================
// MATCHING ENGINE
// ============================================

/**
 * Find all network schemas that have a matching relationship definition
 * for the given relationship type
 * 
 * @param relationshipType - The relationship type from Blueprint Hub
 * @param sourceKind - Source entity kind
 * @param targetKind - Target entity kind
 */
export function findMatchingSchemas(
    relationshipType: RelationshipTypeDef | { relationship_name: string; display_label: string },
    sourceKind: EntityKind,
    targetKind: EntityKind
): NetworkMatchResult[] {
    const results: NetworkMatchResult[] = [];

    // Check all built-in schemas
    for (const schema of BUILTIN_SCHEMAS) {
        const match = findMatchInSchema(schema, relationshipType, sourceKind, targetKind);
        if (match) {
            results.push(match);
        }
    }

    // Sort by confidence
    results.sort((a, b) => b.matchConfidence - a.matchConfidence);

    return results;
}

/**
 * Find a matching relationship definition in a specific schema
 */
function findMatchInSchema(
    schema: NetworkSchema,
    relationshipType: RelationshipTypeDef | { relationship_name: string; display_label: string },
    sourceKind: EntityKind,
    targetKind: EntityKind
): NetworkMatchResult | null {
    // Check if entity kinds are allowed in this schema
    if (!schema.allowedEntityKinds.includes(sourceKind) ||
        !schema.allowedEntityKinds.includes(targetKind)) {
        return null;
    }

    const name = relationshipType.relationship_name?.toLowerCase() ?? '';
    const label = relationshipType.display_label?.toLowerCase() ?? '';

    // Find best matching relationship definition
    let bestMatch: { def: NetworkRelationshipDef; confidence: number } | null = null;

    for (const relDef of schema.relationships) {
        // Check entity kind compatibility
        if (relDef.sourceKind !== sourceKind || relDef.targetKind !== targetKind) {
            // Also check reverse direction for bidirectional
            if (relDef.direction !== 'BIDIRECTIONAL' ||
                relDef.sourceKind !== targetKind || relDef.targetKind !== sourceKind) {
                continue;
            }
        }

        // Calculate match confidence
        let confidence = 0;

        // Exact code match (highest confidence)
        if (name.toUpperCase() === relDef.code) {
            confidence = 1.0;
        }
        // Label match
        else if (label === relDef.label.toLowerCase()) {
            confidence = 0.95;
        }
        // Code contains match
        else if (name.includes(relDef.code.toLowerCase()) ||
            relDef.code.toLowerCase().includes(name)) {
            confidence = 0.8;
        }
        // Semantic matching for common patterns
        else {
            confidence = computeSemanticMatch(name, label, relDef);
        }

        if (confidence > 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
            bestMatch = { def: relDef, confidence };
        }
    }

    if (!bestMatch) {
        return null;
    }

    return {
        schema,
        relationshipDef: bestMatch.def,
        matchingNetworks: [], // Will be populated async
        matchConfidence: bestMatch.confidence,
    };
}

/**
 * Compute semantic matching for common relationship patterns
 */
function computeSemanticMatch(
    name: string,
    label: string,
    relDef: NetworkRelationshipDef
): number {
    const combined = `${name} ${label}`;

    // Family relationships
    const familyMatches: Record<string, string[]> = {
        'PARENT_OF': ['parent', 'father', 'mother', 'dad', 'mom'],
        'CHILD_OF': ['child', 'son', 'daughter', 'kid', 'offspring'],
        'SPOUSE_OF': ['spouse', 'husband', 'wife', 'married', 'partner'],
        'SIBLING_OF': ['sibling', 'brother', 'sister'],
    };

    // Organization relationships
    const orgMatches: Record<string, string[]> = {
        'REPORTS_TO': ['reports', 'supervisor', 'boss', 'manager'],
        'MANAGES': ['manages', 'supervises', 'leads', 'directs'],
        'MEMBER_OF': ['member', 'belongs', 'part of', 'works for'],
    };

    const allMatches = { ...familyMatches, ...orgMatches };

    const keywords = allMatches[relDef.code];
    if (keywords) {
        for (const keyword of keywords) {
            if (combined.includes(keyword)) {
                return 0.75;
            }
        }
    }

    return 0;
}

// ============================================
// AUTO-MEMBERSHIP
// ============================================

/**
 * Check if a relationship should be auto-added to networks
 * and create the network relationships if matching
 * 
 * @param relationshipId - The unified relationship ID
 * @param sourceEntityId - Source entity ID 
 * @param targetEntityId - Target entity ID
 * @param relationshipType - The relationship type info
 * @param sourceKind - Source entity kind
 * @param targetKind - Target entity kind
 * @returns List of networks the relationship was added to
 */
export async function checkAndAutoEnroll(
    relationshipId: string,
    sourceEntityId: string,
    targetEntityId: string,
    relationshipType: { relationship_name: string; display_label: string; relationship_type_id?: string },
    sourceKind: EntityKind,
    targetKind: EntityKind
): Promise<NetworkInstance[]> {
    const enrolledNetworks: NetworkInstance[] = [];

    // Find matching schemas
    const matches = findMatchingSchemas(relationshipType, sourceKind, targetKind);

    if (matches.length === 0) {
        return enrolledNetworks;
    }

    // Load all networks
    const allNetworks = await loadAllNetworks();

    for (const match of matches) {
        // Find networks using this schema that contain both entities
        const relevantNetworks = allNetworks.filter(network => {
            const schema = getSchemaById(network.schemaId);
            if (!schema || schema.id !== match.schema.id) {
                return false;
            }

            // Check if both entities are members of this network
            const hasSource = network.entityIds.includes(sourceEntityId);
            const hasTarget = network.entityIds.includes(targetEntityId);

            return hasSource && hasTarget;
        });

        // Auto-enroll in each relevant network
        for (const network of relevantNetworks) {
            const networkRel = await createNetworkRelationship({
                sourceEntityId,
                targetEntityId,
                networkId: network.id,
                relationshipCode: match.relationshipDef.code,
                attributes: {
                    unifiedRelationshipId: relationshipId,
                    autoEnrolled: true,
                    matchConfidence: match.matchConfidence,
                },
            });

            if (networkRel) {
                enrolledNetworks.push(network);
            }
        }
    }

    return enrolledNetworks;
}

/**
 * Get network membership info for a relationship (for UI badges)
 */
export async function getRelationshipNetworkMemberships(
    sourceEntityId: string,
    targetEntityId: string,
    relationshipType?: string
): Promise<RelationshipNetworkMembership['networkMemberships']> {
    const memberships: RelationshipNetworkMembership['networkMemberships'] = [];

    // Load all networks
    const allNetworks = await loadAllNetworks();

    for (const network of allNetworks) {
        // Check if both entities are in this network
        if (!network.entityIds.includes(sourceEntityId) ||
            !network.entityIds.includes(targetEntityId)) {
            continue;
        }

        // Load relationships for this network
        const networkRels = await loadNetworkRelationships(network.id);

        // Find relationships matching source/target
        const matchingRels = networkRels.filter(rel =>
            (rel.sourceEntityId === sourceEntityId && rel.targetEntityId === targetEntityId) ||
            (rel.sourceEntityId === targetEntityId && rel.targetEntityId === sourceEntityId)
        );

        const schema = getSchemaById(network.schemaId);

        for (const rel of matchingRels) {
            memberships.push({
                networkId: network.id,
                networkName: network.name,
                schemaName: schema?.name ?? 'Custom',
                relationshipCode: rel.relationshipCode,
                networkRelationshipId: rel.id,
                color: schema?.color,
            });
        }
    }

    return memberships;
}

// ============================================
// MANUAL NETWORK ASSOCIATION
// ============================================

/**
 * Get available networks for a relationship (for "Add to Network" action)
 * 
 * @param sourceEntityId - Source entity ID
 * @param targetEntityId - Target entity ID
 * @param sourceKind - Source entity kind
 * @param targetKind - Target entity kind
 */
export async function getAvailableNetworksForRelationship(
    sourceEntityId: string,
    targetEntityId: string,
    sourceKind: EntityKind,
    targetKind: EntityKind
): Promise<Array<{
    network: NetworkInstance;
    schema: NetworkSchema;
    availableRelationships: NetworkRelationshipDef[];
    alreadyMember: boolean;
}>> {
    const results: Array<{
        network: NetworkInstance;
        schema: NetworkSchema;
        availableRelationships: NetworkRelationshipDef[];
        alreadyMember: boolean;
    }> = [];

    const allNetworks = await loadAllNetworks();

    for (const network of allNetworks) {
        const schema = getSchemaById(network.schemaId);
        if (!schema) continue;

        // Check if entity kinds are compatible with this schema
        if (!schema.allowedEntityKinds.includes(sourceKind) ||
            !schema.allowedEntityKinds.includes(targetKind)) {
            continue;
        }

        // Find available relationship definitions
        const availableRels = schema.relationships.filter(rel =>
            (rel.sourceKind === sourceKind && rel.targetKind === targetKind) ||
            (rel.direction === 'BIDIRECTIONAL' &&
                rel.sourceKind === targetKind && rel.targetKind === sourceKind)
        );

        if (availableRels.length === 0) continue;

        // Check current membership
        const networkRels = await loadNetworkRelationships(network.id);
        const alreadyMember = networkRels.some(rel =>
            (rel.sourceEntityId === sourceEntityId && rel.targetEntityId === targetEntityId) ||
            (rel.sourceEntityId === targetEntityId && rel.targetEntityId === sourceEntityId)
        );

        results.push({
            network,
            schema,
            availableRelationships: availableRels,
            alreadyMember,
        });
    }

    return results;
}

/**
 * Manually add a relationship to a network
 */
export async function addRelationshipToNetwork(
    input: AddToNetworkInput
): Promise<NetworkRelationshipInstance | null> {
    const network = await loadNetworkInstance(input.networkId);
    if (!network) {
        console.error('[autoMembership] Network not found:', input.networkId);
        return null;
    }

    // Ensure both entities are members of the network
    await addEntityToNetwork(input.networkId, input.sourceEntityId);
    await addEntityToNetwork(input.networkId, input.targetEntityId);

    // Create the network relationship
    return createNetworkRelationship(input);
}

/**
 * Remove a relationship from a network
 */
export async function removeRelationshipFromNetwork(
    networkRelationshipId: string
): Promise<boolean> {
    try {
        await deleteNetworkRelationship(networkRelationshipId);
        return true;
    } catch (err) {
        console.error('[autoMembership] Failed to remove relationship:', err);
        return false;
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Create a network relationship instance
 */
async function createNetworkRelationship(
    input: AddToNetworkInput
): Promise<NetworkRelationshipInstance | null> {
    try {
        const network = await loadNetworkInstance(input.networkId);
        if (!network) return null;

        const schema = getSchemaById(network.schemaId);
        if (!schema) return null;

        // Validate relationship code
        const relDef = schema.relationships.find(r => r.code === input.relationshipCode);
        if (!relDef) {
            console.error('[autoMembership] Invalid relationship code:', input.relationshipCode);
            return null;
        }

        const now = new Date();
        const networkRel: NetworkRelationshipInstance = {
            id: generateId(),
            networkId: input.networkId,
            relationshipCode: input.relationshipCode,
            sourceEntityId: input.sourceEntityId,
            targetEntityId: input.targetEntityId,
            notes: input.notes,
            attributes: input.attributes,
            createdAt: now,
            updatedAt: now,
        };

        await saveNetworkRelationship(networkRel);

        // Auto-create inverse if schema supports it
        if (schema.autoCreateInverse && relDef.inverseRelationship) {
            const inverseRel: NetworkRelationshipInstance = {
                id: generateId(),
                networkId: input.networkId,
                relationshipCode: relDef.inverseRelationship,
                sourceEntityId: input.targetEntityId,
                targetEntityId: input.sourceEntityId,
                attributes: {
                    ...input.attributes,
                    inverseOf: networkRel.id,
                },
                createdAt: now,
                updatedAt: now,
            };

            await saveNetworkRelationship(inverseRel);
        }

        return networkRel;
    } catch (err) {
        console.error('[autoMembership] Failed to create network relationship:', err);
        return null;
    }
}

/**
 * Sync existing unified relationships to networks
 * (For migrating existing relationships)
 */
export async function syncRelationshipsToNetworks(
    relationships: Array<{
        id: string;
        sourceEntityId: string;
        targetEntityId: string;
        type: string;
        sourceKind: EntityKind;
        targetKind: EntityKind;
    }>
): Promise<{ enrolled: number; skipped: number }> {
    let enrolled = 0;
    let skipped = 0;

    for (const rel of relationships) {
        const networks = await checkAndAutoEnroll(
            rel.id,
            rel.sourceEntityId,
            rel.targetEntityId,
            { relationship_name: rel.type, display_label: rel.type },
            rel.sourceKind,
            rel.targetKind
        );

        if (networks.length > 0) {
            enrolled++;
        } else {
            skipped++;
        }
    }

    return { enrolled, skipped };
}

// Export singleton-ish functions
export const networkAutoMembership = {
    findMatchingSchemas,
    checkAndAutoEnroll,
    getRelationshipNetworkMemberships,
    getAvailableNetworksForRelationship,
    addRelationshipToNetwork,
    removeRelationshipFromNetwork,
    syncRelationshipsToNetworks,
};

export default networkAutoMembership;
