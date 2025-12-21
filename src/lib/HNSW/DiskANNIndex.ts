import { HNSW } from './main';
import { DiskANNSerializer, SerializedDiskANNIndex } from './DiskANNSerialization';

/**
 * Configuration for DiskANN-inspired index
 */
export interface DiskANNConfig {
    // Clustering
    numClusters: number;          // Number of partitions (default: 256)
    maxClusterSize: number;       // Trigger split at this size (default: 1000)

    // Search
    searchProbeCount: number;     // Clusters to search (default: 5)
    adaptiveProbing: boolean;     // Dynamic probe count (default: true)
    probeThreshold: number;       // Similarity threshold for adaptive probing (default: 0.85)

    // HNSW routing
    hnswM: number;                // HNSW connections (default: 32)
    hnswEfConstruction: number;   // HNSW build parameter (default: 400)
    hnswEfSearch: number;         // HNSW search parameter (default: 100)

    // Optimization
    enableQuantization: boolean;  // Compress vectors (default: false)
    cacheSize: number;            // LRU cache size (default: 10000)
    batchSize: number;            // Batch operations (default: 100)
}

export const DEFAULT_CONFIG: DiskANNConfig = {
    numClusters: 256,
    maxClusterSize: 1000,
    searchProbeCount: 5,
    adaptiveProbing: true,
    probeThreshold: 0.85,
    hnswM: 32,
    hnswEfConstruction: 400,
    hnswEfSearch: 100,
    enableQuantization: false,
    cacheSize: 10000,
    batchSize: 100,
};

/**
 * Centroid representing a cluster partition
 */
export interface Centroid {
    id: number;
    vector: Float32Array;
    memberCount: number;
    boundingRadius: number; // For pruning
}

/**
 * Vector record in the index
 */
export interface VectorRecord {
    id: string;
    vector: Float32Array;
    clusterId: number;
    metadata?: Record<string, any>;
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
    id: string;
    score: number;
    metadata?: Record<string, any>;
}

/**
 * Quantization utilities for memory compression
 */
class VectorQuantizer {
    private min: number = 0;
    private max: number = 1;

    calibrate(vectors: Float32Array[]): void {
        let globalMin = Infinity;
        let globalMax = -Infinity;

        for (const vec of vectors) {
            for (let i = 0; i < vec.length; i++) {
                globalMin = Math.min(globalMin, vec[i]);
                globalMax = Math.max(globalMax, vec[i]);
            }
        }

        this.min = globalMin;
        this.max = globalMax;
    }

    compress(vector: Float32Array): Uint8Array {
        const scale = 255 / (this.max - this.min);
        const quantized = new Uint8Array(vector.length);

        for (let i = 0; i < vector.length; i++) {
            quantized[i] = Math.round((vector[i] - this.min) * scale);
        }

        return quantized;
    }

    decompress(quantized: Uint8Array): Float32Array {
        const scale = (this.max - this.min) / 255;
        const vector = new Float32Array(quantized.length);

        for (let i = 0; i < quantized.length; i++) {
            vector[i] = quantized[i] * scale + this.min;
        }

        return vector;
    }

    getCompressionRatio(): number {
        return 4; // float32 → uint8
    }
}

/**
 * LRU Cache for frequently accessed vectors
 */
class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private accessOrder: K[] = [];

    constructor(private maxSize: number) { }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recent)
            this.accessOrder = this.accessOrder.filter(k => k !== key);
            this.accessOrder.push(key);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.accessOrder = this.accessOrder.filter(k => k !== key);
        } else if (this.cache.size >= this.maxSize) {
            // Evict least recently used
            const lru = this.accessOrder.shift()!;
            this.cache.delete(lru);
        }

        this.cache.set(key, value);
        this.accessOrder.push(key);
    }

    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }

    size(): number {
        return this.cache.size;
    }
}

/**
 * Statistics for monitoring and optimization
 */
export interface IndexStats {
    totalVectors: number;
    totalClusters: number;
    avgClusterSize: number;
    maxClusterSize: number;
    minClusterSize: number;
    cacheHitRate: number;
    avgSearchTime: number;
    memoryUsage: {
        centroids: number;
        vectors: number;
        cache: number;
        total: number;
    };
}

