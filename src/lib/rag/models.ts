/**
 * Model Registry - Single source of truth for embedding model configurations
 * 
 * Adding a new model:
 * 1. Add entry to MODEL_REGISTRY
 * 2. Add dimension mapping to DIMENSION_TO_MODELS
 * That's it - no other code changes needed.
 */

// ============================================================================
// Types
// ============================================================================

export interface ModelConfig {
    id: string;
    label: string;
    dims: number;
    onnxUrl: string;
    tokenizerUrl: string;
    supportsMatryoshka: boolean;
    truncationOptions: number[];
}

export type ModelId = keyof typeof MODEL_REGISTRY;
export type TruncateDim = 'full' | number;

// ============================================================================
// Model Registry
// ============================================================================

export const MODEL_REGISTRY = {
    'bge-small': {
        id: 'bge-small',
        label: 'BGE-small',
        dims: 384,
        onnxUrl: 'https://huggingface.co/nicholascao/gte-small-onnx/resolve/main/onnx/model_quantized.onnx',
        tokenizerUrl: 'https://huggingface.co/nicholascao/gte-small-onnx/resolve/main/tokenizer.json',
        supportsMatryoshka: false,
        truncationOptions: [],
    },
    'modernbert-base': {
        id: 'modernbert-base',
        label: 'ModernBERT',
        dims: 768,
        onnxUrl: 'https://huggingface.co/nicholascao/modernbert-embed-base-onnx/resolve/main/onnx/model_quantized.onnx',
        tokenizerUrl: 'https://huggingface.co/nicholascao/modernbert-embed-base-onnx/resolve/main/tokenizer.json',
        supportsMatryoshka: true,
        truncationOptions: [512, 256, 128, 64],
    },
} as const satisfies Record<string, ModelConfig>;

// ============================================================================
// Dimension Lookups
// ============================================================================

/**
 * Reverse lookup: dimension → possible model IDs
 * When multiple models share a dimension, first entry is preferred default.
 */
export const DIMENSION_TO_MODELS: Record<number, ModelId[]> = {
    384: ['bge-small'],
    768: ['modernbert-base'],
};

/**
 * Infer most likely model from embedding dimension.
 * Returns null if dimension doesn't match any known model.
 */
export function inferModelFromDimension(dim: number): ModelId | null {
    const candidates = DIMENSION_TO_MODELS[dim];
    return candidates?.[0] ?? null;
}

/**
 * Get all known dimensions for validation.
 */
export function getKnownDimensions(): number[] {
    return Object.keys(DIMENSION_TO_MODELS).map(Number);
}

/**
 * Check if a dimension is from a known model.
 */
export function isKnownDimension(dim: number): boolean {
    return dim in DIMENSION_TO_MODELS;
}

// ============================================================================
// Model Helpers
// ============================================================================

/**
 * Get model config by ID.
 */
export function getModel(id: ModelId): ModelConfig {
    return MODEL_REGISTRY[id];
}

/**
 * Get all available model IDs.
 */
export function getModelIds(): ModelId[] {
    return Object.keys(MODEL_REGISTRY) as ModelId[];
}

/**
 * Get truncation options for a model.
 * Returns ['full'] if model doesn't support Matryoshka.
 */
export function getTruncationOptions(modelId: ModelId): TruncateDim[] {
    const model = MODEL_REGISTRY[modelId];
    const hasOptions = model.truncationOptions && model.truncationOptions.length > 0;
    if (!model.supportsMatryoshka || !hasOptions) {
        return ['full'];
    }
    return ['full', ...model.truncationOptions];
}
