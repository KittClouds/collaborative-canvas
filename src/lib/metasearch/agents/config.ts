import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * Configure OpenRouter with NVIDIA Nemotron 3 Nano
 * FREE and optimized for reasoning, tool calling, and agentic tasks
 */
export const openrouter = createOpenRouter({
    apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
});

/**
 * Nemotron 3 Nano configuration
 * - 1M token context window
 * - Excellent reasoning capabilities
 * - Strong tool use and structured output
 * - FREE on OpenRouter
 */
export const nemotronConfig = {
    provider: openrouter,
    modelId: 'nvidia/nemotron-3-nano-30b-a3b:free',
    options: {
        temperature: 0.7,
    },
};

// For fast, non-reasoning tasks (optional fallback)
export const nemotronFastConfig = {
    provider: openrouter,
    modelId: 'nvidia/nemotron-3-nano-30b-a3b:free',
    options: {
        temperature: 0.5,
    },
};

/**
 * Get the Nemotron model instance
 */
export function getNemotronModel(fast: boolean = false) {
    const config = fast ? nemotronFastConfig : nemotronConfig;
    return config.provider(config.modelId);
}
