interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

/**
 * LRU cache for search results
 */
export class SearchCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private maxSize: number;
    private ttl: number; // Time to live in ms

    constructor(maxSize: number = 100, ttlSeconds: number = 300) {
        this.maxSize = maxSize;
        this.ttl = ttlSeconds * 1000;
    }

    /**
     * Get cached result
     */
    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        // Move to end (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.data;
    }

    /**
     * Set cache entry
     */
    set(key: string, data: T): void {
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    /**
     * Clear cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttl: this.ttl / 1000,
        };
    }
}
