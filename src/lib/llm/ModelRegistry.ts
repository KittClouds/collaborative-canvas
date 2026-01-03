import type { ModelDefinition, ModelId, LLMProvider } from './types';

/**
 * Registry of all available LLM models
 * Centralizes model definitions for the entire app
 */
export class ModelRegistry {
    private static models: Map<ModelId, ModelDefinition> = new Map([
        // ===== GEMINI MODELS (Direct API) =====
        [
            'gemini-2.5-flash',
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                provider: 'gemini',
                contextWindow: 1000000,
                costPer1kTokens: 0.000075,
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Latest Gemini 2.5 Flash. Fast and capable.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'gemini-2.5-pro',
            {
                id: 'gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
                provider: 'gemini',
                contextWindow: 2000000,
                costPer1kTokens: 0.00125,
                speedTier: 'medium',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Most capable Gemini. 2M context window.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'gemini-2.0-flash',
            {
                id: 'gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                provider: 'gemini',
                contextWindow: 1000000,
                costPer1kTokens: 0.000075,
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Fast multimodal Gemini 2.0 model.',
                maxOutputTokens: 8192,
            },
        ],

        // ===== OPENROUTER MODELS (FREE tier only) =====
        [
            'nvidia/nemotron-3-nano-30b-a3b:free',
            {
                id: 'nvidia/nemotron-3-nano-30b-a3b:free',
                name: 'Nemotron 3 Nano 30B (FREE)',
                provider: 'openrouter',
                contextWindow: 1000000,
                costPer1kTokens: 0,
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'NVIDIA reasoning model. Great for extraction. FREE.',
                maxOutputTokens: 4096,
            },
        ],
        [
            'arcee-ai/trinity-mini:free',
            {
                id: 'arcee-ai/trinity-mini:free',
                name: 'Trinity Mini (FREE)',
                provider: 'openrouter',
                contextWindow: 131000,
                costPer1kTokens: 0,
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Arcee AI 26B MoE model. Function calling + agents. FREE.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'nex-agi/deepseek-v3.1-nex-n1:free',
            {
                id: 'nex-agi/deepseek-v3.1-nex-n1:free',
                name: 'DeepSeek V3.1 Nex N1 (FREE)',
                provider: 'openrouter',
                contextWindow: 128000,
                costPer1kTokens: 0,
                speedTier: 'medium',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'DeepSeek V3.1 tuned for agents + tool use. FREE.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'google/gemini-3-flash-preview',
            {
                id: 'google/gemini-3-flash-preview',
                name: 'Gemini 3 Flash Preview',
                provider: 'openrouter',
                contextWindow: 1000000,
                costPer1kTokens: 0.00015,
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Gemini 3 Flash via OpenRouter. Agentic workflows.',
                maxOutputTokens: 8192,
            },
        ],
    ]);

    /**
     * Get model definition by ID
     */
    static getModel(id: ModelId): ModelDefinition | undefined {
        return this.models.get(id);
    }

    /**
     * Get all models for a specific provider
     */
    static getModelsByProvider(provider: LLMProvider): ModelDefinition[] {
        return Array.from(this.models.values()).filter(m => m.provider === provider);
    }

    /**
     * Get all available models
     */
    static getAllModels(): ModelDefinition[] {
        return Array.from(this.models.values());
    }

    /**
     * Get free models only
     */
    static getFreeModels(): ModelDefinition[] {
        return Array.from(this.models.values()).filter(m => m.costPer1kTokens === 0);
    }

    /**
     * Get models by capability
     */
    static getModelsByCapability(capability: keyof ModelDefinition['capabilities']): ModelDefinition[] {
        return Array.from(this.models.values()).filter(m => m.capabilities[capability]);
    }

    /**
     * Get recommended model for task
     */
    static getRecommendedModel(task: 'chat' | 'extraction' | 'reasoning'): ModelId {
        switch (task) {
            case 'chat':
                return 'gemini-2.5-flash'; // Fast, capable
            case 'extraction':
                return 'nvidia/nemotron-3-nano-30b-a3b:free'; // Fast extraction
            case 'reasoning':
                return 'gemini-2.5-pro'; // Best reasoning
            default:
                return 'gemini-2.5-flash';
        }
    }
}
