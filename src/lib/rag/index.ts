/**
 * RAG Module - Centralized exports for embedding pipeline
 */

// Embedding utilities
export {
    normalizeEmbedding,
    getEmbeddingMeta,
    validateDimension,
    validateEmbedding,
    toStorageFormat,
    fromStorageFormat,
    truncateEmbedding,
    type RawEmbedding,
    type EmbeddingMeta,
} from './embedding-utils';

// Model registry
export {
    MODEL_REGISTRY,
    DIMENSION_TO_MODELS,
    inferModelFromDimension,
    getKnownDimensions,
    isKnownDimension,
    getModel,
    getModelIds,
    getTruncationOptions,
    type ModelId,
    type TruncateDim,
    type ModelConfig,
} from './models';
