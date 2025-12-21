// src/lib/embeddings/pipeline/indexManager.ts

import { DiskANNIndex } from '@/lib/HNSW/DiskANNIndex';
import { dbClient } from '@/lib/db/client/db-client';
import { blobToFloat32 } from '@/lib/db/client/types';
import type { EmbeddingPipelineConfig } from './types';
import { DEFAULT_PIPELINE_CONFIG } from './types';

/**
 * Manages DiskANN index lifecycle
 * Syncs with SQLite vector tables
 */
export class IndexManager {
    private smallIndex: DiskANNIndex | null = null;
    private mediumIndex: DiskANNIndex | null = null;
    private config: EmbeddingPipelineConfig;
    private isBuilt = false;

    constructor(config: Partial<EmbeddingPipelineConfig> = {}) {
        this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };

        if (this.config.enableDiskANN) {
            this.smallIndex = new DiskANNIndex({
                numClusters: this.config.diskannClusters,
                searchProbeCount: 5,
                adaptiveProbing: true,
                hnswM: 32,
                cacheSize: this.config.cacheSize,
            });

            this.mediumIndex = new DiskANNIndex({
                numClusters: Math.floor(this.config.diskannClusters * 1.5),
                searchProbeCount: 5,
                adaptiveProbing: true,
                hnswM: 32,
                cacheSize: this.config.cacheSize,
            });
        }
    }

    /**
     * Build DiskANN indexes from SQLite embeddings
     */
    async buildIndexes(): Promise<void> {
        if (!this.config.enableDiskANN) {
            console.log('[IndexManager] DiskANN disabled, skipping index build');
            return;
        }

        console.log('[IndexManager] Building DiskANN indexes from SQLite...');
        const startTime = performance.now();

        // Fetch all embeddings from DB
        const embeddings = await dbClient.getAllEmbeddings();

        if (embeddings.length === 0) {
            console.log('[IndexManager] No embeddings found, skipping index build');
            return;
        }

        // Separate by model
        const smallData: Array<{ id: string; vector: Float32Array }> = [];
        const mediumData: Array<{ id: string; vector: Float32Array }> = [];

        for (const emb of embeddings) {
            if (emb.embedding_small) {
                smallData.push({
                    id: emb.node_id,
                    vector: blobToFloat32(emb.embedding_small),
                });
            }

            if (emb.embedding_medium) {
                mediumData.push({
                    id: emb.node_id,
                    vector: blobToFloat32(emb.embedding_medium),
                });
            }
        }

        // Build indexes
        const promises: Promise<void>[] = [];

        if (smallData.length > 0 && this.smallIndex) {
            promises.push(
                this.smallIndex.buildIndex(smallData).then(() => {
                    console.log(`[IndexManager] Small index built with ${smallData.length} vectors`);
                })
            );
        }

        if (mediumData.length > 0 && this.mediumIndex) {
            promises.push(
                this.mediumIndex.buildIndex(mediumData).then(() => {
                    console.log(`[IndexManager] Medium index built with ${mediumData.length} vectors`);
                })
            );
        }

        await Promise.all(promises);

        this.isBuilt = true;
        const elapsed = (performance.now() - startTime).toFixed(2);
        console.log(`[IndexManager] Indexes built in ${elapsed}ms`);
    }

    /**
     * Incrementally add embedding to index
     */
    async addEmbedding(
        nodeId: string,
        embedding: Float32Array,
        model: 'small' | 'medium'
    ): Promise<void> {
        if (!this.config.enableDiskANN || !this.isBuilt) return;

        const index = model === 'small' ? this.smallIndex : this.mediumIndex;
        if (!index) return;

        await index.upsert(nodeId, embedding);
    }

    /**
     * Remove embedding from index
     */
    removeEmbedding(nodeId: string, model: 'small' | 'medium'): void {
        if (!this.config.enableDiskANN) return;

        const index = model === 'small' ? this.smallIndex : this.mediumIndex;
        if (!index) return;

        index.remove(nodeId);
    }

    /**
     * Search using DiskANN (sidecar to SQLite)
     */
    async search(
        query: Float32Array,
        k: number = 10,
        model: 'small' | 'medium' = 'small'
    ): Promise<Array<{ id: string; score: number }>> {
        if (!this.config.enableDiskANN || !this.isBuilt) {
            console.warn('[IndexManager] DiskANN not available, use SQLite vector search');
            return [];
        }

        const index = model === 'small' ? this.smallIndex : this.mediumIndex;
        if (!index) return [];

        const results = await index.search(query, k);
        return results.map(r => ({ id: r.id, score: r.score }));
    }

    /**
     * Get index statistics
     */
    getStats() {
        if (!this.config.enableDiskANN) {
            return { enabled: false };
        }

        return {
            enabled: true,
            isBuilt: this.isBuilt,
            small: this.smallIndex?.getStats(),
            medium: this.mediumIndex?.getStats(),
        };
    }

    /**
     * Serialize indexes for persistence
     */
    serialize(): { small: any; medium: any } | null {
        if (!this.isBuilt) return null;

        return {
            small: this.smallIndex?.toJSON() || null,
            medium: this.mediumIndex?.toJSON() || null,
        };
    }

    /**
     * Clear indexes
     */
    clear(): void {
        this.smallIndex?.clear();
        this.mediumIndex?.clear();
        this.isBuilt = false;
    }
}
