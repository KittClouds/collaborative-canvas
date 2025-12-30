/**
 * Async atoms for database operations
 * Handles initialization, hydration, and write operations
 */
import { atom } from 'jotai';
import { dbClient } from '@/lib/db/client/db-client';
import { generateId } from '@/lib/utils/ids';
import {
    notesAtom,
    foldersAtom,
    selectedNoteIdAtom,
    isSavingAtom,
    lastSavedAtom,
} from './notes';
import type { Note, Folder } from '@/types/noteTypes';
import type { SQLiteNode, SQLiteNodeInput } from '@/lib/db/client/types';

// ============================================
// TRANSFORMATION UTILITIES
// ============================================

/**
 * Transform SQLite node to Note type
 */
function transformToNote(node: SQLiteNode): Note {
    return {
        ...node,
        type: 'NOTE',
        parentId: node.parent_id,
        folderId: node.parent_id,
        title: node.label,
        createdAt: node.created_at,
        updatedAt: node.updated_at,
        connections: node.extraction ? JSON.parse(node.extraction) : undefined,
    } as unknown as Note;
}

/**
 * Transform SQLite node to Folder type
 */
function transformToFolder(node: SQLiteNode): Folder {
    // Parse attributes to extract fantasy_date if present
    let fantasyDate = null;
    if (node.attributes) {
        try {
            const attrs = typeof node.attributes === 'string'
                ? JSON.parse(node.attributes)
                : node.attributes;
            fantasyDate = attrs?.fantasy_date || null;
        } catch {
            // Ignore parse errors
        }
    }

    return {
        ...node,
        type: 'FOLDER',
        parentId: node.parent_id,
        name: node.label,
        isEntity: Boolean(node.is_entity),
        createdAt: node.created_at,
        updatedAt: node.updated_at,
        fantasy_date: fantasyDate,
    } as unknown as Folder;
}

/**
 * Transform Note updates to SQLite format
 */
function transformNoteUpdates(updates: Partial<Note>): Record<string, any> {
    const dbUpdates: Record<string, any> = { ...updates };

    // Map Note fields to SQLite column names
    if (updates.title !== undefined) dbUpdates.label = updates.title;
    if (updates.folderId !== undefined) dbUpdates.parent_id = updates.folderId;
    if ('favorite' in updates) dbUpdates.favorite = updates.favorite ? 1 : 0;
    if (updates.connections !== undefined) {
        dbUpdates.extraction = JSON.stringify(updates.connections);
    }

    // Remove Note-specific fields not in SQLite schema
    delete dbUpdates.title;
    delete dbUpdates.folderId;
    delete dbUpdates.connections;

    return dbUpdates;
}

/**
 * Transform Folder updates to SQLite format
 */
function transformFolderUpdates(updates: Partial<Folder>): Record<string, any> {
    const dbUpdates: Record<string, any> = { ...updates };

    if (updates.name !== undefined) dbUpdates.label = updates.name;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;

    delete dbUpdates.name;
    delete dbUpdates.parentId;

    return dbUpdates;
}

// ============================================
// INITIALIZATION ATOMS
// ============================================

/**
 * Async atom that loads all data from database
 * Called once during app initialization
 */
export const dbInitAtom = atom(async () => {
    console.log('[Atoms] Loading data from database...');

    await dbClient.init();
    const allNodes = await dbClient.getAllNodes();

    const notes = allNodes
        .filter(n => n.type === 'NOTE')
        .map(transformToNote);

    const folders = allNodes
        .filter(n => n.type === 'FOLDER')
        .map(transformToFolder);

    console.log(`[Atoms] Loaded ${notes.length} notes, ${folders.length} folders`);

    return { notes, folders };
});

/**
 * Write-only atom that hydrates store with database data
 * Usage: await store.set(hydrateNotesAtom)
 */
export const hydrateNotesAtom = atom(
    null, // No read function (write-only)
    async (get, set) => {
        try {
            const { notes, folders } = await get(dbInitAtom);

            set(notesAtom, notes);
            set(foldersAtom, folders);

            console.log('[Atoms] ✅ Store hydrated successfully');
        } catch (error) {
            console.error('[Atoms] ❌ Hydration failed:', error);
            throw error;
        }
    }
);

// ============================================
// NOTE MUTATION ATOMS
// ============================================

/**
 * Update note content (optimized path for editor changes)
 * Includes optimistic update + rollback on failure
 * 
 * Usage: set(updateNoteContentAtom, { id: 'abc', content: 'new text' })
 */
