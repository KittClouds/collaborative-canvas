/**
 * Jotai-powered search hook
 * Drop-in replacement for useSearch() from SearchContext
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { loadable } from 'jotai/utils';
import {
    searchQueryAtom,
    searchModeAtom,
    selectedModelAtom,
    hybridWeightsAtom,
    searchResultsAtom,
    searchMetadataAtom,
    isSearchingAtom,
    embeddingHealthAtom,
    syncStatusAtom,
    syncProgressAtom,
    syncEmbeddingsAtom,
    cancelSyncAtom,
} from '@/atoms/search';
import type { SyncScope } from '@/lib/embeddings/syncService';

/**
 * Hook that mirrors useSearch() from SearchContext
 */
export function useJotaiSearch() {
    // Config atoms
    const [query, setQuery] = useAtom(searchQueryAtom);
    const [searchMode, setSearchMode] = useAtom(searchModeAtom);
    const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom);
    const [hybridWeights, setHybridWeights] = useAtom(hybridWeightsAtom);

    // Results (use loadable to handle async)
    const resultsLoadable = useAtomValue(loadable(searchResultsAtom));
    const metadata = useAtomValue(searchMetadataAtom);
    const isSearching = useAtomValue(isSearchingAtom);

    // Sync state
    const healthLoadable = useAtomValue(loadable(embeddingHealthAtom));
    const syncStatus = useAtomValue(syncStatusAtom);
    const syncProgress = useAtomValue(syncProgressAtom);

    // Actions
    const triggerSync = useSetAtom(syncEmbeddingsAtom);
    const cancelSync = useSetAtom(cancelSyncAtom);

    // Extract results from loadable
    const results = resultsLoadable.state === 'hasData' ? resultsLoadable.data : [];
    const embeddingHealth = healthLoadable.state === 'hasData'
        ? healthLoadable.data
        : { embeddingsCount: 0, totalNotes: 0, syncedNotes: 0 };

    /**
     * Execute search (just update query - atom handles execution)
     */
    const executeSearch = async () => {
        // Search executes automatically when query changes
        // This is just for API compatibility
        console.log('[Search] Executing search for:', query);
    };

    /**
     * Sync embeddings
     */
    const syncEmbeddings = async (scope: SyncScope) => {
        await triggerSync(scope);
    };

    /**
     * Refresh embedding health
     */
    const refreshHealth = async () => {
        // Trigger refresh by reading the atom
        // atomWithRefresh provides this automatically
    };

    return {
        // State
        query,
        results,
        isSearching,
        searchMetadata: metadata,
        embeddingHealth,
        syncStatus,
        syncProgress,
        selectedModel,
        searchMode,
        hybridWeights,

        // Actions
        setQuery,
        executeSearch,
        syncEmbeddings,
        cancelSync: () => cancelSync(),
        refreshHealth,
        setSelectedModel,
        setSearchMode,
        setHybridWeights,
    };
}

/**
 * Granular hooks for specific use cases
 */

export function useSearchQuery() {
    return useAtom(searchQueryAtom);
}

export function useSearchResults() {
    const loadableResults = useAtomValue(loadable(searchResultsAtom));
    return loadableResults.state === 'hasData' ? loadableResults.data : [];
}

export function useEmbeddingHealth() {
    const loadableHealth = useAtomValue(loadable(embeddingHealthAtom));
    return loadableHealth.state === 'hasData'
        ? loadableHealth.data
        : { embeddingsCount: 0, totalNotes: 0, syncedNotes: 0 };
}
