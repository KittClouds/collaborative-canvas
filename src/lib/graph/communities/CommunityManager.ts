import type {
    NodeId,
    CommunityId,
    Community,
    CommunityType,
    UnifiedNode,
    UnifiedEdge,
    EntityKind,
} from '../types';
import { generateId } from '@/lib/utils/ids';

/**
 * Community Detection & Management
 * 
 * IMPORTANT: Backend only for now
 * TODO: Add to graph view UI when building visualization
 *       - Color-code communities in graph
 *       - "Show Community" filter
 *       - Community sidebar panel
 */
export class CommunityManager {
    private communities = new Map<CommunityId, Community>();
    private nodeToCommunities = new Map<NodeId, Set<CommunityId>>();
    private hierarchyLevels = new Map<number, Set<CommunityId>>();

    /**
     * Detect communities using modified Louvain algorithm
     * Optimized for storytelling graphs
     */
    async detectCommunities(
        nodes: UnifiedNode[],
        edges: UnifiedEdge[],
        namespace: string = 'default',
        options: CommunityDetectionOptions = {}
    ): Promise<Community[]> {
        const {
            minSize = 3,
            maxLevel = 5,
            resolution = 1.0,
            seedFromFolders = true,
        } = options;

        // Step 1: Build adjacency matrix
        const graph = this.buildGraph(nodes, edges);

        // Step 2: Seed communities from FACTION folders (hybrid approach)
        const seededCommunities = seedFromFolders
            ? this.seedCommunitiesFromFolders(nodes, namespace)
            : [];

        // Step 3: Run Louvain algorithm for multi-level detection
        const detectedCommunities = this.louvainClustering(
            graph,
            maxLevel,
            resolution,
            minSize
        );

        // Step 4: Merge seeded + detected communities
        const allCommunities = this.mergeCommunities(
            seededCommunities,
            detectedCommunities,
            namespace
        );

        // Step 5: Classify community types
        for (const community of allCommunities) {
            community.community_type = this.classifyCommunity(community, nodes, edges);
            community.description = this.generateDescription(community, nodes);
        }

        // Step 6: Store communities
        for (const community of allCommunities) {
            this.communities.set(community.id, community);

            // Index node → community mapping
            for (const entityId of community.entity_ids) {
                let comms = this.nodeToCommunities.get(entityId);
                if (!comms) {
                    comms = new Set();
                    this.nodeToCommunities.set(entityId, comms);
                }
                comms.add(community.id);
            }

            // Index by hierarchy level
            let levelComms = this.hierarchyLevels.get(community.level);
            if (!levelComms) {
                levelComms = new Set();
                this.hierarchyLevels.set(community.level, levelComms);
            }
            levelComms.add(community.id);
        }

        return allCommunities;
    }

    /**
     * Get all communities a node belongs to (multi-membership)
     */
    getNodeCommunities(nodeId: NodeId): Community[] {
        const communityIds = this.nodeToCommunities.get(nodeId);
        if (!communityIds) return [];

        return Array.from(communityIds)
            .map(id => this.communities.get(id))
            .filter((c): c is Community => c !== undefined);
    }

    /**
     * Get primary community for a node (highest level)
     */
    getPrimaryCommunity(nodeId: NodeId): Community | undefined {
        const communities = this.getNodeCommunities(nodeId);
        if (communities.length === 0) return undefined;

        // Return lowest level (most specific) community
        return communities.reduce((a, b) => a.level < b.level ? a : b);
    }

    /**
     * Get community hierarchy (parent → children)
     */
    getCommunityHierarchy(communityId: CommunityId): Community[] {
        const community = this.communities.get(communityId);
        if (!community) return [];

        const hierarchy: Community[] = [community];

        // Walk up to root
        let current = community;
        while (current.parent_community_id) {
            const parent = this.communities.get(current.parent_community_id);
            if (!parent) break;
            hierarchy.unshift(parent);
            current = parent;
        }

        return hierarchy;
    }

    /**
     * Get all communities at a specific hierarchy level
     */
    getCommunitiesByLevel(level: number): Community[] {
        const communityIds = this.hierarchyLevels.get(level);
        if (!communityIds) return [];

        return Array.from(communityIds)
            .map(id => this.communities.get(id))
            .filter((c): c is Community => c !== undefined);
    }

