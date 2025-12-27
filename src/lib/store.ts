/**
 * Global Jotai store instance
 * Allows atom access outside React components (services, workers, etc.)
 */
import { createStore } from 'jotai';

// Create singleton store
export const jotaiStore = createStore();

// Store initialization flag
let storeInitialized = false;

/**
 * Initialize store with data from database
 * Called once on app startup
 */
export async function initializeJotaiStore(): Promise<void> {
    if (storeInitialized) {
        console.warn('[Store] Already initialized, skipping');
        return;
    }

    try {
        console.log('[Store] Initializing Jotai store...');

        // Import hydration atom (prevents circular deps)
        const { hydrateNotesAtom } = await import('@/atoms/notes-async');
        const { initSearchServicesAtom } = await import('@/atoms/search');

        // Hydrate store from database
        await jotaiStore.set(hydrateNotesAtom);

        // Initialize search services
        jotaiStore.set(initSearchServicesAtom as any);

        storeInitialized = true;
        console.log('[Store] ✅ Jotai store initialized');
    } catch (error) {
        console.error('[Store] ❌ Failed to initialize:', error);
        throw error;
    }
}

/**
 * Reset store (for testing/logout)
 */
export function resetJotaiStore(): void {
    storeInitialized = false;
    // Store will be re-initialized on next init call
}