/**
 * DiskANN-Inspired Vector Index
 * 
 * Implements a two-tier hybrid search:
 * 1. Fast routing via HNSW index over cluster centroids
 * 2. Precise search within selected partitions
 * 
 * Features:
 * - Dynamic cluster rebalancing
 * - Adaptive multi-probe search
 * - Optional vector quantization
 * - LRU caching for hot vectors
 * - Incremental updates without full rebuild
 */
export class DiskANNIndex {
    private config: DiskANNConfig;

    // Core components
    private centroids: Map<number, Centroid> = new Map();
    private centroidIndex: HNSW | null = null;
    private vectors: Map<string, VectorRecord> = new Map();

    // Cluster assignments (clusterId → vectorIds)
    private clusterMembers: Map<number, Set<string>> = new Map();

    // Optimization
    private quantizer: VectorQuantizer | null = null;
    private vectorCache: LRUCache<string, Float32Array>;

    // Statistics
    private stats = {
        searchCount: 0,
        totalSearchTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
    };

    private dimension: number | null = null;
    private isBuilt: boolean = false;

    constructor(config: Partial<DiskANNConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.vectorCache = new LRUCache(this.config.cacheSize);

        if (this.config.enableQuantization) {
            this.quantizer = new VectorQuantizer();
        }
    }

    /**
     * Build index from scratch with initial vectors
     */
    async buildIndex(vectors: Array<{ id: string; vector: Float32Array; metadata?: any }>): Promise<void> {
        if (vectors.length === 0) {
            throw new Error('Cannot build index with empty vector set');
        }

        console.log(`DiskANN: Building index with ${vectors.length} vectors...`);
        const startTime = performance.now();

        // Set dimension
        this.dimension = vectors[0].vector.length;

        // Validate dimensions
        for (const vec of vectors) {
            if (vec.vector.length !== this.dimension) {
                throw new Error(`Dimension mismatch: expected ${this.dimension}, got ${vec.vector.length}`);
            }
        }

        // Clear existing state
        this.clear();

        // Calibrate quantizer if enabled
        if (this.quantizer) {
            console.log('DiskANN: Calibrating quantizer...');
            this.quantizer.calibrate(vectors.map(v => v.vector));
        }

        // Initialize clusters using k-means++
        console.log(`DiskANN: Initializing ${this.config.numClusters} clusters...`);
        await this.initializeClusters(vectors);

        // Assign vectors to clusters
        console.log('DiskANN: Assigning vectors to clusters...');
        await this.assignVectorsToClusters(vectors);

        // Build HNSW index over centroids
        console.log('DiskANN: Building HNSW routing index...');
        await this.buildCentroidIndex();

        this.isBuilt = true;
        const buildTime = performance.now() - startTime;

        console.log(`DiskANN: Index built in ${buildTime.toFixed(2)}ms`);
        console.log(`  - Clusters: ${this.centroids.size}`);
        console.log(`  - Vectors: ${this.vectors.size}`);
        console.log(`  - Avg cluster size: ${(this.vectors.size / this.centroids.size).toFixed(1)}`);
    }

    /**
     * Initialize cluster centroids using k-means++
     */
    private async initializeClusters(vectors: Array<{ id: string; vector: Float32Array }>): Promise<void> {
        const k = Math.min(this.config.numClusters, vectors.length);
        const centroids: Float32Array[] = [];

        // Choose first centroid randomly
        const firstIdx = Math.floor(Math.random() * vectors.length);
        centroids.push(this.normalizeVector(vectors[firstIdx].vector));

        // k-means++ initialization
        for (let i = 1; i < k; i++) {
            const distances = vectors.map(v => {
                let minDist = Infinity;
                for (const centroid of centroids) {
                    const dist = this.euclideanDistance(v.vector, centroid);
                    minDist = Math.min(minDist, dist);
                }
                return minDist * minDist; // Squared distance
            });

            // Choose next centroid with probability proportional to squared distance
            const totalDist = distances.reduce((a, b) => a + b, 0);
            let rand = Math.random() * totalDist;

            for (let j = 0; j < distances.length; j++) {
                rand -= distances[j];
                if (rand <= 0) {
                    centroids.push(this.normalizeVector(vectors[j].vector));
                    break;
                }
            }
        }

        // Create centroid objects
        centroids.forEach((vec, idx) => {
            this.centroids.set(idx, {
                id: idx,
                vector: vec,
                memberCount: 0,
                boundingRadius: 0,
            });
            this.clusterMembers.set(idx, new Set());
        });
    }

