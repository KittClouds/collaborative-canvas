import { useState, useEffect, useCallback } from 'react';
import { getEntitiesByGroupId, Entity } from '@/lib/cozo/api/entities';

interface UseEntitiesReturn {
  entities: Entity[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch all entities in a group (for target selection)
 */
export function useEntities(groupId: string | null): UseEntitiesReturn {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntities = useCallback(async () => {
    if (!groupId) {
      setEntities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await getEntitiesByGroupId(groupId);
      setEntities(result);
    } catch (error) {
      console.error('Error fetching entities:', error);
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  return {
    entities,
    isLoading,
    refresh: fetchEntities,
  };
}
