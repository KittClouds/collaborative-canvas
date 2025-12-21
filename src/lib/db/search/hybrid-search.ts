// src/lib/db/search/hybrid-search.ts

import { graphBridge } from './graphBridge';
import { resoRankBridge, ResoRankResult } from './resorank-bridge';
import { embeddingPipeline } from '@/lib/embeddings/pipeline';
import { dbClient } from '../client/db-client';
import type { SQLiteNode } from '../client/types';
import type { SearchResult } from './types';

export interface GraphSignal {
    nodeId: string;

    // Direct graph signals
    degree: number;              // Connection count
    centrality: number;          // PageRank score
    avgEdgeWeight: number;       // Average edge strength

    // Multi-hop signals
    reachableNodes: number;      // How many nodes reachable
    avgPathWeight: number;       // Average path strength

    // Context signals
    connectedToCandidates: number; // How many other candidates it connects to
    temporalScore: number;         // Temporal relationship strength
    causalScore: number;           // Causal relationship strength
}

export interface FusionConfig {
    intent: 'semantic' | 'relational' | 'balanced' | 'contextual';

    vectorWeight: number;
    graphWeight: number;
    lexicalWeight: number;

    maxHops: number;
    minEdgeWeight: number;

    adaptiveWeights: boolean;
    boostConnected: boolean;
}

export const DEFAULT_FUSION_CONFIGS: Record<FusionConfig['intent'], FusionConfig> = {
    semantic: {
        intent: 'semantic',
        vectorWeight: 0.7,
        graphWeight: 0.2,
        lexicalWeight: 0.1,
        maxHops: 1,
        minEdgeWeight: 0.3,
        adaptiveWeights: false,
        boostConnected: false,
    },
    relational: {
        intent: 'relational',
        vectorWeight: 0.2,
        graphWeight: 0.6,
        lexicalWeight: 0.2,
        maxHops: 3,
        minEdgeWeight: 0.1,
        adaptiveWeights: true,
        boostConnected: true,
    },
    balanced: {
        intent: 'balanced',
        vectorWeight: 0.4,
        graphWeight: 0.4,
        lexicalWeight: 0.2,
        maxHops: 2,
        minEdgeWeight: 0.2,
        adaptiveWeights: true,
        boostConnected: true,
    },
    contextual: {
        intent: 'contextual',
        vectorWeight: 0.5,
        graphWeight: 0.3,
        lexicalWeight: 0.2,
        maxHops: 2,
        minEdgeWeight: 0.2,
        adaptiveWeights: true,
        boostConnected: true,
    },
};

/**
 * Graph-powered hybrid search engine
 * Uses in-memory graph for fast traversal
 */
export class HybridSearchEngine {
    private centralityCache: Map<string, number> | null = null;
    private isGraphReady = false;

    /**
     * Initialize graph from SQLite
     */
    async initialize(): Promise<void> {
        if (this.isGraphReady) return;

        console.log('[HybridSearch] Loading graph...');

        // Fetch nodes and edges from SQLite
        const [nodes, edges, embeddings] = await Promise.all([
            dbClient.getAllNodes(),
            dbClient.getAllEdges(),
            dbClient.getAllEmbeddings(),
        ]);

        // Build vector mapping (nodeId → model)
        const vectorMap = new Map<string, { model: 'small' | 'medium' }>();
        for (const emb of embeddings) {
            const model = emb.embedding_small ? 'small' : 'medium';
            vectorMap.set(emb.node_id, { model });
        }

        // Load graph (lean, no vectors)
        await graphBridge.loadFromSQLite(nodes, edges, vectorMap);

        // Pre-compute centrality for all nodes
        console.log('[HybridSearch] Computing centrality...');
        this.centralityCache = graphBridge.computeCentrality(10, 0.85);

        this.isGraphReady = true;
        console.log('[HybridSearch] Graph ready:', graphBridge.getStats());
    }

