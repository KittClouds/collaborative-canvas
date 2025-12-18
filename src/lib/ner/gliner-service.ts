import { pipeline } from '@huggingface/transformers';
import type { NEREntity, NERSpan } from './types';

type Pipeline = any;

class GLiNERService {
    private pipelineInstance: Pipeline | null = null;
    private loading: boolean = false;
    private loadError: Error | null = null;

    async initialize(): Promise<void> {
        if (this.pipelineInstance) return; // Already loaded
        if (this.loading) {
            // Wait for existing load to complete
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

        try {
            // Load GLiNER Small ONNX model (~50MB)
            // Uses token-classification pipeline with GLiNER model
            this.pipelineInstance = await pipeline(
                'token-classification',
                'onnx-community/NeuroBERT-NER-ONNX'
            );
            console.log('GLiNER model loaded successfully');
        } catch (error) {
            this.loadError = error as Error;
            console.error('Failed to load GLiNER model:', error);
            throw error;
        } finally {
            this.loading = false;
        }
    }

    async extractEntities(
        text: string,
        entityTypes: string[] = ['person', 'location', 'organization', 'event', 'artifact']
    ): Promise<NEREntity[]> {
        if (!this.pipelineInstance) {
            throw new Error('GLiNER model not initialized. Call initialize() first.');
        }

        try {
            // Standard token classification doesn't support dynamic entity_types like GLiNER
            // We pass the text directly. Options like threshold might be supported depending on the library version
            const results = await (this.pipelineInstance as any)(text, {
                ignore_labels: ['O'],
                score_threshold: 0.4,
                aggregation_strategy: 'simple', // Aggregate subword tokens into entities
            });

            // Normalize results to NEREntity format
            return (results as any[]).map((r: any) => {
                let type = (r.entity || r.entity_group || r.label || 'unknown').toUpperCase();

                // Map BERT/Standard tags to generic types used in mapping
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
}

// Singleton instance
export const glinerService = new GLiNERService();

// ==================== Clean NER API ====================

export interface RunNEROptions {
    threshold?: number;
}

/**
 * Clean NER API - returns raw NER model output without hardcoded label mapping
 */
export async function runNer(
    text: string,
    options: RunNEROptions = {}
): Promise<NERSpan[]> {
    const threshold = options.threshold ?? 0.4;

    if (!glinerService.isLoaded()) {
        await glinerService.initialize();
    }

    try {
        const results = await (glinerService as any).pipelineInstance(text, {
            ignore_labels: ['O'],
            score_threshold: threshold,
            aggregation_strategy: 'simple',
        });

        return (results as any[]).map((r: any) => ({
            text: r.word || r.text || text.slice(r.start, r.end),
            start: r.start,
            end: r.end,
            nerLabel: (r.entity || r.entity_group || r.label || 'unknown').toUpperCase(),
            confidence: r.score || 0,
        }));
    } catch (error) {
        console.error('NER extraction failed:', error);
        return [];
    }
}
