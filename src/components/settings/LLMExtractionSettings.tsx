import React, { useState } from 'react';
import {
    type LLMExtractionConfig,
    getDefaultModel,
    getSupportedModels
} from '@/lib/extraction/extractionConfig';

interface LLMExtractionSettingsProps {
    initialConfig?: LLMExtractionConfig;
    onSave: (config: LLMExtractionConfig) => void;
}

export function LLMExtractionSettings({ initialConfig, onSave }: LLMExtractionSettingsProps) {
    const [config, setConfig] = useState<LLMExtractionConfig>(initialConfig || {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-2.0-flash-exp',
    });

    return (
        <div className="llm-settings p-4 space-y-4 border rounded-md">
            <h3 className="text-lg font-medium">LLM Entity Extraction</h3>

            <div className="space-y-2">
                <label className="block text-sm font-medium">Provider</label>
                <select
                    className="w-full p-2 border rounded bg-background text-foreground"
                    value={config.provider}
                    onChange={(e) => {
                        const provider = e.target.value as LLMExtractionConfig['provider'];
                        setConfig({
                            ...config,
                            provider,
                            model: getDefaultModel(provider),
                        });
                    }}
                >
                    <option value="gemini">Google Gemini</option>
                    <option value="openrouter">OpenRouter (Multi-provider)</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openai">OpenAI</option>
                </select>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium">Model</label>
                <select
                    className="w-full p-2 border rounded bg-background text-foreground"
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                >
                    {getSupportedModels(config.provider).map(model => (
                        <option key={model} value={model}>{model}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium">API Key</label>
                <input
                    type="password"
                    className="w-full p-2 border rounded bg-background text-foreground"
                    placeholder="API Key"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                />
            </div>

            <button
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                onClick={() => onSave(config)}
            >
                Save Configuration
            </button>
        </div>
    );
}