    /**
     * Assign vectors to nearest clusters and update centroids
     */
    private async assignVectorsToClusters(
        vectors: Array<{ id: string; vector: Float32Array; metadata?: any }>
    ): Promise<void> {
        // Clear existing assignments
        for (const members of this.clusterMembers.values()) {
            members.clear();
        }

        // Assign each vector to nearest centroid
        for (const { id, vector, metadata } of vectors) {
            const normalized = this.normalizeVector(vector);
            const clusterId = this.findNearestCentroid(normalized);

            this.vectors.set(id, {
                id,
                vector: normalized,
                clusterId,
                metadata,
            });

            this.clusterMembers.get(clusterId)!.add(id);
        }

        // Recompute centroids and bounding radii
        for (const [clusterId, members] of this.clusterMembers) {
            if (members.size === 0) continue;

            const centroid = this.centroids.get(clusterId)!;
            centroid.memberCount = members.size;

            // Compute centroid as mean of members
            const newCentroid = new Float32Array(this.dimension!);
            for (const memberId of members) {
                const vec = this.vectors.get(memberId)!.vector;
                for (let i = 0; i < vec.length; i++) {
                    newCentroid[i] += vec[i];
                }
            }
            for (let i = 0; i < newCentroid.length; i++) {
                newCentroid[i] /= members.size;
            }
            centroid.vector = this.normalizeVector(newCentroid);

            // Compute bounding radius
            let maxDist = 0;
            for (const memberId of members) {
                const vec = this.vectors.get(memberId)!.vector;
                const dist = this.euclideanDistance(vec, centroid.vector);
                maxDist = Math.max(maxDist, dist);
            }
            centroid.boundingRadius = maxDist;
        }
    }

    /**
     * Build HNSW index over cluster centroids
     */
    private async buildCentroidIndex(): Promise<void> {
        this.centroidIndex = new HNSW(
            this.config.hnswM,
            this.config.hnswEfConstruction,
            'cosine'
        );

        const centroidData = Array.from(this.centroids.values()).map(c => ({
            id: c.id,
            vector: c.vector,
        }));

        this.centroidIndex.buildIndex(centroidData);
    }

    /**
     * Add or update a single vector (incremental)
     */
    async upsert(id: string, vector: Float32Array, metadata?: any): Promise<void> {
        if (!this.isBuilt) {
            throw new Error('Index not built. Call buildIndex() first.');
        }

        if (vector.length !== this.dimension) {
            throw new Error(`Dimension mismatch: expected ${this.dimension}, got ${vector.length}`);
        }

        const normalized = this.normalizeVector(vector);

        // Remove from old cluster if exists
        const existing = this.vectors.get(id);
        if (existing) {
            this.clusterMembers.get(existing.clusterId)?.delete(id);
        }

        // Find nearest cluster
        const clusterId = this.findNearestCentroid(normalized);

        // Add to new cluster
        this.vectors.set(id, { id, vector: normalized, clusterId, metadata });
        this.clusterMembers.get(clusterId)!.add(id);

        // Update centroid incrementally (online mean)
        const centroid = this.centroids.get(clusterId)!;
        const members = this.clusterMembers.get(clusterId)!;

        // Recompute centroid
        const newCentroid = new Float32Array(this.dimension!);
        for (const memberId of members) {
            const vec = this.vectors.get(memberId)!.vector;
            for (let i = 0; i < vec.length; i++) {
                newCentroid[i] += vec[i];
            }
        }
        for (let i = 0; i < newCentroid.length; i++) {
            newCentroid[i] /= members.size;
        }
        centroid.vector = this.normalizeVector(newCentroid);
        centroid.memberCount = members.size;

        // Update HNSW node
        const hnswNode = this.centroidIndex!.nodes.get(clusterId);
        if (hnswNode) {
            hnswNode.vector = centroid.vector;
            hnswNode.invalidateCache();
        }

        // Check if cluster needs splitting
        if (members.size > this.config.maxClusterSize) {
            await this.splitCluster(clusterId);
        }

        // Invalidate cache
        this.vectorCache.set(id, normalized);
    }

