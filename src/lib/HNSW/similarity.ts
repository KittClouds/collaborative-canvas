import { Node } from './node';

// Efficient dot product with loop unrolling
function dotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    let i = 0;
    const len = a.length;

    // Process 4 elements at a time for performance improvement
    for (; i < len - 3; i += 4) {
        sum += a[i] * b[i] + a[i + 1] * b[i + 1] +
            a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3];
    }

    // Handle remaining elements
    for (; i < len; i++) {
        sum += a[i] * b[i];
    }

    return sum;
}

export function cosineSimilarity(
    a: Float32Array,
    b: Float32Array,
    magnitudeA?: number,
    magnitudeB?: number
): number {
    if (a.length !== b.length) throw new Error('Vector dimensions must match');

    const dot = dotProduct(a, b);
    const magA = magnitudeA ?? Math.sqrt(dotProduct(a, a));
    const magB = magnitudeB ?? Math.sqrt(dotProduct(b, b));

    // Handle zero vectors
    if (magA === 0 || magB === 0) return 0;

    // Numerical stability: clamp to [-1, 1]
    return Math.max(-1, Math.min(1, dot / (magA * magB)));
}

export function cosineSimilarityOptimized(
    a: Node,
    b: Node
): number {
    let dot = 0;
    const vA = a.vector;
    const vB = b.vector;
    const len = vA.length;
    let i = 0;

    // Process 4 elements at a time
    for (; i < len - 3; i += 4) {
        dot += vA[i] * vB[i] + vA[i + 1] * vB[i + 1] +
            vA[i + 2] * vB[i + 2] + vA[i + 3] * vB[i + 3];
    }
    for (; i < len; i++) {
        dot += vA[i] * vB[i];
    }

    const magA = a.getMagnitude();
    const magB = b.getMagnitude();

    if (magA === 0 || magB === 0) return 0;
    return Math.max(-1, Math.min(1, dot / (magA * magB)));
}

// Squared distance avoids expensive sqrt when ranking
export function euclideanDistanceSquared(
    a: Float32Array,
    b: Float32Array
): number {
    if (a.length !== b.length) throw new Error('Vector dimensions must match');
    let sum = 0;
    let i = 0;
    const len = a.length;

    // Loop unrolling for distance calculation
    for (; i < len - 3; i += 4) {
        const d0 = a[i] - b[i];
        const d1 = a[i + 1] - b[i + 1];
        const d2 = a[i + 2] - b[i + 2];
        const d3 = a[i + 3] - b[i + 3];
        sum += d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
    }

    for (; i < len; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}

export function euclideanSimilarity(a: Float32Array, b: Float32Array): number {
    // Use squared distance for efficiency, ranking remains the same
    return 1 / (1 + euclideanDistanceSquared(a, b));
}

export function getVectorMagnitude(a: Float32Array): number {
    return Math.sqrt(dotProduct(a, a));
}
