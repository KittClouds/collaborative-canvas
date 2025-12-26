import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { dbClient } from '@/lib/db/client/db-client';
import { generateId } from '@/lib/utils/ids';
import type { SQLiteNode, SQLiteNodeInput, NodeType } from '@/lib/db/client/types';

import type { DocumentConnections } from '@/lib/entities/entityTypes';

export interface Note extends Omit<SQLiteNode, 'type'> {
    type: 'NOTE';
    parentId?: string | null;
    folderId?: string | null;
    title: string;
    isEntity?: boolean;
    entityKind?: string | null;
    entitySubtype?: string | null;
    entityLabel?: string | null;
    connections?: DocumentConnections;
    createdAt?: number;
    updatedAt?: number;
}

export interface Folder extends Omit<SQLiteNode, 'type'> {
    type: 'FOLDER';
    parentId?: string | null;
    name: string;
    entityKind?: string | null;
    entitySubtype?: string | null;
    entityLabel?: string | null;
    isTypedRoot?: boolean;
    isSubtypeRoot?: boolean;
    isEntity?: boolean;
    createdAt?: number;
    updatedAt?: number;
}

export interface FolderWithChildren extends Folder {
    children: FolderWithChildren[];
    notes: Note[];
}

interface NotesState {
    notes: Note[];
    folders: Folder[];
    isSaving: boolean;
    lastSaved: Date | null;
    searchQuery: string;
    selectedNoteId: string | null;
}

export interface FolderCreationOptions {
    entityKind?: string;
    entitySubtype?: string;
    entityLabel?: string;
    isTypedRoot?: boolean;
    isSubtypeRoot?: boolean;
    color?: string;
}

interface NotesContextType {
    state: NotesState;

    // Derived Data
    selectedNote: Note | null;
    favoriteNotes: Note[];
    globalNotes: Note[]; // Notes without a folder
    folderTree: FolderWithChildren[];

    // Actions
    selectNote: (id: string) => void;
    setSearchQuery: (query: string) => void;

    // CRUD Note
    createNote: (folderId?: string, title?: string, sourceNoteId?: string) => Promise<Note>;
    updateNote: (id: string, updates: Partial<Note> & { content?: string }) => Promise<void>;
    updateNoteContent: (id: string, content: string) => Promise<void>; // Specific optimization
    deleteNote: (id: string) => Promise<void>;
    getEntityNote: (id: string) => Note | undefined;