    /**
     * Remove a vector from the index
     */
    remove(id: string): boolean {
        const record = this.vectors.get(id);
        if (!record) return false;

        this.vectors.delete(id);
        this.clusterMembers.get(record.clusterId)?.delete(id);
        this.vectorCache.get(id); // Just to update access order

        return true;
    }

    /**
     * Search for k nearest neighbors
     */
    async search(query: Float32Array, k: number = 10): Promise<SearchResult[]> {
        if (!this.isBuilt || !this.centroidIndex) {
            throw new Error('Index not built');
        }

        const startTime = performance.now();
        const normalized = this.normalizeVector(query);

        // Phase 1: Find candidate clusters via HNSW
        let probeCount = this.config.searchProbeCount;

        if (this.config.adaptiveProbing) {
            probeCount = await this.computeAdaptiveProbeCount(normalized, k);
        }

        const candidateClusters = this.centroidIndex.searchKNN(
            normalized,
            probeCount,
            this.config.hnswEfSearch
        );

        // Phase 2: Search within selected clusters
        const candidates: Array<{ id: string; score: number }> = [];

        for (const cluster of candidateClusters) {
            const members = this.clusterMembers.get(cluster.id);
            if (!members) continue;

            for (const memberId of members) {
                let vector = this.vectorCache.get(memberId);

                if (!vector) {
                    vector = this.vectors.get(memberId)!.vector;
                    this.vectorCache.set(memberId, vector);
                    this.stats.cacheMisses++;
                } else {
                    this.stats.cacheHits++;
                }

                const score = this.cosineSimilarity(normalized, vector);
                candidates.push({ id: memberId, score });
            }
        }

        // Sort and return top k
        candidates.sort((a, b) => b.score - a.score);
        const results = candidates.slice(0, k).map(c => ({
            id: c.id,
            score: c.score,
            metadata: this.vectors.get(c.id)?.metadata,
        }));

        // Update stats
        const searchTime = performance.now() - startTime;
        this.stats.searchCount++;
        this.stats.totalSearchTime += searchTime;

        return results;
    }

    /**
     * Adaptive probe count based on cluster similarity
     */
    private async computeAdaptiveProbeCount(query: Float32Array, k: number): Promise<number> {
        const initialProbes = Math.min(this.config.searchProbeCount * 2, this.centroids.size);
        const clusterScores = this.centroidIndex!.searchKNN(query, initialProbes);

        if (clusterScores.length === 0) return 1;

        const topScore = clusterScores[0].score;
        let probeCount = 1;

        for (let i = 1; i < clusterScores.length; i++) {
            if (clusterScores[i].score >= topScore * this.config.probeThreshold) {
                probeCount++;
            } else {
                break;
            }
        }

        return Math.max(probeCount, Math.min(3, clusterScores.length));
    }

    /**
     * Split large cluster into two using k-means
     */
    private async splitCluster(clusterId: number): Promise<void> {
        const members = Array.from(this.clusterMembers.get(clusterId)!);
        if (members.length <= this.config.maxClusterSize) return;

        console.log(`DiskANN: Splitting cluster ${clusterId} with ${members.length} members`);

        // Get next available cluster IDs
        const newId1 = Math.max(...Array.from(this.centroids.keys())) + 1;
        const newId2 = newId1 + 1;

        // Pick two random members as initial centroids
        const idx1 = Math.floor(Math.random() * members.length);
        let idx2 = Math.floor(Math.random() * members.length);
        while (idx2 === idx1) idx2 = Math.floor(Math.random() * members.length);

        const c1 = this.vectors.get(members[idx1])!.vector;
        const c2 = this.vectors.get(members[idx2])!.vector;

        // Create new clusters
        this.centroids.set(newId1, {
            id: newId1,
            vector: c1,
            memberCount: 0,
            boundingRadius: 0,
        });
        this.centroids.set(newId2, {
            id: newId2,
            vector: c2,
            memberCount: 0,
            boundingRadius: 0,
        });
        this.clusterMembers.set(newId1, new Set());
        this.clusterMembers.set(newId2, new Set());

        // Reassign members
        for (const memberId of members) {
            const vec = this.vectors.get(memberId)!.vector;
            const dist1 = this.euclideanDistance(vec, c1);
            const dist2 = this.euclideanDistance(vec, c2);

            const newClusterId = dist1 < dist2 ? newId1 : newId2;
            this.vectors.get(memberId)!.clusterId = newClusterId;
            this.clusterMembers.get(newClusterId)!.add(memberId);
        }

        // Remove old cluster
        this.centroids.delete(clusterId);
        this.clusterMembers.delete(clusterId);

        // Add new centroids to HNSW
        this.centroidIndex!.addPoint(newId1, c1);
        this.centroidIndex!.addPoint(newId2, c2);

        // Remove old centroid from HNSW
        this.centroidIndex!.deletePoint(clusterId);
    }

