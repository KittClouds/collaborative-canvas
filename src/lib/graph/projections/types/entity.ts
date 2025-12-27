/**
 * Entity Scope Configuration
 * Defines the scope for knowledge graph (entity-relation-entity) projections.
 */

export type EntityTarget = 'global' | 'folder' | 'note';

export interface EntityScope {
    type: 'entity';
    target: EntityTarget;

    // Context ID depends on target:
    // - global: undefined
    // - folder: folderId
    // - note: noteId
    contextId?: string;

    // Filtering
    entityKinds?: string[]; // e.g., ['CHARACTER', 'LOCATION']
    relationshipTypes?: string[];
}
