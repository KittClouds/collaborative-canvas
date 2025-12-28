/**
 * Graph Visualization API
 * 
 * Unified entry point for graph visualization across all 3 scopes.
 * Combines data retrieval, enrichment, and transformation layers.
 */

import {
    getObsidianGraphData,
    getEntityGraphData,
    getCooccurrenceGraphData,
    getUnifiedGraphData,
    getNetworkGraphData,
    type GraphFilter,
    type GraphScope,
    type RawGraphData,
} from './data-providers';

import {
    enrichGraphData,
    applyPageRankSizing,
    applyCommunityColors,
    filterByConfidence,
    type EnrichedGraphData,
} from './enrichment';

import {
    toCytoscapeElements,
    toD3Graph,
    toGraphologyData,
    suggestLayout,
    generateCytoscapeStylesheet,
    type OutputFormat,
    type CytoscapeElements,
    type D3Graph,
    type GraphologyData,
    type LayoutHints,
} from './transformers';

// ===== TYPES =====

export interface GraphVisualizationOptions {
    filter: GraphFilter;
    format?: OutputFormat;
    algorithms?: {
        pageRank?: boolean;
        communityDetection?: boolean;
        centrality?: 'degree' | 'betweenness' | 'closeness';
    };
    confidenceThreshold?: number;
    includeLayoutHints?: boolean;
}

export interface VisualizationResult<T = CytoscapeElements | D3Graph | GraphologyData | EnrichedGraphData> {
    data: T;
    format: OutputFormat;
    layoutHints?: LayoutHints;
    stats: {
        nodeCount: number;
        edgeCount: number;
        queryTimeMs: number;
        enrichmentTimeMs: number;
        totalTimeMs: number;
    };
    source: RawGraphData['source'];
}

// ===== MAIN API =====

/**
 * Get graph visualization data with full processing pipeline
 * 
 * @example
 * ```ts
 * // Scope 1: Obsidian folder graph
 * const result = await getGraphVisualization({
 *   filter: { scope: 'folder', scopeIds: ['folder-123'] },
 *   format: 'cytoscape',
 * });
 * 
 * // Scope 2: Entity relationship graph
 * const result = await getGraphVisualization({
 *   filter: { scope: 'vault', entityKinds: ['CHARACTER', 'LOCATION'] },
 *   format: 'd3',
 *   algorithms: { pageRank: true },
 * });
 * 
 * // Scope 3: Co-occurrence graph (Infranodus style)
 * const result = await getGraphVisualization({
 *   filter: { scope: 'note', scopeIds: ['note-123'] },
 *   format: 'graphology',
 * });
 * ```
 */
