export interface LLMExtractionConfig {
  provider: 'gemini' | 'openai' | 'openrouter' | 'anthropic';
  apiKey: string;
  model?: string;
  customEntityTypes?: string[];
  customEntityDescriptions?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
}

export function getDefaultModel(provider: string): string {
  const defaults = {
    gemini: 'gemini-2.0-flash-exp',
    openai: 'gpt-4o',
    openrouter: 'openai/gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
  };
  return defaults[provider as keyof typeof defaults] || 'gemini-2.0-flash-exp';
}

export function getSupportedModels(provider: string): string[] {
  const models = {
    gemini: [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp-1219',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
    openai: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
    ],
    openrouter: [
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-exp',
      'meta-llama/llama-3.3-70b-instruct',
      'qwen/qwen-2.5-72b-instruct',
    ],
    anthropic: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  };
  return models[provider as keyof typeof models] || [];
}

export function estimateTokenCost(
  provider: string,
  model: string,
  tokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gemini-2.0-flash-exp': { input: 0, output: 0 },
    'gpt-4o': { input: 2.5, output: 10 },
    'claude-3-5-sonnet': { input: 3, output: 15 },
  };

  const modelPricing = pricing[model] || { input: 0, output: 0 };
  const cost = (tokens / 2) * (modelPricing.input / 1_000_000) +
    (tokens / 2) * (modelPricing.output / 1_000_000);

  return cost;
}