    /**
     * Main hybrid search with graph-direct traversal
     */
    async search(
        query: string,
        queryEmbedding: Float32Array | null,
        k: number = 10,
        config: Partial<FusionConfig> = {}
    ): Promise<SearchResult[]> {
        if (!this.isGraphReady) {
            await this.initialize();
        }

        const fusionConfig = { ...DEFAULT_FUSION_CONFIGS.balanced, ...config };

        console.log(`[HybridSearch] Query: "${query}", Intent: ${fusionConfig.intent}`);
        const startTime = performance.now();

        // Phase 1: Gather candidates from each signal source
        const [lexicalCandidates, vectorCandidates] = await Promise.all([
            this.getLexicalCandidates(query, k * 5),
            queryEmbedding ? this.getVectorCandidates(queryEmbedding, k * 5) : [],
        ]);

        // Combine candidate IDs
        const candidateIds = new Set<string>();
        lexicalCandidates.forEach(c => candidateIds.add(c.id));
        vectorCandidates.forEach(c => candidateIds.add(c.node_id));

        if (candidateIds.size === 0) {
            return [];
        }

        console.log(`[HybridSearch] Candidates: ${candidateIds.size} (lexical: ${lexicalCandidates.length}, vector: ${vectorCandidates.length})`);

        // Phase 2: Compute graph signals DIRECTLY from in-memory graph
        const graphSignals = this.computeGraphSignals(
            Array.from(candidateIds),
            fusionConfig
        );

        // Phase 3: Normalize and fuse scores
        const fusedResults = this.fuseScores(
            lexicalCandidates,
            vectorCandidates,
            graphSignals,
            fusionConfig
        );

        // Phase 4: Context propagation (boost via graph connectivity)
        if (fusionConfig.boostConnected) {
            this.propagateContextViaGraph(fusedResults, fusionConfig);
        }

        // Sort and hydrate
        fusedResults.sort((a, b) => b.score - a.score);
        const topResults = fusedResults.slice(0, k);

        const hydratedResults = await this.hydrateResults(topResults);

        const elapsed = (performance.now() - startTime).toFixed(2);
        console.log(`[HybridSearch] Completed in ${elapsed}ms, returned ${hydratedResults.length} results`);

        return hydratedResults;
    }

    /**
     * Get lexical candidates (ResoRank/FTS5)
     */
    private async getLexicalCandidates(
        query: string,
        limit: number
    ): Promise<ResoRankResult[]> {
        if (resoRankBridge.isReady()) {
            return resoRankBridge.search(query, limit);
        }

        const sql = `
      SELECT node_id as id, rank as score
      FROM nodes_fts
      WHERE nodes_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `;

        const results = await dbClient.query<{ id: string; score: number }>(sql, [query, limit]);
        return results.map(r => ({ id: r.id, score: Math.abs(r.score) }));
    }

    /**
     * Get vector candidates (DiskANN → SQLite)
     */
    private async getVectorCandidates(
        queryEmbedding: Float32Array,
        limit: number
    ): Promise<Array<{ node_id: string; score: number }>> {
        return embeddingPipeline.search(queryEmbedding, limit, 'small');
    }

