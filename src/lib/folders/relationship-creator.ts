/**
 * FolderRelationshipCreator - Automatically creates relationships from folder structure
 * 
 * When folders/notes are created, moved, or deleted, this class manages
 * the automatic creation/update/removal of semantic relationships based on
 * folder schema definitions.
 * 
 * Folder structure = Knowledge graph with zero extra work!
 */

import { entityRegistry } from '@/lib/entities/entity-registry';
import { folderSchemaRegistry } from './schema-registry';
import { generateId } from '@/lib/utils/ids';
import type { Folder, Note } from '@/contexts/NotesContext';
import type { FolderRelationshipDefinition, RelationshipProvenanceType } from './schemas';
import type { EntityKind } from '@/lib/entities/entityTypes';

/**
 * Tracked folder relationship for lifecycle management
 */
interface FolderRelationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    inverseType?: string;
    bidirectional: boolean;
    confidence: number;
    provenance: {
        type: RelationshipProvenanceType;
        originId: string; // Folder ID that created this
        timestamp: Date;
    };
    attributes: Record<string, any>;
}

/**
 * In-memory relationship store for folder-created relationships.
 * This supplements the EntityRegistry's relationship tracking with
 * provenance and lifecycle management.
 */
class FolderRelationshipStore {
    private relationships: Map<string, FolderRelationship> = new Map();
    private byOrigin: Map<string, Set<string>> = new Map(); // originId -> relationship IDs
    private bySource: Map<string, Set<string>> = new Map(); // entityId -> relationship IDs
    private byTarget: Map<string, Set<string>> = new Map(); // entityId -> relationship IDs

    add(rel: FolderRelationship): void {
        this.relationships.set(rel.id, rel);

        // Index by origin
        if (!this.byOrigin.has(rel.provenance.originId)) {
            this.byOrigin.set(rel.provenance.originId, new Set());
        }
        this.byOrigin.get(rel.provenance.originId)!.add(rel.id);

        // Index by source
        if (!this.bySource.has(rel.sourceEntityId)) {
            this.bySource.set(rel.sourceEntityId, new Set());
        }
        this.bySource.get(rel.sourceEntityId)!.add(rel.id);

        // Index by target
        if (!this.byTarget.has(rel.targetEntityId)) {
            this.byTarget.set(rel.targetEntityId, new Set());
        }
        this.byTarget.get(rel.targetEntityId)!.add(rel.id);
    }

    remove(id: string): boolean {
        const rel = this.relationships.get(id);
        if (!rel) return false;

        this.relationships.delete(id);
        this.byOrigin.get(rel.provenance.originId)?.delete(id);
        this.bySource.get(rel.sourceEntityId)?.delete(id);
        this.byTarget.get(rel.targetEntityId)?.delete(id);

        return true;
    }

    getByOrigin(originId: string): FolderRelationship[] {
        const ids = this.byOrigin.get(originId) || new Set();
        return Array.from(ids).map(id => this.relationships.get(id)!).filter(Boolean);
    }

    getByEntity(entityId: string): FolderRelationship[] {
        const sourceIds = this.bySource.get(entityId) || new Set();
        const targetIds = this.byTarget.get(entityId) || new Set();
        const allIds = new Set([...sourceIds, ...targetIds]);
        return Array.from(allIds).map(id => this.relationships.get(id)!).filter(Boolean);
    }

    removeByOrigin(originId: string): number {
        const rels = this.getByOrigin(originId);
        for (const rel of rels) {
            this.remove(rel.id);
        }
        return rels.length;
    }

    clear(): void {
        this.relationships.clear();
        this.byOrigin.clear();
        this.bySource.clear();
        this.byTarget.clear();
    }

    getAll(): FolderRelationship[] {
        return Array.from(this.relationships.values());
    }

    size(): number {
        return this.relationships.size;
    }
}

/**
 * Main relationship creator class.
 * Hooks into folder/note lifecycle events to create semantic relationships.
 */
export class FolderRelationshipCreator {
    private store: FolderRelationshipStore;

    constructor() {
        this.store = new FolderRelationshipStore();
    }

