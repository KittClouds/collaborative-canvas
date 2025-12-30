/**
 * CozoDB Service - SQLite Bridge Persistence
 * 
 * Features:
 * - WASM initialization with proper error handling
 * - SQLite-based persistence layer via dbClient
 * - Automatic hydration from SQLite on startup
 * - Auto-persist on write operations
 * - Export/import for data portability
 * - Connection pooling prevention (singleton pattern)
 */

import init, { CozoDb } from 'cozo-lib-wasm';
// @ts-ignore - Vite specific import
import wasmUrl from 'cozo-lib-wasm/cozo_lib_wasm_bg.wasm?url';
import { dbClient } from '@/lib/db';

// ==================== TYPES ====================

// Cozo relation name to SQLite table mapping
const COZO_TABLE_MAP: Record<string, string> = {
    'entities': 'cozo_entities',
    'entity_aliases': 'cozo_entity_aliases',
    'entity_mentions': 'cozo_entity_mentions',
    'entity_metadata': 'cozo_entity_metadata',
    'relationships': 'cozo_relationships',
    'relationship_provenance': 'cozo_relationship_provenance',
    'relationship_attributes': 'cozo_relationship_attributes',
};

const SQLITE_TABLE_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(COZO_TABLE_MAP).map(([k, v]) => [v, k])
);

// ==================== SERVICE ====================

export class CozoDbService {
    private db: CozoDb | null = null;
    private initPromise: Promise<void> | null = null;
    private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingRelations = new Set<string>();

    /**
     * Initialize the CozoDB WASM module + SQLite persistence layer
     * This must be called before using the database.
     */
    async init(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this.doInit().catch(err => {
            console.error('[CozoDB] Initialization failed:', err);
            this.initPromise = null; // Reset so retry is possible
            throw err;
        });

        return this.initPromise;
    }

    /**
     * Internal initialization logic
     */
    private async doInit(): Promise<void> {
        console.log('[CozoDB] Starting initialization...');

        // Step 1: Initialize WASM module
        await init(wasmUrl);
        console.log('[CozoDB] ✅ WASM module loaded');

        // Step 2: Create in-memory CozoDB instance
        this.db = CozoDb.new();
        console.log('[CozoDB] ✅ Database instance created');

        // Step 3: Initialize dbClient (SQLite)
        await dbClient.init();
        console.log('[CozoDB] ✅ SQLite persistence layer ready');

        // Step 4: Hydrate from SQLite
        await this.hydrateFromSQLite();
        console.log('[CozoDB] ✅ Initialization complete');
    }

    /**
     * Hydrate CozoDB relations from SQLite tables
     */
    private async hydrateFromSQLite(): Promise<void> {
        try {
            const tables = await dbClient.cozoGetTables();
            let totalRows = 0;

            for (const table of tables) {
                const cozoRelation = SQLITE_TABLE_MAP[table];
                if (!cozoRelation) continue;

                const { columns, rows } = await dbClient.cozoGetTableData(table);
                if (rows.length === 0) continue;

                // Build import payload
                const importData = JSON.stringify({
                    relations: [{
                        name: cozoRelation,
                        headers: columns,
                        rows: rows,
                    }]
                });

                try {
                    this.db?.import_relations(importData);
                    totalRows += rows.length;
                } catch (err) {
                    console.warn(`[CozoDB] Failed to import ${cozoRelation}:`, err);
                }
            }

            console.log(`[CozoDB] ✅ Hydrated ${tables.length} tables, ${totalRows} rows from SQLite`);
        } catch (err) {
            console.error('[CozoDB] Hydration from SQLite failed:', err);
            // Continue anyway - better to start fresh than crash
        }
    }

    /**
     * Sync specific relations to SQLite
     */
    private async syncToSQLite(relations: string[]): Promise<void> {
        if (!this.db || relations.length === 0) return;

        try {
            const payload = JSON.stringify({ relations });
            const exportJson = this.db.export_relations(payload);
            const data = JSON.parse(exportJson);

            if (!data.relations) return;

            for (const rel of data.relations) {
                const sqliteTable = COZO_TABLE_MAP[rel.name];
                if (!sqliteTable) continue;

                // Clear and re-insert (simpler than diffing)
                await dbClient.cozoClearTable(sqliteTable);

                if (rel.rows.length > 0) {
                    await dbClient.cozoBulkInsert(sqliteTable, rel.headers, rel.rows);
                }
            }

            console.debug(`[CozoDB] Synced to SQLite: ${relations.join(', ')}`);
        } catch (err) {
            console.error('[CozoDB] Sync to SQLite failed:', err);
        }
    }

    /**
     * Schedule a debounced sync to SQLite
     */
    private scheduleSyncToSQLite(relations: string[]): void {
        for (const rel of relations) {
            this.pendingRelations.add(rel);
        }

        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }

