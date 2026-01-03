import { streamText, CoreMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { tools } from './tools';
import { agentConfig, ModelProvider } from './mastra.config';
import { SettingsManager } from '@/lib/settings/SettingsManager';

export type { ModelProvider };

export interface ChatRequest {
  messages: CoreMessage[];
  modelProvider?: ModelProvider;
  modelName?: string;
  onFinish?: (text: string) => void;
}

/**
 * Get OpenRouter client with API key from settings
 */
function getOpenRouterClient() {
  const apiKey = SettingsManager.getApiKey('openrouter');
  return createOpenRouter({
    apiKey: apiKey || import.meta.env.VITE_OPENROUTER_API_KEY || '',
  });
}

export const chatService = {
  async streamResponse(request: ChatRequest) {
    const { messages, modelProvider = 'google', modelName = 'gemini-2.5-flash' } = request;

    let model;
    switch (modelProvider) {
      case 'openrouter':
        const openrouter = getOpenRouterClient();
        model = openrouter(modelName);
        break;
      case 'google':
      default:
        model = google(modelName);
        break;
    }

    try {
      const result = await streamText({
        model,
        messages,
        system: agentConfig.instructions,
        tools: tools as any,
        // @ts-ignore - maxSteps is available in AI SDK 5.x
        maxSteps: 5,
        dangerouslyAllowBrowser: true,
      });

      return result;
    } catch (error) {
      console.error('Chat service error:', error);
      throw error;
    }
  },

  getAvailableModels() {
    return {
      google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
      openrouter: [
        'nvidia/nemotron-3-nano-30b-a3b:free',
        'arcee-ai/trinity-mini:free',
        'nex-agi/deepseek-v3.1-nex-n1:free',
        'google/gemini-3-flash-preview',
      ],
    };
  },

  /**
   * Generate inline edit for selected text.
   * Simpler than streamResponse - no tools, no chat history.
   */
  async generateInlineEdit(options: {
    text: string;
    prompt: string;
    action: string;
    modelProvider?: ModelProvider;
    modelName?: string;
  }) {
    const {
      prompt,
      modelProvider = 'google',
      modelName = 'gemini-2.5-flash'
    } = options;

    let model;
    switch (modelProvider) {
      case 'openrouter':
        const openrouter = getOpenRouterClient();
        model = openrouter(modelName);
        break;
      case 'google':
      default:
        model = google(modelName);
        break;
    }

    try {
      // @ts-ignore - allow browser execution
      const result = await streamText({
        model,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are a professional writing assistant. Respond only with the improved text, no explanations or commentary.',
      });

      return result;
    } catch (error) {
      console.error('Inline edit error:', error);
      throw error;
    }
  }
};
