
import { computePageRank, getMainCharacters, compareImportanceMetrics } from '../algorithms/pagerank';
import { detectCommunitiesLouvain, findCommunityBridges } from '../algorithms/communityDetection';
import { findShortestPath, findKShortestPaths, findEntitiesWithinHops } from '../algorithms/pathfinding';
import { findStronglyConnectedComponents, findIsolatedSubplots } from '../algorithms/componentAnalysis';
import { cozoDb } from '../db'; // Need for helper if not importing helper

/**
 * GET /api/graph/importance
 * Get character importance rankings
 */
export async function handleGetImportance(req: Request): Promise<Response> {
    const { groupId, limit } = parseQuery(req);

    const results = await getMainCharacters(groupId, limit ? parseInt(limit) : 10);

    return jsonResponse({
        success: true,
        data: results,
    });
}

/**
 * GET /api/graph/importance/compare
 * Compare PageRank vs Degree centrality
 */
export async function handleCompareImportance(req: Request): Promise<Response> {
    const { groupId } = parseQuery(req);

    const comparison = await compareImportanceMetrics(groupId);

    return jsonResponse({
        success: true,
        data: comparison,
    });
}

/**
 * GET /api/graph/communities
 * Detect story communities
 */
export async function handleGetCommunities(req: Request): Promise<Response> {
    const { groupId } = parseQuery(req);

    const communities = await detectCommunitiesLouvain({ groupId });

    return jsonResponse({
        success: true,
        data: {
            communities,
            count: communities.length,
        },
    });
}

/**
 * GET /api/graph/communities/bridges
 * Find inter-community bridges
 */
export async function handleGetBridges(req: Request): Promise<Response> {
    const { groupId } = parseQuery(req);

    const bridges = await findCommunityBridges(groupId);

    return jsonResponse({
        success: true,
        data: bridges,
    });
}

/**
 * GET /api/graph/path
 * Find shortest path between entities
 */
export async function handleFindPath(req: Request): Promise<Response> {
    const { fromEntityId, toEntityId, groupId, maxPaths } = parseQuery(req);

    if (maxPaths && parseInt(maxPaths) > 1) {
        const paths = await findKShortestPaths({
            fromEntityId,
            toEntityId,
            groupId,
            maxPaths: parseInt(maxPaths),
        });

        return jsonResponse({
            success: true,
            data: { paths, count: paths.length },
        });
    }

    const path = await findShortestPath({
        fromEntityId,
        toEntityId,
        groupId,
    });

    if (!path) {
        return jsonResponse({
            success: false,
            error: 'No path found between entities',
        }, 404);
    }

    return jsonResponse({
        success: true,
        data: path,
    });
}

/**
 * GET /api/graph/neighbors
 * Find entities within N hops
 */
export async function handleGetNeighbors(req: Request): Promise<Response> {
    const { entityId, maxHops, groupId } = parseQuery(req);

    const neighbors = await findEntitiesWithinHops(
        entityId,
        maxHops ? parseInt(maxHops) : 2,
        groupId
    );

    return jsonResponse({
        success: true,
        data: {
            neighbors,
            count: neighbors.length,
        },
    });
}

/**
 * GET /api/graph/components
 * Find disconnected story arcs
 */
export async function handleGetComponents(req: Request): Promise<Response> {
    const { groupId } = parseQuery(req);

    const components = await findStronglyConnectedComponents(groupId);

    return jsonResponse({
        success: true,
        data: {
            components,
            isConnected: components.length === 1,
            isolatedCount: components.filter(c => c.isIsolated).length,
        },
    });
}

/**
 * GET /api/graph/plot-holes
 * Detect narrative inconsistencies
 */
export async function handleDetectPlotHoles(req: Request): Promise<Response> {
    const { groupId } = parseQuery(req);

    const issues: any[] = [];

    // Find isolated subplots
    const isolated = await findIsolatedSubplots(groupId);
    if (isolated.length > 0) {
        issues.push({
            type: 'DISCONNECTED_PLOT',
            severity: 'medium',
            message: `Found ${isolated.length} isolated storylines`,
            details: isolated,
        });
    }

    // Find orphaned entities (no connections)
    const orphans = await findOrphanedEntities(groupId);
    if (orphans.length > 0) {
        issues.push({
            type: 'ORPHANED_ENTITIES',
            severity: 'low',
            message: `${orphans.length} entities mentioned but never connected`,
            details: orphans,
        });
    }

    // Find overused bridges (plot convenience characters)
    const bridges = await findCommunityBridges(groupId);
    const overused = bridges.filter(b => b.bridgeScore > 5); // Example threshold
    if (overused.length > 0) {
        issues.push({
            type: 'OVERUSED_BRIDGE',
            severity: 'low',
            message: 'Some characters connect too many unrelated plots',
            details: overused,
        });
    }

    return jsonResponse({
        success: true,
        data: {
            issues,
            count: issues.length,
            severity: issues.some(i => i.severity === 'high') ? 'high' : 'low',
        },
    });
}

/**
 * Helper: Find orphaned entities
 */
async function findOrphanedEntities(groupId: string): Promise<any[]> {
    const query = `
    ?[id, name, frequency] :=
      *entity{id, name, frequency, group_id},
      group_id == $group_id,
      # Check absence of edges
      not *entity_edge{source_id: id},
      not *entity_edge{target_id: id},
      frequency < 3
  `;

    try {
        const result = await cozoDb.runQuery(query, { group_id: groupId });
        if (!result.rows) return [];

        return result.rows.map((row: any[]) => ({
            entityId: row[0],
            name: row[1],
            frequency: row[2],
        }));
    } catch (e) {
        return [];
    }
}

// Utility functions
function parseQuery(req: Request): Record<string, string> {
    const url = new URL(req.url);
    const params: Record<string, string> = {};
    url.searchParams.forEach((val, key) => { params[key] = val; });
    return params;
}

function jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