export const updateNoteContentAtom = atom(
    null, // Write-only
    async (get, set, update: { id: string; content: string }) => {
        const { id, content } = update;
        const currentNotes = get(notesAtom);
        const originalNote = currentNotes.find(n => n.id === id);

        if (!originalNote) {
            console.error(`[Atoms] Note ${id} not found`);
            return;
        }

        // Optimistic update - UI reflects change immediately
        const timestamp = Date.now();
        set(notesAtom, currentNotes.map(n =>
            n.id === id
                ? { ...n, content, updated_at: timestamp, updatedAt: timestamp }
                : n
        ));

        set(isSavingAtom, true);

        try {
            // Persist to database
            await dbClient.updateNode(id, { content });
            set(lastSavedAtom, new Date());
            console.log(`[Atoms] ✅ Updated note ${id}`);
        } catch (error) {
            // Rollback on failure
            console.error(`[Atoms] ❌ Failed to update note ${id}:`, error);
            set(notesAtom, currentNotes);
            throw error;
        } finally {
            set(isSavingAtom, false);
        }
    }
);

/**
 * Update any note fields
 * Includes optimistic update + rollback on failure
 * 
 * Usage: set(updateNoteAtom, { id: 'abc', updates: { title: 'New Title', favorite: true } })
 */
export const updateNoteAtom = atom(
    null,
    async (get, set, params: { id: string; updates: Partial<Note> }) => {
        const { id, updates } = params;
        const currentNotes = get(notesAtom);
        const originalNote = currentNotes.find(n => n.id === id);

        if (!originalNote) {
            console.error(`[Atoms] Note ${id} not found`);
            return;
        }

        // Optimistic update
        const timestamp = Date.now();
        set(notesAtom, currentNotes.map(n =>
            n.id === id
                ? { ...n, ...updates, updatedAt: timestamp }
                : n
        ));

        set(isSavingAtom, true);

        try {
            const dbUpdates = transformNoteUpdates(updates);
            await dbClient.updateNode(id, dbUpdates);
            set(lastSavedAtom, new Date());
            console.log(`[Atoms] ✅ Updated note ${id}`, updates);
        } catch (error) {
            console.error(`[Atoms] ❌ Failed to update note ${id}:`, error);
            set(notesAtom, currentNotes);
            throw error;
        } finally {
            set(isSavingAtom, false);
        }
    }
);

/**
 * Create new note
 * Returns the created note's ID
 * 
 * Usage: const noteId = await store.set(createNoteAtom, { folderId: 'xyz', title: 'New Note' })
 */
export const createNoteAtom = atom(
    null,
    async (get, set, params: { folderId?: string; title?: string; sourceNoteId?: string }) => {
        const newNoteId = generateId();
        const timestamp = Date.now();

        const newNote: Note = {
            id: newNoteId,
            type: 'NOTE',
            label: params.title || 'Untitled Note',
            title: params.title || 'Untitled Note',
            content: '',
            parent_id: params.folderId || null,
            parentId: params.folderId || null,
            folderId: params.folderId || null,
            source_note_id: params.sourceNoteId,
            is_entity: false,
            isEntity: false,
            favorite: 0,
            created_at: timestamp,
            createdAt: timestamp,
            updated_at: timestamp,
            updatedAt: timestamp,
        } as unknown as Note;

        // Optimistic add
        set(notesAtom, [...get(notesAtom), newNote]);

        try {
            const nodeInput: SQLiteNodeInput = {
                id: newNoteId,
                type: 'NOTE',
                label: newNote.title,
                content: '',
                parent_id: params.folderId || null,
                source_note_id: params.sourceNoteId,
                is_entity: false,
            };

            await dbClient.insertNode(nodeInput);
            console.log(`[Atoms] ✅ Created note ${newNoteId}`);

            return newNoteId;
        } catch (error) {
            console.error(`[Atoms] ❌ Failed to create note:`, error);
            // Rollback
            set(notesAtom, get(notesAtom).filter(n => n.id !== newNoteId));
            throw error;
        }
    }
);

/**
 * Delete note by ID
 * Auto-deselects if deleted note was selected
 * 
 * Usage: await store.set(deleteNoteAtom, 'note-id-123')
 */