    /**
     * Find nearest centroid for a vector
     */
    private findNearestCentroid(vector: Float32Array): number {
        let bestId = -1;
        let bestScore = -Infinity;

        for (const [id, centroid] of this.centroids) {
            const score = this.cosineSimilarity(vector, centroid.vector);
            if (score > bestScore) {
                bestScore = score;
                bestId = id;
            }
        }

        return bestId;
    }

    /**
     * Get index statistics
     */
    getStats(): IndexStats {
        const clusterSizes = Array.from(this.clusterMembers.values()).map(m => m.size);

        const vectorMem = this.vectors.size * (this.dimension || 0) * 4; // float32
        const centroidMem = this.centroids.size * (this.dimension || 0) * 4;
        const cacheMem = this.vectorCache.size() * (this.dimension || 0) * 4;

        return {
            totalVectors: this.vectors.size,
            totalClusters: this.centroids.size,
            avgClusterSize: clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length || 0,
            maxClusterSize: Math.max(...clusterSizes, 0),
            minClusterSize: Math.min(...clusterSizes, Infinity) === Infinity ? 0 : Math.min(...clusterSizes),
            cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
            avgSearchTime: this.stats.totalSearchTime / this.stats.searchCount || 0,
            memoryUsage: {
                centroids: centroidMem,
                vectors: vectorMem,
                cache: cacheMem,
                total: centroidMem + vectorMem + cacheMem,
            },
        };
    }

    /**
     * Clear the index
     */
    clear(): void {
        this.centroids.clear();
        this.clusterMembers.clear();
        this.vectors.clear();
        this.vectorCache.clear();
        this.centroidIndex = null;
        this.isBuilt = false;
    }

    // Utility methods

    private normalizeVector(v: Float32Array): Float32Array {
        let norm = 0;
        for (const x of v) norm += x * x;
        norm = Math.sqrt(norm || 1e-9);
        return v.map(x => x / norm) as Float32Array;
    }

    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return dot; // Already normalized
    }

    private euclideanDistance(a: Float32Array, b: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    isReady(): boolean {
        return this.isBuilt;
    }

    getDimension(): number | null {
        return this.dimension;
    }

    /**
     * Serialize index to JSON
     */
    toJSON(): SerializedDiskANNIndex {
        return DiskANNSerializer.toJSON(this);
    }

    /**
     * Serialize to JSON string
     */
    stringify(pretty: boolean = false): string {
        return DiskANNSerializer.stringify(this, pretty);
    }

    /**
     * Serialize to binary format
     */
    toBinary(): Uint8Array {
        return DiskANNSerializer.toBinary(this);
    }

    /**
     * Get serialization size estimate
     */
    getSerializationSize() {
        return DiskANNSerializer.estimateSize(this);
    }

    /**
     * Export structure only (no vectors)
     */
    exportStructure() {
        return DiskANNSerializer.exportStructure(this);
    }

    /**
     * Static deserializers
     */
    static fromJSON(data: SerializedDiskANNIndex): DiskANNIndex {
        return DiskANNSerializer.fromJSON(data);
    }

    static parse(json: string): DiskANNIndex {
        return DiskANNSerializer.parse(json);
    }

    static fromBinary(binary: Uint8Array): DiskANNIndex {
        return DiskANNSerializer.fromBinary(binary);
    }

    static validate(data: SerializedDiskANNIndex) {
        return DiskANNSerializer.validate(data);
    }
}
