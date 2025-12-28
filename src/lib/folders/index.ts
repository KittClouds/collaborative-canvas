/**
 * Folder System - Main exports
 * 
 * Typed folder system that automatically creates semantic relationships
 * from folder hierarchy. Folder structure = Knowledge graph!
 */

// Types
export type {
    FolderSchema,
    FolderRelationshipDefinition,
    AllowedSubfolderDefinition,
    AllowedNoteTypeDefinition,
    RelationshipProvenanceType,
    RelationshipProvenance,
} from './schemas';

// Schemas
export {
    CHARACTER_FOLDER_SCHEMA,
    LOCATION_FOLDER_SCHEMA,
    ITEM_FOLDER_SCHEMA,
    EVENT_FOLDER_SCHEMA,
    NARRATIVE_FOLDER_SCHEMA,
    SCENE_FOLDER_SCHEMA,
    CHAPTER_FOLDER_SCHEMA,
    ARC_FOLDER_SCHEMA,
    ACT_FOLDER_SCHEMA,
    NPC_FOLDER_SCHEMA,
    CONCEPT_FOLDER_SCHEMA,
} from './schemas/index';

// Registry
export { FolderSchemaRegistry, folderSchemaRegistry } from './schema-registry';

// Network Auto-Creation API
export {
    checkAndCreateNetworkForFolder,
    onEntityAddedToFolder,
    updateNetworkStats,
    type NetworkCreationResult,
    type NetworkAutoCreateConfig,
} from './api/network-auto-creator';
