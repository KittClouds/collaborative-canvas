/**
 * High-performance in-memory cache for entity/edge storage
 * Implements LRU eviction to prevent memory bloat
 */

interface CacheEntry<T> {
    value: T;
    timestamp: number;
    hits: number;
}

export class MemoryCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private maxSize: number;
    private ttl: number; // Time to live in ms

    constructor(maxSize = 1000, ttl = 60000) { // 1000 items, 60s TTL
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check expiry
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        // Update hit count (for LRU influence - actual LRU uses timestamp primarily)
        entry.hits++;
        // In a strict LRU, access should update timestamp to keep it "fresh"
        entry.timestamp = Date.now();

        return entry.value;
    }

    set(key: string, value: T): void {
        // Evict if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            hits: 0
        });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        // Check expiry
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Get cache stats (for debugging)
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                hits: entry.hits,
                age: Date.now() - entry.timestamp
            }))
        };
    }
}
