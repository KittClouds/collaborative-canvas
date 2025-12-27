/**
 * Search-related atoms
 * Replaces SearchContext functionality
 */
import { atom } from 'jotai';
import { atomWithRefresh } from 'jotai/utils';
import { notesAtom } from './notes';
import { searchService } from '@/lib/db/search';
import { syncService, healthTracker } from '@/lib/embeddings';
import type { SearchResult } from '@/lib/db/search/types';
import type { SyncScope, SyncProgress, SyncStatus } from '@/lib/embeddings/syncService';
import type { EmbeddingHealth } from '@/lib/embeddings/healthTracker';

// ============================================
// SEARCH CONFIGURATION ATOMS
// ============================================

/**
 * Current search query string
 */
export const searchQueryAtom = atom<string>('');

/**
 * Search mode: semantic (vector only) or hybrid (vector + graph + lexical)
 */
export const searchModeAtom = atom<'semantic' | 'hybrid'>('semantic');

/**
 * Selected embedding model
 */
export const selectedModelAtom = atom<'small' | 'medium'>('small');

/**
 * Hybrid search weight configuration
 */
export const hybridWeightsAtom = atom({
    vector: 0.4,
    graph: 0.4,
    lexical: 0.2,
});

// ============================================
// SEARCH EXECUTION ATOMS
// ============================================

/**
 * Async atom that executes search based on query and config
 * Returns empty array if query is empty
 */
export const searchResultsAtom = atom(async (get) => {
    const query = get(searchQueryAtom);

    // Don't search if query is empty
    if (!query.trim()) {
        return [];
    }

    const mode = get(searchModeAtom);
    const model = get(selectedModelAtom);
    const weights = get(hybridWeightsAtom);

    const startTime = performance.now();

    try {
        const results = await searchService.search({
            query,
            k: 20,
            mode,
            semanticOptions: {
                model,
                threshold: 0.5,
            },
            ...(mode === 'hybrid' && {
                hybridOptions: {
                    vectorWeight: weights.vector,
                    graphWeight: weights.graph,
                    lexicalWeight: weights.lexical,
                    maxHops: 2,
                    boostConnected: true,
                },
            }),
        });

        const searchTime = Math.round(performance.now() - startTime);
        console.log(`[Search] Found ${results.length} results in ${searchTime}ms`);

        return results as SearchResult[];
    } catch (error) {
        console.error('[Search] Search failed:', error);
        return [];
    }
});

/**
 * Search metadata (derived from results)
 */
export const searchMetadataAtom = atom((get) => {
    const results = get(searchResultsAtom);
    const mode = get(searchModeAtom);

    // If results is a Promise, return default metadata
    if (results instanceof Promise) {
        return {
            totalResults: 0,
            searchTime: 0,
            graphExpanded: mode === 'hybrid',
        };
    }

    return {
        totalResults: (results as SearchResult[]).length,
        searchTime: 0, // Calculated in searchResultsAtom logic if tracked separately
        graphExpanded: mode === 'hybrid',
    };
});

/**
 * Loading state for search
 */
export const isSearchingAtom = atom((get) => {
    const results = get(searchResultsAtom);
    return results instanceof Promise;
});

// ============================================
// EMBEDDING SYNC ATOMS
// ============================================

/**
 * Embedding health metrics
 * Refreshable atom - call refresh() to update
 */
export const embeddingHealthAtom = atomWithRefresh(async (get) => {
    const notes = get(notesAtom);

    try {
        // Set notes provider for health tracker
        healthTracker.setNotesProvider(() =>
            notes.map(n => ({ id: n.id, folderId: n.folderId }))
        );

        const health = await healthTracker.getHealth();
        return health;
    } catch (error) {
        console.warn('[Search] Failed to get embedding health:', error);

        // Return default health on error
        return {
            embeddingsCount: 0,
            totalNotes: notes.length,
            syncedNotes: 0,
        } as EmbeddingHealth;
    }
});

import { type WritableAtom } from 'jotai';

const _syncStatusAtom = atom<SyncStatus>({ isRunning: false });
const _syncProgressAtom = atom<SyncProgress | undefined>(undefined);

/**
 * Sync status
 */
export const syncStatusAtom: WritableAtom<SyncStatus, [SyncStatus], void> = atom(
    (get) => get(_syncStatusAtom),
    (_get, set, update: SyncStatus) => set(_syncStatusAtom as any, update)
);

/**
 * Sync progress
 */
export const syncProgressAtom: WritableAtom<SyncProgress | undefined, [SyncProgress | undefined], void> = atom(
    (get) => get(_syncProgressAtom),
    (_get, set, update: SyncProgress | undefined) => set(_syncProgressAtom as any, update)
);

// ============================================
// SYNC ACTION ATOM
// ============================================

/**
 * Write-only atom to trigger embedding sync
 * Usage: await set(syncEmbeddingsAtom, 'all')
 */
export const syncEmbeddingsAtom = atom(
    null,
    async (get, set, scope: SyncScope) => {
        const notes = get(notesAtom);
        const model = get(selectedModelAtom);

        console.log(`[Search] Starting ${scope} sync with ${model} model`);

        // Set notes provider for sync service
        syncService.setNotesProvider(() =>
            notes.map(n => ({
                id: n.id,
                title: n.title,
                content: n.content,
                folderId: n.folderId,
            }))
        );

        // Update status
        set(syncStatusAtom, { isRunning: true, scope });

        // Subscribe to progress updates
        const unsubscribe = syncService.onProgress((progress) => {
            set(syncProgressAtom, progress);

            // Refresh health on completion
            if (progress.phase === 'complete') {
                // Trigger health refresh
                set(embeddingHealthAtom as any);
            }
        });

        try {
            await syncService.sync(scope, { model });
            console.log(`[Search] ✅ Sync completed`);
        } catch (error) {
            console.error(`[Search] ❌ Sync failed:`, error);
            throw error;
        } finally {
            set(syncStatusAtom, { isRunning: false });
            unsubscribe();
        }
    }
);

/**
 * Cancel sync action
 */
export const cancelSyncAtom = atom(null, () => {
    syncService.cancel();
    console.log('[Search] Sync cancelled');
});

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize search services with notes provider
 * Call this once on app startup
 */
export const initSearchServicesAtom = atom(null, (get, set) => {
    const notes = get(notesAtom);

    // Set notes providers
    syncService.setNotesProvider(() =>
        notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            folderId: n.folderId,
        }))
    );

    healthTracker.setNotesProvider(() =>
        notes.map(n => ({
            id: n.id,
            folderId: n.folderId,
        }))
    );

    console.log('[Search] Services initialized');
});
