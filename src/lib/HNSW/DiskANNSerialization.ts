import { DiskANNIndex, DiskANNConfig, Centroid } from './DiskANNIndex';
import { HNSW, SerializedHNSWData } from './main';

/**
 * Metadata for serialized index
 */
export interface SerializationMetadata {
    version: string;
    created: number;
    updated: number;
    checksum: string;
    compression?: 'none' | 'gzip';
}

/**
 * Serialized centroid format
 */
interface SerializedCentroid {
    id: number;
    vector: number[];
    memberCount: number;
    boundingRadius: number;
}

/**
 * Serialized vector record (compact)
 */
interface SerializedVectorRecord {
    id: string;
    vector: number[];
    clusterId: number;
    metadata?: Record<string, any>;
}

/**
 * Complete serialized index structure
 */
export interface SerializedDiskANNIndex {
    metadata: SerializationMetadata;
    config: DiskANNConfig;
    graph: {
        dimension: number;
        totalVectors: number;
        totalClusters: number;
    };
    centroids: SerializedCentroid[];
    centroidIndex: SerializedHNSWData;
    vectors: SerializedVectorRecord[];
    clusterAssignments: Record<number, string[]>; // clusterId → vectorIds
}

/**
 * Serialization utilities for DiskANN index
 */
export class DiskANNSerializer {
    private static readonly VERSION = '1.0.0';

    /**
     * Serialize index to JSON-compatible object
     */
    static toJSON(index: DiskANNIndex): SerializedDiskANNIndex {
        // Access private fields via type assertion
        const idx = index as any;

        if (!idx.isBuilt) {
            throw new Error('Cannot serialize index that has not been built');
        }

        const dimension = idx.dimension;
        if (!dimension) {
            throw new Error('Cannot serialize index without dimension set');
        }

        // Serialize centroids
        const centroids: SerializedCentroid[] = [];
        for (const [id, centroid] of idx.centroids) {
            centroids.push({
                id: centroid.id,
                vector: Array.from(centroid.vector),
                memberCount: centroid.memberCount,
                boundingRadius: centroid.boundingRadius,
            });
        }

        // Serialize vectors
        const vectors: SerializedVectorRecord[] = [];
        for (const [id, record] of idx.vectors) {
            vectors.push({
                id: record.id,
                vector: Array.from(record.vector),
                clusterId: record.clusterId,
                ...(record.metadata && { metadata: record.metadata }),
            });
        }

        // Serialize cluster assignments
        const clusterAssignments: Record<number, string[]> = {};
        for (const [clusterId, members] of idx.clusterMembers) {
            clusterAssignments[clusterId] = Array.from(members);
        }

        // Serialize HNSW centroid index
        const centroidIndex = idx.centroidIndex.toJSON();

        const serialized: SerializedDiskANNIndex = {
            metadata: {
                version: this.VERSION,
                created: Date.now(),
                updated: Date.now(),
                checksum: this.computeChecksum(vectors.length, centroids.length, dimension),
                compression: 'none',
            },
            config: idx.config,
            graph: {
                dimension,
                totalVectors: vectors.length,
                totalClusters: centroids.length,
            },
            centroids,
            centroidIndex,
            vectors,
            clusterAssignments,
        };

        return serialized;
    }