        this.syncDebounceTimer = setTimeout(() => {
            const relationsToSync = Array.from(this.pendingRelations);
            this.pendingRelations.clear();
            this.syncToSQLite(relationsToSync).catch(err =>
                console.error('[CozoDB] Debounced sync failed:', err)
            );
        }, 1000);
    }

    /**
     * Detect modified relations from a script and schedule sync
     */
    private detectAndScheduleSync(script: string): void {
        // Find relations being modified: "?[...] <- ... :put relation_name" or ":rm relation_name"
        const putMatches = script.matchAll(/:put\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        const rmMatches = script.matchAll(/:rm\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        const insertMatches = script.matchAll(/:insert\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);

        const modifiedRelations = new Set<string>();

        for (const m of putMatches) {
            if (COZO_TABLE_MAP[m[1]]) modifiedRelations.add(m[1]);
        }
        for (const m of rmMatches) {
            if (COZO_TABLE_MAP[m[1]]) modifiedRelations.add(m[1]);
        }
        for (const m of insertMatches) {
            if (COZO_TABLE_MAP[m[1]]) modifiedRelations.add(m[1]);
        }

        if (modifiedRelations.size > 0) {
            this.scheduleSyncToSQLite(Array.from(modifiedRelations));
        }
    }

    /**
     * Check if the DB is initialized and ready.
     */
    isReady(): boolean {
        return this.db !== null;
    }

    /**
     * Run a CozoScript query.
     * @param script The CozoScript query string
     * @param params Parameters as a generic object (will be JSON stringified)
     * @returns The raw string result from CozoDB
     */
    run(script: string, params: Record<string, any> = {}): string {
        if (!this.db) {
            throw new Error('[CozoDB] Not initialized. Call init() first.');
        }

        try {
            const paramsStr = JSON.stringify(params);
            const result = this.db.run(script, paramsStr, false);

            // Auto-detect writes and schedule sync
            this.detectAndScheduleSync(script);

            return result;
        } catch (err) {
            console.error('[CozoDB] Query failed:', script, err);
            throw err;
        }
    }

    /**
     * Run a query and parse the result as JSON.
     */
    runQuery(script: string, params: Record<string, any> = {}): any {
        const resultStr = this.run(script, params);

        try {
            return JSON.parse(resultStr);
        } catch (e) {
            console.error('[CozoDB] Failed to parse result:', resultStr);
            throw new Error(`CozoDB result parse error: ${e}`);
        }
    }

    /**
     * Export relations as JSON string.
     * @param relations Array of relation names to export
     */
    exportRelations(relations: string[]): string {
        if (!this.db) throw new Error('[CozoDB] Not initialized');

        try {
            const payload = JSON.stringify({ relations });
            return this.db.export_relations(payload);
        } catch (err) {
            console.error('[CozoDB] Export failed:', err);
            throw err;
        }
    }

    /**
     * Import relations from JSON string.
     * @param data Serialized relations data (from exportRelations)
     */
    importRelations(data: string): string {
        if (!this.db) throw new Error('[CozoDB] Not initialized');

        try {
            const result = this.db.import_relations(data);

            // Parse imported data to find relation names and schedule sync
            try {
                const parsed = JSON.parse(data);
                if (parsed.relations) {
                    const relationNames = parsed.relations.map((r: any) => r.name);
                    this.scheduleSyncToSQLite(relationNames);
                }
            } catch {
                // Ignore parse errors - sync will happen on next write
            }

            return result;
        } catch (err) {
            console.error('[CozoDB] Import failed:', err);
            throw err;
        }
    }

    /**
     * Export entire database state to downloadable JSON
     */
    async exportToFile(relations: string[]): Promise<Blob> {
        const data = this.exportRelations(relations);

        const exportData = {
            version: '2.0',
            timestamp: new Date().toISOString(),
            relations,
            data,
        };

        const json = JSON.stringify(exportData, null, 2);
        return new Blob([json], { type: 'application/json' });
    }

    /**
     * Import database state from file
     */
    async importFromFile(fileContent: string): Promise<void> {
        const parsed = JSON.parse(fileContent);

        if (!parsed.data) {
            throw new Error('Invalid export file format');
        }

        this.importRelations(parsed.data);
    }

    /**
     * @deprecated - Now auto-persists via SQLite. This is a no-op kept for backwards compatibility.
     */
    async saveSnapshot(_relationNames: string[]): Promise<void> {
        // No-op: Persistence is now automatic via SQLite bridge
        // Writes are synced automatically when using run() or runQuery()
    }

    /**
     * Clear all SQLite CozoDB tables (useful for debugging)
     */
    async clearSnapshots(): Promise<void> {
        const tables = Object.values(COZO_TABLE_MAP);
        for (const table of tables) {
            try {
                await dbClient.cozoClearTable(table);
            } catch (err) {
                console.warn(`[CozoDB] Failed to clear ${table}:`, err);
            }
        }
        console.log('[CozoDB] ⚠️ All CozoDB SQLite tables cleared');
    }

    /**
     * Get persistence info (for debugging/monitoring)
     */
    async getSnapshotInfo(): Promise<{ timestamp: Date; totalRelations: number } | null> {
        try {
            const tables = await dbClient.cozoGetTables();
            let totalRows = 0;

            for (const table of tables) {
                const { rows } = await dbClient.cozoGetTableData(table);
                totalRows += rows.length;
            }

            return {
                timestamp: new Date(), // SQLite doesn't track this, return current time
                totalRelations: tables.length,
            };
        } catch {
            return null;
        }
    }

    /**
     * Close database connection (cleanup)
     */
    async close(): Promise<void> {
        // Flush any pending syncs
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
            const relationsToSync = Array.from(this.pendingRelations);
            if (relationsToSync.length > 0) {
                await this.syncToSQLite(relationsToSync);
            }
        }

        this.db = null;
        this.initPromise = null;
        this.pendingRelations.clear();

        console.log('[CozoDB] Connection closed');
    }
}

// Singleton instance
export const cozoDb = new CozoDbService();
