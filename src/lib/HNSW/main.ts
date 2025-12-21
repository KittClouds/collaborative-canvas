import { PriorityQueue, PriorityQueuePool } from './pqueue';
import { Node } from './node';
import { cosineSimilarity, euclideanSimilarity, getVectorMagnitude } from './similarity';

type Metric = 'cosine' | 'euclidean';

export class HNSWError extends Error {
    constructor(
        message: string,
        public code: string,
        public context?: any
    ) {
        super(message);
        this.name = 'HNSWError';
    }
}

// Enhanced metadata structure
export interface HNSWMetadata {
    version: string;
    created: number;
    updated: number;
    checksum?: string;
}

// Compact node representation - sparse neighbors only
export interface CompactNodeData {
    id: number;
    level: number;
    vector: number[];
    magnitude: number; // Keep magnitude for performance
    // Store as flat array: [level0Count, ...ids, level1Count, ...ids, ...]
    neighborData: number[];
    deleted?: boolean; // Omit if false to save space
}

// Improved serialization format
export interface SerializedHNSWData {
    metadata: HNSWMetadata;
    config: {
        M: number;
        efConstruction: number;
        metric: 'cosine' | 'euclidean';
        levelMult?: number; // Only include if non-default
    };
    graph: {
        d: number; // Required
        levelMax: number;
        entryPointId: number;
        nodeCount: number; // For integrity validation
    };
    nodes: CompactNodeData[];
}

interface SearchMetrics {
    duration: number;
    nodesVisited: number;
    layersTraversed: number;
    candidatesEvaluated: number;
    earlyTerminations: number;
}

interface HNSWStats {
    totalSearches: number;
    avgSearchTime: number;
    avgNodesVisited: number;
    cacheHitRate: number;
    graphDensity: number; // Avg neighbors per node
}

export class HNSW {
    metric: Metric; // Metric to use
    similarityFunction: (a: Float32Array, b: Float32Array, magA?: number, magB?: number) => number;
    d: number | null = null; // Dimension of the vectors
    M: number; // Max number of neighbors
    efConstruction: number; // Max number of nodes to visit during construction
    levelMax: number; // Max level of the graph
    entryPointId: number; // Id of the entry point
    nodes: Map<number, Node>; // Map of nodes
    probs: number[]; // Probabilities for the levels
    levelMult: number; // Multiplier for level generation probability
    private _metadata: HNSWMetadata;
    private _stats: HNSWStats = {
        totalSearches: 0,
        avgSearchTime: 0,
        avgNodesVisited: 0,
        cacheHitRate: 0,
        graphDensity: 0
    };
    private _searchMetrics: SearchMetrics[] = [];
    private _enableProfiling: boolean = false;
    private _buildProgress?: {
        total: number;
        current: number;
        startTime: number;
        estimatedTimeRemaining: number;
    };

    constructor(
        M = 16,
        efConstruction = 200,
        metric: Metric = 'cosine',
        levelMult?: number
    ) {
        this.metric = metric;
        this.d = null; // Dimensionality is set by the first vector added
        this.M = M;
        this.efConstruction = efConstruction;
        this.levelMult = levelMult === undefined ? 1 / Math.log(M) : levelMult;
        this.entryPointId = -1;
        this.nodes = new Map<number, Node>();
        // Initialize probs using the M and determined levelMult
        this.probs = this.set_probs(this.M, this.levelMult);
        this.levelMax = this.probs.length - 1;
        this.similarityFunction = this.getMetric(metric);

        this._metadata = {
            version: '2.0.0',
            created: Date.now(),
            updated: Date.now()
        };

        this.validateConfig();
    }

    enableProfiling(enabled: boolean = true): void {
        this._enableProfiling = enabled;
        if (enabled) {
            this._searchMetrics = [];
        }
    }

    getStats(): HNSWStats {
        return { ...this._stats };
    }

    getSearchMetrics(): SearchMetrics[] {
        return [...this._searchMetrics];
    }

    private validateConfig(): void {
        if (this.M < 2 || this.M > 512) { // Increased upper limit slightly for flexibility
            throw new HNSWError(
                'M must be between 2 and 512',
                'INVALID_M',
                { M: this.M }
            );
        }

        if (this.efConstruction < this.M) {
            throw new HNSWError(
                'efConstruction must be >= M',
                'INVALID_EF_CONSTRUCTION',
                { efConstruction: this.efConstruction, M: this.M }
            );
        }
    }

    private getMetric(metric: Metric): (a: number[] | Float32Array, b: number[] | Float32Array) => number {
        if (metric === 'cosine') {
            return cosineSimilarity;
        } else if (metric === 'euclidean') {
            return (a: Float32Array, b: Float32Array) => euclideanSimilarity(a, b);
        } else {
            throw new Error('Invalid metric');
        }
    }

    private set_probs(M: number, levelMult: number): number[] {
        let level = 0;
        const probs = [];
        while (true) {
            const prob = Math.exp(-level / levelMult) * (1 - Math.exp(-1 / levelMult));
            if (prob < 1e-9) break;
            probs.push(prob);
            level++;
        }
        return probs;
    }

    private selectLevel(): number {
        let r = Math.random();
        this.probs.forEach((p, i) => {
            if (r < p) {
                return i;
            }
            r -= p;
        });
        return this.probs.length - 1;
    }

