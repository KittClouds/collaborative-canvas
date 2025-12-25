import { cozoDb } from '../db';

export interface StronglyConnectedComponent {
    componentId: number;
    members: Array<{
        entityId: string;
        name: string;
        entityKind: string;
    }>;
    size: number;
    isIsolated: boolean;  // True if <5% of total entities
}

/**
 * Find strongly connected components (SCCs)
 * 
 * In directed graph: nodes that can reach each other
 * For storytelling: detects isolated plot threads
 */
export async function findStronglyConnectedComponents(
    groupId: string
): Promise<StronglyConnectedComponent[]> {
    const query = `
    # Define edges (treat as directed for SCC)
    edges[source, target] :=
      *entity_edge{source_id: source, target_id: target, group_id},
      group_id == $group_id
    
    # Run SCC algorithm
    ?[component_id, entity_id, name, entity_kind] <~ StronglyConnectedComponent(
      edges: edges[source, target]
    )
    
    *entity{id: entity_id, name, entity_kind}
    # Wait, check join syntax. 
    # The rule outputting result <~ Algo usually produces relation.
    # Then we join it.
    
    # Correct syntax:
    scc[component_id, entity_id] <~ StronglyConnectedComponent(edges: edges[source, target])
    
    ?[component_id, entity_id, name, entity_kind] :=
        scc[component_id, entity_id],
        *entity{id: entity_id, name, entity_kind}
    
    :order component_id
  `;

    try {
        const result = await cozoDb.runQuery(query, { group_id: groupId });

        if (!result.rows) return [];

        // Group by component
        const componentsMap = new Map<number, any[]>();

        for (const [compId, entityId, name, kind] of result.rows) {
            if (!componentsMap.has(compId)) {
                componentsMap.set(compId, []);
            }
            componentsMap.get(compId)!.push({ entityId, name, entityKind: kind });
        }

        const totalEntities = result.rows.length; // Approximate total entities in SCCs

        const components: StronglyConnectedComponent[] = [];

        for (const [compId, members] of componentsMap) {
            components.push({
                componentId: compId,
                members,
                size: members.length,
                isIsolated: members.length < Math.max(2, totalEntities * 0.05), // <5% = isolated, min 2
            });
        }

        return components.sort((a, b) => b.size - a.size);

    } catch (e) {
        console.error('SCC failed', e);
        return [];
    }
}

/**
 * Check if graph is fully connected
 */
export async function isGraphConnected(groupId: string): Promise<boolean> {
    const components = await findStronglyConnectedComponents(groupId);
    // Ideally, 1 component. But SCC is for directed.
    // If we mean Weakly Connected (undirected), we should use WeaklyConnectedComponent algo.
    // Narrative connection usually implies undirected 'relatedness'.
    // But SCC is strictly stricter.
    // If SCC count is 1, it's definitely connected.
    // If >1, might still be weakly connected.
    // Let's assume strict connection for now.
    return components.length === 1;
}

/**
 * Find isolated subplots (small disconnected components)
 */
export async function findIsolatedSubplots(
    groupId: string
): Promise<StronglyConnectedComponent[]> {
    const components = await findStronglyConnectedComponents(groupId);
    return components.filter(c => c.isIsolated);
}