    /**
     * Get child communities
     */
    getChildCommunities(communityId: CommunityId): Community[] {
        const community = this.communities.get(communityId);
        if (!community) return [];

        return community.child_community_ids
            .map(id => this.communities.get(id))
            .filter((c): c is Community => c !== undefined);
    }

    /**
     * Find overlapping communities (entities shared between communities)
     */
    findOverlap(communityId1: CommunityId, communityId2: CommunityId): NodeId[] {
        const c1 = this.communities.get(communityId1);
        const c2 = this.communities.get(communityId2);
        if (!c1 || !c2) return [];

        const set1 = new Set(c1.entity_ids);
        return c2.entity_ids.filter(id => set1.has(id));
    }

    /**
     * Get "bridge" nodes (entities connecting different communities)
     */
    getBridgeNodes(): Map<NodeId, CommunityId[]> {
        const bridges = new Map<NodeId, CommunityId[]>();

        for (const [nodeId, communityIds] of this.nodeToCommunities) {
            if (communityIds.size > 1) {
                bridges.set(nodeId, Array.from(communityIds));
            }
        }

        return bridges;
    }

    /**
     * Get bridge nodes with community details
     */
    getBridgeNodesDetailed(): BridgeNodeInfo[] {
        const bridges: BridgeNodeInfo[] = [];

        for (const [nodeId, communityIds] of this.nodeToCommunities) {
            if (communityIds.size > 1) {
                const communities = Array.from(communityIds)
                    .map(id => this.communities.get(id))
                    .filter((c): c is Community => c !== undefined);

                bridges.push({
                    nodeId,
                    communityCount: communities.length,
                    communities: communities.map(c => ({
                        id: c.id,
                        name: c.name,
                        type: c.community_type,
                    })),
                });
            }
        }

        // Sort by number of communities (most connected first)
        return bridges.sort((a, b) => b.communityCount - a.communityCount);
    }

    /**
     * Find community relationships (which communities interact)
     */
    getCommunityRelationships(edges: UnifiedEdge[]): CommunityRelationship[] {
        const relationships = new Map<string, CommunityRelationship>();

        for (const edge of edges) {
            const sourceCommunities = this.nodeToCommunities.get(edge.data.source);
            const targetCommunities = this.nodeToCommunities.get(edge.data.target);

            if (!sourceCommunities || !targetCommunities) continue;

            // Cross-community edges
            for (const sourceComm of sourceCommunities) {
                for (const targetComm of targetCommunities) {
                    if (sourceComm !== targetComm) {
                        const key = [sourceComm, targetComm].sort().join('-');

                        let rel = relationships.get(key);
                        if (!rel) {
                            rel = {
                                community1_id: sourceComm,
                                community2_id: targetComm,
                                edge_count: 0,
                                total_weight: 0,
                                edge_types: new Set(),
                            };
                            relationships.set(key, rel);
                        }

                        rel.edge_count++;
                        rel.total_weight += edge.data.weight || 1;
                        rel.edge_types.add(edge.data.type);
                    }
                }
            }
        }

        return Array.from(relationships.values())
            .map(r => ({
                ...r,
                edge_types: r.edge_types, // Keep as Set for now
            }))
            .sort((a, b) => b.edge_count - a.edge_count);
    }

    // ===== LOUVAIN ALGORITHM (Multi-level Community Detection) =====

    private louvainClustering(
        graph: GraphMatrix,
        maxLevel: number,
        resolution: number,
        minSize: number
    ): DetectedCommunity[] {
        const communities: DetectedCommunity[] = [];
        let currentGraph = graph;
        let level = 0;
        let nodeMapping = new Map<NodeId, NodeId>(); // Track original nodes

        // Initialize node mapping
        for (const nodeId of graph.nodes.keys()) {
            nodeMapping.set(nodeId, nodeId);
        }

        while (level < maxLevel) {
            // Phase 1: Local optimization (assign nodes to communities)
            const partition = this.louvainPhase1(currentGraph, resolution);

            if (this.hasConverged(partition, level)) {
                break;
            }

            // Extract communities from partition
            const levelCommunities = this.partitionToCommunities(
                partition,
                nodeMapping,
                level,
                minSize
            );

            communities.push(...levelCommunities);

            // Phase 2: Aggregate graph (collapse communities into super-nodes)
            const { graph: newGraph, mapping } = this.louvainPhase2(currentGraph, partition);
            currentGraph = newGraph;

            // Update node mapping for next level
            const newMapping = new Map<NodeId, NodeId>();
            for (const [origNode, currentNode] of nodeMapping) {
                const superNode = mapping.get(currentNode);
                if (superNode) {
                    newMapping.set(origNode, superNode);
                }
            }
            nodeMapping = newMapping;

            level++;
        }

        return communities;
    }

