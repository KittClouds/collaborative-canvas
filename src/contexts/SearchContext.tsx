import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { searchService } from '@/lib/db/search';
import { syncService, healthTracker } from '@/lib/embeddings';
import type { SearchResult } from '@/lib/db/search';
import type { SyncScope, SyncProgress, SyncStatus } from '@/lib/embeddings/syncService';
import type { EmbeddingHealth } from '@/lib/embeddings/healthTracker';
import { useNotes } from './NotesContext';

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  searchMetadata?: {
    totalResults: number;
    searchTime: number;
    graphExpanded: boolean;
  };
  embeddingHealth: EmbeddingHealth;
  syncStatus: SyncStatus;
  syncProgress?: SyncProgress;
  selectedModel: 'small' | 'medium';
  searchMode: 'semantic' | 'hybrid';
  hybridWeights: {
    vector: number;
    graph: number;
    lexical: number;
  };
}

interface SearchContextValue extends SearchState {
  setQuery: (query: string) => void;
  executeSearch: () => Promise<void>;
  syncEmbeddings: (scope: SyncScope) => Promise<void>;
  cancelSync: () => void;
  refreshHealth: () => Promise<void>;
  setSelectedModel: (model: 'small' | 'medium') => void;
  setSearchMode: (mode: 'semantic' | 'hybrid') => void;
  setHybridWeights: (weights: { vector: number; graph: number; lexical: number }) => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

const DEFAULT_HEALTH: EmbeddingHealth = {
  embeddingsCount: 0,
  totalNotes: 0,
  syncedNotes: 0,
};

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { state } = useNotes();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMetadata, setSearchMetadata] = useState<SearchState['searchMetadata']>();
  const [embeddingHealth, setEmbeddingHealth] = useState<EmbeddingHealth>(DEFAULT_HEALTH);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isRunning: false });
  const [syncProgress, setSyncProgress] = useState<SyncProgress>();
  const [selectedModel, setSelectedModel] = useState<'small' | 'medium'>('small');
  const [searchMode, setSearchMode] = useState<'semantic' | 'hybrid'>('semantic');
  const [hybridWeights, setHybridWeights] = useState({
    vector: 0.4,
    graph: 0.4,
    lexical: 0.2,
  });

  useEffect(() => {
    const notesProvider = () => state.notes.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content,
      folderId: n.folderId,
    }));

    syncService.setNotesProvider(notesProvider);
    healthTracker.setNotesProvider(() => state.notes.map(n => ({
      id: n.id,
      folderId: n.folderId,
    })));
  }, [state.notes]);

  useEffect(() => {
    healthTracker.getHealth()
      .then(setEmbeddingHealth)
      .catch((error) => {
        console.warn('Failed to get initial health, will retry:', error);
        // Use default health state until DB is ready
      });
  }, [state.notes.length]);

  useEffect(() => {
    const unsubscribe = syncService.onProgress((progress) => {
      setSyncProgress(progress);
      setSyncStatus(syncService.getStatus());

      if (progress.phase === 'complete') {
        healthTracker.refreshHealth().then(setEmbeddingHealth);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = healthTracker.onHealthChange(setEmbeddingHealth);
    return unsubscribe;
  }, []);

  const executeSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    const startTime = performance.now();

    try {
      const results = await searchService.search({
        query,
        k: 20,
        mode: searchMode,
        semanticOptions: {
          model: selectedModel,
          threshold: 0.5,
        },
        ...(searchMode === 'hybrid' && {
          hybridOptions: {
            vectorWeight: hybridWeights.vector,
            graphWeight: hybridWeights.graph,
            lexicalWeight: hybridWeights.lexical,
            maxHops: 2,
            boostConnected: true,
          },
        }),
      });

      setResults(results);
      setSearchMetadata({
        totalResults: results.length,
        searchTime: Math.round(performance.now() - startTime),
        graphExpanded: searchMode === 'hybrid',
      });
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedModel, searchMode, hybridWeights]);

  const syncEmbeddings = useCallback(async (scope: SyncScope) => {
    setSyncStatus({ isRunning: true, scope });
    await syncService.sync(scope, { model: selectedModel });
    setSyncStatus({ isRunning: false });
  }, [selectedModel]);

  const cancelSync = useCallback(() => {
    syncService.cancel();
  }, []);

  const refreshHealth = useCallback(async () => {
    const health = await healthTracker.refreshHealth();
    setEmbeddingHealth(health);
  }, []);

  const value = useMemo(() => ({
    query,
    results,
    isSearching,
    searchMetadata,
    embeddingHealth,
    syncStatus,
    syncProgress,
    selectedModel,
    searchMode,
    hybridWeights,
    setQuery,
    executeSearch,
    syncEmbeddings,
    cancelSync,
    refreshHealth,
    setSelectedModel,
    setSearchMode,
    setHybridWeights,
  }), [
    query,
    results,
    isSearching,
    searchMetadata,
    embeddingHealth,
    syncStatus,
    syncProgress,
    selectedModel,
    searchMode,
    hybridWeights,
    executeSearch,
    syncEmbeddings,
    cancelSync,
    refreshHealth,
  ]);

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}
