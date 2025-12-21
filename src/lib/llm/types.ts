// Shared types for LLM system

export type LLMProvider = 'gemini' | 'openrouter';

export type ModelId =
    // Gemini models
    | 'gemini-2.0-flash-exp'
    | 'gemini-2.0-flash'
    | 'gemini-1.5-pro'
    | 'gemini-1.5-flash'
    // OpenRouter models
    | 'gpt-4o'
    | 'claude-3.5-sonnet'
    | 'claude-sonnet-4-20250514'
    | 'nvidia/nemotron-3-nano-30b-a3b:free'
    | 'deepseek/deepseek-r1:free'
    | 'google/gemma-3-27b-it:free'
    | 'meta-llama/llama-3.3-70b-instruct';

export interface ModelDefinition {
    id: ModelId;
    name: string;
    provider: LLMProvider;
    contextWindow: number;
    costPer1kTokens: number; // 0 for free models
    speedTier: 'fast' | 'medium' | 'slow';
    capabilities: {
        chat: boolean;
        embeddings: boolean;
        reasoning: boolean;
    };
    description: string;
    maxOutputTokens?: number;
}

export interface LLMConfig {
    provider: LLMProvider;
    modelId: ModelId;
    apiKey: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stopSequences?: string[];
}

export interface ChatResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
}
