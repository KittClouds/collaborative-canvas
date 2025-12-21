import type { SQLiteNode } from '../client/types';

export interface ResoRankDocument {
    id: string;
    text: string;
    metadata?: Record<string, any>;
}

export interface ResoRankResult {
    id: string;
    score: number;
}

/**
 * Bridge between ResoRank (in-memory BM25) and SQLite
 * Manages document syncing and search delegation
 */
export class ResoRankBridge {
    private resorank: any = null; // Will be actual ResoRank instance
    private isIndexed = false;
    private documentCount = 0;

    /**
     * Set ResoRank instance (injected from main app)
     */
    setResoRank(resorankInstance: any): void {
        this.resorank = resorankInstance;
        console.log('[ResoRankBridge] ResoRank instance connected');
    }

    /**
     * Index SQLite nodes into ResoRank
     */
    async indexNodes(nodes: SQLiteNode[]): Promise<void> {
        if (!this.resorank) {
            throw new Error('ResoRank not initialized');
        }

        console.log(`[ResoRankBridge] Indexing ${nodes.length} nodes...`);
        const startTime = performance.now();

        const documents: ResoRankDocument[] = nodes.map(node => ({
            id: node.id,
            text: this.nodeToSearchText(node),
            metadata: {
                type: node.type,
                entity_kind: node.entity_kind,
                entity_subtype: node.entity_subtype,
                label: node.label,
            },
        }));

        // Batch index into ResoRank
        await this.resorank.indexDocuments(documents);

        this.isIndexed = true;
        this.documentCount = documents.length;

        const elapsed = (performance.now() - startTime).toFixed(2);
        console.log(`[ResoRankBridge] Indexed ${documents.length} documents in ${elapsed}ms`);
    }

    /**
     * Add single node to ResoRank index
     */
    async addNode(node: SQLiteNode): Promise<void> {
        if (!this.resorank) {
            throw new Error('ResoRank not initialized');
        }

        const document: ResoRankDocument = {
            id: node.id,
            text: this.nodeToSearchText(node),
            metadata: {
                type: node.type,
                entity_kind: node.entity_kind,
                entity_subtype: node.entity_subtype,
                label: node.label,
            },
        };

        await this.resorank.addDocument(document);
        this.documentCount++;
    }

    /**
     * Update node in ResoRank index
     */
    async updateNode(node: SQLiteNode): Promise<void> {
        if (!this.resorank) return;

        await this.removeNode(node.id);
        await this.addNode(node);
    }

    /**
     * Remove node from ResoRank index
     */
    async removeNode(nodeId: string): Promise<void> {
        if (!this.resorank) return;

        await this.resorank.removeDocument(nodeId);
        this.documentCount = Math.max(0, this.documentCount - 1);
    }

    /**
     * Search ResoRank index
     */
    async search(query: string, k: number = 50): Promise<ResoRankResult[]> {
        if (!this.resorank || !this.isIndexed) {
            return [];
        }

        try {
            const results = await this.resorank.search(query, k);
            return results.map((r: any) => ({
                id: r.id,
                score: r.score,
            }));
        } catch (error) {
            console.error('[ResoRankBridge] Search failed:', error);
            return [];
        }
    }

    /**
     * Convert node to searchable text
     */
    private nodeToSearchText(node: SQLiteNode): string {
        const parts: string[] = [];

        // Core searchable fields
        parts.push(node.label);

        if (node.content) {
            parts.push(node.content);
        }

        if (node.entity_kind) {
            parts.push(node.entity_kind);
        }

        if (node.entity_subtype) {
            parts.push(node.entity_subtype);
        }

        // Parse JSON fields for additional context
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

    /**
     * Check if ResoRank is ready
     */
    isReady(): boolean {
        return this.resorank !== null && this.isIndexed;
    }

    /**
     * Get index stats
     */
    getStats() {
        return {
            isReady: this.isReady(),
            documentCount: this.documentCount,
        };
    }

    /**
     * Clear index
     */
    clear(): void {
        this.isIndexed = false;
        this.documentCount = 0;
        if (this.resorank) {
            this.resorank.clear();
        }
    }
}

export const resoRankBridge = new ResoRankBridge();
