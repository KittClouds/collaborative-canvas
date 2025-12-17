import { useState, useEffect, useCallback } from 'react';
import {
  getAllEntityTypesByVersion,
  createEntityType,
  updateEntityType,
  deleteEntityType,
  getAllFieldsByEntityType,
} from '../api/storage';
import type { EntityTypeDef, CreateEntityTypeInput, FieldDef } from '../types';

export interface EntityTypeWithFields extends EntityTypeDef {
  fields: FieldDef[];
}

export function useEntityTypes(versionId: string | null) {
  const [entityTypes, setEntityTypes] = useState<EntityTypeWithFields[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntityTypes = useCallback(async () => {
    if (!versionId) {
      setEntityTypes([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const types = await getAllEntityTypesByVersion(versionId);
      
      // Load fields for each entity type
      const typesWithFields = await Promise.all(
        types.map(async (type) => {
          const fields = await getAllFieldsByEntityType(type.entity_type_id);
          return { ...type, fields };
        })
      );

      setEntityTypes(typesWithFields);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load entity types';
      setError(message);
      console.error('Error loading entity types:', err);
    } finally {
      setIsLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    loadEntityTypes();
  }, [loadEntityTypes]);

  const create = useCallback(
    async (input: Omit<CreateEntityTypeInput, 'version_id'>) => {
      if (!versionId) {
        throw new Error('No active version');
      }

      const newType = await createEntityType({
        ...input,
        version_id: versionId,
      });

      await loadEntityTypes();
      return newType;
    },
    [versionId, loadEntityTypes]
  );

  const update = useCallback(
    async (entityTypeId: string, updates: Partial<CreateEntityTypeInput>) => {
      const updated = await updateEntityType(entityTypeId, updates);
      await loadEntityTypes();
      return updated;
    },
    [loadEntityTypes]
  );

  const remove = useCallback(
    async (entityTypeId: string) => {
      await deleteEntityType(entityTypeId);
      await loadEntityTypes();
    },
    [loadEntityTypes]
  );

  return {
    entityTypes,
    isLoading,
    error,
    create,
    update,
    remove,
    refresh: loadEntityTypes,
  };
}
