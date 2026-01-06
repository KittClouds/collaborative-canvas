/**
 * useWikiData Hook
 * Derives Wiki-specific data from Jotai notes state.
 */
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { notesAtom, foldersAtom } from '@/atoms';
import type { Note } from '@/types/noteTypes';
import { WIKI_CATEGORIES, type WikiCategory } from '../types/wikiTypes';

export interface WikiDataResult {
    /** All entity notes */
    entities: Note[];
    /** Recently updated notes (last 10) */
    recentlyUpdated: Note[];
    /** Get notes by entity kind */
    getByKind: (kind: string) => Note[];
    /** Get category stats */
    getCategoryStats: () => Array<{ category: WikiCategory; count: number }>;
    /** Get a single entity by ID */
    getEntityById: (id: string) => Note | undefined;
}

export function useWikiData(): WikiDataResult {
    const notes = useAtomValue(notesAtom);
    const folders = useAtomValue(foldersAtom);

    // Filter to only entity notes
    const entities = useMemo(() => {
        return notes.filter(n => n.isEntity || n.is_entity);
    }, [notes]);

    // Recently updated (sorted by updated_at descending, take 10)
    const recentlyUpdated = useMemo(() => {
        return [...entities]
            .sort((a, b) => (b.updated_at || b.updatedAt || 0) - (a.updated_at || a.updatedAt || 0))
            .slice(0, 10);
    }, [entities]);

    // Get notes by entity kind
    const getByKind = useMemo(() => {
        return (kind: string): Note[] => {
            return entities.filter(n =>
                (n.entityKind || n.entity_kind)?.toUpperCase() === kind.toUpperCase()
            );
        };
    }, [entities]);

    // Get category stats
    const getCategoryStats = useMemo(() => {
        return () => {
            return WIKI_CATEGORIES.map(category => ({
                category,
                count: entities.filter(n =>
                    (n.entityKind || n.entity_kind)?.toUpperCase() === category.entityKind.toUpperCase()
                ).length,
            }));
        };
    }, [entities]);

    // Get entity by ID
    const getEntityById = useMemo(() => {
        return (id: string): Note | undefined => {
            return notes.find(n => n.id === id);
        };
    }, [notes]);

    return {
        entities,
        recentlyUpdated,
        getByKind,
        getCategoryStats,
        getEntityById,
    };
}
