import { useMemo, useCallback, useState, useEffect } from 'react';
import {
    getGraph,
    EpisodeManager,
    CommunityManager,
    TemporalQueryManager,
    UnifiedNode,
    UnifiedEdge,
} from '@/lib/graph';
import type {
    NodeId,
    EpisodeId,
    CommunityId,
    Episode,
    Community,
    TemporalQueryResult,
    EntityTimeline,
    CommunityStats,
    CommunityDetectionOptions,
} from '@/lib/graph';

/**
 * useUnifiedGraph Hook
 * 
 * Central React interface for the Graph, Episode, Community, and Temporal systems.
 * Provides singleton-like access to managers and memoized query methods.
 */
export function useUnifiedGraph() {
    const graph = useMemo(() => getGraph(), []);

    // Initialize managers
    const episodeManager = useMemo(() => new EpisodeManager(), []);
    const communityManager = useMemo(() => new CommunityManager(), []);

    // Update State to trigger re-renders when data changes
    const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

    // Get all nodes and edges for managers
    const nodes = useMemo(() => {
        const allNodes: UnifiedNode[] = [];
        graph.getInstance().nodes().forEach(n => {
            const data = n.data();
            allNodes.push({ group: 'nodes', data });
        });
        return allNodes;
    }, [graph, lastUpdate]);

    const edges = useMemo(() => {
        const allEdges: UnifiedEdge[] = [];
        graph.getInstance().edges().forEach(e => {
            const data = e.data();
            allEdges.push({ group: 'edges', data });
        });
        return allEdges;
    }, [graph, lastUpdate]);

    const nodeMap = useMemo(() => {
        const map = new Map<NodeId, UnifiedNode>();
        nodes.forEach(n => map.set(n.data.id, n));
        return map;
    }, [nodes]);

    const edgeMap = useMemo(() => {
        const map = new Map<string, UnifiedEdge>();
        edges.forEach(e => map.set(e.data.id, e));
        return map;
    }, [edges]);

    // Temporal Query Manager needs up-to-date managers and maps
    const temporalQuery = useMemo(() =>
        new TemporalQueryManager(episodeManager, nodeMap, edgeMap),
        [episodeManager, nodeMap, edgeMap]
    );

    /**
     * Sync Episodes with current graph data
     */
    const refreshEpisodes = useCallback((namespace: string = 'default') => {
        episodeManager.clear();
        const episodes = episodeManager.createEpisodesFromNodes(nodes, namespace);
        episodeManager.autoLinkFromNodeHierarchy(nodes);

        // Record appearances for entities
        for (const episode of episodes) {
            if (episode.entity_ids) {
                episodeManager.recordAppearances(episode.entity_ids, episode.id);
            }
        }

        setLastUpdate(Date.now());
    }, [episodeManager, nodes]);

    /**
     * Run Community Detection
     */
    const detectCommunities = useCallback(async (
        namespace: string = 'default',
        options?: CommunityDetectionOptions
    ) => {
        communityManager.clear();
        const communities = await communityManager.detectCommunities(nodes, edges, namespace, options);
        setLastUpdate(Date.now());
        return communities;
    }, [communityManager, nodes, edges]);

    // Initial sync
    useEffect(() => {
        refreshEpisodes();
    }, [refreshEpisodes]);

    // Helper to trigger update from external graph changes
    const notifyGraphUpdate = useCallback(() => {
        setLastUpdate(Date.now());
    }, []);

    // --- EPISODE QUERIES ---

    const getEpisode = useCallback((id: EpisodeId) => episodeManager.getEpisode(id), [episodeManager]);
    const getTimeline = useCallback((namespace?: string) => episodeManager.getTimeline(namespace), [episodeManager]);
    const getEntityAppearances = useCallback((entityId: NodeId) => episodeManager.getEntityAppearances(entityId), [episodeManager]);

    // --- COMMUNITY QUERIES ---

    const getCommunities = useCallback(() => communityManager.getAllCommunities(), [communityManager]);
    const getEntityCommunities = useCallback((entityId: NodeId) => communityManager.getNodeCommunities(entityId), [communityManager]);
    const getCommunityStats = useCallback(() => communityManager.getStats(), [communityManager]);

    // --- TEMPORAL QUERIES ---

    const getDuringEpisode = useCallback((episodeId: EpisodeId) => temporalQuery.getDuring(episodeId), [temporalQuery]);
    const getEntityJourney = useCallback((entityId: NodeId) => temporalQuery.getEntityTimeline(entityId), [temporalQuery]);
    const findNarrationPath = useCallback((startId: NodeId, endId: NodeId) => temporalQuery.findSequence(startId, endId), [temporalQuery]);

    return {
        graph,
        episodeManager,
        communityManager,
        temporalQuery,

        // Core Actions
        refreshEpisodes,
        detectCommunities,
        notifyGraphUpdate,

        // State
        lastUpdate,
        nodes,
        edges,

        // Quick Queries
        queries: {
            episodes: {
                getById: getEpisode,
                getTimeline,
                getForEntity: getEntityAppearances,
            },
            communities: {
                getAll: getCommunities,
                getForEntity: getEntityCommunities,
                getStats: getCommunityStats,
            },
            temporal: {
                getDuring: getDuringEpisode,
                getJourney: getEntityJourney,
                findPath: findNarrationPath,
            }
        }
    };
}
