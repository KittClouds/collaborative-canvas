import { useState, useEffect, useCallback } from 'react';
import {
  getAllRelationshipTypesByVersion,
  createRelationshipType,
  updateRelationshipType,
  deleteRelationshipType,
  getAllRelationshipAttributesByType,
} from '../api/storage';
import type { RelationshipTypeDef, CreateRelationshipTypeInput, RelationshipAttributeDef } from '../types';

export interface RelationshipTypeWithAttributes extends RelationshipTypeDef {
  attributes: RelationshipAttributeDef[];
}

export function useRelationshipTypes(versionId: string | null) {
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipTypeWithAttributes[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRelationshipTypes = useCallback(async () => {
    if (!versionId) {
      setRelationshipTypes([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const types = await getAllRelationshipTypesByVersion(versionId);

      // Load attributes for each relationship type
      const typesWithAttributes = await Promise.all(
        types.map(async (type) => {
          const attributes = await getAllRelationshipAttributesByType(type.relationship_type_id);
          return { ...type, attributes };
        })
      );

      setRelationshipTypes(typesWithAttributes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load relationship types';
      setError(message);
      console.error('Error loading relationship types:', err);
    } finally {
      setIsLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    loadRelationshipTypes();
  }, [loadRelationshipTypes]);

  const create = useCallback(
    async (input: Omit<CreateRelationshipTypeInput, 'version_id'>) => {
      if (!versionId) {
        throw new Error('No active version');
      }

      const newType = await createRelationshipType({
        ...input,
        version_id: versionId,
      });

      await loadRelationshipTypes();

      // If verb patterns were included, trigger scanner pattern reload
      if (input.verb_patterns && input.verb_patterns.length > 0) {
        try {
          const { refreshScannerPatterns } = await import('@/lib/scanner');
          refreshScannerPatterns();
          console.log('[useRelationshipTypes] Scanner patterns refreshed after creating relationship type');
        } catch (error) {
          console.warn('[useRelationshipTypes] Failed to refresh scanner patterns:', error);
        }
      }

      return newType;
    },
    [versionId, loadRelationshipTypes]
  );

  const update = useCallback(
    async (relationshipTypeId: string, updates: Partial<CreateRelationshipTypeInput>) => {
      const updated = await updateRelationshipType(relationshipTypeId, updates);
      await loadRelationshipTypes();
      return updated;
    },
    [loadRelationshipTypes]
  );

  const remove = useCallback(
    async (relationshipTypeId: string) => {
      await deleteRelationshipType(relationshipTypeId);
      await loadRelationshipTypes();
    },
    [loadRelationshipTypes]
  );

  return {
    relationshipTypes,
    isLoading,
    error,
    create,
    update,
    remove,
    refresh: loadRelationshipTypes,
  };
}
