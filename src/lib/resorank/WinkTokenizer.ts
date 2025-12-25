/**
 * WinkTokenizer - Bridge WinkProcessor to ResoRank
 * 
 * RATIONALE:
 * - Lemmatization improves recall ("entities" matches "entity")
 * - POS-aware filtering reduces index size
 * - Preserves contractions (don't → don't, not "don t")
 * - Noun phrase detection for multi-word concepts
 * 
 * ARCHITECTURE:
 * - Uses existing WinkProcessor singleton (zero duplication)
 * - Drop-in replacement for naive regex tokenization
 * - No changes to ResoRank algorithm internals
 */

import { getWinkProcessor } from '@/lib/entities/nlp/WinkProcessor';
import type { Token } from '@/lib/entities/nlp/WinkProcessor';

export interface WinkTokenizerOptions {
    lemmatize?: boolean;        // Use lemmas instead of raw text
    filterStopWords?: boolean;  // Remove DET, PRON, etc.
    extractPhrases?: boolean;   // Return multi-word noun phrases
    minTokenLength?: number;    // Filter short tokens
}

export class WinkTokenizer {
    private wink = getWinkProcessor();

    /**
     * Tokenize text with linguistic awareness
     * REPLACES: naive regex split
     */
    tokenize(text: string, options?: WinkTokenizerOptions): string[] {
        const opts = {
            lemmatize: true,
            filterStopWords: true,
            extractPhrases: false,
            minTokenLength: 2,
            ...options
        };

        const analysis = this.wink.analyze(text);
        const tokens: string[] = [];

        for (const token of analysis.tokens) {
            // Skip punctuation
            if (token.isPunctuation) continue;

            // Filter stop words (if requested)
            if (opts.filterStopWords && token.isStopWord) continue;

            // Get token text (lemma or original)
            const tokenText = opts.lemmatize ? token.lemma : token.text;

            // Apply length filter
            if (tokenText.length < opts.minTokenLength) continue;

            tokens.push(tokenText.toLowerCase());
        }

        // Optionally add noun phrases as single tokens
        if (opts.extractPhrases) {
            const chunks = this.wink.extractNounChunks(text);
            for (const chunk of chunks) {
                // Only add multi-word chunks
                if (chunk.tokens.length > 1) {
                    const phrase = chunk.tokens
                        .map(t => opts.lemmatize ? t.lemma : t.text)
                        .join(' ')
                        .toLowerCase();
                    tokens.push(phrase);
                }
            }
        }

        return tokens;
    }

    /**
     * Extract context snippet using sentence boundaries
     * REPLACES: crude substring slicing
     */
    extractContext(
        text: string,
        matchPosition: number,
        windowSentences: number = 1
    ): { snippet: string; start: number; end: number } {
        const sentences = this.wink.getSentences(text);

        // Find sentence containing match
        const sentenceIndex = sentences.findIndex(
            s => s.start <= matchPosition && s.end > matchPosition
        );

        if (sentenceIndex === -1) {
            // Fallback to character window
            const start = Math.max(0, matchPosition - 100);
            const end = Math.min(text.length, matchPosition + 100);
            return { snippet: text.substring(start, end), start, end };
        }

        // Extract window
        const startIdx = Math.max(0, sentenceIndex - windowSentences);
        const endIdx = Math.min(sentences.length, sentenceIndex + windowSentences + 1);

        const contextSentences = sentences.slice(startIdx, endIdx);
        const snippet = contextSentences.map(s => s.text).join(' ');

        return {
            snippet,
            start: contextSentences[0].start,
            end: contextSentences[contextSentences.length - 1].end
        };
    }
}

// Singleton
let tokenizer: WinkTokenizer | null = null;

export function getWinkTokenizer(): WinkTokenizer {
    if (!tokenizer) {
        tokenizer = new WinkTokenizer();
    }
    return tokenizer;
}
