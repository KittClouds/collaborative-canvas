/**
 * Network Queries API
 * 
 * High-level query functions for traversing and analyzing networks:
 * - Ancestor/descendant traversal
 * - Sibling finding
 * - Generation depth calculation
 * - Path finding
 * - Network statistics
 */

import type { NodeId } from '@/lib/graph/types';
import type {
    NetworkInstance,
    NetworkSchema,
    NetworkRelationshipInstance,
    NetworkLineageResult,
    NetworkQueryOptions,
} from './types';
import { loadNetworkRelationships, loadNetworkInstance } from './storage';
import { getSchemaById } from './schemas';
import { loadNetworkSchema } from './storage';

/**
 * Get all ancestors of an entity (e.g., all parents, grandparents)
 */
export async function getAncestors(
    options: NetworkQueryOptions
): Promise<NetworkLineageResult[]> {
    const { networkId, startEntityId, maxDepth = Infinity, relationshipCodes } = options;

    if (!startEntityId) return [];

    const relationships = await loadNetworkRelationships(networkId);
    const ancestors: NetworkLineageResult[] = [];
    const visited = new Set<NodeId>();

    // Determine which relationship codes to use for "going up" the tree
    const upwardCodes = relationshipCodes || ['CHILD_OF', 'ADOPTED_BY', 'REPORTS_TO', 'SUBORDINATE_OF'];

    const queue: Array<{ id: NodeId; depth: number; path: NodeId[] }> = [
        { id: startEntityId, depth: 0, path: [startEntityId] }
    ];

    while (queue.length > 0) {
        const { id, depth, path } = queue.shift()!;

        if (depth > 0) { // Don't include the starting entity
            const relationship = relationships.find(r =>
                r.targetEntityId === path[path.length - 1] &&
                r.sourceEntityId === path[path.length - 2]
            );

            ancestors.push({
                entityId: id,
                depth,
                relationship: relationship?.relationshipCode || 'UNKNOWN',
                path: [...path],
            });
        }

        if (depth >= maxDepth) continue;
        if (visited.has(id)) continue;
        visited.add(id);

        // Find parent relationships (current entity is target)
        const parentRels = relationships.filter(r =>
            upwardCodes.includes(r.relationshipCode) &&
            r.sourceEntityId === id
        );

        for (const rel of parentRels) {
            queue.push({
                id: rel.targetEntityId,
                depth: depth + 1,
                path: [...path, rel.targetEntityId],
            });
        }
    }

    // Sort by depth
    return ancestors.sort((a, b) => a.depth - b.depth);
}

/**
 * Get all descendants (children, grandchildren, etc.)
 */
export async function getDescendants(
    options: NetworkQueryOptions
): Promise<NetworkLineageResult[]> {
    const { networkId, startEntityId, maxDepth = Infinity, relationshipCodes } = options;

    if (!startEntityId) return [];

    const relationships = await loadNetworkRelationships(networkId);
    const descendants: NetworkLineageResult[] = [];
    const visited = new Set<NodeId>();

    // Determine which relationship codes to use for "going down" the tree
    const downwardCodes = relationshipCodes || ['PARENT_OF', 'ADOPTIVE_PARENT_OF', 'MANAGES', 'SUPERIOR_OF'];

    const queue: Array<{ id: NodeId; depth: number; path: NodeId[] }> = [
        { id: startEntityId, depth: 0, path: [startEntityId] }
    ];

    while (queue.length > 0) {
        const { id, depth, path } = queue.shift()!;

        if (depth > 0) {
            const relationship = relationships.find(r =>
                r.sourceEntityId === path[path.length - 2] &&
                r.targetEntityId === path[path.length - 1]
            );

            descendants.push({
                entityId: id,
                depth,
                relationship: relationship?.relationshipCode || 'UNKNOWN',
                path: [...path],
            });
        }

        if (depth >= maxDepth) continue;
        if (visited.has(id)) continue;
        visited.add(id);

        // Find child relationships (current entity is source)
        const childRels = relationships.filter(r =>
            downwardCodes.includes(r.relationshipCode) &&
            r.sourceEntityId === id
        );

        for (const rel of childRels) {
            queue.push({
                id: rel.targetEntityId,
                depth: depth + 1,
                path: [...path, rel.targetEntityId],
            });
        }
    }

    return descendants.sort((a, b) => a.depth - b.depth);
}

/**
 * Get siblings (entities with same parent)
 */
