/**
 * Decoration Cache - DISABLED due to SQLite OPFS corruption issue
 * 
 * TODO: Fix the nodes_temp_old orphan table issue in OPFS, then re-enable
 * For now, this is a no-op cache - highlighting still works, just rescans each time
 */

import type { HighlightSpan } from './types';

// Entity version - bumps when entities are hydrated, invalidating all caches
let currentEntityVersion = 0;

class DecorationCache {
    /**
     * Get cached decorations - DISABLED, always returns null (cache miss)
     */
    async get(_noteId: string, _contentHash: string): Promise<HighlightSpan[] | null> {
        // Disabled - always rescan
        return null;
    }

    /**
     * Store decorations - DISABLED, no-op
     */
    async set(_noteId: string, _contentHash: string, _spans: HighlightSpan[]): Promise<void> {
        // Disabled - no-op
    }

    /**
     * Invalidate cache for a specific note - DISABLED, no-op
     */
    async invalidate(_noteId: string): Promise<void> {
        // Disabled - no-op
    }

    /**
     * Invalidate all caches (called when entities change)
     */
    invalidateAll(): void {
        currentEntityVersion++;
        console.log(`[DecorationCache] All caches invalidated (entity version → ${currentEntityVersion})`);
    }

    /**
     * Get current entity version
     */
    getEntityVersion(): number {
        return currentEntityVersion;
    }

    /**
     * Clean up stale entries - DISABLED, no-op
     */
    async cleanup(_olderThanDays: number = 7): Promise<number> {
        return 0;
    }
}

export const decorationCache = new DecorationCache();