export const deleteNoteAtom = atom(
    null,
    async (get, set, noteId: string) => {
        const currentNotes = get(notesAtom);

        // Optimistic delete
        set(notesAtom, currentNotes.filter(n => n.id !== noteId));

        // Deselect if currently selected
        if (get(selectedNoteIdAtom) === noteId) {
            set(selectedNoteIdAtom, null);
        }

        try {
            await dbClient.deleteNode(noteId);
            console.log(`[Atoms] ✅ Deleted note ${noteId}`);
        } catch (error) {
            console.error(`[Atoms] ❌ Failed to delete note ${noteId}:`, error);
            // Rollback
            set(notesAtom, currentNotes);
            throw error;
        }
    }
);

// ============================================
// FOLDER MUTATION ATOMS
// ============================================

/**
 * Create new folder
 * Returns the created folder's ID
 */
export const createFolderAtom = atom(
    null,
    async (get, set, params: {
        name: string;
        parentId?: string;
        entityKind?: string;
        entitySubtype?: string;
        isTypedRoot?: boolean;
        isSubtypeRoot?: boolean;
        color?: string;
        fantasy_date?: { year: number; month: number; day: number };
    }) => {
        const newFolderId = generateId();
        const timestamp = Date.now();

        const newFolder: Folder = {
            id: newFolderId,
            type: 'FOLDER',
            label: params.name,
            name: params.name,
            parent_id: params.parentId || null,
            parentId: params.parentId || null,
            content: null,
            entity_kind: params.entityKind,
            entityKind: params.entityKind,
            entity_subtype: params.entitySubtype,
            entitySubtype: params.entitySubtype,
            is_typed_root: params.isTypedRoot,
            isTypedRoot: params.isTypedRoot,
            is_subtype_root: params.isSubtypeRoot,
            isSubtypeRoot: params.isSubtypeRoot,
            color: params.color,
            fantasy_date: params.fantasy_date,
            is_entity: false,
            isEntity: false,
            created_at: timestamp,
            createdAt: timestamp,
            updated_at: timestamp,
            updatedAt: timestamp,
        } as unknown as Folder;

        // Optimistic add
        set(foldersAtom, [...get(foldersAtom), newFolder]);

        try {
            const nodeInput: SQLiteNodeInput = {
                id: newFolderId,
                type: 'FOLDER',
                label: params.name,
                parent_id: params.parentId || null,
                content: null,
                entity_kind: params.entityKind,
                entity_subtype: params.entitySubtype,
                is_typed_root: params.isTypedRoot,
                is_subtype_root: params.isSubtypeRoot,
                color: params.color,
                // Store fantasy_date in attributes field
                attributes: params.fantasy_date ? { fantasy_date: params.fantasy_date } : null,
            };

            await dbClient.insertNode(nodeInput);
            console.log(`[Atoms] ✅ Created folder ${newFolderId}`);

            return newFolderId;
        } catch (error) {
            console.error(`[Atoms] ❌ Failed to create folder:`, error);
            // Rollback
            set(foldersAtom, get(foldersAtom).filter(f => f.id !== newFolderId));
            throw error;
        }
    }
);

/**
 * Update folder fields
 */
export const updateFolderAtom = atom(
    null,
    async (get, set, params: { id: string; updates: Partial<Folder> }) => {
        const { id, updates } = params;
        const currentFolders = get(foldersAtom);

        // Optimistic update
        set(foldersAtom, currentFolders.map(f =>
            f.id === id ? { ...f, ...updates } : f
        ));

        try {
            const dbUpdates = transformFolderUpdates(updates);
            await dbClient.updateNode(id, dbUpdates);
            console.log(`[Atoms] ✅ Updated folder ${id}`);
        } catch (error) {
            console.error(`[Atoms] ❌ Failed to update folder ${id}:`, error);
            // Rollback
            set(foldersAtom, currentFolders);
            throw error;
        }
    }
);

/**
 * Delete folder by ID
 * Orphans child notes (sets parent_id to null)
 */
export const deleteFolderAtom = atom(
    null,
    async (get, set, folderId: string) => {
        const currentFolders = get(foldersAtom);
        const currentNotes = get(notesAtom);

        // Optimistic delete
        set(foldersAtom, currentFolders.filter(f => f.id !== folderId));

        // Orphan child notes
        set(notesAtom, currentNotes.map(n =>
            n.parent_id === folderId
                ? { ...n, parent_id: null, folderId: null, parentId: null }
                : n
        ));

        try {
            await dbClient.deleteNode(folderId);
            console.log(`[Atoms] ✅ Deleted folder ${folderId}`);
        } catch (error) {
            console.error(`[Atoms] ❌ Failed to delete folder ${folderId}:`, error);
            // Rollback
            set(foldersAtom, currentFolders);
            set(notesAtom, currentNotes);
            throw error;
        }
    }
);
