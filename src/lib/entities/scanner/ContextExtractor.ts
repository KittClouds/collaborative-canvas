/**
 * ContextExtractor - Wink-powered context snippet generation
 * 
 * REPLACES: Crude substring slicing in entity mention contexts
 * ARCHITECTURE: Uses existing WinkProcessor singleton
 */

import { getWinkProcessor } from '../nlp/WinkProcessor';

export interface EntityContext {
    snippet: string;         // Full sentence(s) containing mention
    beforeText: string;      // Text before mention (within sentence)
    afterText: string;       // Text after mention
    sentenceIndex: number;   // Sentence number in document
    start: number;           // Character offset
    end: number;             // Character offset
}

export class ContextExtractor {
    private wink = getWinkProcessor();

    /**
     * Extract context around entity mention using sentence boundaries
     * REPLACES: text.substring(start - 50, end + 50)
     */
    extractContext(
        fullText: string,
        mentionStart: number,
        mentionEnd: number,
        windowSentencesCount: number = 0
    ): EntityContext {
        const sentences = this.wink.getSentences(fullText);

        // Find sentence containing mention
        const sentenceIndex = sentences.findIndex(
            s => s.start <= mentionStart && s.end >= mentionEnd
        );

        if (sentenceIndex === -1) {
            // Fallback to character window
            const start = Math.max(0, mentionStart - 100);
            const end = Math.min(fullText.length, mentionEnd + 100);
            return {
                snippet: fullText.substring(start, end),
                beforeText: fullText.substring(start, mentionStart),
                afterText: fullText.substring(mentionEnd, end),
                sentenceIndex: -1,
                start,
                end
            };
        }

        // Extract sentence window
        const sentence = sentences[sentenceIndex];
        const startIdx = Math.max(0, sentenceIndex - windowSentencesCount);
        const endIdx = Math.min(sentences.length, sentenceIndex + windowSentencesCount + 1);

        const contextSentences = sentences.slice(startIdx, endIdx);
        const snippet = contextSentences.map(s => s.text).join(' ');

        return {
            snippet,
            beforeText: sentence.text.substring(0, mentionStart - sentence.start),
            afterText: sentence.text.substring(mentionEnd - sentence.start),
            sentenceIndex,
            start: contextSentences[0].start,
            end: contextSentences[contextSentences.length - 1].end
        };
    }
}

// Singleton
let extractor: ContextExtractor | null = null;

export function getContextExtractor(): ContextExtractor {
    if (!extractor) {
        extractor = new ContextExtractor();
    }
    return extractor;
}
