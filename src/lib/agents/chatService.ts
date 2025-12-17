import { streamText, CoreMessage, ToolCallPart, ToolResultPart } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { tools } from './tools';
import { agentConfig } from './mastra.config';

export type ModelProvider = 'openai' | 'google' | 'anthropic';

export interface ChatRequest {
  messages: CoreMessage[];
  modelProvider?: ModelProvider;
  modelName?: string;
  onFinish?: (text: string) => void;
}

export const chatService = {
  async streamResponse(request: ChatRequest) {
    const { messages, modelProvider = 'openai', modelName = 'gpt-4o' } = request;

    let model;
    switch (modelProvider) {
      case 'google':
        model = google(modelName);
        break;
      case 'anthropic':
        model = anthropic(modelName);
        break;
      case 'openai':
      default:
        model = openai(modelName);
        break;
    }

    try {
      const result = await streamText({
        model,
        messages,
        system: agentConfig.instructions,
        tools: tools as any, // Cast to any to avoid TS inference issues with overloads
        // @ts-ignore - maxSteps is available in AI SDK 5.x but TS inference might be failing
        maxSteps: 5, // Allow multi-step tool execution
        dangerouslyAllowBrowser: true, // Client-side execution
      });

      return result;
    } catch (error) {
      console.error('Chat service error:', error);
      throw error;
    }
  },

  getAvailableModels() {
    return {
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
      google: ['gemini-2.0-flash-exp', 'gemini-1.5-pro'],
      anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    };
  }
};