    private _searchLayer(
        queryVector: Float32Array,
        entryPointIds: number[],
        layerNumber: number,
        numCandidatesToKeep: number,
        queryMagnitude?: number,
        metrics?: SearchMetrics
    ): { candidates: PriorityQueue<number>; terminatedEarly: boolean } {
        const visited = new Set<number>();
        // Worklist: Max-heap of {id, similarity} to explore most promising first
        const W = PriorityQueuePool.getQueue<{ id: number; similarity: number }>(
            (a, b) => b.similarity - a.similarity,
            'worklist'
        );
        // Results: Min-heap of {id, similarity} to keep top N, peek() is worst of top N
        const C = PriorityQueuePool.getQueue<{ id: number; similarity: number }>(
            (a, b) => a.similarity - b.similarity,
            'results'
        );
        let terminatedEarly = false;

        for (const epId of entryPointIds) {
            const epNode = this.nodes.get(epId);
            // Ignore if node doesn't exist, is deleted, or already visited
            if (!epNode || epNode.deleted || visited.has(epId)) continue;

            // epNode is guaranteed to exist and not be deleted here
            const sim = this.similarityFunction(queryVector, epNode.vector, queryMagnitude, epNode.magnitude);
            if (metrics) metrics.candidatesEvaluated++;

            W.push({ id: epId, similarity: sim });
            visited.add(epId);
            if (metrics) metrics.nodesVisited++;

            if (C.size() < numCandidatesToKeep) {
                C.push({ id: epId, similarity: sim });
            } else if (sim > C.peek()!.similarity) {
                C.pop();
                C.push({ id: epId, similarity: sim });
            }
        }

        while (!W.isEmpty()) {
            const current = W.pop()!; // Pop best candidate to explore

            // Early termination check: if C is full and current's similarity is worse than the worst in C
            if (C.size() === numCandidatesToKeep && current.similarity < C.peek()!.similarity) {
                terminatedEarly = true;
                if (metrics) metrics.earlyTerminations++;
                break; // Exit the while (!W.isEmpty()) loop
            }

            const currentNodeObject = this.nodes.get(current.id);
            // Ignore if node doesn't exist, is deleted, or has no neighbors at this level
            if (!currentNodeObject || currentNodeObject.deleted || !currentNodeObject.neighbors[layerNumber]) continue;

            for (const neighborId of currentNodeObject.neighbors[layerNumber]) {
                if (neighborId === -1) continue; // Skip placeholder

                const neighborNode = this.nodes.get(neighborId);
                // Ignore if neighbor doesn't exist, is deleted, or already visited
                if (!neighborNode || neighborNode.deleted || visited.has(neighborId)) continue;

                visited.add(neighborId); // Add to visited only if valid and not deleted
                if (metrics) metrics.nodesVisited++;
                // neighborNode is guaranteed to exist and not be deleted here
                const simToQuery = this.similarityFunction(queryVector, neighborNode.vector, queryMagnitude, neighborNode.magnitude);
                if (metrics) metrics.candidatesEvaluated++;

                if (C.size() < numCandidatesToKeep || simToQuery > C.peek()!.similarity) {
                    if (C.size() === numCandidatesToKeep) {
                        C.pop(); // Remove worst from C if full
                    }
                    C.push({ id: neighborId, similarity: simToQuery });
                }
                W.push({ id: neighborId, similarity: simToQuery }); // Add to worklist
            }
        }

        // Convert C (min-heap of {id, similarity}) to a PQ of just IDs, ordered best first for popping.
        const returnQueue = PriorityQueuePool.getQueue<number>(
            (id_a, id_b) => {
                const nodeA = this.nodes.get(id_a)!;
                const nodeB = this.nodes.get(id_b)!;
                return this.similarityFunction(queryVector, nodeB.vector, queryMagnitude, nodeB.magnitude) -
                    this.similarityFunction(queryVector, nodeA.vector, queryMagnitude, nodeA.magnitude);
            },
            'return'
        );
        const tempArray: { id: number; similarity: number }[] = [];
        while (!C.isEmpty()) tempArray.push(C.pop()!);

        // Release pooled queues
        PriorityQueuePool.releaseQueue(W, 'worklist');
        PriorityQueuePool.releaseQueue(C, 'results');

        // tempArray is now sorted worst first (due to min-heap pop order)
        tempArray.sort((a, b) => b.similarity - a.similarity); // Sort best first by similarity
        tempArray.forEach(item => returnQueue.push(item.id));

        return { candidates: returnQueue, terminatedEarly: terminatedEarly }; // 4. Return object
    }

