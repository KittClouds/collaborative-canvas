import type { EntityKind } from '@/lib/entities/entityTypes';
import type { Note, Folder } from '@/types/noteTypes';

/**
 * Unified tree node for React Arborist
 * Represents both folders and notes in flat structure
 */
export interface ArboristNode {
    id: string;
    name: string;
    children?: ArboristNode[];

    // Node type discrimination
    type: 'folder' | 'note';

    // Folder-specific properties
    parentId?: string;
    color?: string;
    entityKind?: EntityKind;
    entitySubtype?: string;
    entityLabel?: string;
    isTypedRoot?: boolean;
    isSubtypeRoot?: boolean;
    inheritedKind?: EntityKind;
    inheritedSubtype?: string;

    // Note-specific properties
    isEntity?: boolean;
    favorite?: number;
    isPinned?: number;
    folderId?: string;

    // Network-specific properties
    networkId?: string;  // If this folder IS a network root

    // D3-style metrics (optional - for future enhancements)
    size?: number;    // Content length in bytes
    count?: number;   // Child count for folders

    // Computed display properties
    effectiveColor?: string;  // Resolved color (folder → parent → default)
    depth?: number;           // Tree depth for indentation

    // Original data references (for mutations)
    folderData?: Folder;
    noteData?: Note;
}

/**
 * Arborist-compatible tree data structure
 */
export type ArboristTree = ArboristNode[];
