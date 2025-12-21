import { HNSW } from './main';
import { Node } from './node';

const MAGIC = 0x48534e57; // "HNSW" in ASCII

export function encodeGraph(graph: HNSW): Uint8Array {
    // Get actual dimension from graph or estimate from first node
    let actualDimension = graph.d;
    if (!actualDimension && graph.nodes.size > 0) {
        const firstNode = graph.nodes.values().next().value;
        actualDimension = firstNode?.vector?.length || 0;
    }

    if (!actualDimension) {
        throw new Error('Cannot determine graph dimension for serialization');
    }

    // Calculate total size needed
    let totalSize = 14; // header: magic(4) + dim(2) + M(2) + totalNodes(4) + levelMax(2)

    for (const [nodeId, node] of graph.nodes) {
        totalSize += 5; // nodeId(4) + levelCount(1)
        totalSize += actualDimension * 4; // vector data (float32 = 4 bytes each)
        for (let level = 0; level <= node.level; level++) {
            totalSize += 2; // neighbourCount(2)
            const neighbors = node.neighbors[level].filter(id => id !== -1);
            totalSize += neighbors.length * 4; // neighbourId(4) each
        }
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write header
    view.setUint32(offset, MAGIC, false); // big-endian for cross-platform consistency
    offset += 4;

    view.setUint16(offset, actualDimension, false);
    offset += 2;

    view.setUint16(offset, graph.M, false);
    offset += 2;

    view.setUint32(offset, graph.nodes.size, false);
    offset += 4;

    view.setUint16(offset, graph.levelMax, false);
    offset += 2;

    // Write nodes
    for (const [nodeId, node] of graph.nodes) {
        view.setUint32(offset, nodeId, false);
        offset += 4;

        view.setUint8(offset, node.level + 1); // levelCount = level + 1
        offset += 1;

        // Write vector data
        const vector = node.vector instanceof Float32Array ? node.vector : new Float32Array(node.vector);
        for (let i = 0; i < vector.length; i++) {
            view.setFloat32(offset, vector[i], false);
            offset += 4;
        }

        for (let level = 0; level <= node.level; level++) {
            const neighbors = node.neighbors[level].filter(id => id !== -1);
            view.setUint16(offset, neighbors.length, false);
            offset += 2;

            for (const neighborId of neighbors) {
                view.setUint32(offset, neighborId, false);
                offset += 4;
            }
        }
    }

    return new Uint8Array(buffer);
}

export function decodeGraph(bytes: Uint8Array): HNSW {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    // Read header
    const magic = view.getUint32(offset, false);
    if (magic !== MAGIC) {
        throw new Error(`Invalid HNSW magic number: 0x${magic.toString(16)}`);
    }
    offset += 4;

    const d = view.getUint16(offset, false);
    offset += 2;

    const M = view.getUint16(offset, false);
    offset += 2;

    const totalNodes = view.getUint32(offset, false);
    offset += 4;

    const levelMax = view.getUint16(offset, false);
    offset += 2;

    // Validate dimension
    if (!d || d <= 0) {
        throw new Error(`Invalid dimension in serialized graph: ${d}`);
    }

    // Create HNSW instance
    const graph = new HNSW(M, 200, 'cosine');
    graph.d = d;
    graph.levelMax = levelMax;

    // Read nodes
    for (let i = 0; i < totalNodes; i++) {
        const nodeId = view.getUint32(offset, false);
        offset += 4;

        const levelCount = view.getUint8(offset);
        offset += 1;

        const nodeLevel = levelCount - 1;

        // Read vector data
        const vector = new Float32Array(d);
        for (let j = 0; j < d; j++) {
            vector[j] = view.getFloat32(offset, false);
            offset += 4;
        }

        // Create node with actual vector data
        const node = new Node(nodeId, vector, nodeLevel, M);

        // Read neighbors for each level
        for (let level = 0; level <= nodeLevel; level++) {
            const neighborCount = view.getUint16(offset, false);
            offset += 2;

            const neighbors: number[] = [];
            for (let j = 0; j < neighborCount; j++) {
                const neighborId = view.getUint32(offset, false);
                neighbors.push(neighborId);
                offset += 4;
            }

            // Pad with -1 to match expected array size
            while (neighbors.length < M) {
                neighbors.push(-1);
            }

            node.neighbors[level] = neighbors;
        }

        graph.nodes.set(nodeId, node);

        // Set entry point to first node (will be overridden if needed)
        if (graph.entryPointId === -1) {
            graph.entryPointId = nodeId;
        }
    }

    return graph;
}
