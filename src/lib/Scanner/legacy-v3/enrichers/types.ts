import type { PatternMatchEvent } from '../types';
import type { Sentence } from '@/lib/scanner/nlp/WinkProcessor';

export interface EnrichedMatch extends PatternMatchEvent {
    // NLP enrichment
    sentence?: Sentence;              // Containing sentence
    posContext?: {                    // POS tags around match
        before: string[];
        after: string[];
    };
    nounChunk?: {                     // If part of a noun chunk
        text: string;
        isProperNoun: boolean;
    };

    // Confidence adjustment
    baseConfidence: number;           // Original confidence (0.95 for explicit)
    nlpConfidence: number;            // After NLP validation
    finalConfidence: number;          // Combined score

    // Validation flags
    validatedByPOS: boolean;          // POS matches entity kind
    validatedByChunk: boolean;        // Part of valid noun chunk
}
