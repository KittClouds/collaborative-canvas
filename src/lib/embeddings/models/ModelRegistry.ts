export type EmbeddingProvider = 'local' | 'gemini' | 'huggingface';

export interface EmbeddingModelDefinition {
    id: string;
    name: string;
    provider: EmbeddingProvider;
    dimensions: number;
    maxTokens: number;

    // Performance characteristics
    speed: 'fast' | 'medium' | 'slow';
    quality: 'high' | 'medium' | 'low';

    // Cost
    costPer1kTokens: number; // 0 for local models

    // Local model info (if provider === 'local')
    localModel?: {
        modelId: string; // HuggingFace model ID
        quantization?: 'q8' | 'q4' | 'fp16';
        memoryMB: number; // Estimated memory usage
    };

    description: string;
}

export class EmbeddingModelRegistry {
    private static models: Map<string, EmbeddingModelDefinition> = new Map([
        // ===== LOCAL MODELS (In-Browser) =====
        [
            'modernbert-base',
            {
                id: 'modernbert-base',
                name: 'ModernBERT Base',
                provider: 'local',
                dimensions: 768,
                maxTokens: 8192,
                speed: 'fast',
                quality: 'high',
                costPer1kTokens: 0,
                localModel: {
                    modelId: 'answerdotai/ModernBERT-base',
                    quantization: 'q8',
                    memoryMB: 150,
                },
                description: 'State-of-the-art local model. Best quality for in-browser.',
            },
        ],
        [
            'mongodb-leaf',
            {
                id: 'mongodb-leaf',
                name: 'MongoDB Leaf (256d)',
                provider: 'local',
                dimensions: 256,
                maxTokens: 512,
                speed: 'fast',
                quality: 'medium',
                costPer1kTokens: 0,
                localModel: {
                    modelId: 'MongoDB/MongoLite-IR-v1',
                    quantization: 'q8',
                    memoryMB: 50,
                },
                description: 'Lightweight, fast. Great for search/retrieval.',
            },
        ],

        // ===== CLOUD MODELS (API) =====
        [
            'gemini-embedding-004',
            {
                id: 'gemini-embedding-004',
                name: 'Gemini Text Embedding 004',
                provider: 'gemini',
                dimensions: 768,
                maxTokens: 2048,
                speed: 'fast',
                quality: 'high',
                costPer1kTokens: 0.00001, // Very cheap
                description: 'Google Gemini embeddings. High quality, cloud-based.',
            },
        ],
        [
            'text-embedding-3-small',
            {
                id: 'text-embedding-3-small',
                name: 'OpenAI Text Embedding 3 Small',
                provider: 'huggingface', // Via OpenRouter/Mastra
                dimensions: 1536,
                maxTokens: 8191,
                speed: 'fast',
                quality: 'high',
                costPer1kTokens: 0.00002,
                description: 'OpenAI embeddings via OpenRouter.',
            },
        ],
    ]);

    static getModel(id: string): EmbeddingModelDefinition | undefined {
        return this.models.get(id);
    }

    static getLocalModels(): EmbeddingModelDefinition[] {
        return Array.from(this.models.values()).filter(m => m.provider === 'local');
    }

    static getCloudModels(): EmbeddingModelDefinition[] {
        return Array.from(this.models.values()).filter(m => m.provider !== 'local');
    }

    static getByDimension(dim: number): EmbeddingModelDefinition[] {
        return Array.from(this.models.values()).filter(m => m.dimensions === dim);
    }

    static getRecommended(preference: 'speed' | 'quality' | 'privacy'): string {
        switch (preference) {
            case 'speed':
                return 'mongodb-leaf'; // Fastest local
            case 'quality':
                return 'modernbert-base'; // Best quality local
            case 'privacy':
                return 'modernbert-base'; // All local, privacy-first
            default:
                return 'modernbert-base';
        }
    }
}
