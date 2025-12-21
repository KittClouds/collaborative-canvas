import type { LLMConfig, ChatMessage, ChatOptions, ChatResponse, ModelId } from './types';
import { ModelRegistry } from './ModelRegistry';
import { SettingsManager } from '@/lib/settings/SettingsManager';

/**
 * Unified LLM Engine
 *
 * Central abstraction for ALL LLM calls in the app
 * - Supports Gemini and OpenRouter providers
 * - Reads settings from SettingsManager
 * - Provides both sync and streaming chat
 */
export class UnifiedLLMEngine {
    /**
     * Get configured LLM config for a specific purpose
     */
    static getConfig(purpose: 'default' | 'extraction' | 'agent' = 'default'): LLMConfig {
        const settings = SettingsManager.getLLMSettings();

        let modelId: ModelId;
        switch (purpose) {
            case 'extraction':
                modelId = settings.extractorModel;
                break;
            case 'agent':
                modelId = settings.agentModel;
                break;
            default:
                modelId = settings.defaultModel;
        }

        const model = ModelRegistry.getModel(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }

        const apiKey = SettingsManager.getApiKey(model.provider);
        if (!apiKey) {
            throw new Error(`No API key configured for ${model.provider}. Please add your API key in Settings.`);
        }

        return {
            provider: model.provider,
            modelId,
            apiKey,
            temperature: settings.defaultTemperature,
            maxTokens: settings.defaultMaxTokens,
        };
    }

    /**
     * Build request URL for provider
     */
    private static getEndpoint(config: LLMConfig): string {
        if (config.provider === 'gemini') {
            return `https://generativelanguage.googleapis.com/v1beta/models/${config.modelId}:generateContent?key=${config.apiKey}`;
        }

        if (config.provider === 'openrouter') {
            return 'https://openrouter.ai/api/v1/chat/completions';
        }

        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    /**
     * Simple chat completion (non-streaming)
     */
    static async chat(
        messages: ChatMessage[],
        options: ChatOptions = {},
        purpose: 'default' | 'extraction' | 'agent' = 'default'
    ): Promise<ChatResponse> {
        const config = this.getConfig(purpose);
        const model = ModelRegistry.getModel(config.modelId);

        try {
            if (config.provider === 'gemini') {
                return await this.chatGemini(messages, options, config);
            }

            if (config.provider === 'openrouter') {
                return await this.chatOpenRouter(messages, options, config);
            }

            throw new Error(`Unsupported provider: ${config.provider}`);
        } catch (error) {
            console.error('LLM chat error:', error);
            throw new Error(`LLM chat failed: ${error}`);
        }
    }

    /**
     * Gemini API chat
     */
    private static async chatGemini(
        messages: ChatMessage[],
        options: ChatOptions,
        config: LLMConfig
    ): Promise<ChatResponse> {
        const endpoint = this.getEndpoint(config);

        // Convert messages to Gemini format
        const contents = messages
            .filter(m => m.role !== 'system') // Gemini handles system differently
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        // Extract system instruction
        const systemMessage = messages.find(m => m.role === 'system');

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                temperature: options.temperature ?? config.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? config.maxTokens ?? 2048,
                topP: options.topP ?? 0.95,
            },
        };

        if (systemMessage) {
            body.systemInstruction = { parts: [{ text: systemMessage.content }] };
        }

        if (options.stopSequences?.length) {
            (body.generationConfig as Record<string, unknown>).stopSequences = options.stopSequences;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const content = candidate?.content?.parts?.[0]?.text || '';

        return {
            content,
            usage: data.usageMetadata ? {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
            } : undefined,
            finishReason: candidate?.finishReason,
        };
    }

    /**
     * OpenRouter API chat (OpenAI-compatible)
     */
    private static async chatOpenRouter(
        messages: ChatMessage[],
        options: ChatOptions,
        config: LLMConfig
    ): Promise<ChatResponse> {
        const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

        const body = {
            model: config.modelId,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            temperature: options.temperature ?? config.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? config.maxTokens ?? 2048,
            top_p: options.topP ?? 0.95,
            stop: options.stopSequences,
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Collaborative Canvas',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];

        return {
            content: choice?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0,
            } : undefined,
            finishReason: choice?.finish_reason,
        };
    }

    /**
     * Streaming chat completion
     */
    static async *chatStream(
        messages: ChatMessage[],
        options: ChatOptions = {},
        purpose: 'default' | 'extraction' | 'agent' = 'default'
    ): AsyncGenerator<string> {
        const config = this.getConfig(purpose);

        if (config.provider === 'openrouter') {
            yield* this.streamOpenRouter(messages, options, config);
        } else if (config.provider === 'gemini') {
            // Gemini streaming requires different endpoint
            yield* this.streamGemini(messages, options, config);
        } else {
            throw new Error(`Streaming not supported for provider: ${config.provider}`);
        }
    }

    /**
     * OpenRouter streaming
     */
    private static async *streamOpenRouter(
        messages: ChatMessage[],
        options: ChatOptions,
        config: LLMConfig
    ): AsyncGenerator<string> {
        const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

        const body = {
            model: config.modelId,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            temperature: options.temperature ?? config.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? config.maxTokens ?? 2048,
            stream: true,
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Collaborative Canvas',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`OpenRouter stream error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') return;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content;
                        if (delta) yield delta;
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    /**
     * Gemini streaming
     */
    private static async *streamGemini(
        messages: ChatMessage[],
        options: ChatOptions,
        config: LLMConfig
    ): AsyncGenerator<string> {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelId}:streamGenerateContent?key=${config.apiKey}&alt=sse`;

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const systemMessage = messages.find(m => m.role === 'system');

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                temperature: options.temperature ?? config.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? config.maxTokens ?? 2048,
            },
        };

        if (systemMessage) {
            body.systemInstruction = { parts: [{ text: systemMessage.content }] };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Gemini stream error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const parsed = JSON.parse(line.slice(6));
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) yield text;
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    /**
     * Test API key for a provider
     */
    static async testApiKey(provider: 'gemini' | 'openrouter', apiKey: string): Promise<boolean> {
        try {
            // Get a free model for testing
            const testModelId = provider === 'gemini'
                ? 'gemini-2.0-flash-exp'
                : 'nvidia/nemotron-3-nano-30b-a3b:free';

            const config: LLMConfig = {
                provider,
                modelId: testModelId,
                apiKey,
                temperature: 0.7,
                maxTokens: 10,
            };

            if (provider === 'gemini') {
                await this.chatGemini(
                    [{ role: 'user', content: 'Hi' }],
                    { maxTokens: 10 },
                    config
                );
            } else {
                await this.chatOpenRouter(
                    [{ role: 'user', content: 'Hi' }],
                    { maxTokens: 10 },
                    config
                );
            }

            return true;
        } catch (error) {
            console.error('API key test failed:', error);
            return false;
        }
    }

    /**
     * Check if a provider is configured
     */
    static isProviderConfigured(provider: 'gemini' | 'openrouter'): boolean {
        return SettingsManager.hasApiKey(provider);
    }

    /**
     * Get currently configured model info
     */
    static getCurrentModelInfo(purpose: 'default' | 'extraction' | 'agent' = 'default') {
        const settings = SettingsManager.getLLMSettings();

        let modelId: ModelId;
        switch (purpose) {
            case 'extraction':
                modelId = settings.extractorModel;
                break;
            case 'agent':
                modelId = settings.agentModel;
                break;
            default:
                modelId = settings.defaultModel;
        }

        return ModelRegistry.getModel(modelId);
    }
}
