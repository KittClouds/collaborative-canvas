import { ArboristNode, ArboristTree } from './types';
import type { Folder, Note, FolderWithChildren } from '@/contexts/NotesContext';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';

const DEFAULT_COLORS = [
    "#10b981", "#3b82f6", "#8b5cf6", "#ec4899",
    "#f59e0b", "#ef4444", "#14b8a6", "#6366f1"
];

/**
 * Recursively transform FolderWithChildren tree to Arborist-compatible format
 * Preserves color inheritance and entity semantics
 */
function transformFolderToNode(
    folder: FolderWithChildren,
    depth: number = 0,
    parentColor?: string
): ArboristNode {
    // Color resolution: folder.color → parentColor → default by depth
    const effectiveColor = folder.color
        || parentColor
        || (folder.entityKind ? ENTITY_COLORS[folder.entityKind] : undefined)
        || DEFAULT_COLORS[depth % DEFAULT_COLORS.length];

    // Transform child notes to leaf nodes
    const noteNodes: ArboristNode[] = folder.notes.map(note => ({
        id: note.id,
        name: note.title,
        type: 'note' as const,
        isEntity: note.isEntity,
        entityKind: note.entityKind,
        entitySubtype: note.entitySubtype,
        entityLabel: note.entityLabel,
        favorite: note.favorite,
        isPinned: note.isPinned,
        folderId: note.folderId,
        inheritedKind: folder.entityKind || folder.inheritedKind,
        inheritedSubtype: folder.entitySubtype || folder.inheritedSubtype,
        effectiveColor,
        depth: depth + 1,
        size: note.content.length,  // D3-style metric
        noteData: note,
    }));

    // Transform child folders recursively
    const folderNodes: ArboristNode[] = folder.subfolders.map(subfolder =>
        transformFolderToNode(subfolder, depth + 1, effectiveColor)
    );

    // Combine children: folders first, then notes
    const children = [...folderNodes, ...noteNodes];

    return {
        id: folder.id,
        name: folder.name,
        type: 'folder' as const,
        children: children.length > 0 ? children : undefined,
        parentId: folder.parentId,
        color: folder.color,
        entityKind: folder.entityKind,
        entitySubtype: folder.entitySubtype,
        entityLabel: folder.entityLabel,
        isTypedRoot: folder.isTypedRoot,
        isSubtypeRoot: folder.isSubtypeRoot,
        inheritedKind: folder.inheritedKind,
        inheritedSubtype: folder.inheritedSubtype,
        effectiveColor,
        depth,
        count: children.length,  // D3-style metric
        folderData: folder,
    };
}

/**
 * Build Arborist tree from NotesContext data
 */
export function buildArboristTree(
    folderTree: FolderWithChildren[],
    globalNotes: Note[]
): ArboristTree {
    const rootFolders = folderTree.map(folder => transformFolderToNode(folder, 0));

    // Add global notes (no folder) as root-level nodes
    const rootNotes: ArboristNode[] = globalNotes.map(note => ({
        id: note.id,
        name: note.title,
        type: 'note' as const,
        isEntity: note.isEntity,
        entityKind: note.entityKind,
        entitySubtype: note.entitySubtype,
        entityLabel: note.entityLabel,
        favorite: note.favorite,
        isPinned: note.isPinned,
        folderId: undefined,
        effectiveColor: note.entityKind ? ENTITY_COLORS[note.entityKind] : DEFAULT_COLORS[0],
        depth: 0,
        size: note.content.length,
        noteData: note,
    }));

    return [...rootFolders, ...rootNotes];
}

/**
 * Get parent node color for inheritance (for hover effects, etc.)
 */
export function getParentColor(
    nodeId: string,
    tree: ArboristTree
): string | undefined {
    // Recursive search for node's parent
    function findParent(nodes: ArboristNode[], targetId: string): ArboristNode | null {
        for (const node of nodes) {
            if (node.children?.some(child => child.id === targetId)) {
                return node;
            }
            if (node.children) {
                const found = findParent(node.children, targetId);
                if (found) return found;
            }
        }
        return null;
    }

    const parent = findParent(tree, nodeId);
    return parent?.effectiveColor;
}
