import { atom } from 'jotai';
import { atomFamily } from '@/atoms/utils/atomFamily';
import type { Note } from '@/types/noteTypes';

// Base storage (internal only) - map of Note ID to Note object
const _notesStorageAtom = atom<Map<string, Note>>(new Map());

/**
 * Per-note atom family.
 * Subscribe to specific note updates without re-rendering on every list change.
 */
export const noteAtomFamily = atomFamily((noteId: string) =>
    atom(
        (get) => get(_notesStorageAtom).get(noteId) ?? null,
        (get, set, update: Note | null) => {
            const storage = new Map(get(_notesStorageAtom));
            if (update === null) {
                storage.delete(noteId);
            } else {
                storage.set(noteId, update);
            }
            set(_notesStorageAtom, storage);
        }
    )
);

/**
 * List of all note IDs (lightweight).
 * Useful for virtualized lists.
 */
export const noteIdsAtom = atom((get) =>
    Array.from(get(_notesStorageAtom).keys())
);

/**
 * Full notes array (only when absolutely needed).
 * Prefer using noteIdsAtom + noteAtomFamily when possible.
 */
export const allNotesAtom = atom((get) =>
    Array.from(get(_notesStorageAtom).values())
);

/**
 * Bulk update notes in the atomic store.
 * Merges new/updated notes into the existing map.
 */
export const bulkUpdateNotesAtom = atom(
    null,
    (get, set, notes: Note[]) => {
        const storage = new Map(get(_notesStorageAtom));
        notes.forEach(note => storage.set(note.id, note));
        set(_notesStorageAtom, storage);
    }
);
