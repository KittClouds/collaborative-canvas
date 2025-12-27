import { GraphProjection, ProjectionCacheEntry } from '../types/base';

/**
 * In-memory Projection Cache
 * Stores recently calculated graph projections to avoid expensive re-calculations.
 * Implements simple LRU-like eviction via size limit.
 */
export class ProjectionCache {
    private cache = new Map<string, ProjectionCacheEntry>();
    private readonly MAX_SIZE = 50; // Maximum number of projections to keep in memory

    /**
     * Store a projection in the cache
     * @param key Unique cache key
     * @param data The graph projection data
     * @param ttl Time to live in milliseconds
     */
    set(key: string, data: GraphProjection, ttl: number): void {
        // Evict oldest if we hit the limit
        if (this.cache.size >= this.MAX_SIZE) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }

        const timestamp = Date.now();
        this.cache.set(key, {
            key,
            data,
            timestamp,
            ttl
        });

        // Schedule cleanup
        setTimeout(() => {
            this.invalidate(key);
        }, ttl);
    }

    /**
     * Retrieve a projection from the cache
     * @param key Unique cache key
     * @returns The projection if found and valid, null otherwise
     */
    get(key: string): GraphProjection | null {
        const entry = this.cache.get(key);

        if (!entry) return null;

        if (this.isExpired(entry)) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Check if a cache entry is expired
     */
    isExpired(entry: ProjectionCacheEntry): boolean {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    /**
     * Invalidate a specific cache entry
     */
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear entire cache
     */
    invalidateAll(): void {
        this.cache.clear();
    }

    /**
     * Get current cache size (debugging)
     */
    size(): number {
        return this.cache.size;
    }
}
