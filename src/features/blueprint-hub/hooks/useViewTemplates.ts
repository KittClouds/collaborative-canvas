import { useState, useEffect, useCallback } from 'react';
import {
  getAllViewTemplatesByVersion,
  createViewTemplate,
  deleteViewTemplate,
} from '../api/storage';
import type { ViewTemplateDef, CreateViewTemplateInput } from '../types';

export function useViewTemplates(versionId: string | null) {
  const [viewTemplates, setViewTemplates] = useState<ViewTemplateDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadViewTemplates = useCallback(async () => {
    if (!versionId) {
      setViewTemplates([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const templates = await getAllViewTemplatesByVersion(versionId);
      setViewTemplates(templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load view templates';
      setError(message);
      console.error('Error loading view templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    loadViewTemplates();
  }, [loadViewTemplates]);

  const create = useCallback(
    async (input: Omit<CreateViewTemplateInput, 'version_id'>) => {
      if (!versionId) {
        throw new Error('No active version');
      }

      const newTemplate = await createViewTemplate({
        ...input,
        version_id: versionId,
      });

      await loadViewTemplates();
      return newTemplate;
    },
    [versionId, loadViewTemplates]
  );

  const remove = useCallback(
    async (viewId: string) => {
      await deleteViewTemplate(viewId);
      await loadViewTemplates();
    },
    [loadViewTemplates]
  );

  return {
    viewTemplates,
    isLoading,
    error,
    create,
    remove,
    refresh: loadViewTemplates,
  };
}
