/**
 * Relationship System Startup - Initialize and connect all components
 * 
 * This module:
 * 1. Loads relationships from SQLite
 * 2. Runs integrity checks
 * 3. Sets up EntityRegistry callbacks
 * 4. Syncs folder-based relationships
 */

import { relationshipRegistry } from './relationship-registry';
import { RelationshipIntegrityChecker } from './integrity';
import { RelationshipMigrationAdapter } from './migration-adapter';
import { entityRegistry } from '@/lib/entities/entity-registry';
import { folderRelationshipCreator } from '@/lib/folders/relationship-creator';
import type { RelationshipStoreImpl } from '@/lib/storage/impl/RelationshipStoreImpl';

let initialized = false;
let relationshipStore: RelationshipStoreImpl | null = null;

/**
 * Set the SQLite store for persistence
 */
export function setRelationshipStore(store: RelationshipStoreImpl): void {
    relationshipStore = store;

    relationshipRegistry.setPersistCallback(async (rel) => {
        if (relationshipStore) {
            await relationshipStore.save(rel);
        }
    });

    relationshipRegistry.setDeleteCallback(async (id) => {
        if (relationshipStore) {
            await relationshipStore.delete(id);
        }
    });
}

/**
 * Initialize the relationship system
 * Call this on app startup after SQLite is ready
 */
export async function initializeRelationshipSystem(): Promise<{
    loaded: number;
    issuesFound: number;
    issuesRepaired: number;
    folderRelsSynced: number;
}> {
    if (initialized) {
        console.log('[RelationshipSystem] Already initialized');
        return { loaded: 0, issuesFound: 0, issuesRepaired: 0, folderRelsSynced: 0 };
    }

    console.log('[RelationshipSystem] Initializing...');

    let loaded = 0;
    if (relationshipStore) {
        const stored = await relationshipStore.getAll();
        for (const rel of stored) {
            relationshipRegistry.addWithoutPersist(rel);
        }
        loaded = stored.length;
        console.log(`[RelationshipSystem] Loaded ${loaded} relationships from SQLite`);
    }

    entityRegistry.setOnEntityDeleteCallback((entityId) => {
        const deleted = relationshipRegistry.deleteByEntity(entityId);
        if (deleted > 0) {
            console.log(`[RelationshipSystem] Cascade deleted ${deleted} relationships for entity ${entityId}`);
        }
    });

    entityRegistry.setOnEntityMergeCallback((oldId, newId) => {
        const migrated = relationshipRegistry.migrateEntity(oldId, newId);
        if (migrated > 0) {
            console.log(`[RelationshipSystem] Migrated ${migrated} relationships from ${oldId} to ${newId}`);
        }
    });

    const checker = new RelationshipIntegrityChecker(relationshipRegistry, entityRegistry);
    const issues = checker.checkIntegrity();
    let issuesRepaired = 0;

    if (issues.length > 0) {
        console.warn(`[RelationshipSystem] Found ${issues.length} integrity issues`);
        const result = checker.repairIntegrity(issues);
        issuesRepaired = result.removed + result.merged;
        console.log(`[RelationshipSystem] Repaired: ${result.removed} removed, ${result.merged} merged`);
    }

    let folderRelsSynced = 0;
    try {
        const folderRels = folderRelationshipCreator.getAll();
        for (const rel of folderRels) {
            if (!relationshipRegistry.exists(rel.id)) {
                const unified = RelationshipMigrationAdapter.convertFolderRel(rel);
                relationshipRegistry.add({
                    sourceEntityId: unified.sourceEntityId,
                    targetEntityId: unified.targetEntityId,
                    type: unified.type,
                    inverseType: unified.inverseType,
                    bidirectional: unified.bidirectional,
                    namespace: unified.namespace,
                    attributes: unified.attributes,
                    provenance: unified.provenance
                }, true);
                folderRelsSynced++;
            }
        }
        if (folderRelsSynced > 0) {
            console.log(`[RelationshipSystem] Synced ${folderRelsSynced} folder relationships`);
        }
    } catch (e) {
        console.warn('[RelationshipSystem] Could not sync folder relationships:', e);
    }

    initialized = true;
    console.log('[RelationshipSystem] Ready');

    return {
        loaded,
        issuesFound: issues.length,
        issuesRepaired,
        folderRelsSynced
    };
}

/**
 * Check if the system is initialized
 */
export function isRelationshipSystemInitialized(): boolean {
    return initialized;
}

/**
 * Get current system stats
 */
export function getRelationshipSystemStats() {
    return {
        initialized,
        ...relationshipRegistry.getStats()
    };
}

/**
 * Force re-initialization (for testing/recovery)
 */
export function resetRelationshipSystem(): void {
    relationshipRegistry.clear();
    initialized = false;
}
