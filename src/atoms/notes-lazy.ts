import { atom } from 'jotai';
import { atomFamily } from '@/atoms/utils/atomFamily';
import { foldersAtom, notesAtom } from '@/atoms/notes';

/**
 * Lazy folder children family.
 * Computes children for a specific folder only when accessed.
 * 
 * Usage:
 * const { subfolders, notes } = useAtomValue(folderChildrenFamily(folderId))
 */
export const folderChildrenFamily = atomFamily((folderId: string | null) =>
    atom((get) => {
        const folders = get(foldersAtom);
        const notes = get(notesAtom);

        return {
            subfolders: folders.filter(f => f.parent_id === folderId),
            notes: notes.filter(n => n.parent_id === folderId),
        };
    })
);
