import { useState, useEffect, useCallback } from 'react';
import { getEdgeStore } from '@/lib/storage/index';
import type { EntityEdge } from '@/lib/storage/interfaces';

interface UseEntityRelationshipsReturn {
  edges: EntityEdge[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch both outgoing and incoming edges for an entity
 */
export function useEntityRelationships(entityId: string | null): UseEntityRelationshipsReturn {
  const [edges, setEdges] = useState<EntityEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEdges = useCallback(async () => {
    if (!entityId) {
      setEdges([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const edgeStore = getEdgeStore();
      const [outgoing, incoming] = await Promise.all([
        edgeStore.getEdgesBySourceId(entityId),
        edgeStore.getEdgesByTargetId(entityId),
      ]);

      // Combine and deduplicate
      const allEdges = [...outgoing, ...incoming];
      const uniqueEdges = Array.from(
        new Map(allEdges.map((edge) => [edge.id, edge])).values()
      );

      setEdges(uniqueEdges);
    } catch (error) {
      console.error('Error fetching entity relationships:', error);
      setEdges([]);
    } finally {
      setIsLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchEdges();
  }, [fetchEdges]);

  return {
    edges,
    isLoading,
    refresh: fetchEdges,
  };
}
