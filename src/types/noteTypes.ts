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
    parentId?: string | null; // Alias for parent_id
    collapsed?: boolean;
    updatedAt: number;
    updated_at?: number; // DB field

    // Entity/Network fields
    isTypedRoot?: boolean | number;
    entityKind?: string | null;
    inherited_kind?: string | null;
    entitySubtype?: string | null;
    color?: string | null;

    // Calendar provenance (fantasy date when created from calendar)
    fantasy_date?: { year: number; month: number; day: number } | null;
}

export interface FolderWithChildren extends Folder {
    children: FolderWithChildren[];
    notes: Note[];
}