    /**
     * Compute graph signals DIRECTLY from in-memory graph
     */
    private computeGraphSignals(
        candidateIds: string[],
        config: FusionConfig
    ): Map<string, GraphSignal> {
        const signals = new Map<string, GraphSignal>();

        for (const nodeId of candidateIds) {
            const node = graphBridge.getNode(nodeId);
            if (!node) {
                // Fallback for nodes not in graph
                signals.set(nodeId, this.getEmptySignal(nodeId));
                continue;
            }

            // Direct graph metrics (instant!)
            const degree = node.outEdges.size + node.inEdges.size;
            const centrality = this.centralityCache?.get(nodeId) || 0;

            // Average edge weight
            const allEdges = [...node.outEdges.values(), ...node.inEdges.values()];
            const avgEdgeWeight = allEdges.length > 0
                ? allEdges.reduce((sum, e) => sum + e.weight, 0) / allEdges.length
                : 0;

            // Multi-hop traversal (if enabled)
            let reachableNodes = 0;
            let avgPathWeight = 0;

            if (config.maxHops > 1) {
                const traversal = graphBridge.traverse(nodeId, config.maxHops, config.minEdgeWeight);
                reachableNodes = traversal.size;

                if (traversal.size > 0) {
                    let totalWeight = 0;
                    for (const { pathWeight } of traversal.values()) {
                        totalWeight += pathWeight;
                    }
                    avgPathWeight = totalWeight / traversal.size;
                }
            }

            // Context signals
            let connectedToCandidates = 0;
            for (const candidateId of candidateIds) {
                if (candidateId === nodeId) continue;
                if (node.outEdges.has(candidateId) || node.inEdges.has(candidateId)) {
                    connectedToCandidates++;
                }
            }

            // Temporal/causal signals from edges
            let temporalSum = 0;
            let temporalCount = 0;
            let causalSum = 0;
            let causalCount = 0;

            for (const edge of allEdges) {
                if (edge.temporal) {
                    temporalSum += edge.temporal.confidence;
                    temporalCount++;
                }
                if (edge.causality) {
                    causalSum += edge.causality.strength;
                    causalCount++;
                }
            }

            signals.set(nodeId, {
                nodeId,
                degree,
                centrality,
                avgEdgeWeight,
                reachableNodes,
                avgPathWeight,
                connectedToCandidates,
                temporalScore: temporalCount > 0 ? temporalSum / temporalCount : 0,
                causalScore: causalCount > 0 ? causalSum / causalCount : 0,
            });
        }

        return signals;
    }

    /**
     * Fuse scores from all signals
     */
    private fuseScores(
        lexicalCandidates: ResoRankResult[],
        vectorCandidates: Array<{ node_id: string; score: number }>,
        graphSignals: Map<string, GraphSignal>,
        config: FusionConfig
    ): Array<{ node_id: string; score: number; breakdown: any }> {
        // Normalize scores
        const normalizedLexical = this.normalizeScores(
            lexicalCandidates.map(c => ({ id: c.id, score: c.score }))
        );
        const normalizedVector = this.normalizeScores(
            vectorCandidates.map(c => ({ id: c.node_id, score: c.score }))
        );

        // Collect all unique IDs
        const allIds = new Set<string>();
        lexicalCandidates.forEach(c => allIds.add(c.id));
        vectorCandidates.forEach(c => allIds.add(c.node_id));

        const results = [];

        for (const nodeId of allIds) {
            const lexicalScore = normalizedLexical.get(nodeId) || 0;
            const vectorScore = normalizedVector.get(nodeId) || 0;
            const graphSignal = graphSignals.get(nodeId);

            // Compute graph relevance score
            const graphScore = graphSignal ? this.computeGraphRelevance(graphSignal) : 0;

            // Weighted fusion (HMGI formula)
            const finalScore =
                config.lexicalWeight * lexicalScore +
                config.vectorWeight * vectorScore +
                config.graphWeight * graphScore;

            results.push({
                node_id: nodeId,
                score: finalScore,
                breakdown: {
                    lexical: lexicalScore,
                    vector: vectorScore,
                    graph: graphScore,
                    graphSignal,
                    weights: {
                        lexical: config.lexicalWeight,
                        vector: config.vectorWeight,
                        graph: config.graphWeight,
                    },
                },
            });
        }

        return results;
    }

