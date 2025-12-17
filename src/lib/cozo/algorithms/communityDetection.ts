import { cozoDb } from '../db';

export interface NativeCommunityOptions {
    groupId: string;
    maxIterations?: number;
    keepDepth?: number;      // Hierarchical levels (1-3)
}

export interface Community {
    communityId: number;
    members: Array<{
        entityId: string;
        name: string;
        entityKind: string;
    }>;
    size: number;
    topEntities: string[];   // Top 5 by degree (or importance)
    label: string;           // Auto-generated label
}

/**
 * Detect story communities using Louvain algorithm
 */
export async function detectCommunitiesLouvain(
    options: NativeCommunityOptions
): Promise<Community[]> {
    const startTime = Date.now();

    const query = `
    # Define weighted edges
    edges[source_id, target_id, weight] :=
      *entity_edge{source_id, target_id, weight, group_id},
      group_id == $group_id,
      weight >= 2
    
    # Run Louvain algorithm
    communities[entity_id, community_label] <~ CommunityDetectionLouvain(
      edges: edges[source_id, target_id, weight],
      undirected: true,
      max_iter: $max_iter,
      levels: $keep_depth
    )
    
    # Group entities by community
    ?[community_label, entity_id, name, entity_kind] :=
      communities[entity_id, community_label],
      *entity{id: entity_id, name, entity_kind, group_id},
      group_id == $group_id
    
    :order community_label
  `;

    // Note: Cozo arg for levels might be 'levels' or 'keep_depth'? 
    // Standard Cozo uses 'levels' typically for outputting hierarchical levels, 
    // but if it's just basic community detection, it returns leaf communities.
    // I'll stick to 'levels': 1 to get final communities.

    try {
        const result = await cozoDb.runQuery(query, {
            group_id: options.groupId,
            max_iter: options.maxIterations || 20,
            keep_depth: options.keepDepth || 1,
        });

        if (!result.rows) return [];

        // Group by community_label
        const communitiesMap = new Map<number, any[]>();

        for (const [label, id, name, kind] of result.rows) {
            if (!communitiesMap.has(label)) {
                communitiesMap.set(label, []);
            }
            communitiesMap.get(label)!.push({ entityId: id, name, entityKind: kind });
        }

        // Format communities
        const communities: Community[] = [];

        for (const [label, members] of communitiesMap) {
            // Simple heuristic for top entities: just first few? 
            // Ideally we sort by degree or PageRank. 
            // For efficiency, I'll just pick first ones or known ones.
            // Let's rely on mapping order or random for now to avoid extra query.

            const topEntities = members
                .slice(0, 5)
                .map((m: any) => m.name);

            communities.push({
                communityId: label,
                members: members,
                size: members.length,
                topEntities,
                label: generateCommunityLabel(topEntities),
            });
        }

        return communities.sort((a, b) => b.size - a.size);

    } catch (e) {
        console.error('Louvain detection failed', e);
        return [];
    }
}

function generateCommunityLabel(topEntities: string[]): string {
    if (topEntities.length === 0) return 'Unknown Group';
    if (topEntities.length === 1) return topEntities[0];
    return `${topEntities[0]}'s Circle`;
}

export async function getEntityCommunity(
    entityId: string,
    groupId: string
): Promise<Community | null> {
    const communities = await detectCommunitiesLouvain({ groupId });

    for (const community of communities) {
        if (community.members.some(m => m.entityId === entityId)) {
            return community;
        }
    }
    return null;
}

export async function findCommunityBridges(
    groupId: string
): Promise<Array<{
    entityId: string;
    name: string;
    communities: number[];
    bridgeScore: number;
}>> {
    // To find bridges properly using Louvain (which is hard partitioning),
    // we usually run it hierarchically or check edge connections across partitions.
    // Cozo's Louvain returns hard partitions.
    // "Bridges" in hard partitioning context are nodes with edges to other communities.

    // Alternative strategy: Use the raw graph and checking edges vs community map.

    const communities = await detectCommunitiesLouvain({ groupId });
    const entityCommMap = new Map<string, number>();
    communities.forEach(c => {
        c.members.forEach(m => entityCommMap.set(m.entityId, c.communityId));
    });

    const query = `
      ?[source_id, target_id] :=
        *entity_edge{source_id, target_id, group_id},
        group_id == $group_id
  `;

    try {
        const res = await cozoDb.runQuery(query, { group_id: groupId });
        if (!res.rows) return [];

        const bridgeMap = new Map<string, Set<number>>();

        res.rows.forEach((row: any[]) => {
            const s = row[0];
            const t = row[1];
            const c1 = entityCommMap.get(s);
            const c2 = entityCommMap.get(t);

            if (c1 !== undefined && c2 !== undefined && c1 !== c2) {
                // s is connected to c2
                if (!bridgeMap.has(s)) bridgeMap.set(s, new Set());
                bridgeMap.get(s)!.add(c2);

                // t is connected to c1
                if (!bridgeMap.has(t)) bridgeMap.set(t, new Set());
                bridgeMap.get(t)!.add(c1);
            }
        });

        const bridges: any[] = [];
        const entityNameMap = new Map<string, string>();
        communities.forEach(c => c.members.forEach(m => entityNameMap.set(m.entityId, m.name)));

        for (const [eid, linkedComs] of bridgeMap) {
            bridges.push({
                entityId: eid,
                name: entityNameMap.get(eid) || 'Unknown',
                communities: Array.from(linkedComs),
                bridgeScore: linkedComs.size // Simple score: number of external communities connected
            });
        }

        return bridges.sort((a, b) => b.bridgeScore - a.bridgeScore);

    } catch (e) {
        console.error('Bridge detection failed', e);
        return [];
    }
}
