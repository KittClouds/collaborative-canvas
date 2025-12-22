// Raw output from extraction model
export interface ExtractionSpan {
    text: string;
    start: number;
    end: number;
    label: string;
    confidence: number;
}

// Legacy - kept for backward compatibility
// @deprecated Use ExtractionSpan instead
export interface NERSpan {
    text: string;
    start: number;
    end: number;
    nerLabel: string;
    confidence: number;
}

// @deprecated Use ExtractionSpan instead
export interface NEREntity {
    entity_type: string;
    word: string;
    start: number;
    end: number;
    score: number;
}

export interface NERResult {
    entities: NEREntity[];
    text: string;
    timestamp: number;
}

// Status of extraction model
export type ExtractionModelStatus = 'idle' | 'loading' | 'ready' | 'error';

// @deprecated Use ExtractionModelStatus instead
export type NERModelStatus = 'idle' | 'loading' | 'ready' | 'error';
