// src/lib/db/search/index.ts

import { dbClient } from '../client/db-client';
import { resoRankBridge } from './resorank-bridge';
import { vectorSearch } from './vector-search';
import { ftsSearch } from './fts-search';
import { hybridSearchEngine } from './hybrid-search';
import { embeddingPipeline } from '@/lib/embeddings/pipeline';
import { SearchCache } from './search-cache';
import type { SearchResult, SearchOptions } from './types';
import type { SQLiteNode } from '../client/types';
import type { SearchMode } from './searchModes';

export interface EnhancedSearchOptions extends SearchOptions {
    mode: SearchMode;

    // Mode-specific options
    lexicalOptions?: {
        useBoolean?: boolean;    // Enable AND/OR operators
        fuzzy?: boolean;          // Fuzzy matching
    };

    semanticOptions?: {
        model?: 'small' | 'medium';
        threshold?: number;       // Min similarity score
    };

    hybridOptions?: {
        vectorWeight?: number;
        graphWeight?: number;
        lexicalWeight?: number;
        maxHops?: number;
        boostConnected?: boolean;
    };
}

/**
 * Main search orchestrator with 3 distinct modes
 */
export class SearchService {
    private cache = new SearchCache<SearchResult[]>(100, 300);
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('[SearchService] Initializing...');

        // Check FTS5 availability
        const ftsAvailable = await ftsSearch.isAvailable();
        console.log('[SearchService] FTS5 available:', ftsAvailable);

