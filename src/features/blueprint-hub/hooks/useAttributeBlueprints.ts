import { useState, useEffect, useCallback } from 'react';
import {
  getAllRelationshipAttributesByType,
  createRelationshipAttribute,
  deleteRelationshipAttribute,
} from '../api/storage';
import type { RelationshipAttributeDef, CreateRelationshipAttributeInput } from '../types';

export function useAttributeBlueprints(relationshipTypeId: string | null) {
  const [attributes, setAttributes] = useState<RelationshipAttributeDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttributes = useCallback(async () => {
    if (!relationshipTypeId) {
      setAttributes([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const attrs = await getAllRelationshipAttributesByType(relationshipTypeId);
      setAttributes(attrs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load attributes';
      setError(message);
      console.error('Error loading attributes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [relationshipTypeId]);

  useEffect(() => {
    loadAttributes();
  }, [loadAttributes]);

  const create = useCallback(
    async (input: CreateRelationshipAttributeInput) => {
      const newAttr = await createRelationshipAttribute(input);
      await loadAttributes();
      return newAttr;
    },
    [loadAttributes]
  );

  const remove = useCallback(
    async (attributeId: string) => {
      await deleteRelationshipAttribute(attributeId);
      await loadAttributes();
    },
    [loadAttributes]
  );

  return {
    attributes,
    isLoading,
    error,
    create,
    remove,
    refresh: loadAttributes,
  };
}