    private async addNodeToGraph(node: Node) {
        if (this.entryPointId === -1) {
            this.entryPointId = node.id;
            return;
        }

        const nodeVector = node.vector;
        let currentGlobalEntryPointIds: number[] = [this.entryPointId];

        // 1. Search layers above node.level to find the best entry point(s) for node.level
        const queryMagnitude = this.metric === 'cosine' ? getVectorMagnitude(nodeVector) : undefined;

        // 1. Search layers above node.level to find the best entry point(s) for node.level
        for (let searchLayer = this.levelMax; searchLayer > node.level; searchLayer--) {
            if (currentGlobalEntryPointIds.length === 0) break; // Stop if no entry points
            const bestEntryPointQueue = this._searchLayer(nodeVector, currentGlobalEntryPointIds, searchLayer, 1, queryMagnitude);
            if (!bestEntryPointQueue.candidates.isEmpty()) {
                currentGlobalEntryPointIds = [bestEntryPointQueue.candidates.peek()!];
            } else {
                currentGlobalEntryPointIds = []; // No path found at this level
            }
        }

        // 2. Search in node's layers (from node.level down to 0) to find efConstruction neighbors
        for (let connectionLayer = Math.min(node.level, this.levelMax); connectionLayer >= 0; connectionLayer--) {
            if (currentGlobalEntryPointIds.length === 0 && connectionLayer < Math.min(node.level, this.levelMax)) {
                // If we lost all entry points and we are not in the very first connection layer search,
                // try to reset to global entry point to prevent complete disconnection if possible.
                // This is a heuristic and might need refinement.
                currentGlobalEntryPointIds = [this.entryPointId];
            }
            if (currentGlobalEntryPointIds.length === 0 && this.nodes.size > 1) {
                // If still no entry points (e.g. global entry point is not suitable or graph is tiny),
                // we might not be able to connect this node at this layer.
                // This situation should be rare in a healthy graph construction.
                // For now, we'll let _searchLayer handle empty entryPointIds (it will return empty queue).
            }

            const neighborCandidateQueue = this._searchLayer(nodeVector, currentGlobalEntryPointIds, connectionLayer, this.efConstruction, queryMagnitude);

            const neighborsFoundAtThisLayer: number[] = [];
            while (!neighborCandidateQueue.candidates.isEmpty()) {
                neighborsFoundAtThisLayer.push(neighborCandidateQueue.candidates.pop()!); // Pop gives best due to returnQueue's comparator
            }

            for (const neighborId of neighborsFoundAtThisLayer) {
                if (neighborId === node.id) continue;

                const neighborNode = this.nodes.get(neighborId);
                if (neighborNode) {
                    // Connect the new node (node) to its selected neighbor (neighborId).
                    // _updateNeighborsAndPrune will handle if neighborId points to a (now) deleted node internally.
                    this._updateNeighborsAndPrune(node, neighborId, connectionLayer);

                    // Connect the selected neighbor (neighborNode) back to the new node (node.id),
                    // only if neighborNode has not been marked as deleted.
                    if (!neighborNode.deleted) {
                        this._updateNeighborsAndPrune(neighborNode, node.id, connectionLayer);
                    }
                }
            }

            if (neighborsFoundAtThisLayer.length > 0) {
                currentGlobalEntryPointIds = neighborsFoundAtThisLayer;
            }
            // If neighborsFoundAtThisLayer is empty, currentGlobalEntryPointIds from previous layer search persists,
            // or the global entry point if it was reset.
        }
    }

    private _updateNeighborsAndPrune(baseNode: Node, newNeighborId: number, level: number): void {
        const M = this.M; // Max neighbors for this level

        // Get current valid neighbors and add the new one
        let candidates = baseNode.neighbors[level].filter(id => id !== -1);
        if (!candidates.includes(newNeighborId) && newNeighborId !== baseNode.id) {
            candidates.push(newNeighborId);
        }

        if (candidates.length > M) {
            // Need to prune. Calculate similarities and pick the M closest.
            const candidateSims: { id: number; similarity: number }[] = [];
            for (const neighborId of candidates) {
                const neighborNode = this.nodes.get(neighborId);
                // Only consider existing, non-deleted nodes for similarity calculation
                if (neighborNode && !neighborNode.deleted) {
                    candidateSims.push({
                        id: neighborId,
                        similarity: this.similarityFunction(baseNode.vector, neighborNode.vector, baseNode.magnitude, neighborNode.magnitude)
                    });
                }
            }

            // Sort by similarity (descending) to get the closest ones
            candidateSims.sort((a, b) => b.similarity - a.similarity);

            // Update neighbors with the top M
            for (let i = 0; i < M; i++) {
                baseNode.neighbors[level][i] = candidateSims[i] ? candidateSims[i].id : -1;
            }
            // Fill remaining slots if fewer than M actual neighbors
            for (let i = candidateSims.length; i < M; i++) {
                baseNode.neighbors[level][i] = -1;
            }

        } else {
            // No pruning needed. Filter out deleted nodes from candidates.
            const validCandidates = candidates.filter(candId => {
                const candNode = this.nodes.get(candId);
                return candNode && !candNode.deleted;
            });

            // Update baseNode's neighbors for the current level
            for (let i = 0; i < M; i++) {
                baseNode.neighbors[level][i] = i < validCandidates.length ? validCandidates[i] : -1;
            }

        }
    }

