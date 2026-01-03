/**
 * Embedding Utilities - Single source of truth for embedding handling
 * 
 * This module provides canonical conversion and validation for embeddings
 * across all storage formats (ArrayBuffer, Uint8Array, Float32Array, number[]).
 */

// ============================================================================
// Types
// ============================================================================

export type RawEmbedding = ArrayBuffer | Uint8Array | Float32Array | number[];

export interface EmbeddingMeta {
    dimension: number;
    format: 'arraybuffer' | 'uint8array' | 'float32array' | 'array' | 'unknown';
}

// ============================================================================
// Normalization - Convert ANY format to canonical number[]
// ============================================================================

/**
 * Normalize any embedding format to a canonical number[].
 * This is the ONLY function that should be used for format conversion.
 */
export function normalizeEmbedding(input: unknown): number[] {
    if (!input) return [];

    // Already a number array
    if (Array.isArray(input)) {
        return input as number[];
    }

    // Raw ArrayBuffer
    if (input instanceof ArrayBuffer) {
        return Array.from(new Float32Array(input));
    }

    // Uint8Array (raw bytes from SQLite)
    if (input instanceof Uint8Array) {
        const floats = new Float32Array(input.buffer, input.byteOffset, input.byteLength / 4);
        return Array.from(floats);
    }

    // Float32Array
    if (input instanceof Float32Array) {
        return Array.from(input);
    }

    // Generic ArrayBufferView fallback
    if (ArrayBuffer.isView(input)) {
        const view = input as ArrayBufferView;
        const floats = new Float32Array(view.buffer, view.byteOffset, view.byteLength / 4);
        return Array.from(floats);
    }

    console.warn('[EmbeddingUtils] Unknown embedding format:', typeof input);
    return [];
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Get metadata about an embedding without fully converting it.
 * Useful for dimension detection without copying data.
 */
export function getEmbeddingMeta(input: unknown): EmbeddingMeta {
    if (!input) {
        return { dimension: 0, format: 'unknown' };
    }

    if (Array.isArray(input)) {
        return { dimension: input.length, format: 'array' };
    }

    if (input instanceof ArrayBuffer) {
        return { dimension: input.byteLength / 4, format: 'arraybuffer' };
    }

    if (input instanceof Uint8Array) {
        return { dimension: input.byteLength / 4, format: 'uint8array' };
    }

    if (input instanceof Float32Array) {
        return { dimension: input.length, format: 'float32array' };
    }

    if (ArrayBuffer.isView(input)) {
        return { dimension: (input as ArrayBufferView).byteLength / 4, format: 'uint8array' };
    }

    return { dimension: 0, format: 'unknown' };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that an embedding has the expected dimension.
 */
export function validateDimension(emb: number[], expectedDim: number): boolean {
    return emb.length === expectedDim;
}

/**
 * Validate and report mismatch details.
 */
export function validateEmbedding(
    emb: number[],
    expectedDim: number
): { valid: boolean; actualDim: number; mismatch: number } {
    const actualDim = emb.length;
    return {
        valid: actualDim === expectedDim,
        actualDim,
        mismatch: Math.abs(actualDim - expectedDim)
    };
}

// ============================================================================
// Serialization (for SQLite storage)
// ============================================================================

/**
 * Convert normalized embedding to storage format (ArrayBuffer).
 */
export function toStorageFormat(emb: number[]): ArrayBuffer {
    return new Float32Array(emb).buffer;
}

/**
 * Convert from storage format to normalized embedding.
 * Alias for normalizeEmbedding for semantic clarity.
 */
export function fromStorageFormat(stored: unknown): number[] {
    return normalizeEmbedding(stored);
}

// ============================================================================
// Truncation (Matryoshka support)
// ============================================================================

/**
 * Truncate embedding to specified dimension (Matryoshka models).
 * Only works for dimensions smaller than the source.
 */
export function truncateEmbedding(emb: number[], targetDim: number): number[] {
    if (targetDim >= emb.length) return emb;
    return emb.slice(0, targetDim);
}
