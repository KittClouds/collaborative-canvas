import { pipeline } from '@huggingface/transformers';
import type { NEREntity, NERSpan, ExtractionSpan } from './types';

type Pipeline = any;

/**
 * ExtractionService - Handles ML-based entity extraction
 * Replaces old NER service with extraction model support
 */
class ExtractionService {
    private pipelineInstance: Pipeline | null = null;
    private loading: boolean = false;
    private loadError: Error | null = null;

    async initialize(): Promise<void> {
        if (this.pipelineInstance) return;
        if (this.loading) {
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
            // Load NER model (Phase 0: keep existing model)
            // Phase 2 will swap to LFM2-350M-Extract
            this.pipelineInstance = await pipeline(
                'token-classification',
                'onnx-community/NeuroBERT-NER-ONNX'
            );
            console.log('Extraction model loaded successfully');
        } catch (error) {
            this.loadError = error as Error;
            console.error('Failed to load extraction model:', error);
            throw error;
        } finally {
            this.loading = false;
        }
    }

    /**
     * @deprecated Use extractSpans() instead
     */
    async extractEntities(
        text: string,
        entityTypes: string[] = ['person', 'location', 'organization', 'event', 'artifact']
    ): Promise<NEREntity[]> {
        // Keep existing implementation for backward compatibility
        if (!this.pipelineInstance) {
            throw new Error('Extraction model not initialized. Call initialize() first.');
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
 */
export async function runExtraction(
    text: string,
    options: RunExtractionOptions = {}
): Promise<ExtractionSpan[]> {
    const threshold = options.threshold ?? 0.4;

    if (!extractionService.isLoaded()) {
        await extractionService.initialize();
    }

    try {
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
