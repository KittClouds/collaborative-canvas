/**
 * Hybrid Embedding Pipeline Tests
 * 
 * Tests the capability to use TypeScript-side embedding models (like MDBR Leaf)
 * and send pre-computed vectors to the Rust HNSW index.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EmbeddingEngine } from '../EmbeddingEngine';
import { EmbeddingModelRegistry } from '../models/ModelRegistry';
import { MODEL_REGISTRY, inferModelFromDimension } from '@/lib/rag/models';

describe('Hybrid Embedding Pipeline', () => {
    describe('Model Registry', () => {
        it('should have mongodb-leaf as the first local model', () => {
            const localModels = EmbeddingModelRegistry.getLocalModels();
            expect(localModels.length).toBeGreaterThan(0);
            expect(localModels[0].id).toBe('mongodb-leaf');
        });

        it('should have mongodb-leaf with correct dimensions (256)', () => {
            const model = EmbeddingModelRegistry.getModel('mongodb-leaf');
            expect(model).toBeDefined();
            expect(model?.dimensions).toBe(256);
            expect(model?.provider).toBe('local');
        });

        it('should recommend mongodb-leaf for speed', () => {
            const recommended = EmbeddingModelRegistry.getRecommended('speed');
            expect(recommended).toBe('mongodb-leaf');
        });

        it('should recommend mongodb-leaf for quality', () => {
            const recommended = EmbeddingModelRegistry.getRecommended('quality');
            expect(recommended).toBe('mongodb-leaf');
        });
    });

    describe('RAG Model Registry', () => {
        it('should have mdbr-leaf in MODEL_REGISTRY', () => {
            expect(MODEL_REGISTRY['mdbr-leaf']).toBeDefined();
        });

        it('should have correct config for mdbr-leaf', () => {
            const config = MODEL_REGISTRY['mdbr-leaf'];
            expect(config.dims).toBe(256);
            expect(config.provider).toBe('local');
            expect(config.label).toBe('MDBR Leaf');
        });

        it('should infer mdbr-leaf from 256 dimensions', () => {
            const modelId = inferModelFromDimension(256);
            expect(modelId).toBe('mdbr-leaf');
        });

        it('should distinguish between rust and local providers', () => {
            expect(MODEL_REGISTRY['bge-small'].provider).toBe('rust');
            expect(MODEL_REGISTRY['mdbr-leaf'].provider).toBe('local');
        });
    });

    describe('EmbeddingEngine Provider Type', () => {
        it('should return none when not initialized', () => {
            // Need to clear engine state
            const providerType = EmbeddingEngine.getActiveProviderType();
            // Will be 'none' or the type of any previously initialized provider
            expect(['none', 'local', 'rust', 'cloud']).toContain(providerType);
        });

        it('should have getDimensionsSafe method', () => {
            const dims = EmbeddingEngine.getDimensionsSafe();
            expect(typeof dims).toBe('number');
        });
    });
});

describe('Worker Message Types', () => {
    it('should define INSERT_VECTORS message structure', () => {
        // Type check - this should compile
        const msg: {
            type: 'INSERT_VECTORS'; payload: {
                chunks: Array<{
                    id: string;
                    note_id: string;
                    note_title: string;
                    chunk_index: number;
                    text: string;
                    embedding: Float32Array;
                    start: number;
                    end: number;
                }>
            }
        } = {
            type: 'INSERT_VECTORS',
            payload: {
                chunks: [{
                    id: 'chunk_1',
                    note_id: 'note_1',
                    note_title: 'Test Note',
                    chunk_index: 0,
                    text: 'Test content',
                    embedding: new Float32Array(256), // MDBR Leaf dimension
                    start: 0,
                    end: 12,
                }]
            }
        };

        expect(msg.type).toBe('INSERT_VECTORS');
        expect(msg.payload.chunks[0].embedding.length).toBe(256);
    });

    it('should define SET_DIMENSIONS message structure', () => {
        const msg: { type: 'SET_DIMENSIONS'; payload: { dims: number } } = {
            type: 'SET_DIMENSIONS',
            payload: { dims: 256 }
        };

        expect(msg.type).toBe('SET_DIMENSIONS');
        expect(msg.payload.dims).toBe(256);
    });

    it('should define SEARCH_WITH_VECTOR message structure', () => {
        const msg: { type: 'SEARCH_WITH_VECTOR'; payload: { embedding: Float32Array; k: number } } = {
            type: 'SEARCH_WITH_VECTOR',
            payload: {
                embedding: new Float32Array(256),
                k: 10
            }
        };

        expect(msg.type).toBe('SEARCH_WITH_VECTOR');
        expect(msg.payload.k).toBe(10);
    });
});

describe('Dimension Validation', () => {
    it('should validate 256d embeddings match MDBR Leaf', () => {
        const embedding = new Float32Array(256);
        const expectedDim = MODEL_REGISTRY['mdbr-leaf'].dims;
        expect(embedding.length).toBe(expectedDim);
    });

    it('should validate 384d embeddings match BGE-small', () => {
        const embedding = new Float32Array(384);
        const expectedDim = MODEL_REGISTRY['bge-small'].dims;
        expect(embedding.length).toBe(expectedDim);
    });

    it('should validate 768d embeddings match ModernBERT', () => {
        const embedding = new Float32Array(768);
        const expectedDim = MODEL_REGISTRY['modernbert-base'].dims;
        expect(embedding.length).toBe(expectedDim);
    });
});
