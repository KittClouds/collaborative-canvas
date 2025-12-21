import { GoogleGenerativeAI } from '@google/generative-ai';
import type { IEmbeddingProvider } from './types';
import { EmbeddingModelRegistry } from '../models/ModelRegistry';
import type { EmbeddingModelDefinition } from '../models/ModelRegistry';
import { SettingsManager } from '@/lib/settings/SettingsManager';

export class GeminiEmbeddingProvider implements IEmbeddingProvider {
    readonly name = 'Gemini Embeddings';
    readonly provider = 'gemini';

    private modelId: string;
    private client: GoogleGenerativeAI | null = null;
    private modelDef: EmbeddingModelDefinition;
    private initialized = false;

    constructor(modelId: string) {
        this.modelId = modelId;
        const model = EmbeddingModelRegistry.getModel(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        if (model.provider !== 'gemini') {
            throw new Error(`Not a Gemini model: ${modelId}`);
        }
        this.modelDef = model;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        const apiKey = SettingsManager.getApiKey('gemini');
        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        this.client = new GoogleGenerativeAI(apiKey);
        this.initialized = true;
    }

    isReady(): boolean {
        return this.initialized && this.client !== null;
    }

    async embed(texts: string | string[]): Promise<number[][]> {
        if (!this.isReady()) {
            throw new Error('Provider not initialized');
        }

        const inputTexts = Array.isArray(texts) ? texts : [texts];
        const model = this.client!.getGenerativeModel({
            model: 'text-embedding-004'
        });

        const results: number[][] = [];

        // Batch embed (Gemini supports batch)
        for (const text of inputTexts) {
            const result = await model.embedContent(text);
            results.push(result.embedding.values);
        }

        return results;
    }

    getModelInfo(): EmbeddingModelDefinition {
        return this.modelDef;
    }

    async dispose(): Promise<void> {
        this.client = null;
        this.initialized = false;
    }
}
