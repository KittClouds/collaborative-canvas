import type { Folder, Note, FolderWithChildren } from '@/types/noteTypes';

/**
 * Web Worker for offloading expensive folder tree computations.
 * Receives flat lists of folders and notes, returns a nested tree.
 */
self.onmessage = (e: MessageEvent<{ folders: Folder[]; notes: Note[] }>) => {
    const { folders, notes } = e.data;

    const buildTree = (parentId: string | null): FolderWithChildren[] => {
        return folders
            .filter(f => f.parent_id === parentId)
            .map(folder => ({
                ...folder,
                children: buildTree(folder.id),
                notes: notes.filter(n => n.parent_id === folder.id),
            }));
    };

    const tree = buildTree(null);
    self.postMessage(tree);
};
