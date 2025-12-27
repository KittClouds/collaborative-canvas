import { atom, type WritableAtom } from 'jotai';
import type { Note, Folder, FolderWithChildren } from '@/types/noteTypes';

// ============================================
// BASE ATOMS (Internal State)
// ============================================

const _notesAtom = atom<Note[]>([]);
const _foldersAtom = atom<Folder[]>([]);
const _selectedNoteIdAtom = atom<string | null>(null);
const _isSavingAtom = atom<boolean>(false);
const _lastSavedAtom = atom<Date | null>(null);

// ============================================
// EXPORTED ATOMS (Strictly Writable)
// ============================================

export const notesAtom: WritableAtom<Note[], [Note[]], void> = atom(
    (get) => get(_notesAtom),
    (_get, set, update: Note[]) => set(_notesAtom as any, update)
);

export const foldersAtom: WritableAtom<Folder[], [Folder[]], void> = atom(
    (get) => get(_foldersAtom),
    (_get, set, update: Folder[]) => set(_foldersAtom as any, update)
);

export const selectedNoteIdAtom: WritableAtom<string | null, [string | null], void> = atom(
    (get) => get(_selectedNoteIdAtom),
    (_get, set, update: string | null) => set(_selectedNoteIdAtom as any, update)
);


export const isSavingAtom: WritableAtom<boolean, [boolean], void> = atom(
    (get) => get(_isSavingAtom),
    (_get, set, update: boolean) => set(_isSavingAtom as any, update)
);

export const lastSavedAtom: WritableAtom<Date | null, [Date | null], void> = atom(
    (get) => get(_lastSavedAtom),
    (_get, set, update: Date | null) => set(_lastSavedAtom as any, update)
);

// ============================================
// DERIVED ATOMS (Computed State)
// ============================================

/**
 * Map of note ID -> Note for O(1) lookups
 */
export const notesMapAtom = atom((get) => {
    const notes = get(notesAtom);
    return new Map(notes.map(n => [n.id, n]));
});

/**
 * Currently selected note object
 */
export const selectedNoteAtom = atom((get) => {
    const selectedId = get(selectedNoteIdAtom);
    if (!selectedId) return null;

    const notesMap = get(notesMapAtom);
    return notesMap.get(selectedId) ?? null;
});

/**
 * All favorite notes (favorite = 1 in SQLite)
 */
export const favoriteNotesAtom = atom((get) => {
    const notes = get(notesAtom);
    return notes.filter(n => Number(n.favorite) === 1);
});

/**
 * Notes without a parent folder (root-level notes)
 */
export const globalNotesAtom = atom((get) => {
    const notes = get(notesAtom);
    return notes.filter(n => !n.parent_id);
});

/**
 * Hierarchical folder tree with nested children and notes
 */
export const folderTreeAtom = atom((get) => {
    const folders = get(foldersAtom);
    const notes = get(notesAtom);

    const buildTree = (parentId: string | null): FolderWithChildren[] => {
        return folders
            .filter(f => f.parent_id === parentId)
            .map(folder => ({
                ...folder,
                children: buildTree(folder.id),
                notes: notes.filter(n => n.parent_id === folder.id)
            }));
    };

    return buildTree(null);
});

// ============================================
// TYPE EXPORTS
// ============================================

