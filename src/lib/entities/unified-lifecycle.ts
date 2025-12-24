/**
 * UnifiedEntityLifecycle - Ensures all entity-aware operations synchronize:
 * 1. NotesContext (file system layer)
 * 2. EntityRegistry (entity graph layer)
 * 3. SQLite (persistence via GraphSync)
 * 4. FolderRelationshipCreator (automatic relationships from folder structure)
 * 5. RelationshipRegistry (unified relationship management)
 */

import { entityRegistry } from './entity-registry';
import { getGraphSyncManager } from '@/lib/graph/integration';
import { autoSaveEntityRegistry } from '@/lib/storage/entityStorage';
import { folderRelationshipCreator } from '@/lib/folders/relationship-creator';
import { relationshipRegistry, RelationshipSource } from '@/lib/relationships';
import type { Note, Folder } from '@/contexts/NotesContext';
import type { EntityKind } from './entityTypes';
import { parseEntityFromTitle, parseFolderEntityFromName, parseEntityWithRelation } from './titleParser';

/**
 * Unified entity lifecycle - ensures all layers stay in sync
 */
export class UnifiedEntityLifecycle {
    /**
     * Handle note creation with entity awareness
     */
    static onNoteCreated(note: Note): void {
        const parsed = parseEntityWithRelation(note.title);

        if (parsed && parsed.label) {
            const entity = entityRegistry.registerEntity(
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

            if (parsed.inlineRelation) {
                const targetEntity = entityRegistry.findEntity(parsed.inlineRelation.targetLabel);
                if (targetEntity) {
                    relationshipRegistry.add({
                        sourceEntityId: entity.id,
                        targetEntityId: targetEntity.id,
                        type: parsed.inlineRelation.type,
                        provenance: [{
                            source: RelationshipSource.MANUAL,
                            originId: note.id,
                            timestamp: new Date(),
                            confidence: 1.0,
                            context: `Inline relationship in note title: ${note.title}`
                        }]
                    });
                }
            }

            autoSaveEntityRegistry(entityRegistry);
        }

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
     * Handle folder creation with parent context for relationship creation.
     * This is the preferred method when the parent folder is known, as it
     * enables automatic relationship creation based on folder schemas.
     */
    static onFolderCreatedWithParent(folder: Folder, parentFolder: Folder | null): void {
        // First do standard folder creation logic
        this.onFolderCreated(folder);

        // Then create automatic relationships if parent is typed
        if (parentFolder?.entityKind) {
            folderRelationshipCreator.onSubfolderCreated(parentFolder, folder);
        }
    }

    /**
     * Handle note creation with parent folder context for relationship creation.
     * Creates automatic relationships based on folder schemas.
     */
    static onNoteCreatedWithFolder(note: Note, parentFolder: Folder | null): void {
        // First do standard note creation logic
        this.onNoteCreated(note);

        // Then create automatic relationships if folder is typed
        if (parentFolder?.entityKind) {
            folderRelationshipCreator.onNoteCreated(parentFolder, note);
        }
    }

    /**
     * Handle note moved between folders
     */
    static onNoteMoved(note: Note, oldFolder: Folder | null, newFolder: Folder | null): void {
        // Update folder relationships
        if (newFolder) {
            folderRelationshipCreator.onNoteMoved(note, oldFolder, newFolder);
        }

        // Note: This doesn't re-register entities, just updates folder-based relationships
    }

    /**
     * Handle folder moved to new parent
     */
    static onFolderMoved(folder: Folder, oldParent: Folder | null, newParent: Folder | null): void {
        folderRelationshipCreator.onFolderMoved(folder, oldParent, newParent);
    }

    /**
     * Handle folder deletion
     */
    static onFolderDeleted(folderId: string, wasTyped: boolean, entityKind?: EntityKind): void {
        // Clean up folder-based relationships first
        folderRelationshipCreator.onFolderDeleted(folderId);

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

    /**
     * Get statistics about folder-created relationships
     */
    static getFolderRelationshipStats(): { totalRelationships: number; byType: Record<string, number> } {
        return folderRelationshipCreator.getStats();
    }

    /**
     * Get unified relationship statistics
     */
    static getRelationshipStats() {
        return relationshipRegistry.getStats();
    }
}

