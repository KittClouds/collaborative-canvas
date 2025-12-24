/**
 * useEntityIntelligence - Hook for Phase 5 Cross-Document Intelligence
 * 
 * Orchestrates:
 * - GlobalEntityLinker (Deduplication)
 * - EntityTransferEngine (Suggestions)
 * - FrequencyBooster (Ranking)
 * - CrossDocumentSearch (Global Query)
 * - BacklinkSync (Bidirectional Linking)
 */

import { useMemo, useCallback } from 'react';
import { useNotes } from '@/contexts/NotesContext';
import { globalEntityLinker } from '@/lib/entities/scanner/GlobalEntityLinker';
import { EntityTransferEngine } from '@/lib/entities/scanner/EntityTransferEngine';
import { frequencyBooster } from '@/lib/entities/scanner/FrequencyBooster';
import { CrossDocumentSearch } from '@/lib/entities/scanner/CrossDocumentSearch';
import { BacklinkSync } from '@/lib/entities/scanner/BacklinkSync';
import { entityRegistry } from '@/lib/entities/entity-registry';

export function useEntityIntelligence() {
    const { state } = useNotes();
    const { notes } = state;

    // Memoize engines to avoid re-instantiation, but update them when notes change
    const transferEngine = useMemo(() => new EntityTransferEngine(notes), [notes]);
    const searchEngine = useMemo(() => new CrossDocumentSearch(notes), [notes]);
    const backlinkSync = useMemo(() => new BacklinkSync(notes), [notes]);

    /**
     * Get suggestions for the current note
     */
    const getSuggestionsForNote = useCallback((noteId: string) => {
        const rawSuggestions = transferEngine.suggestEntitiesForNote(noteId);

        // Boost suggestions using user interaction frequency
        return rawSuggestions.map(s => ({
            ...s,
            confidence: frequencyBooster.boostConfidence(s.entity.id, s.confidence)
        })).sort((a, b) => b.confidence - a.confidence);
    }, [transferEngine]);

    /**
     * Search for an entity or text across all notes
     */
    const globalSearch = useCallback((query: string) => {
        // Try entity search first
        const entityResults = searchEngine.searchByEntity(query);
        if (entityResults.length > 0) return entityResults;

        // Fallback to text search
        return searchEngine.searchByText(query);
    }, [searchEngine]);

    /**
     * Get backlinks and outlinks for a note
     */
    const getNoteLinks = useCallback((noteId: string) => {
        return {
            incoming: backlinkSync.computeIncomingLinks(noteId),
            outgoing: backlinkSync.computeOutgoingLinks(noteId)
        };
    }, [backlinkSync]);

    /**
     * Detect duplicates in the registry
     */
    const detectDuplicates = useCallback(async () => {
        return globalEntityLinker.detectDuplicates();
    }, []);

    /**
     * Merge two entities
     */
    const mergeEntities = useCallback((canonicalId: string, duplicateId: string) => {
        const success = globalEntityLinker.mergeEntities(canonicalId, duplicateId);
        if (success) {
            frequencyBooster.recordInteraction(canonicalId);
        }
        return success;
    }, []);

    return {
        getSuggestionsForNote,
        globalSearch,
        getNoteLinks,
        detectDuplicates,
        mergeEntities,
        recordInteraction: frequencyBooster.recordInteraction,
        stats: {
            registry: entityRegistry.getGlobalStats(),
        }
    };
}
