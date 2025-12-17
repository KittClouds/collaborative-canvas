import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { search, setSearchContext } from '@/lib/cozo/search/searchOrchestrator';
import { syncService, healthTracker } from '@/lib/embeddings';
import type { SearchResult, SearchResponse } from '@/lib/cozo/search/searchOrchestrator';
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
    modelUsed: 'small' | 'medium';
    graphExpanded: boolean;
  };
  embeddingHealth: EmbeddingHealth;
  syncStatus: SyncStatus;
  syncProgress?: SyncProgress;
  selectedModel: 'small' | 'medium';
}

interface SearchContextValue extends SearchState {
  setQuery: (query: string) => void;
  executeSearch: () => Promise<void>;
  syncEmbeddings: (scope: SyncScope) => Promise<void>;
  cancelSync: () => void;
  refreshHealth: () => Promise<void>;
  setSelectedModel: (model: 'small' | 'medium') => void;
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

    setSearchContext({
      getNoteById: (id: string) => {
        const note = state.notes.find(n => n.id === id);
        if (!note) return undefined;
        return { id: note.id, title: note.title, content: note.content };
      },
    });
  }, [state.notes]);

  useEffect(() => {
    healthTracker.getHealth().then(setEmbeddingHealth);
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
    if (!query.trim()) {
      setResults([]);
      setSearchMetadata(undefined);
      return;
    }

    setIsSearching(true);

    try {
      const response = await search({
        query,
        maxResults: 20,
        enableGraphExpansion: true,
        model: selectedModel,
      });

      setResults(response.results);
      setSearchMetadata(response.metadata);
    } catch (e) {
      console.error('Search failed:', e);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedModel]);

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
    setQuery,
    executeSearch,
    syncEmbeddings,
    cancelSync,
    refreshHealth,
    setSelectedModel,
  }), [
    query,
    results,
    isSearching,
    searchMetadata,
    embeddingHealth,
    syncStatus,
    syncProgress,
    selectedModel,
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
