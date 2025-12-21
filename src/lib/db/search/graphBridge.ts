// src/lib/db/search/graphBridge.ts

import type { SQLiteNode, SQLiteEdge } from '../client/types';

/**
 * In-memory graph structure (lean, fast traversal)
 */
export interface GraphNode {
    id: string;
    label: string;
    type: string;

    // Graph-specific properties (NO vectors!)
    outEdges: Map<string, GraphEdge>;  // target → edge
    inEdges: Map<string, GraphEdge>;   // source → edge

    // Metadata for search
    entity_kind?: string;
    entity_subtype?: string;

    // Reference to embeddings (NOT stored in graph)
    hasEmbedding: boolean;
    embeddingModel?: 'small' | 'medium';
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
    bidirectional: boolean;

    // Rich edge data
    temporal?: {
        relationType: string;
        confidence: number;
    };
    causality?: {
        strength: number;
        directness: 'direct' | 'indirect';
    };
}

/**
 * Bridge between SQLite and in-memory graph
 * Keeps graph lean by mapping vectors externally
 */
export class GraphBridge {
    private nodes = new Map<string, GraphNode>();
    private edges = new Map<string, GraphEdge>();

    // Vector mapping (nodeId → has embedding flag)
    private vectorMap = new Map<string, { model: 'small' | 'medium' }>();

    // Graph statistics
    private stats = {
        nodeCount: 0,
        edgeCount: 0,
        nodesWithVectors: 0,
    };

    /**
     * Load graph from SQLite (nodes + edges only, NO vectors)
     */
    async loadFromSQLite(
        nodes: SQLiteNode[],
        edges: SQLiteEdge[],
        vectorMap: Map<string, { model: 'small' | 'medium' }>
    ): Promise<void> {
        console.log('[GraphBridge] Loading graph from SQLite...');
        const startTime = performance.now();

        this.clear();

        // Build nodes (lightweight)
        for (const sqlNode of nodes) {
            const hasEmbedding = vectorMap.has(sqlNode.id);

            const node: GraphNode = {
                id: sqlNode.id,
                label: sqlNode.label,
                type: sqlNode.type,
                outEdges: new Map(),
                inEdges: new Map(),
                entity_kind: sqlNode.entity_kind || undefined,
                entity_subtype: sqlNode.entity_subtype || undefined,
                hasEmbedding,
                embeddingModel: hasEmbedding ? vectorMap.get(sqlNode.id)?.model : undefined,
            };

            this.nodes.set(node.id, node);
        }

        // Build edges
        for (const sqlEdge of edges) {
            const edge: GraphEdge = {
                id: sqlEdge.id,
                source: sqlEdge.source,
                target: sqlEdge.target,
                type: sqlEdge.type,
                weight: sqlEdge.weight,
                bidirectional: sqlEdge.bidirectional === 1,
                temporal: sqlEdge.temporal_relation ? this.parseTemporal(sqlEdge.temporal_relation) : undefined,
                causality: sqlEdge.causality ? this.parseCausality(sqlEdge.causality) : undefined,
            };

            this.edges.set(edge.id, edge);

            // Wire up adjacency
            const sourceNode = this.nodes.get(edge.source);
            const targetNode = this.nodes.get(edge.target);

            if (sourceNode) {
                sourceNode.outEdges.set(edge.target, edge);
            }

            if (targetNode) {
                targetNode.inEdges.set(edge.source, edge);
            }

            // Bidirectional wiring
            if (edge.bidirectional && sourceNode) {
                sourceNode.inEdges.set(edge.target, edge);
            }
        }

        // Store vector mapping
        this.vectorMap = vectorMap;

        // Update stats
        this.stats.nodeCount = this.nodes.size;
        this.stats.edgeCount = this.edges.size;
        this.stats.nodesWithVectors = vectorMap.size;

        const elapsed = (performance.now() - startTime).toFixed(2);
        console.log(`[GraphBridge] Loaded ${this.stats.nodeCount} nodes, ${this.stats.edgeCount} edges in ${elapsed}ms`);
        console.log(`[GraphBridge] ${this.stats.nodesWithVectors} nodes have embeddings`);
    }

    /**
     * Get node by ID
     */
    getNode(nodeId: string): GraphNode | undefined {
        return this.nodes.get(nodeId);
    }

