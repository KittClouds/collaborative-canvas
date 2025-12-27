/**
 * Autosave atoms with debouncing
 * Prevents excessive database writes while typing
 */
import { atom } from 'jotai';
import { atomWithDebounce } from '@/lib/atoms/utils';
import { selectedNoteIdAtom, isSavingAtom } from '@/atoms/notes';
import { updateNoteContentAtom } from '@/atoms/notes-async';

/**
 * Current note content being edited
 * Updates immediately as user types (no debounce)
 */
export const noteContentAtom = atom<string>('');

/**
 * Debounced version of note content
 * Only updates 500ms after user stops typing
 */
export const debouncedNoteContentAtom = atomWithDebounce(noteContentAtom, 500);

/**
 * Tracks if content has unsaved changes
 */
export const hasUnsavedChangesAtom = atom((get) => {
    const current = get(noteContentAtom);
    const debounced = get(debouncedNoteContentAtom);
    return current !== debounced;
});

/**
 * Autosave trigger atom
 * Automatically saves debounced content to database
 * 
 * Usage: Subscribe to this atom in editor component
 */
export const autosaveAtom = atom(
    null,
    async (get, set) => {
        const noteId = get(selectedNoteIdAtom);
        const content = get(debouncedNoteContentAtom);

        if (!noteId) {
            // Intentionally silent or debug log only
            // console.warn('[Autosave] No note selected, skipping save');
            return;
        }

        // Only save if we have content? Empty content is valid.
        // However, if the note changed, debounced content might be stale for a moment?
        // No, atomWithDebounce handles the timing.

        console.log('[Autosave] Saving note:', noteId);

        try {
            await set(updateNoteContentAtom, { id: noteId, content });
            console.log('[Autosave] ✅ Saved successfully');
        } catch (error) {
            console.error('[Autosave] ❌ Save failed:', error);
            // Don't throw - allow retry on next debounce
        }
    }
);

/**
 * Manual save atom (Cmd+S / Ctrl+S)
 * Immediately saves current content, bypassing debounce
 */
export const manualSaveAtom = atom(
    null,
    async (get, set) => {
        const noteId = get(selectedNoteIdAtom);
        const content = get(noteContentAtom); // Use immediate content, not debounced

        if (!noteId) return;

        console.log('[Manual Save] Saving note:', noteId);

        // UI indicator
        // Note: isSavingAtom is also updated by updateNoteContentAtom, 
        // but setting it here gives immediate feedback
        // set(isSavingAtom, true); // updateNoteContentAtom does this too

        try {
            await set(updateNoteContentAtom, { id: noteId, content });

            // Update debounced atom to match (prevent duplicate save)
            set(debouncedNoteContentAtom, content);

            console.log('[Manual Save] ✅ Saved successfully');
        } catch (error) {
            console.error('[Manual Save] ❌ Save failed:', error);
            throw error;
        }
        // finally block in updateNoteContentAtom handles isSavingAtom = false
    }
);

/**
 * Initialize content when note is selected
 */
export const initNoteContentAtom = atom(
    null,
    (get, set, content: string) => {
        set(noteContentAtom, content);
        set(debouncedNoteContentAtom, content); // Initialize both to prevent false "unsaved"
    }
);