export async function getSiblings(
    networkId: string,
    entityId: NodeId
): Promise<NodeId[]> {
    const relationships = await loadNetworkRelationships(networkId);

    // Find parents (entities that have PARENT_OF relationship to this entity)
    const parentRels = relationships.filter(r =>
        ['PARENT_OF', 'ADOPTIVE_PARENT_OF'].includes(r.relationshipCode) &&
        r.targetEntityId === entityId
    );

    const parents = parentRels.map(r => r.sourceEntityId);
    if (parents.length === 0) return [];

    // Find all children of those parents
    const siblingRels = relationships.filter(r =>
        ['PARENT_OF', 'ADOPTIVE_PARENT_OF'].includes(r.relationshipCode) &&
        parents.includes(r.sourceEntityId) &&
        r.targetEntityId !== entityId
    );

    // Deduplicate
    return [...new Set(siblingRels.map(r => r.targetEntityId))];
}

/**
 * Get spouses/partners
 */
export async function getSpouses(
    networkId: string,
    entityId: NodeId
): Promise<NodeId[]> {
    const relationships = await loadNetworkRelationships(networkId);

    const spouseRels = relationships.filter(r =>
        r.relationshipCode === 'SPOUSE_OF' &&
        (r.sourceEntityId === entityId || r.targetEntityId === entityId)
    );

    return spouseRels.map(r =>
        r.sourceEntityId === entityId ? r.targetEntityId : r.sourceEntityId
    );
}

/**
 * Calculate generation depth from network root
 */
export async function getGenerationDepth(
    networkId: string,
    entityId: NodeId
): Promise<number> {
    const network = await loadNetworkInstance(networkId);
    if (!network?.rootEntityId) return 0;

    if (entityId === network.rootEntityId) return 0;

    const relationships = await loadNetworkRelationships(networkId);

    // BFS from root to entity
    const visited = new Set<NodeId>();
    const queue: Array<{ id: NodeId; depth: number }> = [
        { id: network.rootEntityId, depth: 0 }
    ];

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (id === entityId) return depth;
        if (visited.has(id)) continue;
        visited.add(id);

        // Find children
        const childRels = relationships.filter(r =>
            ['PARENT_OF', 'ADOPTIVE_PARENT_OF', 'MANAGES', 'SUPERIOR_OF'].includes(r.relationshipCode) &&
            r.sourceEntityId === id
        );

        queue.push(...childRels.map(r => ({ id: r.targetEntityId, depth: depth + 1 })));
    }

    return -1; // Not found in tree
}

/**
 * Find path between two entities
 */
export async function findPath(
    networkId: string,
    fromEntityId: NodeId,
    toEntityId: NodeId,
    maxDepth: number = 10
): Promise<{ path: NodeId[]; relationships: string[] } | null> {
    if (fromEntityId === toEntityId) {
        return { path: [fromEntityId], relationships: [] };
    }

    const relationships = await loadNetworkRelationships(networkId);

    // Build adjacency structure
    const adjacency = new Map<NodeId, Array<{ target: NodeId; rel: string }>>();

    for (const rel of relationships) {
        // Add forward edge
        if (!adjacency.has(rel.sourceEntityId)) {
            adjacency.set(rel.sourceEntityId, []);
        }
        adjacency.get(rel.sourceEntityId)!.push({
            target: rel.targetEntityId,
            rel: rel.relationshipCode
        });

        // Add reverse edge for bidirectional
        if (!adjacency.has(rel.targetEntityId)) {
            adjacency.set(rel.targetEntityId, []);
        }
        adjacency.get(rel.targetEntityId)!.push({
            target: rel.sourceEntityId,
            rel: `INVERSE_${rel.relationshipCode}`
        });
    }

    // BFS to find shortest path
    const visited = new Set<NodeId>();
    const queue: Array<{ id: NodeId; path: NodeId[]; rels: string[] }> = [
        { id: fromEntityId, path: [fromEntityId], rels: [] }
    ];

    while (queue.length > 0) {
        const { id, path, rels } = queue.shift()!;

        if (id === toEntityId) {
            return { path, relationships: rels };
        }

        if (path.length > maxDepth) continue;
        if (visited.has(id)) continue;
        visited.add(id);

        const neighbors = adjacency.get(id) || [];
        for (const { target, rel } of neighbors) {
            if (!visited.has(target)) {
                queue.push({
                    id: target,
                    path: [...path, target],
                    rels: [...rels, rel],
                });
            }
        }
    }

    return null; // No path found
}

/**
 * Get all entities at a specific generation level
 */
