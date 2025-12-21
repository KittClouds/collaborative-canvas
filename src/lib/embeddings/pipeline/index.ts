// src/lib/embeddings/pipeline/index.ts

import { embeddingService } from '../embeddingService';
import { dbClient } from '@/lib/db/client/db-client';
import { EmbeddingProcessor } from './processor';
import { IndexManager } from './indexManager';
import type { SQLiteNode } from '@/lib/db/client/types';
import type { EmbeddingPipelineConfig } from './types';
import { DEFAULT_PIPELINE_CONFIG } from './types';

/**
 * Main embedding pipeline orchestrator
 * Coordinates embedding generation, DB persistence, and DiskANN indexing
 */
export class EmbeddingPipeline {
    private processor: EmbeddingProcessor;
    private indexManager: IndexManager;
    private config: EmbeddingPipelineConfig;
    private isInitialized = false;

    // Auto-sync state
    private pendingNodes = new Set<string>();
    private syncTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(config: Partial<EmbeddingPipelineConfig> = {}) {
        this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
        this.processor = new EmbeddingProcessor(this.config);
        this.indexManager = new IndexManager(this.config);
    }

    /**
     * Initialize pipeline
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('[EmbeddingPipeline] Initializing...');

        // Initialize embedding models
        await embeddingService.initialize();

        // Build DiskANN indexes from existing embeddings
        await this.indexManager.buildIndexes();

        this.isInitialized = true;
        console.log('[EmbeddingPipeline] Ready');
    }

    /**
     * Embed single node
     */
    async embedNode(
        node: SQLiteNode,
        options: {
            priority?: 'high' | 'normal' | 'low';
            model?: 'small' | 'medium';
            immediate?: boolean;
        } = {}
    ): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const priority = options.priority ?? 'normal';
        const model = options.model ?? this.config.defaultModel;

        if (options.immediate) {
            // Process immediately, bypass queue
            const text = this.extractTextFromNode(node);
            if (!text.trim()) return;

            const embedding = await embeddingService.embed(text, model);
            const contentHash = await this.hashContent(text);

            await dbClient.saveEmbedding(node.id, embedding, model, text, contentHash);
            await this.indexManager.addEmbedding(node.id, embedding, model);
        } else {
            // Queue for background processing
            await this.processor.embedNode(node, priority, model);

            // Schedule auto-sync if enabled
            if (this.config.autoSync) {
                this.scheduleAutoSync(node.id);
            }
        }
    }

    /**
     * Batch embed multiple nodes
     */
    async embedNodes(
        nodes: SQLiteNode[],
        options: {
            priority?: 'high' | 'normal' | 'low';
            model?: 'small' | 'medium';
        } = {}
    ): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        await this.processor.embedNodes(
            nodes,
            options.priority ?? 'normal',
            options.model ?? this.config.defaultModel
        );
    }

    /**
     * Sync all nodes in database
     */
    async syncAllNodes(model: 'small' | 'medium' = this.config.defaultModel): Promise<{
        success: number;
        errors: number;
    }> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log('[EmbeddingPipeline] Starting full sync...');
        const startTime = performance.now();

        const nodes = await dbClient.getAllNodes();
        await this.processor.embedNodes(nodes, 'normal', model);

        // Wait for queue to finish (with timeout)
        let waited = 0;
        const maxWait = 300000; // 5 minutes
        while (this.processor.getStats().queue.total > 0 && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            waited += 1000;
        }

        // Rebuild indexes
        await this.indexManager.buildIndexes();

        const stats = this.processor.getStats();
        const elapsed = (performance.now() - startTime).toFixed(2);

        console.log(`[EmbeddingPipeline] Sync complete in ${elapsed}ms`);
        console.log(`  - Processed: ${stats.processed}`);
        console.log(`  - Errors: ${stats.errors}`);
        console.log(`  - Cache hits: ${stats.cacheHits}`);

        return {
            success: stats.processed,
            errors: stats.errors,
        };
    }

    /**
     * Search using DiskANN (fast) with SQLite fallback
     */
    async search(
        query: Float32Array,
        k: number = 10,
        model: 'small' | 'medium' = 'small'
    ): Promise<Array<{ node_id: string; score: number }>> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Try DiskANN first (fast)
        const diskannResults = await this.indexManager.search(query, k, model);

        if (diskannResults.length > 0) {
            return diskannResults.map(r => ({ node_id: r.id, score: r.score }));
        }

        // Fallback to SQLite vector search
        console.log('[EmbeddingPipeline] DiskANN unavailable, using SQLite vector search');

        const column = model === 'small' ? 'embedding_small' : 'embedding_medium';
        const queryBlob = new Uint8Array(query.buffer);

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

        return rows.map(r => ({ node_id: r.node_id, score: 1 - r.distance }));
    }

    /**
     * Rebuild indexes from scratch
     */
    async rebuildIndexes(): Promise<void> {
        console.log('[EmbeddingPipeline] Rebuilding indexes...');
        this.indexManager.clear();
        await this.indexManager.buildIndexes();
    }

    /**
     * Get pipeline statistics
     */
    getStats() {
        return {
            processor: this.processor.getStats(),
            indexes: this.indexManager.getStats(),
            isInitialized: this.isInitialized,
        };
    }

    // Private helpers

    private scheduleAutoSync(nodeId: string): void {
        this.pendingNodes.add(nodeId);

        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }

        this.syncTimer = setTimeout(() => {
            this.flushPendingNodes();
        }, this.config.syncDebounceMs);
    }

    private async flushPendingNodes(): Promise<void> {
        if (this.pendingNodes.size === 0) return;

        const nodeIds = Array.from(this.pendingNodes);
        this.pendingNodes.clear();

        console.log(`[EmbeddingPipeline] Auto-syncing ${nodeIds.length} nodes...`);

        // Fetch nodes and process
        const placeholders = nodeIds.map(() => '?').join(',');
        const sql = `SELECT * FROM nodes WHERE id IN (${placeholders})`;
        const nodes = await dbClient.query<SQLiteNode>(sql, nodeIds);

        await this.processor.embedNodes(nodes);
    }

    private extractTextFromNode(node: SQLiteNode): string {
        const parts: string[] = [node.label];
        if (node.content) parts.push(node.content);
        if (node.entity_kind) parts.push(node.entity_kind);
        if (node.entity_subtype) parts.push(node.entity_subtype);
        return parts.join(' ').trim();
    }

    private async hashContent(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

// Export singleton
export const embeddingPipeline = new EmbeddingPipeline();

// Re-exports
export type { EmbeddingPipelineConfig } from './types';
export { DEFAULT_PIPELINE_CONFIG } from './types';
