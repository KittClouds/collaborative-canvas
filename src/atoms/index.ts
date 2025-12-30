/**
 * Unified atom exports
 * Import atoms from this file in components/hooks
 */

// Base atoms
export {
    notesAtom,
    foldersAtom,
    selectedNoteIdAtom,
    isSavingAtom,
    lastSavedAtom,
} from './notes';

// Derived atoms
export {
    notesMapAtom,
    selectedNoteAtom,
    favoriteNotesAtom,
    globalNotesAtom,
    folderTreeAtom,
} from './notes';

// Async atoms
export {
    dbInitAtom,
    hydrateNotesAtom,
    updateNoteContentAtom,
    updateNoteAtom,
    createNoteAtom,
    deleteNoteAtom,
    createFolderAtom,
    updateFolderAtom,
    deleteFolderAtom,
} from './notes-async';

// Search atoms
export {
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
    initSearchServicesAtom,
} from './search';

// Autosave atoms
export {
    noteContentAtom,
    debouncedNoteContentAtom,
    hasUnsavedChangesAtom,
    autosaveAtom,
    manualSaveAtom,
    initNoteContentAtom,
} from './notes-autosave';

// Optimized atoms
export {
    optimizedFolderTreeAtom,
    foldersByIdAtom,
    notesByFolderAtom,
    folderPathAtom,
} from './notes-optimized';

// Types
export type { FolderWithChildren } from '@/types/noteTypes';

// Calendar atoms
export {
    calendarAtom,
    calendarEventsAtom,
    calendarPeriodsAtom,
    calendarViewStateAtom,
    isCalendarHydratedAtom,
    isCalendarLoadingAtom,
    hydrateCalendarAtom,
    saveCalendarAtom,
    createEventAtom,
    updateEventAtom,
    deleteEventAtom,
    createPeriodAtom,
    updatePeriodAtom,
    deletePeriodAtom,
    updateViewStateAtom,
    setSetupModeAtom,
} from './calendar';
