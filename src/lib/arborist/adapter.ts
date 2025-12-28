import { ArboristNode, ArboristTree } from './types';
import type { Folder, Note, FolderWithChildren } from '@/types/noteTypes';
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
    // Map DB fields (snake_case) to UI fields (camelCase) if missing
    const rawFolder = folder as any;
    const entityKind = (folder.entityKind || rawFolder.entity_kind) as any;
    const entitySubtype = folder.entitySubtype || rawFolder.entity_subtype;
    const parentId = folder.parent_id || rawFolder.parent_id; // Handle all casings
    const inheritedKind = (folder as any).inheritedKind || rawFolder.inherited_kind || entityKind; // Folders can inherit from themselves or explicit prop
    const inheritedSubtype = (folder as any).inheritedSubtype || rawFolder.inherited_subtype || entitySubtype;

    // Helper to get CSS var string
    const getEntityColor = (kind: string) => {
        if (kind && ENTITY_COLORS[kind as any]) {
            const varName = `--entity-${kind.toLowerCase().replace('_', '-')}`;
            return `hsl(var(${varName}))`;
        }
        return undefined;
    };

    // Color resolution: folder.color → parentColor → default by depth
    const effectiveColor = folder.color
        || parentColor
        || getEntityColor(entityKind)
        || DEFAULT_COLORS[depth % DEFAULT_COLORS.length];

    // Transform child notes to leaf nodes
    const noteNodes: ArboristNode[] = (folder.notes || []).map(note => {
        const rawNote = note as any;
        const noteKind = (note.entityKind || rawNote.entity_kind) as any;
        const noteSubtype = note.entitySubtype || rawNote.entity_subtype;

        return {
            id: note.id,
            name: note.title,
            type: 'note' as const,
            isEntity: typeof note.isEntity === 'boolean' ? note.isEntity : (note.isEntity === 1 || !!note.isEntity),
            entityKind: noteKind,
            entitySubtype: noteSubtype,
            entityLabel: note.entityLabel || rawNote.entity_label,
            favorite: typeof note.favorite === 'number' ? note.favorite : (note.favorite ? 1 : 0),
            isPinned: typeof note.isPinned === 'number' ? note.isPinned : (note.isPinned ? 1 : 0),
            folderId: note.parent_id || rawNote.parent_id || undefined,
            inheritedKind,
            inheritedSubtype,
            effectiveColor,
            depth: depth + 1,
            size: note.content.length,  // D3-style metric
            noteData: note,
        };
    });

    // Transform child folders recursively
    const folderNodes: ArboristNode[] = (folder.children || []).map(subfolder =>
        transformFolderToNode(subfolder, depth + 1, effectiveColor)
    );

    // Combine children: folders first, then notes
    const children = [...folderNodes, ...noteNodes];

    return {
        id: folder.id,
        name: folder.name,
        type: 'folder' as const,
        children: children.length > 0 ? children : undefined,
        parentId: parentId || undefined,
        color: folder.color || undefined,
        entityKind,
        entitySubtype,
        entityLabel: (folder as any).entityLabel || rawFolder.entity_label,
        isTypedRoot: !!folder.isTypedRoot || rawFolder.is_typed_root === 1,
        isSubtypeRoot: (folder as any).isSubtypeRoot || rawFolder.is_subtype_root === 1,
        inheritedKind,
        inheritedSubtype,
        networkId: (folder as any).networkId,
        effectiveColor,
        depth,
        count: children.length,
        folderData: {
            ...folder,
            // Ensure folderData has correct props for TypedFolderMenu
            entityKind,
            entitySubtype,
        },
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
    const rootNotes: ArboristNode[] = globalNotes.map(note => {
        const rawNote = note as any;
        const noteKind = (note.entityKind || rawNote.entity_kind) as any;

        return {
            id: note.id,
            name: note.title,
            type: 'note' as const,
            isEntity: typeof note.isEntity === 'boolean' ? note.isEntity : (note.isEntity === 1 || !!note.isEntity),
            entityKind: noteKind,
            entitySubtype: note.entitySubtype || rawNote.entity_subtype,
            entityLabel: note.entityLabel || rawNote.entity_label,
            favorite: typeof note.favorite === 'number' ? note.favorite : (note.favorite ? 1 : 0),
            isPinned: typeof note.isPinned === 'number' ? note.isPinned : (note.isPinned ? 1 : 0),
            folderId: undefined,
            effectiveColor: noteKind && ENTITY_COLORS[noteKind]
                ? `hsl(var(--entity-${noteKind.toLowerCase().replace('_', '-')}))`
                : DEFAULT_COLORS[0],
            depth: 0,
            size: note.content.length,
            noteData: note,
        };
    });

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