export async function getGraphVisualization(
    options: GraphVisualizationOptions
): Promise<VisualizationResult> {
    const startTime = performance.now();
    const { filter, format = 'cytoscape', algorithms, confidenceThreshold, includeLayoutHints = true } = options;

    // Step 1: Select and execute data provider
    let rawData: RawGraphData;

    if (filter.scope === 'network' && filter.scopeIds?.[0]) {
        rawData = await getNetworkGraphData(filter.scopeIds[0], filter);
    } else if (filter.entityKinds?.length || filter.scope === 'vault') {
        // Entity graph for entity-filtered or global vault scope
        rawData = await getEntityGraphData(filter);
    } else if (filter.edgeTypes?.includes('CO_OCCURS')) {
        // Co-occurrence graph when specifically requested
        rawData = await getCooccurrenceGraphData(filter);
    } else if (filter.scope === 'folder' || filter.scope === 'note') {
        // Default to Obsidian graph for folder/note scope
        rawData = await getObsidianGraphData(filter);
    } else {
        // Unified graph for everything else
        rawData = await getUnifiedGraphData(filter);
    }

    const queryTimeMs = rawData.stats.queryTimeMs;
    const enrichmentStart = performance.now();

    // Step 2: Enrich data
    let enrichedData = enrichGraphData(rawData);

    // Step 3: Apply algorithms
    if (algorithms?.pageRank) {
        applyPageRankSizing(enrichedData.nodes, enrichedData.edges);
    }

    if (algorithms?.communityDetection) {
        const communities = detectCommunities(enrichedData);
        applyCommunityColors(enrichedData.nodes, communities);
    }

    // Step 4: Apply confidence filtering
    if (confidenceThreshold && confidenceThreshold > 0) {
        enrichedData = filterByConfidence(enrichedData, confidenceThreshold);
    }

    const enrichmentTimeMs = performance.now() - enrichmentStart;

    // Step 5: Transform to output format
    let data: CytoscapeElements | D3Graph | GraphologyData | EnrichedGraphData;

    switch (format) {
        case 'cytoscape':
            data = toCytoscapeElements(enrichedData);
            break;
        case 'd3':
            data = toD3Graph(enrichedData);
            break;
        case 'graphology':
            data = toGraphologyData(enrichedData);
            break;
        default:
            data = enrichedData;
    }

    // Step 6: Generate layout hints
    const layoutHints = includeLayoutHints ? suggestLayout(enrichedData) : undefined;

    const totalTimeMs = performance.now() - startTime;

    return {
        data,
        format,
        layoutHints,
        stats: {
            nodeCount: enrichedData.nodes.length,
            edgeCount: enrichedData.edges.length,
            queryTimeMs,
            enrichmentTimeMs,
            totalTimeMs,
        },
        source: rawData.source,
    };
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Get Obsidian folder/note graph (Scope 1)
 */
export async function getObsidianGraph(
    scopeIds?: string[],
    format: OutputFormat = 'cytoscape'
): Promise<VisualizationResult> {
    return getGraphVisualization({
        filter: {
            scope: scopeIds?.length ? 'folder' : 'vault',
            scopeIds,
        },
        format,
    });
}

/**
 * Get entity relationship graph (Scope 2)
 */
export async function getEntityGraph(
    entityKinds?: string[],
    format: OutputFormat = 'cytoscape',
    options?: { pageRank?: boolean; minConfidence?: number }
): Promise<VisualizationResult> {
    return getGraphVisualization({
        filter: {
            scope: 'vault',
            entityKinds: entityKinds as any,
            minConfidence: options?.minConfidence,
        },
        format,
        algorithms: {
            pageRank: options?.pageRank,
        },
    });
}

/**
 * Get co-occurrence concept graph (Scope 3 - Infranodus style)
 */
export async function getConceptGraph(
    scopeId: string,
    scope: 'note' | 'folder' = 'note',
    format: OutputFormat = 'graphology'
): Promise<VisualizationResult> {
    return getGraphVisualization({
        filter: {
            scope,
            scopeIds: [scopeId],
            edgeTypes: ['CO_OCCURS'],
        },
        format,
        algorithms: {
            pageRank: true,
            communityDetection: true,
        },
    });
}

/**
 * Get network-specific graph with members and relationships
 */
export async function getNetworkGraph(
    networkId: string,
    format: OutputFormat = 'cytoscape'
): Promise<VisualizationResult> {
    return getGraphVisualization({
        filter: {
            scope: 'network',
            scopeIds: [networkId],
        },
        format,
    });
}

// ===== ALGORITHM IMPLEMENTATIONS =====

/**
 * Simple community detection using label propagation
 */
function detectCommunities(data: EnrichedGraphData): Map<string, number> {
    const communities = new Map<string, number>();

    // Initialize each node with its own community
    const nodes = data.nodes;
    const edges = data.edges;

    for (let i = 0; i < nodes.length; i++) {
        communities.set(nodes[i].id, i);
    }

    // Build neighbor map
    const neighbors = new Map<string, string[]>();
    for (const node of nodes) {
        neighbors.set(node.id, []);
    }
    for (const edge of edges) {
        neighbors.get(edge.sourceId)?.push(edge.targetId);
        neighbors.get(edge.targetId)?.push(edge.sourceId);
    }

    // Label propagation iterations
    const maxIterations = 10;

    for (let iter = 0; iter < maxIterations; iter++) {
        let changed = false;

        // Shuffle node order for each iteration
        const shuffled = [...nodes].sort(() => Math.random() - 0.5);

        for (const node of shuffled) {
            const nodeNeighbors = neighbors.get(node.id) || [];
            if (nodeNeighbors.length === 0) continue;

            // Count community frequencies among neighbors
            const communityCount = new Map<number, number>();
            for (const neighborId of nodeNeighbors) {
                const neighborCommunity = communities.get(neighborId);
                if (neighborCommunity !== undefined) {
                    communityCount.set(
                        neighborCommunity,
                        (communityCount.get(neighborCommunity) || 0) + 1
                    );
                }
            }

            // Find most common community
            let maxCount = 0;
            let maxCommunity = communities.get(node.id)!;
            for (const [community, count] of communityCount) {
                if (count > maxCount) {
                    maxCount = count;
                    maxCommunity = community;
                }
            }

            // Update if different
            if (communities.get(node.id) !== maxCommunity) {
                communities.set(node.id, maxCommunity);
                changed = true;
            }
        }

        if (!changed) break;
    }

    // Renumber communities to be contiguous
    const uniqueCommunities = [...new Set(communities.values())];
    const remapping = new Map<number, number>();
    uniqueCommunities.forEach((c, i) => remapping.set(c, i));

    for (const [nodeId, community] of communities) {
        communities.set(nodeId, remapping.get(community)!);
    }

    return communities;
}

// ===== EXPORTS =====

export {
    // Data providers
    getObsidianGraphData,
    getEntityGraphData,
    getCooccurrenceGraphData,
    getUnifiedGraphData,
    getNetworkGraphData,

    // Enrichment
    enrichGraphData,
    applyPageRankSizing,
    applyCommunityColors,
    filterByConfidence,

    // Transformers
    toCytoscapeElements,
    toD3Graph,
    toGraphologyData,
    suggestLayout,
    generateCytoscapeStylesheet,

    // Types
    type GraphFilter,
    type GraphScope,
    type RawGraphData,
    type EnrichedGraphData,
    type OutputFormat,
    type CytoscapeElements,
    type D3Graph,
    type GraphologyData,
    type LayoutHints,
};
