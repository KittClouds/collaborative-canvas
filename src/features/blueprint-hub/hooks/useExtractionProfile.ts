import { useState, useEffect, useCallback } from 'react';
import {
  getExtractionProfile,
  upsertExtractionProfile,
  getLabelMappings,
  upsertLabelMapping,
  deleteLabelMapping,
  getIgnoreList,
  addToIgnoreList,
  removeFromIgnoreList,
} from '../api/storage';
import type {
  ExtractionProfile,
  LabelMapping,
  IgnoreEntry,
  CreateExtractionProfileInput,
  CreateLabelMappingInput,
  CreateIgnoreEntryInput,
} from '../types';

export interface UseExtractionProfileReturn {
  profile: ExtractionProfile | null;
  mappings: LabelMapping[];
  ignoreList: IgnoreEntry[];
  isLoading: boolean;
  error: Error | null;
  
  updateProfile: (updates: Partial<CreateExtractionProfileInput>) => Promise<void>;
  addMapping: (mapping: Omit<CreateLabelMappingInput, 'profile_id'>) => Promise<void>;
  updateMapping: (mapping_id: string, updates: Partial<CreateLabelMappingInput>) => Promise<void>;
  removeMapping: (mapping_id: string) => Promise<void>;
  addIgnore: (entry: Omit<CreateIgnoreEntryInput, 'profile_id'>) => Promise<void>;
  removeIgnore: (ignore_id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_MAPPINGS: Array<{ ner_label: string; target_entity_kinds: string[]; priority: number }> = [
  { ner_label: 'PER', target_entity_kinds: ['CHARACTER', 'NPC'], priority: 1 },
  { ner_label: 'PERSON', target_entity_kinds: ['CHARACTER', 'NPC'], priority: 1 },
  { ner_label: 'ORG', target_entity_kinds: ['FACTION'], priority: 2 },
  { ner_label: 'LOC', target_entity_kinds: ['LOCATION'], priority: 3 },
  { ner_label: 'GPE', target_entity_kinds: ['LOCATION'], priority: 3 },
  { ner_label: 'EVENT', target_entity_kinds: ['EVENT'], priority: 4 },
  { ner_label: 'PRODUCT', target_entity_kinds: ['ITEM'], priority: 5 },
  { ner_label: 'WORK_OF_ART', target_entity_kinds: ['ITEM'], priority: 5 },
];

export function useExtractionProfile(versionId: string | undefined): UseExtractionProfileReturn {
  const [profile, setProfile] = useState<ExtractionProfile | null>(null);
  const [mappings, setMappings] = useState<LabelMapping[]>([]);
  const [ignoreList, setIgnoreList] = useState<IgnoreEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadProfile = useCallback(async () => {
    if (!versionId) {
      setProfile(null);
      setMappings([]);
      setIgnoreList([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let existingProfile = await getExtractionProfile(versionId);

      // Auto-create profile if it doesn't exist
      if (!existingProfile) {
        existingProfile = await upsertExtractionProfile({
          version_id: versionId,
          enabled: true,
          model_id: 'onnx-community/NeuroBERT-NER-ONNX',
          confidence_threshold: 0.4,
          resolution_policy: 'mention_first',
        });

        // Seed default mappings
        for (const defaultMapping of DEFAULT_MAPPINGS) {
          await upsertLabelMapping({
            profile_id: existingProfile.profile_id,
            ...defaultMapping,
          });
        }
      }

      setProfile(existingProfile);

      // Load mappings and ignore list
      const [loadedMappings, loadedIgnoreList] = await Promise.all([
        getLabelMappings(existingProfile.profile_id),
        getIgnoreList(existingProfile.profile_id),
      ]);

      setMappings(loadedMappings);
      setIgnoreList(loadedIgnoreList);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Failed to load extraction profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<CreateExtractionProfileInput>) => {
      if (!profile) return;

      try {
        const updated = await upsertExtractionProfile({
          profile_id: profile.profile_id,
          version_id: profile.version_id,
          enabled: updates.enabled ?? profile.enabled,
          model_id: updates.model_id ?? profile.model_id,
          confidence_threshold: updates.confidence_threshold ?? profile.confidence_threshold,
          resolution_policy: updates.resolution_policy ?? profile.resolution_policy,
        });
        setProfile(updated);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [profile]
  );

  const addMapping = useCallback(
    async (mapping: Omit<CreateLabelMappingInput, 'profile_id'>) => {
      if (!profile) return;

      try {
        const created = await upsertLabelMapping({
          profile_id: profile.profile_id,
          ...mapping,
        });
        setMappings(prev => [...prev, created].sort((a, b) => a.priority - b.priority));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [profile]
  );

  const updateMapping = useCallback(
    async (mapping_id: string, updates: Partial<CreateLabelMappingInput>) => {
      if (!profile) return;

      const existing = mappings.find(m => m.mapping_id === mapping_id);
      if (!existing) return;

      try {
        const updated = await upsertLabelMapping({
          mapping_id,
          profile_id: profile.profile_id,
          ner_label: updates.ner_label ?? existing.ner_label,
          target_entity_kinds: updates.target_entity_kinds ?? existing.target_entity_kinds,
          priority: updates.priority ?? existing.priority,
        });
        setMappings(prev =>
          prev.map(m => (m.mapping_id === mapping_id ? updated : m)).sort((a, b) => a.priority - b.priority)
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [profile, mappings]
  );

  const removeMapping = useCallback(async (mapping_id: string) => {
    try {
      await deleteLabelMapping(mapping_id);
      setMappings(prev => prev.filter(m => m.mapping_id !== mapping_id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  const addIgnore = useCallback(
    async (entry: Omit<CreateIgnoreEntryInput, 'profile_id'>) => {
      if (!profile) return;

      try {
        const created = await addToIgnoreList({
          profile_id: profile.profile_id,
          ...entry,
        });
        setIgnoreList(prev => [...prev, created]);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [profile]
  );

  const removeIgnore = useCallback(async (ignore_id: string) => {
    try {
      await removeFromIgnoreList(ignore_id);
      setIgnoreList(prev => prev.filter(i => i.ignore_id !== ignore_id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  return {
    profile,
    mappings,
    ignoreList,
    isLoading,
    error,
    updateProfile,
    addMapping,
    updateMapping,
    removeMapping,
    addIgnore,
    removeIgnore,
    refresh,
  };
}