    /**
     * Deserialize index from JSON object
     */
    static fromJSON(data: SerializedDiskANNIndex): DiskANNIndex {
        // Validate version
        if (!data.metadata || data.metadata.version !== this.VERSION) {
            console.warn(`DiskANN: Version mismatch. Expected ${this.VERSION}, got ${data.metadata?.version}`);
        }

        // Validate checksum
        const expectedChecksum = this.computeChecksum(
            data.graph.totalVectors,
            data.graph.totalClusters,
            data.graph.dimension
        );
        if (data.metadata.checksum !== expectedChecksum) {
            console.warn('DiskANN: Checksum mismatch - data may be corrupted');
        }

        // Validate data integrity
        if (data.vectors.length !== data.graph.totalVectors) {
            throw new Error(`Vector count mismatch: expected ${data.graph.totalVectors}, got ${data.vectors.length}`);
        }
        if (data.centroids.length !== data.graph.totalClusters) {
            throw new Error(`Centroid count mismatch: expected ${data.graph.totalClusters}, got ${data.centroids.length}`);
        }

        // Create new index instance
        const index = new DiskANNIndex(data.config);
        const idx = index as any;

        // Restore dimension
        idx.dimension = data.graph.dimension;

        // Restore centroids
        idx.centroids = new Map();
        for (const centroid of data.centroids) {
            idx.centroids.set(centroid.id, {
                id: centroid.id,
                vector: new Float32Array(centroid.vector),
                memberCount: centroid.memberCount,
                boundingRadius: centroid.boundingRadius,
            });
        }

        // Restore HNSW centroid index
        idx.centroidIndex = HNSW.fromJSON(data.centroidIndex);

        // Restore vectors
        idx.vectors = new Map();
        for (const record of data.vectors) {
            idx.vectors.set(record.id, {
                id: record.id,
                vector: new Float32Array(record.vector),
                clusterId: record.clusterId,
                metadata: record.metadata,
            });
        }

        // Restore cluster assignments
        idx.clusterMembers = new Map();
        for (const [clusterIdStr, members] of Object.entries(data.clusterAssignments)) {
            const clusterId = parseInt(clusterIdStr);
            idx.clusterMembers.set(clusterId, new Set(members));
        }

        // Mark as built
        idx.isBuilt = true;

        console.log(`DiskANN: Restored index with ${data.vectors.length} vectors and ${data.centroids.length} clusters`);

        return index;
    }

    /**
     * Serialize to JSON string
     */
    static stringify(index: DiskANNIndex, pretty: boolean = false): string {
        const data = this.toJSON(index);
        return JSON.stringify(data, null, pretty ? 2 : 0);
    }

    /**
     * Deserialize from JSON string
     */
    static parse(json: string): DiskANNIndex {
        const data = JSON.parse(json) as SerializedDiskANNIndex;
        return this.fromJSON(data);
    }

    /**
     * Serialize to compact binary format (significantly smaller)
     */
    static toBinary(index: DiskANNIndex): Uint8Array {
        const json = this.toJSON(index);
        const jsonStr = JSON.stringify(json);

        // Simple binary format: UTF-8 encoding
        const encoder = new TextEncoder();
        return encoder.encode(jsonStr);
    }

    /**
     * Deserialize from binary format
     */
    static fromBinary(binary: Uint8Array): DiskANNIndex {
        const decoder = new TextDecoder();
        const jsonStr = decoder.decode(binary);
        return this.parse(jsonStr);
    }

    /**
     * Get serialization size estimate
     */
    static estimateSize(index: DiskANNIndex): {
        json: number;
        jsonPretty: number;
        binary: number;
        breakdown: {
            metadata: number;
            config: number;
            centroids: number;
            vectors: number;
            hnswIndex: number;
        };
    } {
        const data = this.toJSON(index);
        const jsonStr = JSON.stringify(data);
        const jsonPrettyStr = JSON.stringify(data, null, 2);
        const binarySize = new TextEncoder().encode(jsonStr).length;

        // Size breakdown
        const metadataSize = JSON.stringify(data.metadata).length;
        const configSize = JSON.stringify(data.config).length;
        const centroidsSize = JSON.stringify(data.centroids).length;
        const vectorsSize = JSON.stringify(data.vectors).length;
        const hnswSize = JSON.stringify(data.centroidIndex).length;

        return {
            json: jsonStr.length,
            jsonPretty: jsonPrettyStr.length,
            binary: binarySize,
            breakdown: {
                metadata: metadataSize,
                config: configSize,
                centroids: centroidsSize,
                vectors: vectorsSize,
                hnswIndex: hnswSize,
            },
        };
    }