    /**
     * Compute unified graph relevance from signals
     */
    private computeGraphRelevance(signal: GraphSignal): number {
        const weights = {
            degree: 0.15,
            centrality: 0.25,
            avgEdgeWeight: 0.2,
            avgPathWeight: 0.15,
            connectedToCandidates: 0.15,
            temporalScore: 0.05,
            causalScore: 0.05,
        };

        // Normalize individual signals
        const normalized = {
            degree: Math.min(signal.degree / 20, 1),
            centrality: signal.centrality,
            avgEdgeWeight: signal.avgEdgeWeight,
            avgPathWeight: signal.avgPathWeight,
            connectedToCandidates: Math.min(signal.connectedToCandidates / 10, 1),
            temporalScore: signal.temporalScore,
            causalScore: signal.causalScore,
        };

        return Object.entries(weights).reduce((sum, [key, weight]) => {
            return sum + weight * (normalized[key as keyof typeof normalized] || 0);
        }, 0);
    }

    /**
     * Context propagation via graph traversal
     */
    private propagateContextViaGraph(
        results: Array<{ node_id: string; score: number }>,
        config: FusionConfig
    ): void {
        if (results.length === 0) return;

        // Get top 20% as anchors
        const topK = Math.max(3, Math.floor(results.length * 0.2));
        const anchorIds = results.slice(0, topK).map(r => r.node_id);

        // Build boost map by traversing graph from anchors
        const boostMap = new Map<string, number>();

        for (const anchorId of anchorIds) {
            const neighbors = graphBridge.getNeighbors(anchorId);

            for (const neighbor of neighbors) {
                const edge = graphBridge.getNode(anchorId)?.outEdges.get(neighbor.id);
                const boost = edge ? edge.weight * 0.15 : 0.1;

                boostMap.set(neighbor.id, (boostMap.get(neighbor.id) || 0) + boost);
            }
        }

        // Apply boosts
        for (const result of results) {
            const boost = boostMap.get(result.node_id) || 0;
            result.score = Math.min(1.0, result.score + boost);
        }
    }

    /**
     * Hydrate results with SQLite node data
     */
    private async hydrateResults(
        results: Array<{ node_id: string; score: number; breakdown?: any }>
    ): Promise<SearchResult[]> {
        if (results.length === 0) return [];

        const nodeIds = results.map(r => r.node_id);
        const placeholders = nodeIds.map(() => '?').join(',');
        const sql = `SELECT * FROM nodes WHERE id IN (${placeholders})`;

        const nodes = await dbClient.query<SQLiteNode>(sql, nodeIds);
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        return results
            .map(result => {
                const node = nodeMap.get(result.node_id);
                if (!node) return null;

                return {
                    node_id: node.id,
                    label: node.label,
                    content: node.content || '',
                    score: result.score,
                    source: 'hybrid' as const,
                    metadata: {
                        type: node.type,
                        entity_kind: node.entity_kind || undefined,
                        entity_subtype: node.entity_subtype || undefined,
                        breakdown: result.breakdown,
                    },
                } as SearchResult;
            })
            .filter((r): r is SearchResult => r !== null);
    }

    // Helpers

    private normalizeScores(
        scores: Array<{ id: string; score: number }>
    ): Map<string, number> {
        if (scores.length === 0) return new Map();

        const maxScore = Math.max(...scores.map(s => s.score), 0.001);
        const minScore = Math.min(...scores.map(s => s.score));
        const range = maxScore - minScore || 1;

        return new Map(
            scores.map(s => [s.id, (s.score - minScore) / range])
        );
    }

    private getEmptySignal(nodeId: string): GraphSignal {
        return {
            nodeId,
            degree: 0,
            centrality: 0,
            avgEdgeWeight: 0,
            reachableNodes: 0,
            avgPathWeight: 0,
            connectedToCandidates: 0,
            temporalScore: 0,
            causalScore: 0,
        };
    }

    /**
     * Clear caches
     */
    clearCache(): void {
        this.centralityCache = null;
    }

    /**
     * Rebuild graph (call when nodes/edges change)
     */
    async rebuildGraph(): Promise<void> {
        this.isGraphReady = false;
        this.centralityCache = null;
        graphBridge.clear();
        await this.initialize();
    }
}

export const hybridSearchEngine = new HybridSearchEngine();
