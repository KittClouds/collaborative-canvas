// Static import removed, using dynamic import in initialize() for performance
import type { NEREntity, NERSpan, ExtractionSpan } from './types';
import type { EntityKind } from '@/lib/entities/entityTypes';

type Pipeline = any;

/**
 * Structured extraction output from LFM2-350M-Extract
 */
export interface StructuredExtraction {
    entities: Array<{
        label: string;
        kind: EntityKind;
        confidence: number;
    }>;
    relationships: Array<{
        source: string;
        target: string;
        type: string;
        confidence?: number;
    }>;
    coOccurrences: Array<{
        entities: string[];
        context: string;
    }>;
}

/**
 * Model configuration
 */
export type ModelType = 'ner' | 'extraction';

interface ModelConfig {
    type: ModelType;
    modelId: string;
    pipelineType: string;
    supportsPrompts: boolean;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
    ner: {
        type: 'ner',
        modelId: 'onnx-community/NeuroBERT-NER-ONNX',
        pipelineType: 'token-classification',
        supportsPrompts: false,
    },
    extraction: {
        type: 'extraction',
        modelId: 'onnx-community/LFM2-350M-Extract-ONNX',
        pipelineType: 'text2text-generation',
        supportsPrompts: true,
    },
};

/**
 * ExtractionService - Handles both NER and structured extraction
 */
class ExtractionService {
    private pipelineInstance: Pipeline | null = null;
    private loading: boolean = false;
    private loadError: Error | null = null;
    private currentModel: ModelType = 'ner'; // Default to NER for backward compatibility

    /**
     * Initialize model (defaults to NER, can load extraction model)
     */
    async initialize(modelType: ModelType = 'ner'): Promise<void> {
        if (this.pipelineInstance && this.currentModel === modelType) {
            return; // Already loaded
        }

        if (this.loading) {
            // Wait for existing load
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (!this.loading) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }

        this.loading = true;
        this.loadError = null;

        const config = MODEL_CONFIGS[modelType];

        try {
            console.log(`Loading ${modelType} model: ${config.modelId}...`);

            // Lazy import transformers library
            const { pipeline } = await import('@huggingface/transformers');

            this.pipelineInstance = await pipeline(
                config.pipelineType as any,
                config.modelId,
                {
                    quantized: true, // Use quantized model for smaller size and speed
                    progress_callback: (progress: any) => {
                        if (progress.status === 'progress') {
                            const percent = Math.round((progress.loaded / progress.total) * 100);
                            // Log less frequently to avoid spam
                            if (percent % 10 === 0) {
                                console.log(`Model download: ${percent}%`);
                            }
                        }
                    },
                } as any
            );

            this.currentModel = modelType;
            console.log(`${modelType} model loaded successfully`);

        } catch (error) {
            this.loadError = error as Error;
            console.error(`Failed to load ${modelType} model:`, error);
            throw error;
        } finally {
            this.loading = false;
        }
    }

    /**
     * Run structured extraction with LFM2-350M-Extract (Phase 2)
     */
    async extractStructured(
        text: string,
        systemPrompt: string,
        options: { temperature?: number; maxNewTokens?: number } = {}
    ): Promise<StructuredExtraction> {
        const temperature = options.temperature ?? 0; // Greedy decoding recommended for extraction
        const maxNewTokens = options.maxNewTokens ?? 1024; // Increased for structured JSON output

        if (!this.pipelineInstance || this.currentModel !== 'extraction') {
            await this.initialize('extraction');
        }

        try {
            // LFM2 uses ChatML-like format
            const prompt = this.buildLFM2Prompt(systemPrompt, text);

            const result = await (this.pipelineInstance as any)(prompt, {
                max_new_tokens: maxNewTokens,
                temperature,
                do_sample: temperature > 0,
                return_full_text: false, // Only return generated part
            });

            // Parse JSON output from model
            const generatedText = Array.isArray(result)
                ? result[0].generated_text
                : result.generated_text;

            return this.parseExtractionOutput(generatedText);

        } catch (error) {
            console.error('Structured extraction failed:', error);
            // Return empty result on error instead of throwing to prevent UI crash
            return {
                entities: [],
                relationships: [],
                coOccurrences: [],
            };
        }
    }

