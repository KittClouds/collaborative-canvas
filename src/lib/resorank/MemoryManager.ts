// MemoryManager.ts

// Redefine f32 as number for clarity
type f32 = number;

/**
 * Sigmoid function for entropy scaling (Equation 5)
 */
function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

export class EntropyCache {
    private cache: Map<string, number> = new Map();
    private maxSize: number;
    private accessOrder: string[] = []; // LRU tracking

    constructor(maxSize: number = 1000) {
        this.maxSize = maxSize;
    }

    /**
     * Get entropy (compute if missing)
     */
    get(term: string, tokenIndex: Map<string, any>): number {
        // Cache hit
        if (this.cache.has(term)) {
            this.markAccessed(term);
            return this.cache.get(term)!;
        }

        // Cache miss - compute
        const entropy = this.computeEntropy(term, tokenIndex);
        this.set(term, entropy);
        return entropy;
    }

    /**
     * Compute entropy for single term
     */
    private computeEntropy(term: string, tokenIndex: Map<string, any>): number {
        const termDocs = tokenIndex.get(term);
        if (!termDocs) return 0;

        let rawEntropy = 0;

        for (const [_, metadata] of termDocs) {
            let totalTF = 0;
            for (const [_, fieldData] of metadata.fieldOccurrences) {
                totalTF += fieldData.tf;
            }

            if (totalTF > 10) totalTF = 10; // Optimization

            const pj = sigmoid(totalTF);
            if (pj > 1e-6 && pj < 0.999999) {
                rawEntropy += -(pj * Math.log(pj));
            }
        }

        return rawEntropy;
    }

    /**
     * Add to cache with LRU eviction
     */
    private set(term: string, entropy: number): void {
        if (this.cache.size >= this.maxSize) {
            // Evict least recently used
            const evictKey = this.accessOrder.shift()!;
            this.cache.delete(evictKey);
        }

        this.cache.set(term, entropy);
        this.accessOrder.push(term);
    }

    /**
     * Mark term as recently accessed (LRU)
     */
    private markAccessed(term: string): void {
        const idx = this.accessOrder.indexOf(term);
        if (idx !== -1) {
            this.accessOrder.splice(idx, 1);
            this.accessOrder.push(term);
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; hitRate: number; memoryMB: number } {
        return {
            size: this.cache.size,
            hitRate: 0, // Placeholder
            memoryMB: (this.cache.size * 48) / (1024 * 1024),
        };
    }

    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }
}