export async function getEntitiesAtGeneration(
    networkId: string,
    generation: number
): Promise<NodeId[]> {
    const network = await loadNetworkInstance(networkId);
    if (!network?.rootEntityId) return [];

    const descendants = await getDescendants({
        networkId,
        startEntityId: network.rootEntityId,
    });

    if (generation === 0) {
        return [network.rootEntityId];
    }

    return descendants
        .filter(d => d.depth === generation)
        .map(d => d.entityId);
}

/**
 * Get relationship count by type for a network
 */
export async function getRelationshipStats(
    networkId: string
): Promise<Record<string, number>> {
    const relationships = await loadNetworkRelationships(networkId);

    const stats: Record<string, number> = {};
    for (const rel of relationships) {
        stats[rel.relationshipCode] = (stats[rel.relationshipCode] || 0) + 1;
    }

    return stats;
}

/**
 * Get network members grouped by their relationships
 */
export async function getMembersByRelationship(
    networkId: string,
    entityId: NodeId
): Promise<Record<string, NodeId[]>> {
    const relationships = await loadNetworkRelationships(networkId);

    // Group by relationship code
    const grouped: Record<string, NodeId[]> = {};

    for (const rel of relationships) {
        if (rel.sourceEntityId === entityId) {
            if (!grouped[rel.relationshipCode]) {
                grouped[rel.relationshipCode] = [];
            }
            grouped[rel.relationshipCode].push(rel.targetEntityId);
        }

        // Also include where entity is target (for bidirectional)
        if (rel.targetEntityId === entityId) {
            const inverseCode = `_${rel.relationshipCode}`;
            if (!grouped[inverseCode]) {
                grouped[inverseCode] = [];
            }
            grouped[inverseCode].push(rel.sourceEntityId);
        }
    }

    return grouped;
}

/**
 * Get "family unit" - spouse(s) and children for a character
 */
export async function getFamilyUnit(
    networkId: string,
    entityId: NodeId
): Promise<{
    spouses: NodeId[];
    children: NodeId[];
    parents: NodeId[];
}> {
    const relationships = await loadNetworkRelationships(networkId);

    const spouses: NodeId[] = [];
    const children: NodeId[] = [];
    const parents: NodeId[] = [];

    for (const rel of relationships) {
        // Spouses (bidirectional)
        if (rel.relationshipCode === 'SPOUSE_OF') {
            if (rel.sourceEntityId === entityId) {
                spouses.push(rel.targetEntityId);
            } else if (rel.targetEntityId === entityId) {
                spouses.push(rel.sourceEntityId);
            }
        }

        // Children (entity is parent)
        if (['PARENT_OF', 'ADOPTIVE_PARENT_OF'].includes(rel.relationshipCode)) {
            if (rel.sourceEntityId === entityId) {
                children.push(rel.targetEntityId);
            }
        }

        // Parents (entity is child)
        if (['PARENT_OF', 'ADOPTIVE_PARENT_OF'].includes(rel.relationshipCode)) {
            if (rel.targetEntityId === entityId) {
                parents.push(rel.sourceEntityId);
            }
        }
    }

    return {
        spouses: [...new Set(spouses)],
        children: [...new Set(children)],
        parents: [...new Set(parents)],
    };
}

/**
 * Check if two entities are related
 */
export async function areRelated(
    networkId: string,
    entityA: NodeId,
    entityB: NodeId,
    maxDegrees: number = 6
): Promise<{ related: boolean; degree?: number; path?: NodeId[] }> {
    const path = await findPath(networkId, entityA, entityB, maxDegrees);

    if (path && path.path.length > 0) {
        return {
            related: true,
            degree: path.path.length - 1,
            path: path.path,
        };
    }

    return { related: false };
}

/**
 * Get common ancestors between two entities
 */
export async function getCommonAncestors(
    networkId: string,
    entityA: NodeId,
    entityB: NodeId
): Promise<NodeId[]> {
    const ancestorsA = await getAncestors({ networkId, startEntityId: entityA });
    const ancestorsB = await getAncestors({ networkId, startEntityId: entityB });

    const setA = new Set(ancestorsA.map(a => a.entityId));
    const common = ancestorsB.filter(b => setA.has(b.entityId)).map(a => a.entityId);

    return [...new Set(common)];
}

/**
 * Get total generation count in network
 */
export async function getGenerationCount(networkId: string): Promise<number> {
    const network = await loadNetworkInstance(networkId);
    if (!network?.rootEntityId) return 0;

    const descendants = await getDescendants({
        networkId,
        startEntityId: network.rootEntityId,
    });

    if (descendants.length === 0) return 1; // Just root

    return Math.max(...descendants.map(d => d.depth)) + 1;
}