    addPoint(id: number, vector: Float32Array | number[]) {
        try {
            // Input validation
            if (!Number.isInteger(id) || id < 0) {
                throw new HNSWError(
                    'ID must be a non-negative integer',
                    'INVALID_ID',
                    { id }
                );
            }

            if (!vector || vector.length === 0) {
                throw new HNSWError(
                    'Vector cannot be empty',
                    'EMPTY_VECTOR',
                    { id }
                );
            }

            const floatVector = vector instanceof Float32Array ? vector : new Float32Array(vector);
            if (this.nodes.has(id)) {
                throw new HNSWError(
                    `Node with id ${id} already exists.`,
                    'DUPLICATE_ID',
                    { id }
                );
            }

            if (this.d === null) {
                this.d = floatVector.length;
            } else if (floatVector.length !== this.d) {
                throw new HNSWError(
                    'Vector dimensionality mismatch',
                    'DIMENSION_MISMATCH',
                    { expected: this.d, got: floatVector.length, id }
                );
            }

            const level = this.selectLevel();
            const magnitude = this.metric === 'cosine' ? getVectorMagnitude(floatVector) : 0;
            const node = new Node(id, floatVector, level, this.M, magnitude);
            this.nodes.set(id, node);

            if (this.entryPointId === -1) {
                this.entryPointId = id;
                this.levelMax = node.level;
                return;
            }

            this.levelMax = Math.max(this.levelMax, node.level);

            this.addNodeToGraph(node);
        } catch (error) {
            if (error instanceof HNSWError) {
                console.error(`HNSW Error [${error.code}]:`, error.message, error.context);
            }
            throw error;
        }
    }

    public deletePoint(id: number): void {
        const nodeToDelete = this.nodes.get(id);
        if (nodeToDelete) {
            nodeToDelete.deleted = true;
            // Note: This simple implementation doesn't remove the node from neighbors' lists.
            // A more advanced version would require a "cleanup" process or more complex logic here.
        } else {
            throw new Error(`Node with id ${id} not found.`);
        }
    }

