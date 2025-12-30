import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

/**
 * SQLite Service using OPFS (Origin Private File System)
 * Provides a persistent, SQL-queriable backend for CozoDB.
 */
export class SQLiteService {
    private db: any = null;
    private initPromise: Promise<void> | null = null;
    private readonly DB_FILENAME = 'cozo-persistent.sqlite3';

    /**
     * Initialize the SQLite WASM module and open the OPFS database.
     */
    async init(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this.doInit().catch(err => {
            console.error('[SQLite] Initialization failed:', err);
            this.initPromise = null;
            throw err;
        });

        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        console.log('[SQLite] Initializing OPFS backend...');
        
        try {
            const sqlite3 = await sqlite3InitModule({
                print: console.log,
                printErr: console.error,
            });

            if ('opfs' in sqlite3) {
                this.db = new sqlite3.oo1.OpfsDb(this.DB_FILENAME);
                console.log(`[SQLite] OPFS Database '${this.DB_FILENAME}' opened successfully.`);
                
                // Optimize for performance
                this.db.exec([
                    'PRAGMA journal_mode = WAL;',
                    'PRAGMA synchronous = NORMAL;',
                    'PRAGMA temp_store = MEMORY;'
                ]);
            } else {
                console.warn('[SQLite] OPFS not supported, falling back to in-memory (non-persistent)');
                this.db = new sqlite3.oo1.DB(':memory:');
            }
        } catch (err) {
            console.error('[SQLite] Critical initialization error:', err);
            throw err;
        }
    }

    /**
     * Generic execute wrapper
     */
    exec(sql: string, bind?: any[]): void {
        if (!this.db) throw new Error('SQLite not initialized');
        this.db.exec({ sql, bind });
    }

    /**
     * Execute and return rows
     */
    query(sql: string, bind?: any[]): any[] {
        if (!this.db) throw new Error('SQLite not initialized');
        const result: any[] = [];
        this.db.exec({
            sql,
            bind,
            rowMode: 'object',
            callback: (row: any) => result.push(row)
        });
        return result;
    }

    /**
     * Get list of all tables
     */
    getTables(): string[] {
        const rows = this.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        return rows.map(r => r.name);
    }

    /**
     * Check if table exists
     */
    hasTable(tableName: string): boolean {
        const rows = this.query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [tableName]);
        return rows.length > 0;
    }

    /**
     * Create table based on columns and types
     */
    createTable(tableName: string, columns: { name: string, type: string }[]): void {
        const colDefs = columns.map(c => `${c.name} ${c.type}`).join(', ');
        // Ensure we drop it first to match schema updates (simple strategy)
        // For production, we might want ALTER TABLE, but for a sync bridge, replace is safer for consistency
        this.exec(`DROP TABLE IF EXISTS "${tableName}"`); 
        this.exec(`CREATE TABLE "${tableName}" (${colDefs})`);
    }

    /**
     * Bulk upsert data into a table
     */
    bulkInsert(tableName: string, columns: string[], rows: any[][]): void {
        if (rows.length === 0) return;

        const placeholders = columns.map(() => '?').join(',');
        const sql = `INSERT OR REPLACE INTO "${tableName}" (${columns.join(',')}) VALUES (${placeholders})`;

        this.db.transaction(() => {
            const stmt = this.db.prepare(sql);
            try {
                for (const row of rows) {
                    stmt.bind(row);
                    stmt.step();
                    stmt.reset();
                }
            } finally {
                stmt.finalize();
            }
        });
    }

    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

export const sqliteService = new SQLiteService();
