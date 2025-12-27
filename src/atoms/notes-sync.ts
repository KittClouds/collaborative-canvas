import { atom } from 'jotai';
import { dbClient } from '@/lib/db/client/db-client';
import type { SQLiteNode } from '@/lib/db/client/types';
import { bulkUpdateNotesAtom } from './notes-atomic';
import type { Note } from '@/types/noteTypes';

// Track the last successful sync timestamp
export const lastSyncTimestampAtom = atom<number>(0);

/**
 * Transform SQLite node to Note type
 * (Duplicated from notes-async.ts for independence)
 */
function transformToNote(node: SQLiteNode): Note {
    return {
        ...node,
        type: 'NOTE',
        parentId: node.parent_id,
        folderId: node.parent_id,
        title: node.label,
        createdAt: node.created_at,
        updatedAt: node.updated_at,
        connections: node.extraction ? JSON.parse(node.extraction) : undefined,
    } as unknown as Note;
}

/**
 * Fetch only notes modified after the last sync timestamp.
 * Returns an array of Note objects.
 */
export const incrementalNotesAtom = atom(async (get) => {
    const lastSync = get(lastSyncTimestampAtom);

    // Query only notes updated since last sync
    // Using existing idx_nodes_updated index (DESC) or table scan if small delta
    // We order by updated_at ASC to process oldest changes first if needed, 
    // though for map merging order doesn't strictly matter unless same note changed multiple times (unlikely in batch)
    const sql = `
        SELECT * FROM nodes 
        WHERE type = 'NOTE' AND updated_at > ? 
        ORDER BY updated_at ASC
    `;

    const rows = await dbClient.query<SQLiteNode>(sql, [lastSync]);

    return rows.map(transformToNote);
});

/**
 * Sync atom: Fetches changed notes and merges them into the atomic store.
 * Updates lastSyncTimestampAtom on success.
 */
export const syncNotesAtom = atom(
    null,
    async (get, set) => {
        try {
            const changedNotes = await get(incrementalNotesAtom);

            if (changedNotes.length > 0) {
                console.log(`[NotesSync] Syncing ${changedNotes.length} changed notes`);

                // Merge into atomic store
                set(bulkUpdateNotesAtom, changedNotes);

                // Update timestamp to the latest update time found
                const maxTime = Math.max(...changedNotes.map(n => n.updatedAt || 0));
                set(lastSyncTimestampAtom, maxTime);
            }
        } catch (error) {
            console.error('[NotesSync] Sync failed:', error);
            throw error;
        }
    }
);
