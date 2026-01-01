/**
 * ContextExtractor - Simple utility to extract text surrounding a match
 */

export interface ExtractionResult {
    snippet: string;
    fullSentence?: string;
}

class ContextExtractor {
    /**
     * Extract context around a position
     * @param text Full text
     * @param start Start index of match
     * @param end End index of match
     * @param sentencePadding Number of sentences to include (approximate)
     */
    extractContext(text: string, start: number, end: number, sentencePadding: number = 1): ExtractionResult {
        // Simple implementation: grab surrounding characters if sentence parsing is too heavy
        // or try to find sentence boundaries.

        const paddingChars = 100 * sentencePadding;
        const contextStart = Math.max(0, start - paddingChars);
        const contextEnd = Math.min(text.length, end + paddingChars);

        // Clean up leading/trailing partial words could be nice, but simple slicing is robust.
        let snippet = text.slice(contextStart, contextEnd);

        // Add ellipsis if truncated
        if (contextStart > 0) snippet = '...' + snippet;
        if (contextEnd < text.length) snippet = snippet + '...';

        return {
            snippet
        };
    }
}

export const contextExtractor = new ContextExtractor();

export function getContextExtractor() {
    return contextExtractor;
}
