export interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: number;
    updated_at?: number; // DB field
    parent_id: string | null;
    favorite: boolean | number;
    isPinned?: boolean | number;
    is_pinned?: number; // DB field

    // Entity fields matching SQLiteNode
    entityKind?: string | null;
    entitySubtype?: string | null;
    isEntity?: boolean | number;
    entityLabel?: string | null; // usually title/label

    // Legacy/UI fields
    connections?: any;

    // Allow index access
    [key: string]: any;
}

export interface Folder {
    id: string;
    name: string;
    parent_id: string | null;
    collapsed?: boolean;
    updatedAt: number;
    updated_at?: number; // DB field

    // Entity/Network fields
    isTypedRoot?: boolean | number;
    entityKind?: string | null;
    inherited_kind?: string | null;
    entitySubtype?: string | null;
    color?: string | null;
}

export interface FolderWithChildren extends Folder {
    children: FolderWithChildren[];
    notes: Note[];
}