    /**
     * Build LFM2-style prompt (ChatML format)
     */
    private buildLFM2Prompt(systemPrompt: string, userText: string): string {
        return `<|startoftext|><|im_start|>system
${systemPrompt}<|im_end|>
<|im_start|>user
${userText}<|im_end|>
<|im_start|>assistant
`;
    }

    /**
     * Parse JSON output from LFM2 model
     */
    private parseExtractionOutput(text: string): StructuredExtraction {
        try {
            // Extract JSON from response (model might be chatty)
            // Look for first '{' and last '}'
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');

            if (start !== -1 && end !== -1 && end > start) {
                const jsonStr = text.substring(start, end + 1);
                const parsed = JSON.parse(jsonStr);

                // Validate and normalize structure
                return {
                    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
                    relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
                    coOccurrences: Array.isArray(parsed.coOccurrences) ? parsed.coOccurrences : [],
                };
            }

            console.warn('No valid JSON found in extraction output', text.substring(0, 50) + "...");
            return { entities: [], relationships: [], coOccurrences: [] };

        } catch (error) {
            console.error('Failed to parse extraction output:', error);
            // Attempt lenient parsing or fallback here if needed
            return { entities: [], relationships: [], coOccurrences: [] };
        }
    }

    // ==================== Legacy / Backward Compatibility Methods ====================

    /**
     * @deprecated Use extractSpans() instead
     */
    async extractEntities(
        text: string,
        entityTypes: string[] = ['person', 'location', 'organization', 'event', 'artifact']
    ): Promise<NEREntity[]> {
        // Warning: This forces a reload if we were in extraction mode
        if (!this.pipelineInstance || this.currentModel !== 'ner') {
            await this.initialize('ner');
        }

        try {
            const results = await (this.pipelineInstance as any)(text, {
                ignore_labels: ['O'],
                score_threshold: 0.4,
                aggregation_strategy: 'simple',
            });

            return (results as any[]).map((r: any) => {
                let type = (r.entity || r.entity_group || r.label || 'unknown').toUpperCase();

                if (type.includes('PER')) type = 'person';
                else if (type.includes('LOC')) type = 'location';
                else if (type.includes('ORG')) type = 'organization';
                else if (type.includes('MISC')) type = 'misc';
                else type = type.toLowerCase();

                return {
                    entity_type: type,
                    word: r.word || r.text || text.slice(r.start, r.end),
                    start: r.start,
                    end: r.end,
                    score: r.score || 0,
                };
            });
        } catch (error) {
            console.error('Entity extraction failed:', error);
            return [];
        }
    }

    isLoaded(): boolean {
        return this.pipelineInstance !== null;
    }

    isLoading(): boolean {
        return this.loading;
    }

    getError(): Error | null {
        return this.loadError;
    }

    getCurrentModel(): ModelType {
        return this.currentModel;
    }
}

// Singleton instance
export const extractionService = new ExtractionService();

// Backward compatibility exports
export const glinerService = extractionService;

// ==================== Clean Extraction API ====================

export interface RunExtractionOptions {
    threshold?: number;
}

/**
 * Run extraction on text - returns raw model output
 * NOTE: This will implicitly use the NER model.
 */
export async function runExtraction(
    text: string,
    options: RunExtractionOptions = {}
): Promise<ExtractionSpan[]> {
    const threshold = options.threshold ?? 0.4;

    if (!extractionService.isLoaded() || extractionService.getCurrentModel() !== 'ner') {
        await extractionService.initialize('ner');
    }

    try {
        // Access private pipeline instance via any cast to run inference
        // In a real scenario, we might expose a public method for this
        const results = await (extractionService as any).pipelineInstance(text, {
            ignore_labels: ['O'],
            score_threshold: threshold,
            aggregation_strategy: 'simple',
        });

        return (results as any[]).map((r: any) => ({
            text: r.word || r.text || text.slice(r.start, r.end),
            start: r.start,
            end: r.end,
            label: (r.entity || r.entity_group || r.label || 'unknown').toUpperCase(),
            confidence: r.score || 0,
        }));
    } catch (error) {
        console.error('Extraction failed:', error);
        return [];
    }
}

// Backward compatibility
/**
 * @deprecated Use runExtraction() instead
 */
export async function runNer(
    text: string,
    options: RunExtractionOptions = {}
): Promise<NERSpan[]> {
    const results = await runExtraction(text, options);
    return results.map(r => ({
        text: r.text,
        start: r.start,
        end: r.end,
        nerLabel: r.label,
        confidence: r.confidence,
    }));
}