    /**
     * Get all neighbors (1-hop)
     */
    getNeighbors(nodeId: string): GraphNode[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        const neighbors = new Set<string>();

        // Outbound neighbors
        for (const targetId of node.outEdges.keys()) {
            neighbors.add(targetId);
        }

        // Inbound neighbors
        for (const sourceId of node.inEdges.keys()) {
            neighbors.add(sourceId);
        }

        return Array.from(neighbors)
            .map(id => this.nodes.get(id))
            .filter((n): n is GraphNode => n !== undefined);
    }

    /**
     * Multi-hop traversal (BFS)
     */
    traverse(
        startNodeId: string,
        maxHops: number = 2,
        minEdgeWeight: number = 0.2
    ): Map<string, { node: GraphNode; distance: number; pathWeight: number }> {
        const visited = new Map<string, { node: GraphNode; distance: number; pathWeight: number }>();
        const queue: Array<{ nodeId: string; distance: number; pathWeight: number }> = [
            { nodeId: startNodeId, distance: 0, pathWeight: 1.0 }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (current.distance > maxHops) continue;
            if (visited.has(current.nodeId)) continue;

            const node = this.nodes.get(current.nodeId);
            if (!node) continue;

            visited.set(current.nodeId, {
                node,
                distance: current.distance,
                pathWeight: current.pathWeight,
            });

            // Explore neighbors
            if (current.distance < maxHops) {
                for (const [targetId, edge] of node.outEdges) {
                    if (edge.weight < minEdgeWeight) continue;
                    if (visited.has(targetId)) continue;

                    queue.push({
                        nodeId: targetId,
                        distance: current.distance + 1,
                        pathWeight: current.pathWeight * edge.weight,
                    });
                }

                // Also explore inbound if bidirectional
                for (const [sourceId, edge] of node.inEdges) {
                    if (!edge.bidirectional) continue;
                    if (edge.weight < minEdgeWeight) continue;
                    if (visited.has(sourceId)) continue;

                    queue.push({
                        nodeId: sourceId,
                        distance: current.distance + 1,
                        pathWeight: current.pathWeight * edge.weight,
                    });
                }
            }
        }

        return visited;
    }

    /**
     * Compute PageRank-like centrality (simple power iteration)
     */
    computeCentrality(iterations: number = 10, damping: number = 0.85): Map<string, number> {
        const scores = new Map<string, number>();
        const n = this.nodes.size;

        if (n === 0) return scores;

        // Initialize
        for (const nodeId of this.nodes.keys()) {
            scores.set(nodeId, 1.0 / n);
        }

        // Power iteration
        for (let iter = 0; iter < iterations; iter++) {
            const newScores = new Map<string, number>();

            for (const [nodeId, node] of this.nodes) {
                let score = (1 - damping) / n;

                // Sum contributions from incoming neighbors
                for (const [sourceId, edge] of node.inEdges) {
                    const sourceNode = this.nodes.get(sourceId);
                    if (!sourceNode) continue;

                    const sourceScore = scores.get(sourceId) || 0;
                    const outDegree = sourceNode.outEdges.size || 1;

                    score += damping * (sourceScore / outDegree) * edge.weight;
                }

                newScores.set(nodeId, score);
            }

            // Update scores
            for (const [nodeId, score] of newScores) {
                scores.set(nodeId, score);
            }
        }

        return scores;
    }

    /**
     * Check if node has embedding
     */
    hasEmbedding(nodeId: string): boolean {
        return this.vectorMap.has(nodeId);
    }

    /**
     * Get stats
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Clear graph
     */
    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.vectorMap.clear();
        this.stats = { nodeCount: 0, edgeCount: 0, nodesWithVectors: 0 };
    }

    // Private helpers

    private parseTemporal(json: string): { relationType: string; confidence: number } | undefined {
        try {
            const data = JSON.parse(json);
            return {
                relationType: data.relationType,
                confidence: data.confidence,
            };
        } catch {
            return undefined;
        }
    }

    private parseCausality(json: string): { strength: number; directness: 'direct' | 'indirect' } | undefined {
        try {
            const data = JSON.parse(json);
            return {
                strength: data.strength,
                directness: data.directness,
            };
        } catch {
            return undefined;
        }
    }
}

export const graphBridge = new GraphBridge();
