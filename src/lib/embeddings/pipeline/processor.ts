// src/lib/embeddings/pipeline/processor.ts

import { embeddingService } from '../embeddingService';
import { dbClient } from '@/lib/db/client/db-client';
import { generateId } from '@/lib/utils/ids';
import type { SQLiteNode } from '@/lib/db/client/types';
import { EmbeddingQueue } from './queue';
import type { EmbeddingJob, EmbeddingPipelineConfig } from './types';
import { DEFAULT_PIPELINE_CONFIG } from './types';

/**
 * Core embedding processor
 * Handles job execution, batching, and DB persistence
 */
export class EmbeddingProcessor {
    private queue = new EmbeddingQueue();
    private config: EmbeddingPipelineConfig;
    private isProcessing = false;
    private abortController: AbortController | null = null;

    // Statistics
    private stats = {
        processed: 0,
        errors: 0,
        cacheHits: 0,
        cacheMisses: 0,
    };

    constructor(config: Partial<EmbeddingPipelineConfig> = {}) {
        this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    }

    /**
     * Add node for embedding
     */
    async embedNode(
        node: SQLiteNode,
        priority: 'high' | 'normal' | 'low' = 'normal',
        model: 'small' | 'medium' = this.config.defaultModel
    ): Promise<void> {
        const text = this.extractTextFromNode(node);
        if (!text.trim()) {
            return;
        }

        const job: EmbeddingJob = {
            id: generateId(),
            nodeId: node.id,
            text,
            model,
            priority,
            retries: 0,
        };

        this.queue.enqueue(job);

        // Start processing if not already running
        if (!this.isProcessing) {
            this.startProcessing();
        }
    }

    /**
     * Batch embed multiple nodes
     */
    async embedNodes(
        nodes: SQLiteNode[],
        priority: 'high' | 'normal' | 'low' = 'normal',
        model: 'small' | 'medium' = this.config.defaultModel
    ): Promise<void> {
        for (const node of nodes) {
            await this.embedNode(node, priority, model);
        }
    }

    /**
     * Process queue continuously
     */
    private async startProcessing(): Promise<void> {
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.abortController = new AbortController();

        console.log('[EmbeddingProcessor] Started processing queue');

        try {
            while (this.queue.size() > 0 && !this.abortController.signal.aborted) {
                // Process up to maxConcurrent jobs in parallel
                const batch: EmbeddingJob[] = [];
                for (let i = 0; i < this.config.maxConcurrent; i++) {
                    const job = this.queue.dequeue();
                    if (!job) break;
                    batch.push(job);
                }

                if (batch.length === 0) break;

                await Promise.all(
                    batch.map(job => this.processJob(job))
                );
            }
        } finally {
            this.isProcessing = false;
            this.abortController = null;
            console.log('[EmbeddingProcessor] Stopped processing queue');
        }
    }

    /**
     * Process single embedding job
     */
    private async processJob(job: EmbeddingJob): Promise<void> {
        try {
            // Check if embedding already exists and is current
            const existing = await dbClient.getEmbedding(job.nodeId);
            const contentHash = await this.hashContent(job.text);

            if (existing && existing.content_hash === contentHash) {
                console.log(`[EmbeddingProcessor] Cache hit for node ${job.nodeId}`);
                this.stats.cacheHits++;
                this.queue.complete(job.nodeId);
                return;
            }

            this.stats.cacheMisses++;

            // Generate embedding
            const embedding = await embeddingService.embed(job.text, job.model);

            // Save to database
            await dbClient.saveEmbedding(
                job.nodeId,
                embedding,
                job.model,
                job.text,
                contentHash
            );

            this.stats.processed++;
            this.queue.complete(job.nodeId);

            console.log(`[EmbeddingProcessor] Embedded node ${job.nodeId} (${job.model})`);
        } catch (error) {
            this.stats.errors++;
            console.error(`[EmbeddingProcessor] Failed to process job for node ${job.nodeId}:`, error);

            // Retry with exponential backoff
            if (job.retries < 3) {
                job.retries++;
                job.priority = 'low'; // Downgrade priority on retry
                this.queue.enqueue(job);
            } else {
                this.queue.complete(job.nodeId);
            }
        }
    }

    /**
     * Extract searchable text from node
     */
    private extractTextFromNode(node: SQLiteNode): string {
        const parts: string[] = [];

        parts.push(node.label);

        if (node.content) {
            // Parse Tiptap JSON if needed
            try {
                const parsed = JSON.parse(node.content);
                parts.push(this.extractTextFromTiptap(parsed));
            } catch {
                parts.push(node.content);
            }
        }

        if (node.entity_kind) {
            parts.push(node.entity_kind);
        }

        if (node.entity_subtype) {
            parts.push(node.entity_subtype);
        }

        // Extract from JSON fields
        if (node.attributes) {
            try {
                const attrs = JSON.parse(node.attributes);
                Object.values(attrs).forEach(val => {
                    if (typeof val === 'string') parts.push(val);
                });
            } catch { }
        }

        return parts.join(' ').trim();
    }

    private extractTextFromTiptap(node: any): string {
        if (!node) return '';

        let text = '';

        if (node.type === 'text' && node.text) {
            text += node.text;
        }

        if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) {
                text += this.extractTextFromTiptap(child);
                if (child.type === 'paragraph' || child.type === 'heading') {
                    text += '\n';
                }
            }
        }

        return text;
    }

    private async hashContent(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Stop processing
     */
    stop(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    /**
     * Clear queue
     */
    clear(): void {
        this.queue.clear();
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            queue: this.queue.getStats(),
            isProcessing: this.isProcessing,
        };
    }
}