    searchKNN(
        query: Float32Array | number[],
        k: number,
        efSearch?: number
    ): { id: number; score: number }[] {
        const startTime = this._enableProfiling ? performance.now() : 0;
        const metrics: SearchMetrics = {
            duration: 0,
            nodesVisited: 0,
            layersTraversed: 0,
            candidatesEvaluated: 0,
            earlyTerminations: 0
        };

        const floatQuery = query instanceof Float32Array ? query : new Float32Array(query);
        const queryMagnitude = this.metric === 'cosine' ? getVectorMagnitude(floatQuery) : undefined;

        if (this.nodes.size === 0) {
            return [];
        }
        // Attempt to recover if entryPointId is -1 but nodes exist (e.g. after all nodes deleted then new ones added)
        if (this.entryPointId === -1 && this.nodes.size > 0) {
            let foundRecoveryEP = false;
            for (const [id, node] of this.nodes) {
                if (!node.deleted) {
                    this.entryPointId = id;
                    // Ensure levelMax is sensible if we had to recover entryPointId
                    // This might involve checking node.level, but addPoint should manage levelMax generally.
                    // For now, we assume levelMax is either correct or will be less critical than finding an EP.
                    console.warn(`HNSW.searchKNN: Recovered missing entryPointId to ${id}.`);
                    foundRecoveryEP = true;
                    break;
                }
            }
            if (!foundRecoveryEP) {
                console.error("HNSW.searchKNN: entryPointId is -1 and no non-deleted nodes found to recover for search.");
                return [];
            }
        }

        let effectiveEntryPointId = this.entryPointId;
        let currentGlobalEntryPointNode = this.nodes.get(effectiveEntryPointId);

        // Check if the determined entry point (either original or recovered) is valid and not deleted.
        if (!currentGlobalEntryPointNode || currentGlobalEntryPointNode.deleted) {
            console.warn(`HNSW.searchKNN: Entry point ID ${effectiveEntryPointId} (original or recovered) is invalid or deleted. Attempting to find a new one for this search.`);
            let foundNewFallback = false;
            for (const [id, node] of this.nodes) {
                if (!node.deleted) {
                    effectiveEntryPointId = id;
                    currentGlobalEntryPointNode = node;
                    foundNewFallback = true;
                    console.log(`HNSW.searchKNN: Using fallback entry point ${id} for this search as ${this.entryPointId} was unusable.`);
                    break;
                }
            }
            if (!foundNewFallback) {
                console.error(`HNSW.searchKNN: No valid non-deleted entry points found in the graph to conduct search.`);
                return [];
            }
        }
        // At this point, 'currentGlobalEntryPointNode' is a non-deleted node if any exist and 'effectiveEntryPointId' is its ID.
        // If no non-deleted nodes exist, we would have returned an empty array.

        if (this.d !== null && floatQuery.length !== this.d) {
            throw new Error(`Query vector dimensionality ${floatQuery.length} does not match index dimensionality ${this.d}`);
        }

        // Handle case with only one valid node
        // currentGlobalEntryPointNode is guaranteed to be non-null and non-deleted here if nodes.size >= 1
        if (this.nodes.size === 1 && currentGlobalEntryPointNode) {
            const similarity = this.similarityFunction(floatQuery, currentGlobalEntryPointNode.vector, queryMagnitude, currentGlobalEntryPointNode.magnitude);
            if (this._enableProfiling) {
                metrics.duration = performance.now() - startTime;
                metrics.nodesVisited = 1;
                metrics.candidatesEvaluated = 1;
                this._recordMetrics(metrics);
            }
            return [{ id: effectiveEntryPointId, score: similarity }];
        }
        // If nodes map is empty (should have been caught by initial check, but as a safeguard)
        if (this.nodes.size === 0) return [];
        if (!currentGlobalEntryPointNode) { // Should not happen if nodes.size > 0 and entry point logic is correct
            console.error("HNSW.searchKNN: currentGlobalEntryPointNode is unexpectedly null before dual-branch logic.");
            return [];
        }

        let currentEntryPoints: number[] = [effectiveEntryPointId];
        // At this point, currentGlobalEntryPointNode is the validated, non-deleted entry point.
        const mainEntryPointNode = currentGlobalEntryPointNode;

        // --- DIVERSITY-AWARE MULTI-BRANCH LOGIC ---
        const MAX_BRANCHES = 3; // Configurable number of diverse entry points
        const DIVERSITY_SIMILARITY_THRESHOLD = 0.9; // How similar candidates can be to be considered non-diverse

        // 1. Perform a cheap search at a high level to find diverse candidates, only if the graph is large enough
        if (this.levelMax > 0 && this.nodes.size > this.M * 2) {
            const presearchResult = this._searchLayer(
                floatQuery,
                [effectiveEntryPointId],
                this.levelMax, // Search at the highest layer
                this.M, // Look for a number of candidates related to M
                queryMagnitude,
                this._enableProfiling ? metrics : undefined
            );

            const candidatePool: number[] = [effectiveEntryPointId];
            const tempPQ = presearchResult.candidates.clone();
            while (!tempPQ.isEmpty() && candidatePool.length < this.M) {
                candidatePool.push(tempPQ.pop()!); // Pop returns highest similarity first
            }

            // 2. Select a few candidates from the pool that are dissimilar from each other
            const diverseEntryPoints: number[] = [effectiveEntryPointId];
            for (const candidateId of candidatePool) {
                if (diverseEntryPoints.length >= MAX_BRANCHES) break;
                if (diverseEntryPoints.includes(candidateId)) continue;

                const candidateNode = this.nodes.get(candidateId);
                if (!candidateNode || candidateNode.deleted) continue;

                let isDiverseEnough = true;
                for (const depId of diverseEntryPoints) {
                    const depNode = this.nodes.get(depId)!; // Should exist
                    // Check if the new candidate is too similar to any already in our diverse set
                    if (this._enableProfiling) metrics.candidatesEvaluated++;
                    if (this.similarityFunction(candidateNode.vector, depNode.vector, candidateNode.magnitude, depNode.magnitude) > DIVERSITY_SIMILARITY_THRESHOLD) {
                        isDiverseEnough = false;
                        break;
                    }
                }

                if (isDiverseEnough) {
                    diverseEntryPoints.push(candidateId);
                }
            }
            currentEntryPoints = diverseEntryPoints;
        }
        // --- END DUAL-BRANCH LOGIC ---

        // Phase 1: Search from top layer down to layer 1
        for (let currentLayer = this.levelMax; currentLayer >= 1; currentLayer--) {
            currentEntryPoints = currentEntryPoints.filter(epId => {
                const node = this.nodes.get(epId);
                return node && !node.deleted;
            });
            if (currentEntryPoints.length === 0) {
                const fallbackEntryPoint = this.nodes.get(this.entryPointId); // Use original global entry
                if (fallbackEntryPoint && !fallbackEntryPoint.deleted) {
                    currentEntryPoints = [this.entryPointId];
                } else { // Should not happen if global entry point was validated initially
                    return [];
                }
            }

            const numCandidatesToKeep = currentEntryPoints.length;
            if (this._enableProfiling) metrics.layersTraversed++;
            const { candidates } = this._searchLayer(floatQuery, currentEntryPoints, currentLayer, numCandidatesToKeep, queryMagnitude, this._enableProfiling ? metrics : undefined);

            if (!candidates.isEmpty()) {
                const topCandidates: number[] = [];
                while (!candidates.isEmpty()) {
                    topCandidates.push(candidates.pop()!);
                }
                currentEntryPoints = topCandidates.reverse();
            } else {
                const fallbackEntryPoint = this.nodes.get(this.entryPointId);
                if (fallbackEntryPoint && !fallbackEntryPoint.deleted) {
                    currentEntryPoints = [this.entryPointId];
                } else {
                    return [];
                }
            }
        }

        currentEntryPoints = currentEntryPoints.filter(epId => {
            const node = this.nodes.get(epId);
            return node && !node.deleted;
        });
        if (currentEntryPoints.length === 0) {
            const fallbackEntryPoint = this.nodes.get(this.entryPointId);
            if (fallbackEntryPoint && !fallbackEntryPoint.deleted) {
                currentEntryPoints = [this.entryPointId];
            } else {
                return [];
            }
        }

        // Phase 2: Adaptive search at layer 0
        let finalCandidateIdsQueue: PriorityQueue<number> | undefined;
        let efSearchCurrent = Math.max(k, efSearch !== undefined ? efSearch : 32);
        const efSearchMax = efSearch !== undefined ? Math.max(k, efSearch) : Math.max(k, this.efConstruction);

        for (let attempt = 0; attempt < 2; attempt++) {
            if (this._enableProfiling) metrics.layersTraversed++;
            const result = this._searchLayer(floatQuery, currentEntryPoints, 0, efSearchCurrent, queryMagnitude, this._enableProfiling ? metrics : undefined);
            finalCandidateIdsQueue = result.candidates;

            if (result.terminatedEarly || (efSearch !== undefined && finalCandidateIdsQueue && finalCandidateIdsQueue.size() >= k)) {
                break;
            }

            efSearchCurrent = Math.min(efSearchCurrent * 2, efSearchMax);

            if (attempt === 1 || efSearchCurrent >= efSearchMax) {
                break;
            }

            if (finalCandidateIdsQueue && !finalCandidateIdsQueue.isEmpty()) {
                const bestSoFar: number[] = [];
                const tempPQ = finalCandidateIdsQueue.clone();
                while (!tempPQ.isEmpty() && bestSoFar.length < Math.max(1, currentEntryPoints.length)) {
                    bestSoFar.push(tempPQ.pop()!); // Pop gives best due to returnQueue's comparator
                }
                currentEntryPoints = bestSoFar.length > 0 ? bestSoFar : [this.entryPointId];
                currentEntryPoints = currentEntryPoints.filter(epId => {
                    const node = this.nodes.get(epId);
                    return node && !node.deleted;
                });
                if (currentEntryPoints.length === 0) {
                    const fallbackEntryPoint = this.nodes.get(this.entryPointId);
                    if (fallbackEntryPoint && !fallbackEntryPoint.deleted) currentEntryPoints = [this.entryPointId]; else return [];
                }
            } else {
                const fallbackEntryPoint = this.nodes.get(this.entryPointId);
                if (fallbackEntryPoint && !fallbackEntryPoint.deleted) currentEntryPoints = [this.entryPointId]; else return [];
            }
        }

        // Phase 3: Extract top K results
        const allCandidatesWithScores: { id: number; score: number }[] = [];
        if (!finalCandidateIdsQueue) {
            console.warn("HNSW.searchKNN: finalCandidateIdsQueue is undefined after adaptive search. No results.");
            return [];
        }

        const seenIds = new Set<number>(); // To handle potential duplicates from PQ if any
        while (!finalCandidateIdsQueue.isEmpty()) {
            const candidateId = finalCandidateIdsQueue.pop()!;
            if (seenIds.has(candidateId)) continue;
            seenIds.add(candidateId);

            const candidateNode = this.nodes.get(candidateId);
            if (candidateNode && !candidateNode.deleted) {
                const score = this.similarityFunction(floatQuery, candidateNode.vector, queryMagnitude, candidateNode.magnitude);
                allCandidatesWithScores.push({ id: candidateId, score: score });
            }
        }

        // Sort by score in descending order (highest similarity first)
        allCandidatesWithScores.sort((a, b) => b.score - a.score);

        // Return the top K results
        const results = allCandidatesWithScores.slice(0, k);

        if (this._enableProfiling) {
            metrics.duration = performance.now() - startTime;
            this._recordMetrics(metrics);
        }

        return results;
    }

