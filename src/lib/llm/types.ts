// Shared types for LLM system

export type LLMProvider = 'gemini' | 'openrouter';

export type ModelId =
    // Gemini models (direct API)
    | 'gemini-2.5-flash'
    | 'gemini-2.5-pro'
    | 'gemini-2.0-flash'
    // OpenRouter FREE models
    | 'nvidia/nemotron-3-nano-30b-a3b:free'
    | 'arcee-ai/trinity-mini:free'
    | 'nex-agi/deepseek-v3.1-nex-n1:free'
    | 'google/gemini-3-flash-preview';

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