    // CRUD Folder
    createFolder: (name: string, parentId?: string, options?: FolderCreationOptions) => Promise<Folder>;
    updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: React.ReactNode }) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                await dbClient.init();
                const allNodes = await dbClient.getAllNodes();

                const loadedNotes = allNodes
                    .filter(n => n.type === 'NOTE')
                    .map(n => ({
                        ...n,
                        type: 'NOTE',
                        parentId: n.parent_id,
                        folderId: n.parent_id,
                        title: n.label,
                        createdAt: n.created_at,
                        updatedAt: n.updated_at,
                        connections: n.extraction ? JSON.parse(n.extraction) : undefined,
                    })) as unknown as Note[];

                const loadedFolders = allNodes
                    .filter(n => n.type === 'FOLDER')
                    .map(n => ({
                        ...n,
                        type: 'FOLDER',
                        parentId: n.parent_id,
                        name: n.label,
                        isEntity: Boolean(n.is_entity),
                        createdAt: n.created_at,
                        updatedAt: n.updated_at,
                    })) as unknown as Folder[];

                setNotes(loadedNotes);
                setFolders(loadedFolders);
            } catch (error) {
                console.error("Failed to load notes data:", error);
            }
        };
        loadData();
    }, []);

    // Derived State
    const selectedNote = useMemo(() =>
        notes.find(n => n.id === selectedNoteId) || null
        , [notes, selectedNoteId]);

    const favoriteNotes = useMemo(() =>
        notes.filter(n => Number(n.favorite) === 1) // SQLite uses 1 for true
        , [notes]);

    const globalNotes = useMemo(() =>
        notes.filter(n => !n.parent_id)
        , [notes]);

    const folderTree = useMemo(() => {
        const buildTree = (parentId: string | null): FolderWithChildren[] => {
            return folders
                .filter(f => f.parent_id === parentId)
                .map(f => ({
                    ...f,
                    children: buildTree(f.id),
                    notes: notes.filter(n => n.parent_id === f.id)
                }));
        };
        return buildTree(null);
    }, [folders, notes]);

    // Actions
    const updateNoteContent = useCallback(async (id: string, content: string) => {
        setIsSaving(true);
        try {
            setNotes(prev => prev.map(n => n.id === id ? { ...n, content, updated_at: Date.now(), updatedAt: Date.now() } : n));
            await dbClient.updateNode(id, { content });
            setLastSaved(new Date());
        } catch (error) {
            console.error("Failed to update note content:", error);
        } finally {
            setIsSaving(false);
        }
    }, []);

    const updateNote = useCallback(async (id: string, updates: Partial<Note> & { content?: string }) => {
        setIsSaving(true);
        try {
            // Map aliases back to DB schema
            const dbUpdates: any = { ...updates };
            if (updates.title !== undefined) dbUpdates.label = updates.title;
            if (updates.folderId !== undefined) dbUpdates.parent_id = updates.folderId;
            if ('favorite' in updates) dbUpdates.favorite = updates.favorite ? 1 : 0;
            if (updates.connections !== undefined) dbUpdates.extraction = JSON.stringify(updates.connections);

            setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n));
            await dbClient.updateNode(id, dbUpdates);
            setLastSaved(new Date());
        } catch (error) {
            console.error("Failed to update note:", error);
        } finally {
            setIsSaving(false);
        }
    }, []);

    const deleteNote = useCallback(async (id: string) => {
        try {
            await dbClient.deleteNode(id);
            setNotes(prev => prev.filter(n => n.id !== id));
            if (selectedNoteId === id) setSelectedNoteId(null);
        } catch (error) {
            console.error("Failed to delete note:", error);
        }
    }, [selectedNoteId]);

    const createNote = useCallback(async (folderId?: string, title?: string, sourceNoteId?: string) => {
        const newNoteId = generateId();
        const timestamp = Date.now();
        const newNoteInput: SQLiteNodeInput = {
            id: newNoteId,
            type: 'NOTE',
            label: title || 'Untitled Note',
            content: '',
            parent_id: folderId || null,
            source_note_id: sourceNoteId,
            is_entity: false, // Default false
        };

        try {
            const createdNode = await dbClient.insertNode(newNoteInput);
            const createdNoteTyped = {
                ...createdNode,
                type: 'NOTE',
                parentId: createdNode.parent_id,
                folderId: createdNode.parent_id,
                title: createdNode.label,
                createdAt: createdNode.created_at,
                updatedAt: createdNode.updated_at,
            } as unknown as Note;

            setNotes(prev => [...prev, createdNoteTyped]);
            return createdNoteTyped;
        } catch (error) {
            console.error("Failed to create note:", error);
            throw error;
        }
    }, []);

    const createFolder = useCallback(async (name: string, parentId?: string, options?: FolderCreationOptions) => {
        const newId = generateId();
        const input: SQLiteNodeInput = {
            id: newId,
            type: 'FOLDER',
            label: name,
            parent_id: parentId || null,
            content: null,
            entity_kind: options?.entityKind,
            entity_subtype: options?.entitySubtype,
            is_typed_root: options?.isTypedRoot,
            is_subtype_root: options?.isSubtypeRoot,
            color: options?.color,
        };

        try {
            const created = await dbClient.insertNode(input);
            const createdFolder = {
                ...created,
                type: 'FOLDER',
                parentId: created.parent_id,
                name: created.label,
                // Map options
                entityKind: options?.entityKind,
                entitySubtype: options?.entitySubtype,
                isTypedRoot: options?.isTypedRoot,
                isSubtypeRoot: options?.isSubtypeRoot,
                isEntity: Boolean(created.is_entity),
                createdAt: created.created_at,
                updatedAt: created.updated_at,
            } as unknown as Folder;

            setFolders(prev => [...prev, createdFolder]);
            return createdFolder;
        } catch (error) {
            console.error("Failed to create folder:", error);
            throw error;
        }
    }, []);

    const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
        try {
            const dbUpdates: any = { ...updates };
            if (updates.name !== undefined) dbUpdates.label = updates.name;
            if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;

            setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
            await dbClient.updateNode(id, dbUpdates);
        } catch (error) {
            console.error("Failed to update folder:", error);
        }
    }, []);

    const deleteFolder = useCallback(async (id: string) => {
        try {
            await dbClient.deleteNode(id);
            // Optimistic delete: assume cascade or handle children logic if needed
            // For now just remove the folder
            setFolders(prev => prev.filter(f => f.id !== id));
            // Should also potentially move children to root or delete them? 
            // SQLite might handle cascade if configured, otherwise children become orphaned.
            // Client side cleanup:
            setNotes(prev => prev.map(n => n.parent_id === id ? { ...n, parent_id: null, folderId: null } : n));
            // Recursively update folders? Left as TODO or DB handled.
        } catch (error) {
            console.error("Failed to delete folder:", error);
        }
    }, []);

    const getEntityNote = useCallback((id: string) => {
        return notes.find(n => n.id === id);
    }, [notes]);

    const value = {
        state: {
            notes,
            folders,
            isSaving,
            lastSaved,
            searchQuery,
            selectedNoteId
        },
        selectedNote,
        favoriteNotes,
        globalNotes,
        folderTree,
        selectNote: setSelectedNoteId,
        setSearchQuery,
        createNote,
        updateNote,
        updateNoteContent,
        deleteNote,
        getEntityNote,
        createFolder,
        updateFolder,
        deleteFolder
    };

    return (
        <NotesContext.Provider value={value}>
            {children}
        </NotesContext.Provider>
    );
}

export function useNotes() {
    const context = useContext(NotesContext);
    if (context === undefined) {
        throw new Error('useNotes must be used within a NotesProvider');
    }
    return context;
}

