import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'kitt-model-cache';
const STORE_NAME = 'models';
const VERSION = 1;

export interface CachedModel {
    modelId: string;
    onnx: ArrayBuffer;
    tokenizer: string;
    timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'modelId' });
                }
            },
        });
    }
    return dbPromise;
}

export const modelCache = {
    async get(modelId: string): Promise<CachedModel | undefined> {
        try {
            const db = await getDB();
            return await db.get(STORE_NAME, modelId);
        } catch (err) {
            console.warn('[ModelCache] Failed to get model:', err);
            return undefined;
        }
    },

    async put(modelId: string, onnx: ArrayBuffer, tokenizer: string): Promise<void> {
        try {
            const db = await getDB();
            const record: CachedModel = {
                modelId,
                onnx,
                tokenizer,
                timestamp: Date.now(),
            };
            await db.put(STORE_NAME, record);
            console.log(`[ModelCache] Cached ${modelId} (${(onnx.byteLength / 1024 / 1024).toFixed(1)} MB)`);
        } catch (err) {
            console.error('[ModelCache] Failed to cache model:', err);
        }
    },

    async delete(modelId: string): Promise<void> {
        const db = await getDB();
        await db.delete(STORE_NAME, modelId);
    },

    async clear(): Promise<void> {
        const db = await getDB();
        await db.clear(STORE_NAME);
    }
};