    private _recordMetrics(metrics: SearchMetrics): void {
        this._searchMetrics.push(metrics);

        // Update rolling averages
        this._stats.totalSearches++;
        this._stats.avgSearchTime =
            (this._stats.avgSearchTime * (this._stats.totalSearches - 1) + metrics.duration)
            / this._stats.totalSearches;
        this._stats.avgNodesVisited =
            (this._stats.avgNodesVisited * (this._stats.totalSearches - 1) + metrics.nodesVisited)
            / this._stats.totalSearches;
    }

    buildIndex(
        data: Array<{ id: number; vector: Float32Array | number[] }>,
        onProgress?: (progress: number, eta: number) => void
    ): void {
        this.nodes.clear();
        this.levelMax = 0;
        this.entryPointId = -1;
        this.d = null;

        const total = data.length;
        const startTime = Date.now();

        this._buildProgress = {
            total,
            current: 0,
            startTime,
            estimatedTimeRemaining: 0
        };

        for (let i = 0; i < data.length; i++) {
            this.addPoint(data[i].id, data[i].vector);

            this._buildProgress.current = i + 1;

            if (onProgress && i % 100 === 0) {
                const elapsed = Date.now() - startTime;
                const itemsPerMs = (i + 1) / elapsed;
                const remaining = total - (i + 1);
                const eta = remaining / itemsPerMs;

                this._buildProgress.estimatedTimeRemaining = eta;
                onProgress((i + 1) / total, eta);
            }
        }

        this._buildProgress = undefined;
    }

    getBuildProgress() {
        return this._buildProgress ? { ...this._buildProgress } : undefined;
    }

    // Batch insert for better performance
    addPointsBatch(points: Array<{ id: number; vector: Float32Array | number[] }>): void {
        // Pre-allocate nodes
        const newNodes = new Map<number, Node>();

        for (const { id, vector } of points) {
            if (this.nodes.has(id)) {
                throw new Error(`Node with id ${id} already exists`);
            }

            const floatVector = vector instanceof Float32Array ? vector : new Float32Array(vector);

            if (this.d === null) {
                this.d = floatVector.length;
            } else if (floatVector.length !== this.d) {
                throw new Error(`Vector dimensionality mismatch: ${floatVector.length} vs ${this.d}`);
            }

            const level = this.selectLevel();
            const magnitude = this.metric === 'cosine' ? getVectorMagnitude(floatVector) : 0;
            const node = new Node(id, floatVector, level, this.M, magnitude);
            newNodes.set(id, node);
        }

        // Add all nodes to graph
        for (const node of newNodes.values()) {
            this.nodes.set(node.id, node);

            if (this.entryPointId === -1) {
                this.entryPointId = node.id;
                this.levelMax = node.level;
            } else {
                this.levelMax = Math.max(this.levelMax, node.level);
                this.addNodeToGraph(node);
            }
        }
    }