    /**
     * Called when a subfolder is created under a typed parent folder.
     * Creates relationships based on the parent's schema definition.
     */
    onSubfolderCreated(parentFolder: Folder, childFolder: Folder): void {
        // Parent must have an entity kind for relationships
        if (!parentFolder.entityKind) return;

        // Get the relationship definition from schema
        const subfolderDef = folderSchemaRegistry.getSubfolderRelationship(
            parentFolder.entityKind,
            parentFolder.entitySubtype,
            childFolder.entityKind as EntityKind,
            childFolder.entitySubtype
        );

        if (!subfolderDef) {
            // No schema-defined relationship, but still track structural containment
            this.createStructuralRelationship(parentFolder, childFolder, {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'CONTAINED_BY',
                category: 'spatial',
                defaultConfidence: 0.8, // Lower confidence for implied structure
            });
            return;
        }

        // Create the schema-defined relationship
        this.createStructuralRelationship(parentFolder, childFolder, subfolderDef.relationship);
    }

    /**
     * Called when a note is created within a typed folder.
     * Registers the note as an entity and creates folder-note relationships.
     */
    onNoteCreated(parentFolder: Folder, note: Note): void {
        if (!parentFolder.entityKind) return;

        // Determine the note's entity kind (explicit or inherited)
        const noteKind = note.entityKind || parentFolder.entityKind || parentFolder.inheritedKind;

        // Register note as entity if it has entity semantics
        if (note.isEntity && note.entityLabel && noteKind) {
            // Entity already registered by unified-lifecycle, just create relationship
        } else if (noteKind && !note.isEntity) {
            // Note in typed folder inherits context but isn't an entity itself
            // We could optionally create a weak relationship here
        }

        // Get note type definition from schema
        const schema = folderSchemaRegistry.getSchema(parentFolder.entityKind, parentFolder.entitySubtype);
        const noteTypeDef = schema?.allowedNoteTypes?.find(
            nt => nt.entityKind === noteKind &&
                (nt.subtype === undefined || nt.subtype === note.entitySubtype)
        );

        if (noteTypeDef?.relationship) {
            this.createNoteRelationship(parentFolder, note, noteTypeDef.relationship);
        }
    }

    /**
     * Called when a note is moved to a different folder.
     * Updates relationships to reflect the new location.
     */
    onNoteMoved(note: Note, oldFolder: Folder | null, newFolder: Folder): void {
        // Remove relationships created by the old folder
        if (oldFolder) {
            this.removeRelationshipsByOrigin(oldFolder.id);
        }

        // Create new relationships based on the new folder
        if (newFolder.entityKind) {
            this.onNoteCreated(newFolder, note);
        }
    }

    /**
     * Called when a folder is deleted.
     * Removes all relationships that originated from this folder.
     */
    onFolderDeleted(folderId: string): void {
        const removedCount = this.store.removeByOrigin(folderId);

        if (removedCount > 0) {
            console.log(`[FolderRelationshipCreator] Removed ${removedCount} relationships from folder ${folderId}`);
        }
    }

    /**
     * Called when a folder is moved to a new parent.
     * Updates relationships to reflect the new hierarchy.
     */
    onFolderMoved(folder: Folder, oldParent: Folder | null, newParent: Folder | null): void {
        // Remove old structural relationships
        if (oldParent) {
            const oldRels = this.store.getByOrigin(oldParent.id).filter(
                rel => rel.sourceEntityId === folder.id || rel.targetEntityId === folder.id
            );
            for (const rel of oldRels) {
                this.store.remove(rel.id);
            }
        }

        // Create new relationships if new parent is typed
        if (newParent?.entityKind) {
            this.onSubfolderCreated(newParent, folder);
        }
    }

