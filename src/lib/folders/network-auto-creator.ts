/**
 * Network Auto-Creator
 * 
 * Monitors folder operations and automatically creates network instances
 * when configured thresholds are met. Uses folder schema configuration
 * to determine which subfolders should trigger network creation.
 * 
 * Integration points:
 * - Called when entities are added to typed subfolders
 * - Uses existing network storage layer (IndexedDB)
 * - Syncs to CozoDB via folderNetworkGraphSync
 */

import { folderSchemaRegistry } from './schema-registry';
import {
    loadNetworkByFolderId,
    saveNetworkInstance,
    addEntityToNetwork,
    saveNetworkRelationship,
} from '@/lib/networks/storage';
import { getSchemaById } from '@/lib/networks/schemas';
import { generateId } from '@/lib/utils/ids';
import type { NetworkInstance, NetworkRelationshipInstance } from '@/lib/networks/types';
import type { EntityKind } from '@/lib/entities/entityTypes';
import type { AllowedSubfolderDefinition } from './schemas';

// ===== TYPES =====

export interface NetworkAutoCreateResult {
    created: boolean;
    networkId?: string;
    reason: string;
    membersAdded?: number;
}

export interface FolderContext {
    /** ID of the typed root folder (e.g., Jon Snow's CHARACTER folder) */
    rootFolderId: string;
    /** ID of the entity represented by the root folder */
    rootEntityId: string;
    /** Label of the root entity (e.g., "Jon Snow") */
    rootEntityLabel: string;
    /** Entity kind of the root folder */
    rootEntityKind: EntityKind;
    /** Label of the subfolder (e.g., "Allies", "Family Members") */
    subfolderLabel: string;
    /** ID of the subfolder */
    subfolderId: string;
    /** Namespace for isolation (default: 'default') */
    namespace?: string;
}

export interface ChildEntity {
    id: string;
    label?: string;
    kind?: EntityKind;
}

// ===== CORE FUNCTIONS =====

/**
 * Check if network should be auto-created and create it if conditions are met.
 * 
 * @param context - Information about the folder hierarchy
 * @param childEntities - Current entities in the subfolder
 * @returns Result indicating if network was created/updated
 */
