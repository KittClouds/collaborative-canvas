import { useState, useEffect, useCallback } from 'react';
import {
  getAllMOCsByVersion,
  createMOC,
  deleteMOC,
} from '../api/storage';
import type { MOCDef, CreateMOCInput } from '../types';

export function useMOCs(versionId: string | null) {
  const [mocs, setMocs] = useState<MOCDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMOCs = useCallback(async () => {
    if (!versionId) {
      setMocs([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mocList = await getAllMOCsByVersion(versionId);
      setMocs(mocList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load MOCs';
      setError(message);
      console.error('Error loading MOCs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    loadMOCs();
  }, [loadMOCs]);

  const create = useCallback(
    async (input: Omit<CreateMOCInput, 'version_id'>) => {
      if (!versionId) {
        throw new Error('No active version');
      }

      const newMoc = await createMOC({
        ...input,
        version_id: versionId,
      });

      await loadMOCs();
      return newMoc;
    },
    [versionId, loadMOCs]
  );

  const remove = useCallback(
    async (mocId: string) => {
      await deleteMOC(mocId);
      await loadMOCs();
    },
    [loadMOCs]
  );

  return {
    mocs,
    isLoading,
    error,
    create,
    remove,
    refresh: loadMOCs,
  };
}