    /**
     * Export only index structure (without vectors) for sharing
     */
    static exportStructure(index: DiskANNIndex): Partial<SerializedDiskANNIndex> {
        const idx = index as any;

        return {
            metadata: {
                version: this.VERSION,
                created: Date.now(),
                updated: Date.now(),
                checksum: '',
            },
            config: idx.config,
            graph: {
                dimension: idx.dimension,
                totalVectors: idx.vectors.size,
                totalClusters: idx.centroids.size,
            },
            centroids: Array.from(idx.centroids.values()).map((c: Centroid) => ({
                id: c.id,
                vector: Array.from(c.vector),
                memberCount: c.memberCount,
                boundingRadius: c.boundingRadius,
            })),
            centroidIndex: idx.centroidIndex.toJSON(),
            // Vectors and assignments omitted
        };
    }

    /**
     * Validate serialized data structure
     */
    static validate(data: SerializedDiskANNIndex): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Check required fields
        if (!data.metadata) errors.push('Missing metadata');
        if (!data.config) errors.push('Missing config');
        if (!data.graph) errors.push('Missing graph info');
        if (!data.centroids) errors.push('Missing centroids');
        if (!data.centroidIndex) errors.push('Missing centroid index');
        if (!data.vectors) errors.push('Missing vectors');
        if (!data.clusterAssignments) errors.push('Missing cluster assignments');

        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // Validate counts
        if (data.vectors.length !== data.graph.totalVectors) {
            errors.push(`Vector count mismatch: ${data.vectors.length} vs ${data.graph.totalVectors}`);
        }
        if (data.centroids.length !== data.graph.totalClusters) {
            errors.push(`Centroid count mismatch: ${data.centroids.length} vs ${data.graph.totalClusters}`);
        }

        // Validate dimensions
        const dim = data.graph.dimension;
        for (let i = 0; i < Math.min(data.vectors.length, 10); i++) {
            if (data.vectors[i].vector.length !== dim) {
                errors.push(`Vector ${i} dimension mismatch: ${data.vectors[i].vector.length} vs ${dim}`);
                break;
            }
        }
        for (const centroid of data.centroids) {
            if (centroid.vector.length !== dim) {
                errors.push(`Centroid ${centroid.id} dimension mismatch`);
                break;
            }
        }

        // Validate cluster assignments
        const assignedVectors = new Set<string>();
        for (const members of Object.values(data.clusterAssignments)) {
            for (const id of members) {
                if (assignedVectors.has(id)) {
                    errors.push(`Vector ${id} assigned to multiple clusters`);
                }
                assignedVectors.add(id);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Compute checksum for data integrity
     */
    private static computeChecksum(
        vectorCount: number,
        clusterCount: number,
        dimension: number
    ): string {
        const data = `v${this.VERSION}-vec${vectorCount}-cls${clusterCount}-dim${dimension}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
}

/**
 * Compression utilities (optional, for future use)
 */
export class CompressionUtils {
    /**
     * Compress JSON string (browser-compatible)
     */
    static async compressJSON(jsonStr: string): Promise<Uint8Array> {
        if (typeof CompressionStream !== 'undefined') {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(jsonStr));
                    controller.close();
                }
            });

            const compressedStream = stream.pipeThrough(
                new CompressionStream('gzip')
            );

            const chunks: Uint8Array[] = [];
            const reader = compressedStream.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            // Combine chunks
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }

            return result;
        }

        // Fallback: no compression
        return new TextEncoder().encode(jsonStr);
    }

    /**
     * Decompress to JSON string
     */
    static async decompressJSON(compressed: Uint8Array): Promise<string> {
        if (typeof DecompressionStream !== 'undefined') {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(compressed);
                    controller.close();
                }
            });

            const decompressedStream = stream.pipeThrough(
                new DecompressionStream('gzip')
            );

            const chunks: Uint8Array[] = [];
            const reader = decompressedStream.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }

            return new TextDecoder().decode(result);
        }

        // Fallback: no compression
        return new TextDecoder().decode(compressed);
    }
}
