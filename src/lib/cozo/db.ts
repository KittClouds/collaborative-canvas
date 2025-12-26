/**
 * CozoDB Service - Enhanced with IndexedDB Persistence
 * 
 * Features:
 * - WASM initialization with proper error handling
 * - IndexedDB-based persistence layer
 * - Automatic snapshot/restore on startup
 * - Export/import for data portability
 * - Connection pooling prevention (singleton pattern)
 */

import init, { CozoDb } from 'cozo-lib-wasm';
// @ts-ignore - Vite specific import
import wasmUrl from 'cozo-lib-wasm/cozo_lib_wasm_bg.wasm?url';
import { openDB, type IDBPDatabase } from 'idb';

// ==================== TYPES ====================

interface CozoSnapshotDB {
    'snapshots': {
        key: string;
        value: {
            id: string;
            timestamp: number;
            data: string; // Serialized CozoDB state
            metadata: {
                totalRelations: number;
                version: string;
            };
        };
    };
    'metadata': {
        key: string;
        value: any;
    };
}

// ==================== SERVICE ====================

export class CozoDbService {
    private db: CozoDb | null = null;
    private initPromise: Promise<void> | null = null;
    private persistenceDb: IDBPDatabase<CozoSnapshotDB> | null = null;

    // Configuration
    private readonly IDB_NAME = 'cozo-persistence';
    private readonly IDB_VERSION = 2;
    private readonly SNAPSHOT_KEY = 'latest';

    /**
     * Initialize the CozoDB WASM module + persistence layer
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

        // Step 3: Open IndexedDB for persistence
        await this.openPersistenceDB();
        console.log('[CozoDB] ✅ Persistence layer ready');

        // Step 4: Restore from latest snapshot (if exists)
        await this.restoreLatestSnapshot();
        console.log('[CozoDB] ✅ Initialization complete');
    }

    /**
     * Open IndexedDB for persistence
     */
    private async openPersistenceDB(): Promise<void> {
        try {
            this.persistenceDb = await openDB<CozoSnapshotDB>(this.IDB_NAME, this.IDB_VERSION, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    // Create object stores on first run or upgrade
                    if (!db.objectStoreNames.contains('snapshots')) {
                        db.createObjectStore('snapshots', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('metadata')) {
                        db.createObjectStore('metadata');
                    }

                    console.log('[CozoDB] IndexedDB schema created/upgraded');
                },
                blocked() {
                    console.warn('[CozoDB] IndexedDB blocked by another tab');
                },
                blocking() {
                    console.warn('[CozoDB] This tab is blocking IndexedDB upgrade');
                },
            });
        } catch (err) {
            console.error('[CozoDB] Failed to open IndexedDB:', err);
            // Continue without persistence - better than crashing
        }
    }

    /**
     * Restore CozoDB state from IndexedDB
     */
    private async restoreLatestSnapshot(): Promise<void> {
        if (!this.persistenceDb) return;

        try {
            const snapshot = await this.persistenceDb.get('snapshots', this.SNAPSHOT_KEY);

            if (snapshot) {
                console.log('[CozoDB] Restoring snapshot from', new Date(snapshot.timestamp));
                this.importRelations(snapshot.data);
                console.log('[CozoDB] ✅ Restored', snapshot.metadata.totalRelations, 'relations');
            } else {
                console.log('[CozoDB] No previous snapshot found, starting fresh');
            }
        } catch (err) {
            console.error('[CozoDB] Failed to restore snapshot:', err);
            // Continue anyway - better to have empty DB than crash
        }
    }

    /**
     * Save CozoDB state to IndexedDB
     */
    async saveSnapshot(relationNames: string[]): Promise<void> {
        if (!this.persistenceDb || !this.db) {
            console.warn('[CozoDB] Cannot save snapshot - not initialized');
            return;
        }

        try {
            const data = this.exportRelations(relationNames);

            const snapshot = {
                id: this.SNAPSHOT_KEY,
                timestamp: Date.now(),
                data,
                metadata: {
                    totalRelations: relationNames.length,
                    version: '1.0',
                },
            };

            await this.persistenceDb.put('snapshots', snapshot);
            console.log('[CozoDB] ✅ Snapshot saved:', snapshot.metadata.totalRelations, 'relations');
        } catch (err) {
            console.error('[CozoDB] Failed to save snapshot:', err);
            throw err;
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
            return this.db.run(script, paramsStr, false);
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
            return this.db.import_relations(data);
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
            version: '1.0',
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

        // Save as snapshot
        if (parsed.relations) {
            await this.saveSnapshot(parsed.relations);
        }
    }

    /**
     * Clear all IndexedDB snapshots (useful for debugging)
     */
    async clearSnapshots(): Promise<void> {
        if (!this.persistenceDb) return;

        await this.persistenceDb.clear('snapshots');
        console.log('[CozoDB] ⚠️ All snapshots cleared');
    }

    /**
     * Get snapshot metadata (for debugging/monitoring)
     */
    async getSnapshotInfo(): Promise<{ timestamp: Date; totalRelations: number } | null> {
        if (!this.persistenceDb) return null;

        const snapshot = await this.persistenceDb.get('snapshots', this.SNAPSHOT_KEY);

        if (!snapshot) return null;

        return {
            timestamp: new Date(snapshot.timestamp),
            totalRelations: snapshot.metadata.totalRelations,
        };
    }

    /**
     * Close database connection (cleanup)
     */
    async close(): Promise<void> {
        // CozoDB WASM doesn't expose close() - it's garbage collected
        // But we can close IndexedDB
        if (this.persistenceDb) {
            this.persistenceDb.close();
            this.persistenceDb = null;
        }

        this.db = null;
        this.initPromise = null;

        console.log('[CozoDB] Connection closed');
    }
}

// Singleton instance
export const cozoDb = new CozoDbService();