        this.isInitialized = true;
        console.log('[SearchService] Ready');
    }

    /**
     * Main search entry point - routes to appropriate mode
     */
    async search(options: EnhancedSearchOptions): Promise<SearchResult[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const { mode, query, k = 10 } = options;

        // Check cache
        const cacheKey = JSON.stringify(options);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            console.log(`[SearchService] Cache hit for mode: ${mode}`);
            return cached;
        }

        let results: SearchResult[] = [];

        console.log(`[SearchService] Executing ${mode} search: "${query}"`);
        const startTime = performance.now();

        try {
            switch (mode) {
                case 'lexical':
                    results = await this.lexicalSearch(query, k, options);
                    break;

                case 'semantic':
                    results = await this.semanticSearch(query, k, options);
                    break;

                case 'hybrid':
                    results = await this.hybridSearch(query, k, options);
                    break;

                default:
                    throw new Error(`Unknown search mode: ${mode}`);
            }

            // Apply universal filters
            if (options.filters) {
                results = this.applyFilters(results, options.filters);
            }

            // Apply min score threshold
            if (options.minScore) {
                results = results.filter(r => r.score >= options.minScore!);
            }

            // Cache results
            this.cache.set(cacheKey, results);

            const elapsed = (performance.now() - startTime).toFixed(2);
            console.log(`[SearchService] ${mode} search completed in ${elapsed}ms, ${results.length} results`);

            return results.slice(0, k);
        } catch (error) {
            console.error(`[SearchService] ${mode} search failed:`, error);
            throw error;
        }
    }

    /**
     * Mode 1: Lexical search (BM25 via ResoRank or FTS5)
     */
    private async lexicalSearch(
        query: string,
        k: number,
        options: EnhancedSearchOptions
    ): Promise<SearchResult[]> {
        const useBoolean = options.lexicalOptions?.useBoolean ?? false;

        // Prefer ResoRank if available
        if (resoRankBridge.isReady()) {
            const candidates = await resoRankBridge.search(query, k);
            return this.hydrateLexicalResults(candidates);
        }

        // Fallback to FTS5
        if (useBoolean) {
            // Use advanced FTS5 syntax
            const ftsResults = await ftsSearch.advancedSearch(query, k);
            return ftsResults.map(r => ({
                node_id: r.node_id,
                label: r.label,
                content: r.content,
                score: Math.abs(r.rank),
                source: 'fts' as const,
            }));
        } else {
            const ftsResults = await ftsSearch.search(query, { limit: k });
            return ftsResults.map(r => ({
                node_id: r.node_id,
                label: r.label,
                content: r.content,
                score: Math.abs(r.rank),
                source: 'fts' as const,
            }));
        }
    }

    /**
     * Mode 2: Semantic search (pure vector similarity)
     */
    private async semanticSearch(
        query: string,
        k: number,
        options: EnhancedSearchOptions
    ): Promise<SearchResult[]> {
        const model = options.semanticOptions?.model ?? 'small';
        const threshold = options.semanticOptions?.threshold ?? 0;

        // Generate query embedding
        const { embeddingService } = await import('@/lib/embeddings');
        const queryEmbedding = await embeddingService.embed(query, model);

        // Search using embedding pipeline (DiskANN with SQLite fallback)
        const vectorResults = await embeddingPipeline.search(queryEmbedding, k, model);

        // Filter by threshold
        const filtered = vectorResults.filter(r => r.score >= threshold);

        // Hydrate with full node data
        return this.hydrateSemanticResults(filtered);
    }

    /**
     * Mode 3: Hybrid search (vector + graph + lexical)
     */
    private async hybridSearch(
        query: string,
        k: number,
        options: EnhancedSearchOptions
    ): Promise<SearchResult[]> {
        const model = options.semanticOptions?.model ?? 'small';

        // Generate query embedding
        const { embeddingService } = await import('@/lib/embeddings');
        const queryEmbedding = await embeddingService.embed(query, model);

        // Execute hybrid search with custom weights
        const hybridConfig = {
            intent: 'contextual' as const,
            vectorWeight: options.hybridOptions?.vectorWeight ?? 0.4,
            graphWeight: options.hybridOptions?.graphWeight ?? 0.4,
            lexicalWeight: options.hybridOptions?.lexicalWeight ?? 0.2,
            maxHops: options.hybridOptions?.maxHops ?? 2,
            adaptiveWeights: true,
            boostConnected: options.hybridOptions?.boostConnected ?? true,
        };

        return hybridSearchEngine.search(query, queryEmbedding, k, hybridConfig);
    }

    /**
     * Hydrate lexical results with full node data
     */
    private async hydrateLexicalResults(
        results: Array<{ id: string; score: number }>
    ): Promise<SearchResult[]> {
        if (results.length === 0) return [];

        const nodeIds = results.map(r => r.id);
        const nodes = await this.getNodesByIds(nodeIds);

        return results
            .map(r => {
                const node = nodes.get(r.id);
                if (!node) return null;

                return {
                    node_id: node.id,
                    label: node.label,
                    content: node.content || '',
                    score: r.score,
                    source: 'resorank' as const,
                    metadata: {
                        type: node.type,
                        entity_kind: node.entity_kind || undefined,
                        entity_subtype: node.entity_subtype || undefined,
                    },
                } as SearchResult;
            })
            .filter((r): r is SearchResult => r !== null);
    }

    /**
     * Hydrate semantic results with full node data
     */
    private async hydrateSemanticResults(
        results: Array<{ node_id: string; score: number }>
    ): Promise<SearchResult[]> {
        if (results.length === 0) return [];

        const nodeIds = results.map(r => r.node_id);
        const nodes = await this.getNodesByIds(nodeIds);

        return results
            .map(r => {
                const node = nodes.get(r.node_id);
                if (!node) return null;

                return {
                    node_id: node.id,
                    label: node.label,
                    content: node.content || '',
                    score: r.score,
                    source: 'vector' as const,
                    metadata: {
                        type: node.type,
                        entity_kind: node.entity_kind || undefined,
                        entity_subtype: node.entity_subtype || undefined,
                    },
                } as SearchResult;
            })
            .filter((r): r is SearchResult => r !== null);
    }

    /**
     * Apply filters to results
     */
    private applyFilters(
        results: SearchResult[],
        filters: SearchOptions['filters']
    ): SearchResult[] {
        return results.filter(result => {
            if (filters?.type && result.metadata?.type !== filters.type) {
                return false;
            }
            if (filters?.entity_kind && result.metadata?.entity_kind !== filters.entity_kind) {
                return false;
            }
            if (filters?.entity_subtype && result.metadata?.entity_subtype !== filters.entity_subtype) {
                return false;
            }
            return true;
        });
    }

    /**
     * Batch fetch nodes by IDs
     */
    private async getNodesByIds(ids: string[]): Promise<Map<string, SQLiteNode>> {
        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT * FROM nodes WHERE id IN (${placeholders})`;
        const rows = await dbClient.query<SQLiteNode>(sql, ids);

        const map = new Map<string, SQLiteNode>();
        for (const row of rows) {
            map.set(row.id, row);
        }
        return map;
    }

    /**
     * Index all nodes into ResoRank
     */
    async indexAllNodes(): Promise<void> {
        const nodes = await dbClient.getAllNodes();
        await resoRankBridge.indexNodes(nodes);
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.cache.clear();
        vectorSearch.clearCache();
    }

    /**
     * Get service stats
     */
    getStats() {
        return {
            searchCache: this.cache.getStats(),
            vectorCache: vectorSearch.getCacheStats(),
            resoRank: resoRankBridge.getStats(),
        };
    }
}

export const searchService = new SearchService();

// Re-exports
export { resoRankBridge } from './resorank-bridge';
export { vectorSearch } from './vector-search';
export { ftsSearch } from './fts-search';
export { hybridSearchEngine } from './hybrid-search';
export type { SearchResult, SearchOptions } from './types';
export { SEARCH_MODES } from './searchModes';
export type { SearchMode, SearchModeConfig } from './searchModes';
