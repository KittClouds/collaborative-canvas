import { atom } from 'jotai';
import { foldersAtom, notesAtom } from '@/atoms/notes';
import { atomWithDebounce } from '@/lib/atom-utils';
import type { Folder, Note, FolderWithChildren } from '@/types/noteTypes';

/**
 * Helper to build the folder tree from flat lists.
 * This is the expensive operation we want to debounce.
 */
function buildFolderTree(folders: Folder[], notes: Note[]): FolderWithChildren[] {
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
}

/**
 * Debounced folder tree atom.
 * Waits 50ms after the last change before recomputing the tree.
 * This prevents UI jank during rapid updates (e.g. typing, syncing).
 */
export const debouncedFolderTreeAtom = atomWithDebounce(
    (get) => {
        const folders = get(foldersAtom);
        const notes = get(notesAtom);

        // Performance tracking
        const startTime = performance.now();

        const tree = buildFolderTree(folders, notes);

        const duration = performance.now() - startTime;
        if (duration > 10) {
            console.warn(`[FolderTree] Rebuilt in ${duration.toFixed(2)}ms`);
        }

        return tree;
    },
    50 // 50ms debounce
);