    private louvainPhase1(
        graph: GraphMatrix,
        resolution: number
    ): Map<NodeId, number> {
        const partition = new Map<NodeId, number>();
        const nodeIds = Array.from(graph.nodes.keys());

        // Initialize: each node in its own community
        nodeIds.forEach((id, idx) => partition.set(id, idx));

        // Pre-calculate total edge weight
        let totalWeight = 0;
        for (const edges of graph.edges.values()) {
            for (const weight of edges.values()) {
                totalWeight += weight;
            }
        }
        totalWeight = totalWeight / 2; // Undirected

        let improved = true;
        let iterations = 0;
        const maxIterations = 100;

        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;

            // Shuffle nodes for better convergence
            const shuffled = this.shuffleArray([...nodeIds]);

            for (const nodeId of shuffled) {
                const currentCommunity = partition.get(nodeId)!;

                // Calculate node degree
                const nodeEdges = graph.edges.get(nodeId) || new Map();
                let nodeDegree = 0;
                for (const weight of nodeEdges.values()) {
                    nodeDegree += weight;
                }

                // Try moving node to neighbor communities
                const neighborCommunities = new Map<number, number>(); // community → weight to community

                for (const [targetId, weight] of nodeEdges) {
                    const targetCommunity = partition.get(targetId)!;
                    neighborCommunities.set(
                        targetCommunity,
                        (neighborCommunities.get(targetCommunity) || 0) + weight
                    );
                }

                let bestCommunity = currentCommunity;
                let bestGain = 0;

                for (const [community, weightToCommunity] of neighborCommunities) {
                    if (community === currentCommunity) continue;

                    const gain = this.calculateModularityGain(
                        nodeId,
                        currentCommunity,
                        community,
                        weightToCommunity,
                        nodeDegree,
                        graph,
                        partition,
                        totalWeight,
                        resolution
                    );

                    if (gain > bestGain) {
                        bestGain = gain;
                        bestCommunity = community;
                    }
                }

                if (bestCommunity !== currentCommunity && bestGain > 1e-10) {
                    partition.set(nodeId, bestCommunity);
                    improved = true;
                }
            }
        }

