export class TemporalCache {
    private cache: Map<string, { value: any; expiresAt: number }>;
    private maxItems: number;

    constructor(maxItems = 50) {
        this.cache = new Map();
        this.maxItems = maxItems;
    }

    async getOrCompute<T>(
        key: string,
        computeFn: () => Promise<T>,
        ttlSeconds: number = 3600
    ): Promise<T> {
        const cached = this.cache.get(key);
        if (cached) {
            if (Date.now() < cached.expiresAt) {
                return cached.value as T;
            } else {
                this.cache.delete(key);
            }
        }

        const value = await computeFn();

        // LRU-ish eviction if full
        if (this.cache.size >= this.maxItems) {
            const keys = this.cache.keys();
            const first = keys.next().value;
            if (first) {
                this.cache.delete(first);
            }
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000
        });

        return value;
    }

    invalidate(keyPrefix?: string): void {
        if (!keyPrefix) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.startsWith(keyPrefix)) {
                this.cache.delete(key);
            }
        }
    }

    invalidateAfter(timestamp: Date): void {
        // Invalidate entries that depend on data after this timestamp
        // OR simply clear everything if data changed?
        // Hard to map keys to timestamp dependency without metadata in key.
        // For now, clear all snapshots usually safe.
        this.cache.clear();
    }
}

export const temporalCache = new TemporalCache();
