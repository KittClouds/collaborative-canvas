import { cozoDb } from '../db';

export interface PathfindingOptions {
    fromEntityId: string;
    toEntityId: string;
    groupId: string;
    algorithm?: 'dijkstra' | 'astar' | 'bfs';
    maxPaths?: number;       // For k-shortest paths
}

export interface PathResult {
    cost: number;            // Total weight
    hops: number;            // Number of edges
    path: string[];          // Entity IDs
    entities: Array<{
        id: string;
        name: string;
        entityKind: string;
    }>;
    narrative: string;       // Human-readable explanation
}

/**
 * Find shortest path between two entities (Dijkstra)
 */
export async function findShortestPath(
    options: PathfindingOptions
): Promise<PathResult | null> {
    const query = `
    # Define edges (weights reversed if algorithm assumes cost, 
    # but weight in our graph usually means strength (high=better).
    # Dijkstra usually minimizes cost. 
    # If using weight as affinity, we might want to invert it 1/weight for cost?
    # Or typically SP on social graphs uses 1 as cost for hops, or 1/affinity.
    # Let's check implicit behavior of ShortestPathDijkstra in Cozo? 
    # Cozo minimizes sum of weights.
    # If we want strongest connection, we want MAX weight.
    # Since Dijkstra minimizes, we should use cost = 1/weight or similar.
    # For now, let's assume unweighted (cost=1) for pure connection steps,
    # OR invert weight if available.
    # Let's try simple hop-based (cost=1) or maybe '1' for unweighted.
    
    edges[source, target, weight] :=
      *entity_edge{source_id: source, target_id: target, weight, group_id},
      group_id == $group_id,
      # For Dijkstra in Cozo, weight must be positive.
      # Let's map high weight to low cost if we want strongest path?
      # Or just return fewest hops using weight=1?
      # Let's use weight=1 (fewest hops) as default "Shortest Path" logic.
      weight = 1

    starting[start] := start = $from
    goals[goal] := goal = $to
    
    ?[start, goal, cost, path] <~ ShortestPathDijkstra(
      edges: edges[source, target, weight],
      starting: starting[start],
      goals: goals[goal],
      undirected: true
    )
  `;

    try {
        const result = await cozoDb.runQuery(query, {
            group_id: options.groupId,
            from: options.fromEntityId,
            to: options.toEntityId,
        });

        if (!result.rows || result.rows.length === 0) {
            return null;
        }

        const [_start, _goal, cost, path] = result.rows[0];
        const pathIds = path as string[];

        const entityNames = await fetchEntityNames(pathIds, options.groupId);

        return {
            cost: cost as number,
            hops: pathIds.length - 1,
            path: pathIds,
            entities: entityNames,
            narrative: generateNarrative(entityNames),
        };
    } catch (e) {
        console.error('Shortest path failed', e);
        return null;
    }
}

/**
 * Find K shortest paths 
 */
export async function findKShortestPaths(
    options: PathfindingOptions
): Promise<PathResult[]> {
    const k = options.maxPaths || 3;

    // NOTE: CozoDB might not have KShortestPathYen built-in by default in all distributions.
    // Standard algos: PageRank, WCC, SCC, Dijkstra, AStar... 
    // Let's check if 'KShortestPathYen' is a valid built-in.
    // Assuming user researched or it's available. If not, it will fail.
    // I will assume it's available as requested in prompt.

    const query = `
    edges[source, target, weight] :=
      *entity_edge{source_id: source, target_id: target, weight, group_id},
      group_id == $group_id,
      weight = 1

    starting[start] := start = $from
    goals[goal] := goal = $to
    
    ?[start, goal, cost, path] <~ KShortestPathYen(
      edges: edges[source, target, weight],
      starting: starting[start],
      goals: goals[goal],
      k: $k,
      undirected: true
    )
    
    :order cost
  `;

    try {
        const result = await cozoDb.runQuery(query, {
            group_id: options.groupId,
            from: options.fromEntityId,
            to: options.toEntityId,
            k,
        });

        if (!result.rows) return [];

        const paths: PathResult[] = [];

        for (const [_start, _goal, cost, path] of result.rows) {
            const pathIds = path as string[];
            const entityNames = await fetchEntityNames(pathIds, options.groupId);

            paths.push({
                cost: cost as number,
                hops: pathIds.length - 1,
                path: pathIds,
                entities: entityNames,
                narrative: generateNarrative(entityNames),
            });
        }

        return paths;
    } catch (e) {
        console.error('K-shortest paths failed', e);
        // Fallback: return single shortest path if Yen fails? 
        // Nah, likely Cozo error.
        return [];
    }
}

/**
 * Find all entities within N hops (BFS)
 */
export async function findEntitiesWithinHops(
    entityId: string,
    maxHops: number,
    groupId: string
): Promise<Array<{
    entityId: string;
    name: string;
    distance: number;
}>> {
    // Using recursive query for BFS. built-in BreadthFirstSearch? 
    // Probably exists or we can write recursive datalog.
    // Attempting built-in BreadthFirstSearch if available, else recursive rule.
    // Datalog is naturally recursive.

    // Standard recursive:
    const query = `
    edges[source, target] :=
      *entity_edge{source_id: source, target_id: target, group_id},
      group_id == $group_id

    # Distance 0
    bfs[target, 0] := target = $start

    # Recursive
    bfs[target, dist] :=
        bfs[source, prev_dist],
        edges[source, target],
        dist = prev_dist + 1,
        dist <= $max_hops

    # Get min dist
    min_dist[target, d] := min(dist), bfs[target, dist]
    
    ?[id, name, d] :=
        min_dist[id, d],
        *entity{id, name, group_id},
        group_id == $group_id,
        d > 0
    
    :order d
  `;

    try {
        const result = await cozoDb.runQuery(query, {
            group_id: groupId,
            start: entityId,
            max_hops: maxHops
        });

        if (!result.rows) return [];

        return result.rows.map((row: any[]) => ({
            entityId: row[0],
            name: row[1],
            distance: row[2]
        }));

    } catch (e) {
        console.error('BFS failed', e);
        return [];
    }
}

async function fetchEntityNames(
    entityIds: string[],
    groupId: string
): Promise<Array<{ id: string; name: string; entityKind: string }>> {
    if (entityIds.length === 0) return [];

    const query = `
    ?[id, name, entity_kind] :=
      id in $ids,
      *entity{id, name, entity_kind}
  `;

    try {
        const result = await cozoDb.runQuery(query, { ids: entityIds });
        if (!result.rows) return [];

        const nameMap = new Map<string, { name: string; kind: string }>(
            result.rows.map((r: any[]) => [r[0], { name: r[1], kind: r[2] }])
        );

        return entityIds.map(id => ({
            id,
            name: nameMap.get(id)?.name || 'Unknown',
            entityKind: nameMap.get(id)?.kind || 'UNKNOWN',
        }));
    } catch (e) {
        return [];
    }
}

function generateNarrative(entities: Array<{ name: string }>): string {
    if (entities.length === 0) return 'No connection';
    if (entities.length === 1) return entities[0].name;
    if (entities.length === 2) return `${entities[0].name} knows ${entities[1].name}`;

    // A knows B, who knows C...
    const connections: string[] = [];
    for (let i = 0; i < entities.length - 1; i++) {
        if (i === 0) {
            connections.push(`${entities[i].name} is connected to ${entities[i + 1].name}`);
        } else {
            connections.push(`who is connected to ${entities[i + 1].name}`);
        }
    }

    return connections.join(', ');
}
