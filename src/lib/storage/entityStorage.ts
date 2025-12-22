/**
 * EntityStorage - Persist EntityRegistry to IndexedDB
 * 
 * Uses same storage system as notes
 */

import { openDB, type IDBPDatabase } from 'idb';
import { EntityRegistry } from '@/lib/entities/entity-registry';

const DB_NAME = 'inklings-db';
const REGISTRY_STORE = 'entity_registry';
const REGISTRY_KEY = 'global';

/**
 * Initialize entity storage (create object store if needed)
 */
export async function initEntityStorage(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, 2, {
        upgrade(db, oldVersion) {
            // Create registry store if it doesn't exist
            if (!db.objectStoreNames.contains(REGISTRY_STORE)) {
                db.createObjectStore(REGISTRY_STORE);
            }
        },
    });
}

/**
 * Save registry to IndexedDB
 */
export async function saveEntityRegistry(registry: EntityRegistry): Promise<void> {
    const db = await initEntityStorage();
    const data = registry.toJSON();
    await db.put(REGISTRY_STORE, data, REGISTRY_KEY);
}

/**
 * Load registry from IndexedDB
 */
export async function loadEntityRegistry(): Promise<EntityRegistry | null> {
    try {
        const db = await initEntityStorage();
        const data = await db.get(REGISTRY_STORE, REGISTRY_KEY);

        if (!data) {
            return null;
        }

        return EntityRegistry.fromJSON(data);
    } catch (error) {
        console.error('Failed to load entity registry:', error);
        return null;
    }
}

/**
 * Clear entity registry from storage
 */
export async function clearEntityRegistry(): Promise<void> {
    const db = await initEntityStorage();
    await db.delete(REGISTRY_STORE, REGISTRY_KEY);
}

// ==================== AUTO-SAVE WITH DEBOUNCE ====================

let saveTimeout: NodeJS.Timeout | null = null;

/**
 * Save registry with debouncing (waits 1 second after last change)
 */
export function autoSaveEntityRegistry(registry: EntityRegistry): void {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
        try {
            await saveEntityRegistry(registry);
            console.log('Entity registry auto-saved');
        } catch (error) {
            console.error('Failed to auto-save entity registry:', error);
        }
    }, 1000);
}