    /**
     * Create a structural relationship between parent and child folders.
     */
    private createStructuralRelationship(
        parentFolder: Folder,
        childFolder: Folder,
        relDef: FolderRelationshipDefinition
    ): void {
        // Determine source and target based on definition
        const sourceId = relDef.sourceType === 'PARENT' ? parentFolder.id : childFolder.id;
        const targetId = relDef.targetType === 'PARENT' ? parentFolder.id : childFolder.id;

        // Create primary relationship
        const relationship: FolderRelationship = {
            id: generateId(),
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            type: relDef.relationshipType,
            inverseType: relDef.inverseType,
            bidirectional: relDef.bidirectional ?? false,
            confidence: relDef.defaultConfidence ?? 1.0,
            provenance: {
                type: 'FOLDER_STRUCTURE',
                originId: parentFolder.id,
                timestamp: new Date(),
            },
            attributes: {
                createdViaFolder: true,
                folderHierarchy: true,
                parentFolderName: parentFolder.name,
                childFolderName: childFolder.name,
                category: relDef.category,
            },
        };

        this.store.add(relationship);

        // Also register in EntityRegistry for graph integration
        this.syncToEntityRegistry(relationship);

        // Create inverse relationship if bidirectional
        if (relDef.bidirectional && relDef.inverseType) {
            const inverseRel: FolderRelationship = {
                id: generateId(),
                sourceEntityId: targetId,
                targetEntityId: sourceId,
                type: relDef.inverseType,
                bidirectional: true,
                confidence: relDef.defaultConfidence ?? 1.0,
                provenance: {
                    type: 'FOLDER_STRUCTURE',
                    originId: parentFolder.id,
                    timestamp: new Date(),
                },
                attributes: {
                    createdViaFolder: true,
                    folderHierarchy: true,
                    isInverse: true,
                    inverseOf: relDef.relationshipType,
                    category: relDef.category,
                },
            };

            this.store.add(inverseRel);
            this.syncToEntityRegistry(inverseRel);
        }

        console.log(`[FolderRelationshipCreator] Created ${relDef.relationshipType} relationship: ${parentFolder.name} -> ${childFolder.name}`);
    }

    /**
     * Create a relationship between a folder and a note within it.
     */
    private createNoteRelationship(
        folder: Folder,
        note: Note,
        relDef: FolderRelationshipDefinition
    ): void {
        const sourceId = relDef.sourceType === 'PARENT' ? folder.id : note.id;
        const targetId = relDef.targetType === 'PARENT' ? folder.id : note.id;

        const relationship: FolderRelationship = {
            id: generateId(),
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            type: relDef.relationshipType,
            inverseType: relDef.inverseType,
            bidirectional: relDef.bidirectional ?? false,
            confidence: relDef.defaultConfidence ?? 1.0,
            provenance: {
                type: 'FOLDER_STRUCTURE',
                originId: folder.id,
                timestamp: new Date(),
            },
            attributes: {
                createdViaFolder: true,
                noteToFolder: true,
                folderName: folder.name,
                noteTitle: note.title,
                category: relDef.category,
            },
        };

        this.store.add(relationship);
        this.syncToEntityRegistry(relationship);
    }

    /**
     * Remove all relationships that originated from a specific folder.
     */
    private removeRelationshipsByOrigin(originId: string): void {
        this.store.removeByOrigin(originId);
    }

    /**
     * Sync a folder relationship to the EntityRegistry for graph integration.
     */
    private syncToEntityRegistry(rel: FolderRelationship): void {
        try {
            // Get entity labels for registry (which uses labels, not IDs for some ops)
            const sourceEntity = entityRegistry.getEntityById(rel.sourceEntityId);
            const targetEntity = entityRegistry.getEntityById(rel.targetEntityId);

            if (sourceEntity && targetEntity) {
                entityRegistry.addRelationship(
                    sourceEntity.label,
                    targetEntity.label,
                    rel.type,
                    rel.provenance.originId, // Use originId as noteId for context
                    `Folder structure: ${rel.attributes.parentFolderName || 'parent'} -> ${rel.attributes.childFolderName || rel.attributes.noteTitle || 'child'}`
                );
            }
        } catch (error) {
            // Non-fatal: EntityRegistry may not have these entities yet
            console.debug('[FolderRelationshipCreator] Could not sync to EntityRegistry:', error);
        }
    }

    /**
     * Get all relationships for an entity (as source or target)
     */
    getEntityRelationships(entityId: string): FolderRelationship[] {
        return this.store.getByEntity(entityId);
    }

    /**
     * Get all relationships created by a specific folder
     */
    getFolderRelationships(folderId: string): FolderRelationship[] {
        return this.store.getByOrigin(folderId);
    }

    /**
     * Get statistics about the relationship store
     */
    getStats(): { totalRelationships: number; byType: Record<string, number> } {
        const all = this.store.getAll();
        const byType: Record<string, number> = {};

        for (const rel of all) {
            byType[rel.type] = (byType[rel.type] || 0) + 1;
        }

        return {
            totalRelationships: all.length,
            byType,
        };
    }

    /**
     * Clear all relationships (useful for testing or reset)
     */
    clear(): void {
        this.store.clear();
    }

    /**
     * Get all folder relationships
     */
    getAll(): FolderRelationship[] {
        return this.store.getAll();
    }
}

// Singleton instance
export const folderRelationshipCreator = new FolderRelationshipCreator();