export async function checkAndCreateNetwork(
    context: FolderContext,
    childEntities: ChildEntity[]
): Promise<NetworkAutoCreateResult> {
    const {
        rootFolderId,
        rootEntityId,
        rootEntityLabel,
        rootEntityKind,
        subfolderLabel,
        subfolderId,
        namespace = 'default'
    } = context;

    // 1. Get schema for parent folder's entity kind
    const schema = folderSchemaRegistry.getSchema(rootEntityKind);
    if (!schema) {
        return { created: false, reason: `No folder schema for entity kind: ${rootEntityKind}` };
    }

    // 2. Find subfolder definition matching the label
    const subfolderDef = findSubfolderDefinition(schema.allowedSubfolders, subfolderLabel);
    if (!subfolderDef) {
        return { created: false, reason: `No subfolder definition for: ${subfolderLabel}` };
    }

    if (!subfolderDef.autoCreateNetwork) {
        return { created: false, reason: 'Subfolder does not auto-create networks' };
    }

    if (!subfolderDef.networkSchemaId) {
        return { created: false, reason: 'No network schema ID configured' };
    }

    // 3. Check threshold (default: 2)
    const threshold = subfolderDef.networkCreationThreshold ?? 2;
    if (childEntities.length < threshold) {
        return {
            created: false,
            reason: `Threshold not met: ${childEntities.length}/${threshold} children`
        };
    }

    // 4. Check if network already exists for this subfolder
    const existingNetwork = await loadNetworkByFolderId(subfolderId);
    if (existingNetwork) {
        // Network exists - add any new members
        const newMembers = childEntities.filter(
            child => !existingNetwork.entityIds.includes(child.id)
        );

        for (const child of newMembers) {
            await addEntityToNetwork(existingNetwork.id, child.id);
        }

        return {
            created: false,
            networkId: existingNetwork.id,
            reason: 'Network already exists',
            membersAdded: newMembers.length
        };
    }

    // 5. Validate network schema exists
    const networkSchema = getSchemaById(subfolderDef.networkSchemaId);
    if (!networkSchema) {
        return {
            created: false,
            reason: `Network schema not found: ${subfolderDef.networkSchemaId}`
        };
    }

    // 6. Generate network name using pattern
    const networkName = generateNetworkName(
        subfolderDef.networkNamePattern ?? "{entityLabel}'s {subfolderLabel}",
        rootEntityLabel,
        rootEntityKind,
        subfolderLabel
    );

    // 7. Create the network instance
    const networkId = generateId();
    const allEntityIds = [rootEntityId, ...childEntities.map(c => c.id)];

    const network: NetworkInstance = {
        id: networkId,
        name: networkName,
        schemaId: subfolderDef.networkSchemaId,
        rootFolderId: subfolderId, // Link to subfolder, not root folder
        rootEntityId: rootEntityId,
        entityIds: allEntityIds,
        namespace,
        description: `Auto-created from ${rootEntityLabel}'s ${subfolderLabel} folder`,
        tags: ['auto-created', rootEntityKind.toLowerCase()],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveNetworkInstance(network);

    // 8. Create initial relationships based on folder relationship type
    await createInitialRelationships(
        networkId,
        rootEntityId,
        childEntities,
        subfolderDef.relationship.relationshipType,
        subfolderDef.relationship.bidirectional ?? false,
        subfolderDef.relationship.inverseType
    );

    console.log(`[NetworkAutoCreator] Created network "${networkName}" with ${allEntityIds.length} members`);

    return {
        created: true,
        networkId,
        reason: `Created network with ${allEntityIds.length} members`
    };
}

/**
 * Find subfolder definition by label (case-insensitive)
 */
function findSubfolderDefinition(
    subfolders: AllowedSubfolderDefinition[],
    label: string
): AllowedSubfolderDefinition | undefined {
    const normalizedLabel = label.toLowerCase().trim();
    return subfolders.find(
        sf => sf.label.toLowerCase().trim() === normalizedLabel
    );
}

/**
 * Generate network name from pattern with placeholder substitution
 */
function generateNetworkName(
    pattern: string,
    entityLabel: string,
    entityKind: string,
    subfolderLabel: string
): string {
    const kindDisplay = entityKind.charAt(0) + entityKind.slice(1).toLowerCase();

    return pattern
        .replace(/{entityLabel}/g, entityLabel)
        .replace(/{entityKind}/g, kindDisplay)
        .replace(/{subfolderLabel}/g, subfolderLabel);
}

/**
 * Create initial relationships in the network based on folder structure
 */
async function createInitialRelationships(
    networkId: string,
    rootEntityId: string,
    childEntities: ChildEntity[],
    relationshipType: string,
    bidirectional: boolean,
    inverseType?: string
): Promise<void> {
    const now = new Date();

    for (const child of childEntities) {
        // Create relationship from root to child (or child to root depending on schema)
        const relationship: NetworkRelationshipInstance = {
            id: generateId(),
            networkId,
            relationshipCode: relationshipType,
            sourceEntityId: child.id, // Child is source (e.g., "Arya is ALLY_OF Jon")
            targetEntityId: rootEntityId,
            strength: 1.0,
            notes: 'Created from folder structure',
            createdAt: now,
            updatedAt: now,
        };

        await saveNetworkRelationship(relationship);

        // If bidirectional, create inverse relationship
        if (bidirectional && inverseType) {
            const inverseRelationship: NetworkRelationshipInstance = {
                id: generateId(),
                networkId,
                relationshipCode: inverseType,
                sourceEntityId: rootEntityId,
                targetEntityId: child.id,
                strength: 1.0,
                notes: 'Created from folder structure (inverse)',
                createdAt: now,
                updatedAt: now,
            };

            await saveNetworkRelationship(inverseRelationship);
        }
    }
}

// ===== CONVENIENCE HELPERS =====

/**
 * Check if a subfolder should trigger network auto-creation
 */
export function shouldCreateNetwork(
    entityKind: EntityKind,
    subfolderLabel: string
): boolean {
    const schema = folderSchemaRegistry.getSchema(entityKind);
    if (!schema) return false;

    const subfolderDef = findSubfolderDefinition(schema.allowedSubfolders, subfolderLabel);
    return subfolderDef?.autoCreateNetwork ?? false;
}

/**
 * Get network creation threshold for a subfolder
 */
export function getNetworkThreshold(
    entityKind: EntityKind,
    subfolderLabel: string
): number {
    const schema = folderSchemaRegistry.getSchema(entityKind);
    if (!schema) return Infinity;

    const subfolderDef = findSubfolderDefinition(schema.allowedSubfolders, subfolderLabel);
    return subfolderDef?.networkCreationThreshold ?? 2;
}

/**
 * Get all subfolder configs that support network auto-creation for an entity kind
 */
export function getNetworkEnabledSubfolders(
    entityKind: EntityKind
): AllowedSubfolderDefinition[] {
    const schema = folderSchemaRegistry.getSchema(entityKind);
    if (!schema) return [];

    return schema.allowedSubfolders.filter(sf => sf.autoCreateNetwork);
}
