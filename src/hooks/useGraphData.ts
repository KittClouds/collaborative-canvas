/**
 * useGraphData Hook
 * 
 * React hook for fetching graph data with loading/error states.
 * Handles CozoDB initialization and provides refetch capability.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { graphDataService } from '@/lib/graph/services/graph-data-service';
import type { GraphData, GraphScope, GraphStats } from '@/lib/graph/types/graph-types';

interface UseGraphDataResult {
    data: GraphData | null;
    stats: GraphStats | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
    isEmpty: boolean;
}

/**
 * Hook to fetch and manage graph data
 * 
 * @param scope - Defines what graph data to fetch (global, note, folder, entity)
 * @param enabled - Whether to fetch data (useful for conditional loading)
 * @returns Graph data, stats, loading state, error, and refetch function
 */
export function useGraphData(scope: GraphScope, enabled = true): UseGraphDataResult {
    const [data, setData] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Create stable scope key for dependency tracking
    const scopeKey = useMemo(() => {
        switch (scope.type) {
            case 'global':
                return 'global';
            case 'note':
                return `note:${scope.noteId}`;
            case 'folder':
                return `folder:${scope.folderId}`;
            case 'entity':
                return `entity:${scope.entityId}`;
        }
    }, [scope]);

    const fetchData = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let result: GraphData;

            switch (scope.type) {
                case 'global':
                    result = await graphDataService.getGlobalGraph();
                    break;
                case 'note':
                    result = await graphDataService.getVisualizationGraph(scope.noteId);
                    break;
                case 'folder':
                    result = await graphDataService.getVisualizationGraph(scope.folderId);
                    break;
                case 'entity':
                    // For entity scope, we could implement a focused graph around that entity
                    // For now, treat it like a note scope
                    result = await graphDataService.getVisualizationGraph(scope.entityId);
                    break;
            }

            setData(result);
        } catch (err) {
            console.error('[useGraphData] Fetch failed:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [scopeKey, enabled]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate stats from data
    const stats = useMemo(() => {
        if (!data) return null;
        return graphDataService.calculateStats(data);
    }, [data]);

    // Check if graph is empty
    const isEmpty = useMemo(() => {
        return !data || (data.nodes.length === 0 && data.links.length === 0);
    }, [data]);

    return {
        data,
        stats,
        loading,
        error,
        refetch: fetchData,
        isEmpty,
    };
}

/**
 * Simplified hook for cases where you just need global graph
 */
export function useGlobalGraph(enabled = true) {
    return useGraphData({ type: 'global' }, enabled);
}

/**
 * Hook for note-scoped graph
 */
export function useNoteGraph(noteId: string | null, enabled = true) {
    const scope: GraphScope = noteId
        ? { type: 'note', noteId }
        : { type: 'global' };

    return useGraphData(scope, enabled && !!noteId);
}
