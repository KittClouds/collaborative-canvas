/**
 * Decoration Cache - Persistent storage for parsed decoration spans
 * 
 * Avoids rescanning unchanged notes by storing decoration results
 * keyed by (note_id, content_hash). Entity hydration bumps a global
 * version to invalidate all caches.
 */

import { dbClient } from '@/lib/db/client/db-client';
import type { HighlightSpan } from './types';

// ==================== TYPES ====================

interface CachedDecorationRow {
    content_hash: string;
    entity_version: number;
    spans_json: string;
}

// ==================== GLOBAL STATE ====================

// Entity version - bumps when entities are hydrated, invalidating all caches
let currentEntityVersion = 0;

// ==================== CACHE CLASS ====================

class DecorationCache {
    /**
     * Get cached decorations for a note if content hash matches
     */
    async get(noteId: string, contentHash: string): Promise<HighlightSpan[] | null> {
        try {
            const result = await dbClient.query<CachedDecorationRow>(
                `SELECT content_hash, entity_version, spans_json 
                 FROM note_decorations 
                 WHERE note_id = ?`,
                [noteId]
            );

            if (!result || result.length === 0) {
                return null;
            }

            const row = result[0];

            // Check hash match
            if (row.content_hash !== contentHash) {
                console.log(`[DecorationCache] Hash mismatch for ${noteId.slice(0, 8)}... → scanning`);
                return null;
            }

            // Check entity version
            if (row.entity_version !== currentEntityVersion) {
                console.log(`[DecorationCache] Entity version mismatch for ${noteId.slice(0, 8)}... → scanning`);
                return null;
            }

            // Cache hit!
            try {
                const spans = JSON.parse(row.spans_json) as HighlightSpan[];
                console.log(`[DecorationCache] Hit for ${noteId.slice(0, 8)}... (${spans.length} spans)`);
                return spans;
            } catch (parseErr) {
                console.warn('[DecorationCache] Failed to parse spans:', parseErr);
                return null;
            }
        } catch (err) {
            // Table might not exist yet on first run - silent fail
            return null;
        }
    }

    /**
     * Store decorations for a note
     */
    async set(noteId: string, contentHash: string, spans: HighlightSpan[]): Promise<void> {
        try {
            const now = Date.now();
            const spansJson = JSON.stringify(spans);

            await dbClient.exec(
                `INSERT OR REPLACE INTO note_decorations 
                 (note_id, content_hash, entity_version, spans_json, created_at, updated_at)
                 VALUES ('${noteId}', '${contentHash}', ${currentEntityVersion}, '${spansJson.replace(/'/g, "''")}', ${now}, ${now})`
            );

            console.log(`[DecorationCache] Stored ${spans.length} spans for ${noteId.slice(0, 8)}...`);
        } catch (err) {
            // Non-fatal - in-memory cache still works
            console.warn('[DecorationCache] Set failed:', err);
        }
    }

    /**
     * Invalidate cache for a specific note
     */
    async invalidate(noteId: string): Promise<void> {
        try {
            await dbClient.exec(`DELETE FROM note_decorations WHERE note_id = '${noteId}'`);
        } catch (err) {
            console.warn('[DecorationCache] Invalidate failed:', err);
        }
    }

    /**
     * Invalidate all caches (called when entities change)
     */
    invalidateAll(): void {
        currentEntityVersion++;
        console.log(`[DecorationCache] All caches invalidated (entity version → ${currentEntityVersion})`);
        // No need to delete rows - version mismatch will cause cache misses
    }

    /**
     * Get current entity version
     */
    getEntityVersion(): number {
        return currentEntityVersion;
    }

    /**
     * Clean up stale entries (older than given days)
     */
    async cleanup(olderThanDays: number = 7): Promise<number> {
        try {
            const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
            await dbClient.exec(`DELETE FROM note_decorations WHERE updated_at < ${cutoff}`);
            console.log(`[DecorationCache] Cleaned up stale entries`);
            return 0;
        } catch (err) {
            console.warn('[DecorationCache] Cleanup failed:', err);
            return 0;
        }
    }
}

// ==================== SINGLETON ====================

export const decorationCache = new DecorationCache();
