/**
 * Optimized folder tree computation with memoization
 * Target: <10ms even with 1000+ notes/folders
 */
import { atom } from 'jotai';
import { foldersAtom, notesAtom } from '@/atoms/notes';
import type { Folder, Note, FolderWithChildren } from '@/types/noteTypes';

/**
 * Cache for folder tree nodes
 * Key: `${folderId}-${updatedAt}` (invalidates when folder changes)
 * Value: Computed FolderWithChildren node
 */
const folderTreeCache = new Map<string, FolderWithChildren>();

/**
 * Tracks last known state to detect changes
 */
let lastFoldersSnapshot = new Map<string, Folder>();
let lastNotesSnapshot = new Map<string, string>(); // noteId -> parentId

/**
 * Optimized folder tree atom
 * Only recomputes changed branches, not entire tree
 */
export const optimizedFolderTreeAtom = atom((get) => {
    const folders = get(foldersAtom);
    const notes = get(notesAtom);

    const startTime = performance.now();

    // Build snapshots for change detection
    const currentFoldersSnapshot = new Map(folders.map(f => [f.id, f]));
    const currentNotesSnapshot = new Map(
        notes.map(n => [n.id, n.parent_id ?? 'ROOT'])
    );

    // Detect changed folders
    const changedFolderIds = new Set<string>();

    // Check for new/updated folders
    for (const [id, folder] of currentFoldersSnapshot) {
        const previous = lastFoldersSnapshot.get(id);
        if (!previous || previous.updatedAt !== folder.updatedAt) {
            changedFolderIds.add(id);
            // Also invalidate parent chain
            let currentFolder = folder;
            while (currentFolder.parent_id) {
                changedFolderIds.add(currentFolder.parent_id);
                const parent = currentFoldersSnapshot.get(currentFolder.parent_id);
                if (!parent) break;
                currentFolder = parent;
            }
        }
    }

    // Check for deleted folders
    let folderDeleted = false;
    for (const [id] of lastFoldersSnapshot) {
        if (!currentFoldersSnapshot.has(id)) {
            changedFolderIds.add(id);
            folderDeleted = true;

            // Also invalidate the deleted folder's parent so its children array updates
            const deletedFolder = lastFoldersSnapshot.get(id);
            if (deletedFolder?.parent_id) {
                changedFolderIds.add(deletedFolder.parent_id);
            }
        }
    }

    // Check for note parent changes
    for (const [noteId, parentId] of currentNotesSnapshot) {
        const previousParentId = lastNotesSnapshot.get(noteId);
        if (previousParentId !== parentId) {
            // Invalidate both old and new parent folders
            if (previousParentId && previousParentId !== 'ROOT') {
                changedFolderIds.add(previousParentId);
            }
            if (parentId !== 'ROOT') {
                changedFolderIds.add(parentId);
            }
        }
    }

    // Invalidate cache for changed folders
    // When a folder is deleted, clear entire cache to ensure root-level folders are rebuilt
    if (folderDeleted) {
        folderTreeCache.clear();
    } else {
        for (const folderId of changedFolderIds) {
            // Remove all cache entries for this folder
            for (const key of folderTreeCache.keys()) {
                if (key.startsWith(`${folderId}-`)) {
                    folderTreeCache.delete(key);
                }
            }
        }
    }

    // Build tree recursively with caching
    const buildTree = (parentId: string | null): FolderWithChildren[] => {
        return folders
            .filter(f => f.parent_id === parentId)
            .map(folder => {
                const cacheKey = `${folder.id}-${folder.updatedAt}`;

                // Check cache first
                if (folderTreeCache.has(cacheKey) && !changedFolderIds.has(folder.id)) {
                    return folderTreeCache.get(cacheKey)!;
                }

                // Compute node
                const node: FolderWithChildren = {
                    ...folder,
                    children: buildTree(folder.id), // Recursive
                    notes: notes.filter(n => n.parent_id === folder.id),
                };

                // Cache result
                folderTreeCache.set(cacheKey, node);

                return node;
            });
    };

    const tree = buildTree(null);

    // Update snapshots for next computation
    lastFoldersSnapshot = currentFoldersSnapshot;
    lastNotesSnapshot = currentNotesSnapshot;

    const duration = performance.now() - startTime;
    if (duration > 5) { // Log only significant computations
        console.log(`[FolderTree] Computed in ${duration.toFixed(2)}ms (cached: ${folderTreeCache.size} nodes)`);
    }

    return tree;
});

/**
 * Get folder by ID (O(1) lookup)
 */
export const foldersByIdAtom = atom((get) => {
    const folders = get(foldersAtom);
    return new Map(folders.map(f => [f.id, f]));
});

/**
 * Get notes by folder ID (O(1) lookup)
 */
export const notesByFolderAtom = atom((get) => {
    const notes = get(notesAtom);
    const byFolder = new Map<string, Note[]>();

    for (const note of notes) {
        const folderId = note.parent_id ?? 'ROOT';
        const existing = byFolder.get(folderId) ?? [];
        existing.push(note);
        byFolder.set(folderId, existing);
    }

    return byFolder;
});

/**
 * Get folder path (breadcrumb trail)
 * Returns array from root to target folder
 */
export const folderPathAtom = atom((get) => (folderId: string): Folder[] => {
    const foldersById = get(foldersByIdAtom);
    const path: Folder[] = [];

    let current = foldersById.get(folderId);
    while (current) {
        path.unshift(current); // Add to front
        // Use type assertion for string indexing if necessary or stick to defined fields
        // Folder interface has parent_id
        current = current.parent_id ? foldersById.get(current.parent_id) : undefined;
    }

    return path;
});
