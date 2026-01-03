export interface LLMExtractionConfig {
  provider: 'gemini' | 'openrouter';
  apiKey: string;
  model?: string;
  customEntityTypes?: string[];
  customEntityDescriptions?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
}

export function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    gemini: 'gemini-2.5-flash',
    openrouter: 'nvidia/nemotron-3-nano-30b-a3b:free',
  };
  return defaults[provider] || 'gemini-2.5-flash';
}

export function getSupportedModels(provider: string): string[] {
  const models: Record<string, string[]> = {
    gemini: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
    ],
    openrouter: [
      'nvidia/nemotron-3-nano-30b-a3b:free',
      'arcee-ai/trinity-mini:free',
      'nex-agi/deepseek-v3.1-nex-n1:free',
      'google/gemini-3-flash-preview',
    ],
  };
  return models[provider] || [];
}

export function estimateTokenCost(
  provider: string,
  model: string,
  tokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    // Gemini pricing (per 1M tokens)
    'gemini-2.5-flash': { input: 0.075, output: 0.3 },
    'gemini-2.5-pro': { input: 1.25, output: 5 },
    'gemini-2.0-flash': { input: 0.075, output: 0.3 },
    // OpenRouter FREE models
    'nvidia/nemotron-3-nano-30b-a3b:free': { input: 0, output: 0 },
    'arcee-ai/trinity-mini:free': { input: 0, output: 0 },
    'nex-agi/deepseek-v3.1-nex-n1:free': { input: 0, output: 0 },
    'google/gemini-3-flash-preview': { input: 0.15, output: 0.6 },
  };

  const modelPricing = pricing[model] || { input: 0, output: 0 };
  const cost = (tokens / 2) * (modelPricing.input / 1_000_000) +
    (tokens / 2) * (modelPricing.output / 1_000_000);

  return cost;
}