    // Batch delete
    deletePointsBatch(ids: number[]): void {
        for (const id of ids) {
            const node = this.nodes.get(id);
            if (node) {
                node.deleted = true;
            }
        }
    }

    // Batch search
    searchKNNBatch(
        queries: Array<Float32Array | number[]>,
        k: number,
        efSearch?: number
    ): Array<Array<{ id: number; score: number }>> {
        return queries.map(query => this.searchKNN(query, k, efSearch));
    }

    // Auto-tune efSearch based on dataset size
    getOptimalEfSearch(k: number): number {
        const size = this.nodes.size;

        if (size < 1000) return Math.max(k, 32);
        if (size < 10000) return Math.max(k, 64);
        if (size < 100000) return Math.max(k, 128);
        return Math.max(k, 256);
    }

    // Dynamic M adjustment suggestion
    suggestOptimalM(): number {
        const stats = this.computeGraphStats();

        // If graph is too sparse, suggest higher M
        if (stats.avgDegree < this.M * 0.5) {
            return Math.min(this.M * 2, 64);
        }

        // If graph is too dense, suggest lower M
        if (stats.avgDegree > this.M * 1.5) {
            return Math.max(Math.floor(this.M / 2), 8);
        }

        return this.M;
    }

    // Check if reindexing would improve performance
    shouldReindex(): boolean {
        const stats = this.computeGraphStats();

        // Reindex if too many isolated nodes
        if (stats.isolatedNodes > this.nodes.size * 0.1) return true;

        // Reindex if degree variance is too high
        if (stats.maxDegree > stats.avgDegree * 3) return true;

        return false;
    }

    // Compute graph health metrics
    public computeGraphStats() {
        let totalDegree = 0;
        let maxDegree = 0;
        let minDegree = this.M * (this.levelMax + 1); // Max possible is M per level
        let isolatedNodes = 0;
        let deletedNodes = 0;
        const levelDistribution = new Map<number, number>();

        for (const node of this.nodes.values()) {
            if (node.deleted) {
                deletedNodes++;
                continue;
            }

            const degree = node.getTotalEdges();
            totalDegree += degree;
            maxDegree = Math.max(maxDegree, degree);
            minDegree = Math.min(minDegree, degree);

            if (degree === 0) isolatedNodes++;

            levelDistribution.set(
                node.level,
                (levelDistribution.get(node.level) || 0) + 1
            );
        }

        const activeNodes = this.nodes.size - deletedNodes;
        const avgDegree = activeNodes > 0 ? totalDegree / activeNodes : 0;

        // Update class stats
        this._stats.graphDensity = avgDegree;

        return {
            nodeCount: this.nodes.size,
            activeNodes,
            deletedNodes,
            avgDegree,
            maxDegree,
            minDegree: activeNodes > 0 ? minDegree : 0,
            isolatedNodes,
            levelDistribution,
            levelMax: this.levelMax
        };
    }

    // Enhanced toJSON with compact representation
    toJSON(): SerializedHNSWData {
        if (this.d === null) {
            throw new Error('Cannot serialize HNSW before dimensionality is set');
        }

        this._metadata.updated = Date.now();

        return {
            metadata: {
                ...this._metadata,
                checksum: this.computeChecksum()
            },
            config: {
                M: this.M,
                efConstruction: this.efConstruction,
                metric: this.metric,
                // Only include levelMult if it differs from default
                ...(this.levelMult !== 1 / Math.log(this.M) && {
                    levelMult: this.levelMult
                })
            },
            graph: {
                d: this.d,
                levelMax: this.levelMax,
                entryPointId: this.entryPointId,
                nodeCount: this.nodes.size
            },
            nodes: Array.from(this.nodes.values())
                .filter(node => !node.deleted) // Optionally exclude deleted nodes
                .map(node => this.nodeToCompact(node))
        };
    }

    // Convert node to compact format - sparse neighbors
    private nodeToCompact(node: Node): CompactNodeData {
        const neighborData: number[] = [];

        // Pack neighbors as: [count, ...ids] per level
        for (let level = 0; level <= node.level; level++) {
            const validNeighbors = node.neighbors[level].filter(id => id !== -1);
            neighborData.push(validNeighbors.length);
            neighborData.push(...validNeighbors);
        }

        const compact: CompactNodeData = {
            id: node.id,
            level: node.level,
            vector: Array.from(node.vector),
            magnitude: node.magnitude,
            neighborData
        };

        // Only include deleted flag if true
        if (node.deleted) {
            compact.deleted = true;
        }

        return compact;
    }

    // Reconstruct node from compact format
    private nodeFromCompact(data: CompactNodeData, M: number): Node {
        const node = new Node(
            data.id,
            new Float32Array(data.vector),
            data.level,
            M,
            data.magnitude
        );

        let dataIdx = 0;
        for (let level = 0; level <= data.level; level++) {
            const count = data.neighborData[dataIdx++];
            const neighbors = data.neighborData.slice(dataIdx, dataIdx + count);
            dataIdx += count;

            // Fill neighbor array with valid IDs and pad with -1
            for (let i = 0; i < M; i++) {
                node.neighbors[level][i] = i < neighbors.length ? neighbors[i] : -1;
            }
        }

        node.deleted = data.deleted ?? false;
        return node;
    }

