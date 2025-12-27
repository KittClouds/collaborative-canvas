/**
 * Virtualized list atoms using splitAtom
 * Enables rendering 1000+ notes without performance degradation
 */
import { atom } from 'jotai';
import { splitAtom } from 'jotai/utils';
import { notesAtom, foldersAtom } from '@/atoms/notes';
import type { Note, Folder } from '@/types/noteTypes';

/**
 * Split notes array into individual note atoms
 * Each note gets its own atom - updating one doesn't affect others
 */
export const splitNotesAtom = splitAtom(notesAtom);

/**
 * Split folders array into individual folder atoms
 */
export const splitFoldersAtom = splitAtom(foldersAtom);

/**
 * Sorted notes for display (by updatedAt descending)
 */
export const sortedNotesAtom = atom((get) => {
    const notes = get(notesAtom);
    return [...notes].sort((a, b) => {
        const timeA = a.updatedAt ?? a.updated_at ?? 0;
        const timeB = b.updatedAt ?? b.updated_at ?? 0;
        return timeB - timeA; // Most recent first
    });
});

/**
 * Split sorted notes for virtualized list
 */
export const splitSortedNotesAtom = splitAtom(sortedNotesAtom);

/**
 * Notes grouped by folder
 */
export const notesByFolderMapAtom = atom((get) => {
    const notes = get(notesAtom);
    const grouped = new Map<string, Note[]>();

    for (const note of notes) {
        const folderId = note.parent_id ?? 'ROOT';
        const existing = grouped.get(folderId) ?? [];
        existing.push(note);
        grouped.set(folderId, existing);
    }

    return grouped;
});

/**
 * Flattened list of all folders + their notes
 * Perfect for virtualized tree view
 * 
 * Returns array of items: { type: 'folder' | 'note', data: Folder | Note, depth: number }
 */
export const flattenedTreeAtom = atom((get) => {
    const folders = get(foldersAtom);
    const notesByFolder = get(notesByFolderMapAtom);

    interface TreeItem {
        type: 'folder' | 'note';
        id: string;
        data: Folder | Note;
        depth: number;
    }

    const items: TreeItem[] = [];

    const traverse = (parentId: string | null, depth: number) => {
        // Get folders at this level
        const childFolders = folders.filter(f => f.parent_id === parentId);

        for (const folder of childFolders) {
            // Add folder
            items.push({
                type: 'folder',
                id: folder.id,
                data: folder,
                depth,
            });

            // Add notes in this folder
            const notes = notesByFolder.get(folder.id) ?? [];
            for (const note of notes) {
                items.push({
                    type: 'note',
                    id: note.id,
                    data: note,
                    depth: depth + 1,
                });
            }

            // Recurse into child folders
            traverse(folder.id, depth + 1);
        }
    };

    // Start from root
    traverse(null, 0);

    // Add root-level notes
    const rootNotes = notesByFolder.get('ROOT') ?? [];
    for (const note of rootNotes) {
        items.push({
            type: 'note',
            id: note.id,
            data: note,
            depth: 0,
        });
    }

    return items;
});

/**
 * Split flattened tree for virtualized rendering
 */
export const splitFlattenedTreeAtom = splitAtom(flattenedTreeAtom);