        // Renumber communities to be contiguous
        return this.renumberPartition(partition);
    }

    private louvainPhase2(
        graph: GraphMatrix,
        partition: Map<NodeId, number>
    ): { graph: GraphMatrix; mapping: Map<NodeId, NodeId> } {
        const communityWeights = new Map<string, number>();
        const communitySelfLoops = new Map<number, number>();
        const mapping = new Map<NodeId, NodeId>();

        // Build community → community edges
        for (const [nodeId, edges] of graph.edges) {
            const sourceCommunity = partition.get(nodeId)!;
            mapping.set(nodeId, `comm_${sourceCommunity}`);

            for (const [targetId, weight] of edges) {
                const targetCommunity = partition.get(targetId)!;

                if (sourceCommunity === targetCommunity) {
                    // Self-loop
                    communitySelfLoops.set(
                        sourceCommunity,
                        (communitySelfLoops.get(sourceCommunity) || 0) + weight
                    );
                } else {
                    const edgeKey = sourceCommunity < targetCommunity
                        ? `${sourceCommunity}-${targetCommunity}`
                        : `${targetCommunity}-${sourceCommunity}`;
                    communityWeights.set(edgeKey, (communityWeights.get(edgeKey) || 0) + weight);
                }
            }
        }

        // Create new graph with communities as nodes
        const newGraph: GraphMatrix = {
            nodes: new Map(),
            edges: new Map(),
        };

        const communityIds = new Set(partition.values());
        for (const commId of communityIds) {
            const nodeId = `comm_${commId}`;
            newGraph.nodes.set(nodeId, { id: nodeId });
            newGraph.edges.set(nodeId, new Map());

            // Add self-loops
            const selfLoop = communitySelfLoops.get(commId);
            if (selfLoop) {
                newGraph.edges.get(nodeId)!.set(nodeId, selfLoop);
            }
        }

        for (const [edgeKey, weight] of communityWeights) {
            const [source, target] = edgeKey.split('-').map(Number);
            newGraph.edges.get(`comm_${source}`)!.set(`comm_${target}`, weight);
            newGraph.edges.get(`comm_${target}`)!.set(`comm_${source}`, weight);
        }

        return { graph: newGraph, mapping };
    }

    private calculateModularityGain(
        nodeId: NodeId,
        fromCommunity: number,
        toCommunity: number,
        weightToCommunity: number,
        nodeDegree: number,
        graph: GraphMatrix,
        partition: Map<NodeId, number>,
        totalWeight: number,
        resolution: number
    ): number {
        // Calculate sum of weights in target community
        let sumIn = 0;
        let sumTot = 0;

        for (const [nId, edges] of graph.edges) {
            if (partition.get(nId) !== toCommunity) continue;

            for (const [targetId, weight] of edges) {
                sumTot += weight;
                if (partition.get(targetId) === toCommunity) {
                    sumIn += weight;
                }
            }
        }

        // Modularity gain formula
        const m2 = 2 * totalWeight;
        const gain = (
            (sumIn + 2 * weightToCommunity) / m2 -
            Math.pow((sumTot + nodeDegree) / m2, 2) * resolution
        ) - (
                sumIn / m2 -
                Math.pow(sumTot / m2, 2) * resolution -
                Math.pow(nodeDegree / m2, 2) * resolution
            );

        return gain;
    }

    private hasConverged(partition: Map<NodeId, number>, level: number): boolean {
        const communitySizes = new Map<number, number>();

        for (const community of partition.values()) {
            communitySizes.set(community, (communitySizes.get(community) || 0) + 1);
        }

        // If we only have 1 community, we've converged
        if (communitySizes.size === 1) return true;

        // If all communities are tiny (< 2 nodes), we've converged
        const allTiny = Array.from(communitySizes.values()).every(size => size < 2);
        return allTiny;
    }

    private renumberPartition(partition: Map<NodeId, number>): Map<NodeId, number> {
        const communityMap = new Map<number, number>();
        let nextId = 0;

        const result = new Map<NodeId, number>();

        for (const [nodeId, community] of partition) {
            if (!communityMap.has(community)) {
                communityMap.set(community, nextId++);
            }
            result.set(nodeId, communityMap.get(community)!);
        }

        return result;
    }

    private partitionToCommunities(
        partition: Map<NodeId, number>,
        nodeMapping: Map<NodeId, NodeId>,
        level: number,
        minSize: number
    ): DetectedCommunity[] {
        const communityMembers = new Map<number, NodeId[]>();

        // Map current partition nodes back to original nodes
        const reverseMapping = new Map<NodeId, NodeId[]>();
        for (const [origNode, currentNode] of nodeMapping) {
            let origNodes = reverseMapping.get(currentNode);
            if (!origNodes) {
                origNodes = [];
                reverseMapping.set(currentNode, origNodes);
            }
            origNodes.push(origNode);
        }

        for (const [nodeId, communityId] of partition) {
            let members = communityMembers.get(communityId);
            if (!members) {
                members = [];
                communityMembers.set(communityId, members);
            }

            // Get original nodes
            const origNodes = reverseMapping.get(nodeId) || [nodeId];
            members.push(...origNodes);
        }

        const communities: DetectedCommunity[] = [];

        for (const [, members] of communityMembers) {
            if (members.length >= minSize) {
                communities.push({
                    id: generateId(),
                    level,
                    entity_ids: members,
                    modularity: 0, // Would calculate properly in production
                });
            }
        }

        return communities;
    }

    private shuffleArray<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    // ===== GRAPH CONSTRUCTION =====

    private buildGraph(nodes: UnifiedNode[], edges: UnifiedEdge[]): GraphMatrix {
        const graph: GraphMatrix = {
            nodes: new Map(),
            edges: new Map(),
        };

        // Add nodes (only entities, not folders)
        for (const node of nodes) {
            if (node.data.isEntity || node.data.type === 'ENTITY') {
                graph.nodes.set(node.data.id, { id: node.data.id });
                graph.edges.set(node.data.id, new Map());
            }
        }

        // Add edges with weights (only between nodes in graph)
        for (const edge of edges) {
            if (!graph.nodes.has(edge.data.source) || !graph.nodes.has(edge.data.target)) {
                continue;
            }

            const weight = this.calculateEdgeWeight(edge);

            // Add both directions for undirected graph
            const sourceEdges = graph.edges.get(edge.data.source)!;
            const targetEdges = graph.edges.get(edge.data.target)!;

            sourceEdges.set(edge.data.target, (sourceEdges.get(edge.data.target) || 0) + weight);
            targetEdges.set(edge.data.source, (targetEdges.get(edge.data.source) || 0) + weight);
        }

        return graph;
    }

    private calculateEdgeWeight(edge: UnifiedEdge): number {
        // Weight based on edge type and properties
        let weight = edge.data.weight || 1.0;

        // Boost certain edge types
        const boosts: Record<string, number> = {
            'KNOWS': 1.5,
            'CO_OCCURS': 1.3,
            'MEMBER_OF': 2.0,
            'RELATED_TO': 1.2,
            'APPEARS_IN': 1.4,
            'BELONGS_TO': 1.8,
            'CHILD_OF': 2.5,
            'PARENT_OF': 2.5,
            'SIBLING_OF': 2.0,
            'SPOUSE_OF': 2.5,
        };

        if (boosts[edge.data.type]) {
            weight *= boosts[edge.data.type];
        }

        // Apply confidence
        if (edge.data.confidence) {
            weight *= edge.data.confidence;
        }

        return weight;
    }

    // ===== HYBRID: SEED FROM FOLDERS =====

    private seedCommunitiesFromFolders(
        nodes: UnifiedNode[],
        namespace: string
    ): Community[] {
        const communities: Community[] = [];
        const factionFolders = nodes.filter(
            n => n.data.entityKind === 'FACTION' && n.data.type === 'FOLDER'
        );

        for (const folder of factionFolders) {
            // Get all entities under this faction folder
            const members = this.getDescendantEntities(folder.data.id, nodes);

            if (members.length > 0) {
                const community: Community = {
                    id: generateId(),
                    name: folder.data.label,
                    description: folder.data.content || `${folder.data.label} faction`,

                    node_id: folder.data.id,
                    entity_kind: 'FACTION',

                    parent_community_id: undefined,
                    child_community_ids: [],
                    level: 0, // Root level (seeded)

                    entity_ids: members,
                    leader_id: this.findLeader(members, nodes),

                    community_type: 'FACTION',

                    namespace,

                    attributes: {
                        seeded: true,
                        source: 'FOLDER',
                    },

                    created_at: new Date(folder.data.createdAt),
                    updated_at: new Date(folder.data.updatedAt),
                };

                communities.push(community);
            }
        }

        // Build hierarchy for nested faction folders
        this.buildFactionHierarchy(communities, nodes);

        return communities;
    }

    private getDescendantEntities(folderId: NodeId, nodes: UnifiedNode[]): NodeId[] {
        const descendants: NodeId[] = [];
        const queue = [folderId];
        const visited = new Set<NodeId>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const children = nodes.filter(n => n.data.parentId === currentId);

            for (const child of children) {
                if (child.data.type === 'FOLDER') {
                    queue.push(child.data.id);
                } else if (child.data.isEntity || child.data.type === 'ENTITY') {
                    descendants.push(child.data.id);
                }
            }
        }

        return descendants;
    }

    private findLeader(members: NodeId[], nodes: UnifiedNode[]): NodeId | undefined {
        // Find the "leader" based on subtype or most connected
        const memberNodes = nodes.filter(n => members.includes(n.data.id));

        // Look for leader subtypes
        const leaderSubtypes = ['LEADER', 'CHIEF', 'KING', 'QUEEN', 'PROTAGONIST'];
        for (const node of memberNodes) {
            if (node.data.entitySubtype &&
                leaderSubtypes.some(s => node.data.entitySubtype?.toUpperCase().includes(s))) {
                return node.data.id;
            }
        }

        return members[0]; // Default to first member
    }

    private buildFactionHierarchy(communities: Community[], nodes: UnifiedNode[]): void {
        const nodeIdToCommunity = new Map<NodeId, Community>();
        for (const comm of communities) {
            nodeIdToCommunity.set(comm.node_id, comm);
        }

        for (const community of communities) {
            const folder = nodes.find(n => n.data.id === community.node_id);
            if (!folder?.data.parentId) continue;

            // Find parent faction folder
            let parentId = folder.data.parentId;
            while (parentId) {
                const parentCommunity = nodeIdToCommunity.get(parentId);
                if (parentCommunity) {
                    community.parent_community_id = parentCommunity.id;
                    parentCommunity.child_community_ids.push(community.id);
                    community.level = parentCommunity.level + 1;
                    break;
                }
                const parentNode = nodes.find(n => n.data.id === parentId);
                parentId = parentNode?.data.parentId;
            }
        }
    }

    // ===== COMMUNITY CLASSIFICATION =====

    private classifyCommunity(
        community: DetectedCommunity | Community,
        nodes: UnifiedNode[],
        edges: UnifiedEdge[]
    ): CommunityType {
        const entityNodes = nodes.filter(n => community.entity_ids.includes(n.data.id));

        // Check if seeded (already classified)
        if ('community_type' in community && community.attributes?.seeded) {
            return community.community_type;
        }

        // Classify based on entity types
        const entityKinds = new Map<EntityKind, number>();
        for (const node of entityNodes) {
            if (node.data.entityKind) {
                entityKinds.set(
                    node.data.entityKind,
                    (entityKinds.get(node.data.entityKind) || 0) + 1
                );
            }
        }

        // Find dominant kind
        let dominantKind: EntityKind | undefined;
        let maxCount = 0;
        for (const [kind, count] of entityKinds) {
            if (count > maxCount) {
                maxCount = count;
                dominantKind = kind;
            }
        }

        // All characters → FAMILY or social group
        if (dominantKind === 'CHARACTER' && maxCount === entityNodes.length) {
            return this.isFamilyCluster(community.entity_ids, edges) ? 'FAMILY' : 'FACTION';
        }

        // All locations → LOCATION_GROUP
        if (dominantKind === 'LOCATION' && maxCount === entityNodes.length) {
            return 'LOCATION_GROUP';
        }

        // Primarily NPCs → PROFESSION (guild, merchants, etc.)
        if (dominantKind === 'NPC' && maxCount / entityNodes.length > 0.6) {
            return 'PROFESSION';
        }

        // Mixed types → CUSTOM
        return 'CUSTOM';
    }

    private isFamilyCluster(entityIds: NodeId[], edges: UnifiedEdge[]): boolean {
        // Check if edges suggest family relationships
        const familyRelations = ['CHILD_OF', 'PARENT_OF', 'SIBLING_OF', 'SPOUSE_OF', 'RELATED_TO'];

        const communityEdges = edges.filter(
            e => entityIds.includes(e.data.source) && entityIds.includes(e.data.target)
        );

        if (communityEdges.length === 0) return false;

        const familyEdgeCount = communityEdges.filter(
            e => familyRelations.some(rel => e.data.type.toUpperCase().includes(rel))
        ).length;

        // If >50% of edges are family relations, it's a family
        return familyEdgeCount / communityEdges.length > 0.5;
    }

    // ===== MERGE COMMUNITIES =====

    private mergeCommunities(
        seeded: Community[],
        detected: DetectedCommunity[],
        namespace: string
    ): Community[] {
        const merged: Community[] = [...seeded];

        for (const detectedComm of detected) {
            // Check if detected community overlaps significantly with seeded
            let bestOverlap = 0;
            let bestMatch: Community | null = null;

            for (const seededComm of seeded) {
                const overlap = this.calculateOverlap(
                    seededComm.entity_ids,
                    detectedComm.entity_ids
                );

                if (overlap > bestOverlap) {
                    bestOverlap = overlap;
                    bestMatch = seededComm;
                }
            }

            if (bestOverlap > 0.7 && bestMatch) {
                // Merge into seeded community (expand it)
                const uniqueIds = new Set([...bestMatch.entity_ids, ...detectedComm.entity_ids]);
                bestMatch.entity_ids = Array.from(uniqueIds);
                bestMatch.attributes = {
                    ...bestMatch.attributes,
                    expandedFromDetection: true,
                    originalSize: bestMatch.entity_ids.length,
                };
            } else {
                // Create new community from detected
                const community: Community = {
                    id: detectedComm.id,
                    name: `Community ${detectedComm.level}-${detectedComm.entity_ids.length}`,
                    description: '',

                    node_id: '', // No backing node for detected communities
                    entity_kind: 'CHARACTER', // Will be updated by classification

                    parent_community_id: undefined,
                    child_community_ids: [],
                    level: detectedComm.level,

                    entity_ids: detectedComm.entity_ids,

                    community_type: 'CUSTOM',

                    namespace,

                    attributes: {
                        detected: true,
                        modularity: detectedComm.modularity,
                    },

                    created_at: new Date(),
                    updated_at: new Date(),
                };

                merged.push(community);
            }
        }

        return merged;
    }

    private calculateOverlap(ids1: NodeId[], ids2: NodeId[]): number {
        const set1 = new Set(ids1);
        const intersection = ids2.filter(id => set1.has(id)).length;
        const union = new Set([...ids1, ...ids2]).size;
        return union > 0 ? intersection / union : 0;
    }

    // ===== DESCRIPTION GENERATION =====

    private generateDescription(community: Community, nodes: UnifiedNode[]): string {
        const entityNodes = nodes.filter(n => community.entity_ids.includes(n.data.id));
        const kinds = new Map<string, number>();

        for (const node of entityNodes) {
            if (node.data.entityKind) {
                kinds.set(node.data.entityKind, (kinds.get(node.data.entityKind) || 0) + 1);
            }
        }

        const kindsList = Array.from(kinds.entries())
            .map(([kind, count]) => `${count} ${kind.toLowerCase()}${count > 1 ? 's' : ''}`)
            .join(', ');

        return `A ${community.community_type.toLowerCase().replace('_', ' ')} containing ${kindsList}`;
    }

    // ===== UPDATE OPERATIONS =====

    /**
     * Add entity to community
     */
    addEntityToCommunity(entityId: NodeId, communityId: CommunityId): boolean {
        const community = this.communities.get(communityId);
        if (!community) return false;

        if (!community.entity_ids.includes(entityId)) {
            community.entity_ids.push(entityId);
            community.updated_at = new Date();
        }

        let comms = this.nodeToCommunities.get(entityId);
        if (!comms) {
            comms = new Set();
            this.nodeToCommunities.set(entityId, comms);
        }
        comms.add(communityId);

        return true;
    }

    /**
     * Remove entity from community
     */
    removeEntityFromCommunity(entityId: NodeId, communityId: CommunityId): boolean {
        const community = this.communities.get(communityId);
        if (!community) return false;

        community.entity_ids = community.entity_ids.filter(id => id !== entityId);
        community.updated_at = new Date();

        const comms = this.nodeToCommunities.get(entityId);
        if (comms) {
            comms.delete(communityId);
        }

        return true;
    }

    /**
     * Update community
     */
    updateCommunity(communityId: CommunityId, updates: Partial<Community>): Community | undefined {
        const community = this.communities.get(communityId);
        if (!community) return undefined;

        const updated: Community = {
            ...community,
            ...updates,
            id: community.id, // Prevent ID change
            updated_at: new Date(),
        };

        this.communities.set(communityId, updated);
        return updated;
    }

    /**
     * Delete community
     */
    deleteCommunity(communityId: CommunityId): boolean {
        const community = this.communities.get(communityId);
        if (!community) return false;

        // Remove from parent's child list
        if (community.parent_community_id) {
            const parent = this.communities.get(community.parent_community_id);
            if (parent) {
                parent.child_community_ids = parent.child_community_ids.filter(id => id !== communityId);
            }
        }

        // Orphan children
        for (const childId of community.child_community_ids) {
            const child = this.communities.get(childId);
            if (child) {
                child.parent_community_id = undefined;
            }
        }

        // Remove from node mappings
        for (const entityId of community.entity_ids) {
            const comms = this.nodeToCommunities.get(entityId);
            if (comms) {
                comms.delete(communityId);
            }
        }

        // Remove from hierarchy levels
        const levelComms = this.hierarchyLevels.get(community.level);
        if (levelComms) {
            levelComms.delete(communityId);
        }

        this.communities.delete(communityId);
        return true;
    }

    // ===== STATISTICS =====

    /**
     * Get community statistics
     */
    getStats(): CommunityStats {
        const communities = Array.from(this.communities.values());

        const byType = {} as Record<CommunityType, number>;
        const byLevel = {} as Record<number, number>;
        let totalMembers = 0;
        let bridgeCount = 0;

        for (const community of communities) {
            byType[community.community_type] = (byType[community.community_type] || 0) + 1;
            byLevel[community.level] = (byLevel[community.level] || 0) + 1;
            totalMembers += community.entity_ids.length;
        }

        for (const comms of this.nodeToCommunities.values()) {
            if (comms.size > 1) bridgeCount++;
        }

        return {
            total: communities.length,
            byType,
            byLevel,
            totalMembers,
            averageSize: communities.length > 0 ? totalMembers / communities.length : 0,
            bridgeNodeCount: bridgeCount,
        };
    }

    // ===== GETTERS =====

    getCommunity(id: CommunityId): Community | undefined {
        return this.communities.get(id);
    }

    getAllCommunities(): Community[] {
        return Array.from(this.communities.values());
    }

    getCommunitiesByType(type: CommunityType): Community[] {
        return Array.from(this.communities.values()).filter(c => c.community_type === type);
    }

    getCommunitiesByNamespace(namespace: string): Community[] {
        return Array.from(this.communities.values()).filter(c => c.namespace === namespace);
    }

    getCommunityCount(): number {
        return this.communities.size;
    }

    /**
     * Export all communities as serializable array
     */
    export(): Community[] {
        return Array.from(this.communities.values());
    }

    /**
     * Import communities from serialized array
     */
    import(communities: Community[]): void {
        for (const community of communities) {
            this.communities.set(community.id, community);

            // Rebuild indexes
            for (const entityId of community.entity_ids) {
                let comms = this.nodeToCommunities.get(entityId);
                if (!comms) {
                    comms = new Set();
                    this.nodeToCommunities.set(entityId, comms);
                }
                comms.add(community.id);
            }

            let levelComms = this.hierarchyLevels.get(community.level);
            if (!levelComms) {
                levelComms = new Set();
                this.hierarchyLevels.set(community.level, levelComms);
            }
            levelComms.add(community.id);
        }
    }

    /**
     * Clear all communities
     */
    clear(): void {
        this.communities.clear();
        this.nodeToCommunities.clear();
        this.hierarchyLevels.clear();
    }
}

// ===== TYPES =====

interface GraphMatrix {
    nodes: Map<NodeId, { id: NodeId }>;
    edges: Map<NodeId, Map<NodeId, number>>; // source → target → weight
}

interface DetectedCommunity {
    id: CommunityId;
    level: number;
    entity_ids: NodeId[];
    modularity: number;
}

export interface CommunityDetectionOptions {
    /** Minimum community size (default: 3) */
    minSize?: number;
    /** Maximum hierarchy levels (default: 5) */
    maxLevel?: number;
    /** Louvain resolution parameter (default: 1.0) */
    resolution?: number;
    /** Seed initial communities from FACTION folders (default: true) */
    seedFromFolders?: boolean;
}

export interface BridgeNodeInfo {
    nodeId: NodeId;
    communityCount: number;
    communities: {
        id: CommunityId;
        name: string;
        type: CommunityType;
    }[];
}

export interface CommunityRelationship {
    community1_id: CommunityId;
    community2_id: CommunityId;
    edge_count: number;
    total_weight: number;
    edge_types: Set<string>;
}

export interface CommunityStats {
    total: number;
    byType: Record<CommunityType, number>;
    byLevel: Record<number, number>;
    totalMembers: number;
    averageSize: number;
    bridgeNodeCount: number;
}
