/**
 * UnifiedEntityLifecycle - Ensures all entity-aware operations synchronize:
 * 1. NotesContext (file system layer)
 * 2. EntityRegistry (entity graph layer)
 * 3. SQLite (persistence via GraphSync)
 */

import { entityRegistry } from './entity-registry';
import { getGraphSyncManager } from '@/lib/graph/integration';
import { autoSaveEntityRegistry } from '@/lib/storage/entityStorage';
import type { Note, Folder } from '@/contexts/NotesContext';
import type { EntityKind } from './entityTypes';
import { parseEntityFromTitle, parseFolderEntityFromName } from './titleParser';

/**
 * Unified entity lifecycle - ensures all layers stay in sync
 */
export class UnifiedEntityLifecycle {
    /**
     * Handle note creation with entity awareness
     */
    static onNoteCreated(note: Note): void {
        const parsed = parseEntityFromTitle(note.title);

        if (parsed && parsed.label) {
            // Register entity immediately
            entityRegistry.registerEntity(
                parsed.label,
                parsed.kind,
                note.id,
                {
                    subtype: parsed.subtype,
                    metadata: {
                        createdVia: 'note_creation',
                        folderId: note.folderId,
                        noteTitle: note.title
                    }
                }
            );

            // Persist registry
            autoSaveEntityRegistry(entityRegistry);
        }

        // Sync to SQLite (via GraphSync)
        getGraphSyncManager().onNoteCreated(note);
    }

    /**
     * Handle note title change (entity rename/retype)
     */
    static onNoteTitleChanged(note: Note, oldTitle: string): void {
        const oldParsed = parseEntityFromTitle(oldTitle);
        const newParsed = parseEntityFromTitle(note.title);

        // Entity removed (was entity, now regular note)
        if (oldParsed && oldParsed.label && !newParsed) {
            const entity = entityRegistry.findEntity(oldParsed.label);
            if (entity && entity.firstMentionNoteId === note.id) {
                // This note was the defining note - delete entity
                entityRegistry.deleteEntity(entity.id);
            } else if (entity) {
                // Remove this note from mentions
                entityRegistry.updateNoteMentions(entity.id, note.id, 0);
            }
        }

        // Entity added (was regular, now entity)
        else if (!oldParsed && newParsed && newParsed.label) {
            entityRegistry.registerEntity(
                newParsed.label,
                newParsed.kind,
                note.id,
                { subtype: newParsed.subtype }
            );
        }

        // Entity changed (label or kind changed)
        else if (oldParsed && oldParsed.label && newParsed && newParsed.label &&
            (oldParsed.label !== newParsed.label || oldParsed.kind !== newParsed.kind)) {

            const oldEntity = entityRegistry.findEntity(oldParsed.label);

            // If label changed but kind same, use updateEntity (rename)
            if (oldEntity && oldParsed.kind === newParsed.kind) {
                entityRegistry.updateEntity(oldEntity.id, {
                    label: newParsed.label,
                    subtype: newParsed.subtype,
                });
            }
            // If kind changed, delete old and create new
            else {
                if (oldEntity) entityRegistry.deleteEntity(oldEntity.id);
                entityRegistry.registerEntity(
                    newParsed.label,
                    newParsed.kind,
                    note.id,
                    { subtype: newParsed.subtype }
                );
            }
        }

        // Persist and sync
        autoSaveEntityRegistry(entityRegistry);
    }

    /**
     * Handle note deletion
     */
    static onNoteDeleted(noteId: string, wasEntity: boolean, entityLabel?: string): void {
        // Clean up EntityRegistry
        entityRegistry.onNoteDeleted(noteId);

        // If this was a defining entity note, delete the entity
        if (wasEntity && entityLabel) {
            const entity = entityRegistry.findEntity(entityLabel);
            if (entity && entity.firstMentionNoteId === noteId) {
                entityRegistry.deleteEntity(entity.id);
            }
        }

        // Persist and sync
        autoSaveEntityRegistry(entityRegistry);
        getGraphSyncManager().onNoteDeleted(noteId);
    }

    /**
     * Handle folder creation with entity awareness
     */
    static onFolderCreated(folder: Folder): void {
        const parsed = parseFolderEntityFromName(folder.name);

        if (parsed && (parsed.isTypedRoot || parsed.isSubtypeRoot)) {
            // Register folder as entity CONTAINER
            entityRegistry.registerEntity(
                parsed.label || folder.name,
                parsed.kind,
                folder.id, // Use folder ID as source
                {
                    subtype: parsed.subtype,
                    metadata: {
                        type: 'folder_container',
                        isTypedRoot: parsed.isTypedRoot,
                        isSubtypeRoot: parsed.isSubtypeRoot,
                        parentId: folder.parentId,
                    }
                }
            );

            // Persist
            autoSaveEntityRegistry(entityRegistry);
        }

        // Sync to SQLite
        getGraphSyncManager().onFolderCreated(folder);
    }

    /**
     * Handle folder deletion
     */
    static onFolderDeleted(folderId: string, wasTyped: boolean, entityKind?: EntityKind): void {
        if (wasTyped && entityKind) {
            // Find and delete folder entity
            const folderEntities = entityRegistry.getAllEntities().filter(
                e => e.metadata?.type === 'folder_container' && e.firstMentionNoteId === folderId
            );

            for (const folderEntity of folderEntities) {
                entityRegistry.deleteEntity(folderEntity.id);
            }
        }

        // Persist and sync
        autoSaveEntityRegistry(entityRegistry);
        getGraphSyncManager().onFolderDeleted(folderId);
    }
}
