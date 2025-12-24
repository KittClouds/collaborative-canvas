/**
 * NegativeCache - Document-scoped rejection cache
 * 
 * Prevents rescanning false positives within same document context.
 * Cache is invalidated when:
 * - Topic shift detected (Jaccard similarity < threshold)
 * - High-confidence entity found (context reset)
 */

export enum RejectionReason {
    LOW_SCORE = 'low_score',              // ResoRank score < threshold
    CONTEXT_MISMATCH = 'context_mismatch', // Wrong domain
    NO_REGISTRY_MATCH = 'no_match',       // Not in entity registry
    GRAPH_CONFLICT = 'graph_conflict',     // Conflicts with known relationships
}

export interface CacheEntry {
    span: string;                   // Normalized text span
    reason: RejectionReason;        // Why it was rejected
    context: string;                // Document context at rejection
    timestamp: number;              // When rejected
    documentSegment: number;        // Paragraph/section number
}

export class NegativeCache {
    private cache: Map<string, CacheEntry>;
    private maxSize: number;
    private currentContext: string;
    private currentSegment: number;
    private hits: number = 0;
    private misses: number = 0;

    constructor(maxSize: number = 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.currentContext = '';
        this.currentSegment = 0;
    }

    /**
     * Check if span should be rejected (cached)
     */
    shouldReject(span: string, context: string): boolean {
        const normalized = span.toLowerCase().trim();
        const entry = this.cache.get(normalized);

        if (!entry) {
            this.misses++;
            return false;
        }

        // Invalidate if context changed significantly
        if (this.hasContextShifted(entry.context, context)) {
            this.cache.delete(normalized);
            this.misses++;
            return false;
        }

        // Invalidate if in different document segment
        if (entry.documentSegment !== this.currentSegment) {
            this.cache.delete(normalized);
            this.misses++;
            return false;
        }

        this.hits++;
        return true; // Cache hit - reject
    }

    /**
     * Add rejection to cache
     */
    addRejection(
        span: string,
        reason: RejectionReason,
        context: string
    ): void {
        const normalized = span.toLowerCase().trim();

        // Enforce max size (FIFO for simplicity)
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) this.cache.delete(oldestKey);
        }

        this.cache.set(normalized, {
            span: normalized,
            reason,
            context,
            timestamp: Date.now(),
            documentSegment: this.currentSegment,
        });
    }

    /**
     * Invalidate cache on context shift
     */
    onContextShift(newContext: string): void {
        this.currentContext = newContext;
        for (const [key, entry] of this.cache) {
            if (this.hasContextShifted(entry.context, newContext)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Invalidate cache on new document segment (paragraph)
     */
    onSegmentBoundary(): void {
        this.currentSegment++;
    }

    /**
     * Invalidate cache when high-confidence entity found
     */
    onHighConfidenceEntity(): void {
        // Clear recent entries (last 10%)
        const keys = Array.from(this.cache.keys());
        const limit = Math.ceil(keys.length * 0.1);
        const recent = keys.slice(-limit);
        for (const key of recent) {
            this.cache.delete(key);
        }
    }

    /**
     * Detect context shift using keyword overlap (Jaccard)
     */
    private hasContextShifted(oldContext: string, newContext: string): boolean {
        const tokenize = (c: string) => new Set(c.toLowerCase().split(/\s+/).filter(w => w.length > 4));

        const oldKeywords = tokenize(oldContext);
        const newKeywords = tokenize(newContext);

        if (oldKeywords.size === 0 || newKeywords.size === 0) return true;

        const intersection = new Set([...oldKeywords].filter(k => newKeywords.has(k)));
        const union = new Set([...oldKeywords, ...newKeywords]);

        const similarity = intersection.size / union.size;
        return similarity < 0.3;
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
        this.currentSegment = 0;
        this.currentContext = '';
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        hitRate: number;
        memoryMB: number;
    } {
        const memoryMB = (this.cache.size * 100) / (1024 * 1024);
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hitRate: total > 0 ? this.hits / total : 0,
            memoryMB,
        };
    }
}

// Per-document cache instances
const documentCaches = new Map<string, NegativeCache>();

export function getDocumentCache(documentId: string): NegativeCache {
    if (!documentCaches.has(documentId)) {
        documentCaches.set(documentId, new NegativeCache());
    }
    return documentCaches.get(documentId)!;
}

export function clearDocumentCache(documentId: string): void {
    documentCaches.delete(documentId);
}
