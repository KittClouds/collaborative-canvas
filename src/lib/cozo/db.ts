/**
 * CozoDB Service - Enhanced with SQLite OPFS Persistence
 * 
 * Replaces manual JSON snapshots with a robust SQLite Bridge.
 * - Hydrates in-memory Cozo from SQLite tables on startup.
 * - Syncs Cozo relations to SQLite tables on write.
 */

import init, { CozoDb } from 'cozo-lib-wasm';
// @ts-ignore - Vite specific import
import wasmUrl from 'cozo-lib-wasm/cozo_lib_wasm_bg.wasm?url';
import { sqliteService } from '@/lib/persistence/sqlite-service';

export class CozoDbService {
    private db: CozoDb | null = null;
    private initPromise: Promise<void> | null = null;
    
    /**
     * Initialize CozoDB and hydrate from SQLite persistence.
     */
    async init(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this.doInit().catch(err => {
            console.error('[CozoDB] Initialization failed:', err);
            this.initPromise = null;
            throw err;
        });

        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        console.log('[CozoDB] Starting initialization...');

        // 1. Init WASM
        await init(wasmUrl);
        
        // 2. Init SQLite Backend (Parallel)
        await sqliteService.init();

        // 3. Create In-Memory Cozo Instance
        this.db = CozoDb.new();
        console.log('[CozoDB] ✅ Database instance created');

        // 4. Hydrate from SQLite OPFS
        await this.hydrateFromPersistence();
        console.log('[CozoDB] ✅ Initialization complete');
    }

    /**
     * Restore state from SQLite tables into Cozo
     */
    private async hydrateFromPersistence(): Promise<void> {
        const tables = sqliteService.getTables();
        if (tables.length === 0) {
            console.log('[CozoDB] No persistent data found (fresh start)');
            return;
        }

        console.log(`[CozoDB] Hydrating from ${tables.length} persistent tables...`);
        const start = performance.now();

        for (const tableName of tables) {
            try {
                // Fetch all rows from SQLite
                const rows = sqliteService.query(`SELECT * FROM "${tableName}"`);
                if (rows.length === 0) continue;

                // Construct Cozo Import JSON
                // SQLite returns objects { col1: val1, col2: val2 }
                // Cozo import needs headers and rows
                const headers = Object.keys(rows[0]);
                const values = rows.map(r => headers.map(h => r[h]));

                const payload = JSON.stringify({
                    relations: [{
                        name: tableName,
                        headers: headers,
                        rows: values
                    }]
                });

                this.db?.import_relations(payload);
            } catch (err) {
                console.error(`[CozoDB] Failed to hydrate table ${tableName}:`, err);
            }
        }

        console.log(`[CozoDB] Hydration complete in ${(performance.now() - start).toFixed(1)}ms`);
    }

    /**
     * Persist specific relations to SQLite
     * Call this after critical writes or on a debounce
     */
    async persistRelations(relationNames: string[]): Promise<void> {
        if (!this.db) return;

        try {
            // Export from Cozo
            const payload = JSON.stringify({ relations: relationNames });
            const exportJson = this.db.export_relations(payload);
            const data = JSON.parse(exportJson);

            // Sync each relation to SQLite
            for (const rel of data.relations) {
                const { name, headers, rows } = rel;
                
                // Map Cozo types to SQLite types (simplified)
                const columns = headers.map((h: string) => ({ 
                    name: h, 
                    type: 'TEXT' // Store everything as text/json to be safe, or map strictly if schema known
                }));
                
                // Create table if needed (dynamic schema adaptation)
                sqliteService.createTable(name, columns);

                // Bulk insert
                // Note: Cozo values might need stringification for complex types if SQLite doesn't handle them
                const sanitizedRows = rows.map((row: any[]) => 
                    row.map(val => (typeof val === 'object' ? JSON.stringify(val) : val))
                );

                sqliteService.bulkInsert(name, headers, sanitizedRows);
            }
            
            console.debug(`[CozoDB] Persisted ${relationNames.join(', ')} to OPFS`);
        } catch (err) {
            console.error('[CozoDB] Persistence failed:', err);
        }
    }

    // ==================== PROXY METHODS ====================

    run(script: string, params: Record<string, any> = {}): string {
        if (!this.db) throw new Error('Not initialized');
        return this.db.run(script, JSON.stringify(params), false);
    }

    runQuery(script: string, params: Record<string, any> = {}): any {
        const res = this.run(script, params);
        try {
            return JSON.parse(res);
        } catch (e) {
            throw new Error(`CozoDB parse error: ${e}`);
        }
    }

    exportRelations(relations: string[]): string {
        if (!this.db) throw new Error('Not initialized');
        return this.db.export_relations(JSON.stringify({ relations }));
    }

    importRelations(data: string): string {
        if (!this.db) throw new Error('Not initialized');
        const res = this.db.import_relations(data);
        
        // Trigger auto-persistence for imported data?
        // Might be too heavy. Let caller decide.
        return res;
    }
}

export const cozoDb = new CozoDbService();
