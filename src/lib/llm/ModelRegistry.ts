import type { ModelDefinition, ModelId, LLMProvider } from './types';

/**
 * Registry of all available LLM models
 * Centralizes model definitions for the entire app
 */
export class ModelRegistry {
    private static models: Map<ModelId, ModelDefinition> = new Map([
        // ===== GEMINI MODELS =====
        [
            'gemini-2.0-flash-exp',
            {
                id: 'gemini-2.0-flash-exp',
                name: 'Gemini 2.0 Flash (Experimental)',
                provider: 'gemini',
                contextWindow: 32000,
                costPer1kTokens: 0, // Free tier
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Latest experimental Gemini model. Fast and free.',
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
                description: 'Fast multimodal Gemini model.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'gemini-1.5-pro',
            {
                id: 'gemini-1.5-pro',
                name: 'Gemini 1.5 Pro',
                provider: 'gemini',
                contextWindow: 2000000, // 2M tokens!
                costPer1kTokens: 0.00125, // $1.25 per 1M input tokens
                speedTier: 'medium',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Most capable Gemini model. Massive context window.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'gemini-1.5-flash',
            {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash',
                provider: 'gemini',
                contextWindow: 1000000,
                costPer1kTokens: 0.000075, // Very cheap
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Fast, affordable Gemini model for most tasks.',
                maxOutputTokens: 8192,
            },
        ],

        // ===== OPENROUTER MODELS =====
        [
            'nvidia/nemotron-3-nano-30b-a3b:free',
            {
                id: 'nvidia/nemotron-3-nano-30b-a3b:free',
                name: 'Nemotron 3 Nano 30B (FREE)',
                provider: 'openrouter',
                contextWindow: 1000000,
                costPer1kTokens: 0, // FREE!
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Nvidia free model. Great for extraction tasks.',
                maxOutputTokens: 4096,
            },
        ],
        [
            'deepseek/deepseek-r1:free',
            {
                id: 'deepseek/deepseek-r1:free',
                name: 'DeepSeek R1 (FREE)',
                provider: 'openrouter',
                contextWindow: 128000,
                costPer1kTokens: 0,
                speedTier: 'medium',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'DeepSeek reasoning model. Free tier.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'google/gemma-3-27b-it:free',
            {
                id: 'google/gemma-3-27b-it:free',
                name: 'Gemma 3 27B (FREE)',
                provider: 'openrouter',
                contextWindow: 96000,
                costPer1kTokens: 0,
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Google open model via OpenRouter. Free.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'gpt-4o',
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                provider: 'openrouter',
                contextWindow: 128000,
                costPer1kTokens: 0.0025, // Via OpenRouter
                speedTier: 'medium',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Latest OpenAI model. Multimodal and powerful.',
                maxOutputTokens: 16384,
            },
        ],
        [
            'claude-3.5-sonnet',
            {
                id: 'claude-3.5-sonnet',
                name: 'Claude 3.5 Sonnet',
                provider: 'openrouter',
                contextWindow: 200000,
                costPer1kTokens: 0.003,
                speedTier: 'medium',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Anthropic flagship. Excellent reasoning.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'claude-sonnet-4-20250514',
            {
                id: 'claude-sonnet-4-20250514',
                name: 'Claude Sonnet 4',
                provider: 'openrouter',
                contextWindow: 200000,
                costPer1kTokens: 0.003,
                speedTier: 'medium',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Latest Claude model via OpenRouter.',
                maxOutputTokens: 8192,
            },
        ],
        [
            'meta-llama/llama-3.3-70b-instruct',
            {
                id: 'meta-llama/llama-3.3-70b-instruct',
                name: 'Llama 3.3 70B',
                provider: 'openrouter',
                contextWindow: 128000,
                costPer1kTokens: 0.0008,
                speedTier: 'fast',
                capabilities: {
                    chat: true,
                    embeddings: false,
                    reasoning: true,
                },
                description: 'Meta open-source model. Fast and affordable.',
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
                return 'gemini-2.0-flash-exp'; // Fast, free, good quality
            case 'extraction':
                return 'nvidia/nemotron-3-nano-30b-a3b:free'; // Fast extraction
            case 'reasoning':
                return 'gemini-1.5-pro'; // Best reasoning
            default:
                return 'gemini-2.0-flash-exp';
        }
    }
}
