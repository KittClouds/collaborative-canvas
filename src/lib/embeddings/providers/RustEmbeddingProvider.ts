// src/lib/embeddings/providers/RustEmbeddingProvider.ts
//
// WASM-based embedding provider using kittcore's EmbedCortex
// This is the A/B testing alternative to LocalEmbeddingProvider (Transformers.js)

import type { IEmbeddingProvider } from './types';
import type { EmbeddingModelDefinition } from '../models/ModelRegistry';

// Import the kittcore WASM module
// The EmbedCortex class provides Rust-native ONNX inference
import { EmbedCortex } from '../../../../rust/kittcore/pkg/kittcore';

/**
 * Model files needed for the Rust embedder
 */
interface RustModelFiles {
    onnxUrl: string;      // URL to ONNX model file
    tokenizerUrl: string; // URL to tokenizer.json
}

/**
 * HuggingFace model file URLs
 */
const MODEL_FILES: Record<string, RustModelFiles> = {
    'bge-small-rust': {
        onnxUrl: 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/onnx/model.onnx',
        tokenizerUrl: 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/tokenizer.json',
    },
    'modernbert-rust': {
        onnxUrl: 'https://huggingface.co/nomic-ai/modernbert-embed-base/resolve/main/onnx/model.onnx',
        tokenizerUrl: 'https://huggingface.co/nomic-ai/modernbert-embed-base/resolve/main/tokenizer.json',
    },
    'minilm-rust': {
        onnxUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
        tokenizerUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json',
    },
};

/**
 * Rust-based WASM embedding provider
 * Uses kittcore's EmbedCortex with tract-onnx for inference
 */
export class RustEmbeddingProvider implements IEmbeddingProvider {
    readonly name: string;
    readonly provider = 'rust';

    private modelId: string;
    private cortex: EmbedCortex | null = null;
    private modelDef: EmbeddingModelDefinition;
    private initialized = false;
    private loadProgress = 0;

    constructor(modelId: string) {
        this.modelId = modelId;

        // Create model definition based on model ID
        this.modelDef = this.createModelDefinition(modelId);
        this.name = this.modelDef.name;
    }

    private createModelDefinition(modelId: string): EmbeddingModelDefinition {
        switch (modelId) {
            case 'bge-small-rust':
                return {
                    id: 'bge-small-rust',
                    name: 'BGE Small EN v1.5 (Rust)',
                    provider: 'local', // Provider type for registry compatibility
                    dimensions: 384,
                    maxTokens: 512,
                    speed: 'fast',
                    quality: 'high',
                    costPer1kTokens: 0,
                    description: 'BGE Small via Rust/WASM ONNX inference (A/B test)',
                };
            case 'modernbert-rust':
                return {
                    id: 'modernbert-rust',
                    name: 'ModernBERT Base (Rust)',
                    provider: 'local',
                    dimensions: 768,
                    maxTokens: 8192,
                    speed: 'medium',
                    quality: 'high',
                    costPer1kTokens: 0,
                    description: 'ModernBERT via Rust/WASM ONNX inference (A/B test)',
                };
            default:
                return {
                    id: modelId,
                    name: `${modelId} (Rust)`,
                    provider: 'local',
                    dimensions: 384,
                    maxTokens: 512,
                    speed: 'fast',
                    quality: 'medium',
                    costPer1kTokens: 0,
                    description: 'Rust/WASM ONNX embedding model',
                };
        }
    }

    /**
     * Initialize the Rust embedding provider
     * Downloads model files from HuggingFace and loads into WASM
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log(`[RustEmbeddingProvider] Loading model: ${this.name}`);
        this.loadProgress = 0;

        // Get model file URLs
        const files = MODEL_FILES[this.modelId];
        if (!files) {
            throw new Error(`No model files configured for: ${this.modelId}`);
        }

        try {
            // Create the EmbedCortex instance
            this.cortex = new EmbedCortex();
            this.loadProgress = 10;

            // Download model files in parallel
            console.log('[RustEmbeddingProvider] Downloading model files...');
            const [onnxResponse, tokenizerResponse] = await Promise.all([
                fetch(files.onnxUrl),
                fetch(files.tokenizerUrl),
            ]);

            if (!onnxResponse.ok) {
                throw new Error(`Failed to download ONNX model: ${onnxResponse.statusText}`);
            }
            if (!tokenizerResponse.ok) {
                throw new Error(`Failed to download tokenizer: ${tokenizerResponse.statusText}`);
            }

            this.loadProgress = 50;

            // Get bytes
            const onnxBytes = new Uint8Array(await onnxResponse.arrayBuffer());
            const tokenizerJson = await tokenizerResponse.text();

            this.loadProgress = 70;

            // Load into WASM
            console.log('[RustEmbeddingProvider] Loading model into WASM...');
            this.cortex.loadModel(onnxBytes, tokenizerJson);

            this.loadProgress = 100;
            this.initialized = true;
            console.log(`[RustEmbeddingProvider] ✓ Model loaded: ${this.name} (${this.cortex.getDimensions()}d)`);

        } catch (error) {
            console.error('[RustEmbeddingProvider] Failed to initialize:', error);
            this.cortex?.free();
            this.cortex = null;
            throw error;
        }
    }

    /**
     * Check if the provider is ready
     */
    isReady(): boolean {
        return this.initialized && this.cortex !== null && this.cortex.isReady();
    }

    /**
     * Generate embeddings for text(s)
     */
    async embed(texts: string | string[]): Promise<number[][]> {
        if (!this.isReady()) {
            throw new Error('RustEmbeddingProvider not initialized');
        }

        const inputTexts = Array.isArray(texts) ? texts : [texts];

        if (inputTexts.length === 0) {
            return [];
        }

        try {
            // Use the WASM embedTexts method
            const embeddings = this.cortex!.embedTexts(inputTexts) as number[][];
            return embeddings;
        } catch (error) {
            console.error('[RustEmbeddingProvider] Embed failed:', error);
            throw error;
        }
    }

    /**
     * Get model information
     */
    getModelInfo(): EmbeddingModelDefinition {
        return this.modelDef;
    }

    /**
     * Get current load progress (0-100)
     */
    getLoadProgress(): number {
        return this.loadProgress;
    }

    /**
     * Cleanup resources
     */
    async dispose(): Promise<void> {
        if (this.cortex) {
            this.cortex.free();
            this.cortex = null;
        }
        this.initialized = false;
        this.loadProgress = 0;
    }
}
