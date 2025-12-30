/**
 * Hook for entity-aware file creation
 * 
 * Wraps createNoteAtom and createFolderAtom to automatically inject
 * the current narrative focus context (entity + date) into new files.
 */

import { useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { createNoteAtom, createFolderAtom } from '@/atoms';
import { narrativeFocusAtom, hasEntityFocusAtom } from '@/atoms/narrative-focus';
import { calendarViewStateAtom } from '@/atoms/calendar';

/**
 * Returns wrapped creation functions that auto-inject narrative context
 */
export function useNarrativeAwareCreation() {
    const createNote = useSetAtom(createNoteAtom);
    const createFolder = useSetAtom(createFolderAtom);

    const narrativeFocus = useAtomValue(narrativeFocusAtom);
    const hasEntityFocus = useAtomValue(hasEntityFocusAtom);
    const viewState = useAtomValue(calendarViewStateAtom);

    /**
     * Create a note with automatic entity ownership and fantasy date
     */
    const createNarrativeNote = useCallback(async (params: {
        folderId?: string;
        title?: string;
        sourceNoteId?: string;
        // Allow override of auto-injection
        skipNarrativeContext?: boolean;
    }) => {
        const { skipNarrativeContext, ...baseParams } = params;

        // Inject narrative context if active and not skipped
        if (!skipNarrativeContext && hasEntityFocus) {
            return createNote({
                ...baseParams,
                ownerEntityId: narrativeFocus.entityId || undefined,
                fantasyDate: viewState.viewDate ? {
                    year: viewState.viewDate.year,
                    monthIndex: viewState.viewDate.monthIndex,
                    dayIndex: viewState.viewDate.dayIndex,
                    eraId: viewState.viewDate.eraId,
                } : undefined,
            });
        }

        return createNote(baseParams);
    }, [createNote, hasEntityFocus, narrativeFocus.entityId, viewState.viewDate]);

    /**
     * Create a folder with automatic entity ownership and fantasy date
     */
    const createNarrativeFolder = useCallback(async (params: {
        name: string;
        parentId?: string;
        entityKind?: string;
        entitySubtype?: string;
        isTypedRoot?: boolean;
        isSubtypeRoot?: boolean;
        color?: string;
        fantasy_date?: { year: number; month: number; day: number };
        // Allow override of auto-injection
        skipNarrativeContext?: boolean;
    }) => {
        const { skipNarrativeContext, ...baseParams } = params;

        // Inject narrative context if active and not skipped
        if (!skipNarrativeContext && hasEntityFocus) {
            // Use provided fantasy_date or derive from viewState
            const fantasyDate = baseParams.fantasy_date || (viewState.viewDate ? {
                year: viewState.viewDate.year,
                month: viewState.viewDate.monthIndex,
                day: viewState.viewDate.dayIndex,
            } : undefined);

            return createFolder({
                ...baseParams,
                fantasy_date: fantasyDate,
                ownerEntityId: narrativeFocus.entityId || undefined,
            });
        }

        return createFolder(baseParams);
    }, [createFolder, hasEntityFocus, narrativeFocus.entityId, viewState.viewDate]);

    return {
        createNarrativeNote,
        createNarrativeFolder,
        // Direct access if needed
        createNote,
        createFolder,
        // Current context info
        hasEntityFocus,
        focusedEntityId: narrativeFocus.entityId,
        focusedEntityLabel: narrativeFocus.entityLabel,
        currentFantasyDate: viewState.viewDate,
    };
}