    // Enhanced fromJSON with validation and migration
    static fromJSON(data: SerializedHNSWData): HNSW {
        // Validate version and migrate if needed
        if (!data.metadata?.version) {
            console.warn('Loading legacy HNSW format, attempting migration');
            data = this.migrateFromLegacy(data as any);
        }

        // Create instance
        const hnsw = new HNSW(
            data.config.M,
            data.config.efConstruction,
            data.config.metric,
            data.config.levelMult
        );

        // Restore graph properties
        hnsw.d = data.graph.d;
        hnsw.levelMax = data.graph.levelMax;
        hnsw.entryPointId = data.graph.entryPointId;
        hnsw._metadata = data.metadata;

        // Validate integrity
        if (data.nodes.length !== data.graph.nodeCount) {
            console.warn(
                `Node count mismatch: expected ${data.graph.nodeCount}, got ${data.nodes.length}`
            );
        }

        // Validate checksum if present
        if (data.metadata.checksum) {
            const expectedChecksum = hnsw.computeChecksum();
            if (data.metadata.checksum !== expectedChecksum) {
                console.warn('Checksum mismatch - data may be corrupted');
            }
        }

        // Reconstruct nodes
        hnsw.nodes = new Map(
            data.nodes.map(nodeData => {
                const node = hnsw.nodeFromCompact(nodeData, hnsw.M);
                return [node.id, node];
            })
        );

        return hnsw;
    }

    // Migrate from old format (the intermediate format with magnitude)
    private static migrateFromLegacy(oldData: any): SerializedHNSWData {
        const isVeryOld = Array.isArray(oldData.nodes) && Array.isArray(oldData.nodes[0]) && typeof oldData.nodes[0][0] === 'number';

        return {
            metadata: {
                version: '2.0.0',
                created: Date.now(),
                updated: Date.now()
            },
            config: {
                M: oldData.M,
                efConstruction: oldData.efConstruction,
                metric: oldData.metric
            },
            graph: {
                d: oldData.d ?? 0,
                levelMax: oldData.levelMax,
                entryPointId: oldData.entryPointId,
                nodeCount: isVeryOld ? oldData.nodes.length : (oldData.graph?.nodeCount ?? 0)
            },
            nodes: isVeryOld
                ? oldData.nodes.map(([_, nodeData]: [number, any]) => {
                    const neighborData: number[] = [];
                    for (const levelNeighbors of nodeData.neighbors) {
                        const valid = levelNeighbors.filter((id: number) => id !== -1);
                        neighborData.push(valid.length, ...valid);
                    }
                    return {
                        id: nodeData.id,
                        level: nodeData.level,
                        vector: nodeData.vector,
                        magnitude: nodeData.magnitude ?? 0,
                        neighborData,
                        ...(nodeData.deleted && { deleted: true })
                    };
                })
                : []
        };
    }

    // Simple checksum for data integrity
    private computeChecksum(): string {
        const criticalData = `${this.M}-${this.d}-${this.nodes.size}-${this.entryPointId}-${this.levelMax}`;
        let hash = 0;
        for (let i = 0; i < criticalData.length; i++) {
            const char = criticalData.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    // Helper: Get serialization size estimate
    getSerializationSize(): { json: number; compact: number; reduction: string } {
        const fullJSON = JSON.stringify(this.toJSON());
        // For testing purposes we'll compare against a mock "full" version if we wanted, 
        // but here we just show the size of the current compact version.
        // To truly show reduction, we'd need to compare against the non-compact version.
        return {
            json: fullJSON.length,
            compact: fullJSON.length,
            reduction: '0.0%' // Compact is now the only format
        };
    }

    public pruneDeletedNodes(): void {
        const deletedNodeIds = new Set<number>();
        // First, find all nodes marked for deletion
        for (const [id, node] of this.nodes.entries()) {
            if (node.deleted) {
                deletedNodeIds.add(id);
            }
        }

        if (deletedNodeIds.size === 0) return; // Nothing to do

        // For every non-deleted node, remove links to deleted nodes
        for (const node of this.nodes.values()) {
            if (node.deleted) continue;

            for (let level = 0; level <= node.level; level++) {
                const originalNeighbors = node.neighbors[level];
                if (!originalNeighbors) continue;

                const cleanedNeighbors = originalNeighbors.filter(id => id !== -1 && !deletedNodeIds.has(id));

                // Re-pad the array. Assuming neighbor arrays are of size this.M for all levels.
                const newNeighbors = new Array(this.M).fill(-1);
                cleanedNeighbors.forEach((id, i) => {
                    if (i < newNeighbors.length) { // Ensure we don't write out of bounds
                        newNeighbors[i] = id;
                    }
                });
                node.neighbors[level] = newNeighbors;
            }
        }

        // Finally, remove the deleted nodes from the main map
        for (const id of deletedNodeIds) {
            this.nodes.delete(id);
        }

        // Optional: Reset entry point if it was deleted
        if (this.entryPointId !== -1 && deletedNodeIds.has(this.entryPointId)) {
            // After deletion, this.nodes contains only non-deleted nodes.
            // Pick the first available node as the new entry point.
            const firstRemainingNodeId = this.nodes.keys().next().value;
            this.entryPointId = firstRemainingNodeId !== undefined ? firstRemainingNodeId : -1;
        }
    }
}
