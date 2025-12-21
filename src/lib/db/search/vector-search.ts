import { dbClient } from '../client/db-client';
import { blobToFloat32 } from '../client/types';

export interface VectorSearchResult {
    node_id: string;
    score: number;
    embedding?: Float32Array;
}

/**
 * Vector search using sqlite-vector extension
 */
export class VectorSearch {
    private embeddingCache = new Map<string, Float32Array>();
    private cacheSize = 1000;

    /**
     * Search using vector similarity with sqlite-vector
     */
    async search(
        queryEmbedding: Float32Array,
        k: number = 10,
        model: 'small' | 'medium' = 'small'
    ): Promise<VectorSearchResult[]> {
        const column = model === 'small' ? 'embedding_small' : 'embedding_medium';

        // Convert query embedding to blob for SQL
        const queryBlob = new Uint8Array(queryEmbedding.buffer);

        try {
            // Use sqlite-vector's vec_distance_cosine function
            const sql = `
        SELECT 
          node_id,
          vec_distance_cosine(${column}, ?) as distance
        FROM embeddings
        WHERE ${column} IS NOT NULL
        ORDER BY distance ASC
        LIMIT ?
      `;

            const rows = await dbClient.query<{ node_id: string; distance: number }>(
                sql,
                [queryBlob, k]
            );

            // Convert distance to similarity score (1 - distance for cosine)
            return rows.map(row => ({
                node_id: row.node_id,
                score: 1 - row.distance,
            }));
        } catch (error) {
            console.error('[VectorSearch] Search failed:', error);
            return [];
        }
    }

    /**
     * Get embedding for a node (with caching)
     */
    async getEmbedding(
        nodeId: string,
        model: 'small' | 'medium' = 'small'
    ): Promise<Float32Array | null> {
        const cacheKey = `${nodeId}:${model}`;

        // Check cache
        if (this.embeddingCache.has(cacheKey)) {
            return this.embeddingCache.get(cacheKey)!;
        }

        // Fetch from DB
        const embedding = await dbClient.getEmbedding(nodeId);
        if (!embedding) return null;

        const blob = model === 'small'
            ? embedding.embedding_small
            : embedding.embedding_medium;

        if (!blob) return null;

        const vector = blobToFloat32(blob);

        // Cache it
        this.embeddingCache.set(cacheKey, vector);

        // Prune cache if too large
        if (this.embeddingCache.size > this.cacheSize) {
            const firstKey = this.embeddingCache.keys().next().value;
            this.embeddingCache.delete(firstKey);
        }

        return vector;
    }

    /**
     * Batch get embeddings for multiple nodes
     */
    async getEmbeddings(
        nodeIds: string[],
        model: 'small' | 'medium' = 'small'
    ): Promise<Map<string, Float32Array>> {
        const result = new Map<string, Float32Array>();

        // Check cache first
        const uncached: string[] = [];
        for (const nodeId of nodeIds) {
            const cacheKey = `${nodeId}:${model}`;
            const cached = this.embeddingCache.get(cacheKey);
            if (cached) {
                result.set(nodeId, cached);
            } else {
                uncached.push(nodeId);
            }
        }

        if (uncached.length === 0) {
            return result;
        }

        // Fetch uncached from DB
        const placeholders = uncached.map(() => '?').join(',');
        const column = model === 'small' ? 'embedding_small' : 'embedding_medium';

        const sql = `
      SELECT node_id, ${column} as embedding
      FROM embeddings
      WHERE node_id IN (${placeholders})
        AND ${column} IS NOT NULL
    `;

        const rows = await dbClient.query<{ node_id: string; embedding: Uint8Array }>(
            sql,
            uncached
        );

        for (const row of rows) {
            const vector = blobToFloat32(row.embedding);
            result.set(row.node_id, vector);

            // Cache it
            const cacheKey = `${row.node_id}:${model}`;
            this.embeddingCache.set(cacheKey, vector);
        }

        return result;
    }

    /**
     * Find similar nodes by ID
     */
    async findSimilar(
        nodeId: string,
        k: number = 10,
        model: 'small' | 'medium' = 'small'
    ): Promise<VectorSearchResult[]> {
        const queryEmbedding = await this.getEmbedding(nodeId, model);
        if (!queryEmbedding) {
            return [];
        }

        return this.search(queryEmbedding, k, model);
    }

    /**
     * Clear embedding cache
     */
    clearCache(): void {
        this.embeddingCache.clear();
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.embeddingCache.size,
            maxSize: this.cacheSize,
        };
    }
}

export const vectorSearch = new VectorSearch();
