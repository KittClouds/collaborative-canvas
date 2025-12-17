import { useState, useEffect, useCallback } from 'react';
import {
  getAllFieldsByVersion,
  getAllFieldsByEntityType,
  createField,
  updateField,
  deleteField,
} from '../api/storage';
import type { FieldDef, CreateFieldInput } from '../types';

export function useFields(versionId: string | null) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    if (!versionId) {
      setFields([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allFields = await getAllFieldsByVersion(versionId);
      setFields(allFields);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load fields';
      setError(message);
      console.error('Error loading fields:', err);
    } finally {
      setIsLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  const create = useCallback(
    async (input: CreateFieldInput) => {
      const newField = await createField(input);
      await loadFields();
      return newField;
    },
    [loadFields]
  );

  const update = useCallback(
    async (fieldId: string, updates: Partial<CreateFieldInput>) => {
      const updated = await updateField(fieldId, updates);
      await loadFields();
      return updated;
    },
    [loadFields]
  );

  const remove = useCallback(
    async (fieldId: string) => {
      await deleteField(fieldId);
      await loadFields();
    },
    [loadFields]
  );

  const getFieldsByEntityType = useCallback(
    (entityTypeId: string) => {
      return fields.filter(f => f.entity_type_id === entityTypeId);
    },
    [fields]
  );

  return {
    fields,
    isLoading,
    error,
    create,
    update,
    remove,
    refresh: loadFields,
    getFieldsByEntityType,
  };
}
