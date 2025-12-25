import init, { CozoDb } from 'cozo-lib-wasm';
// @ts-ignore - Vite specific import
import wasmUrl from 'cozo-lib-wasm/cozo_lib_wasm_bg.wasm?url';

export class CozoDbService {
    private db: CozoDb | null = null;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize the CozoDB WASM module.
     * This must be called before using the database.
     */
    async init(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = init(wasmUrl).then(() => {
            this.db = CozoDb.new();
            console.log('CozoDB initialized');
        }).catch(err => {
            console.error('Failed to initialize CozoDB', err);
            this.initPromise = null; // Reset so retry is possible
            throw err;
        });

        return this.initPromise;
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
            throw new Error('CozoDB not initialized. Call init() first.');
        }
        // params must be stringified JSON
        const paramsStr = JSON.stringify(params);
        // @ts-ignore - TS expects 3 args but docs/usage imply 2. Check cozo_lib_wasm.d.ts if possible.
        return this.db.run(script, paramsStr);
    }

    /**
     * Run a query and parse the result as JSON.
     */
    runQuery(script: string, params: Record<string, any> = {}): any {
        const resultStr = this.run(script, params);
        try {
            return JSON.parse(resultStr);
        } catch (e) {
            console.error('CozoDB Error parsing result:', resultStr);
            throw e;
        }
    }

    /**
     * Export relations as JSON string.
     */
    exportRelations(relations: string[]): string {
        if (!this.db) throw new Error('Not initialized');
        // The API export_relations takes a JSON payload describing what to export?
        // Docs say: export_relations(data: string): string; 
        // Usually data is `{"relations": ["rel1", "rel2"]}`
        const payload = JSON.stringify({ relations });
        return this.db.export_relations(payload);
    }

    /**
     * Import relations from JSON string.
     */
    importRelations(data: string): string {
        if (!this.db) throw new Error('Not initialized');
        return this.db.import_relations(data);
    }
}

export const cozoDb = new CozoDbService();
