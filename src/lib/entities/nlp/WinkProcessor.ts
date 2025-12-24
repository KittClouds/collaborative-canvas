/**
 * WinkProcessor - Linguistic analysis layer for DocumentScanner
 * 
 * Based on wink-nlp v2.2.2 + wink-eng-lite-web-model v1.6.0
 * Performance: 650K tokens/sec (per WinkJS benchmarks)
 * 
 * Key Features:
 * - Accurate sentence boundary detection (handles "Dr. Smith" correctly)
 * - POS tagging for entity disambiguation
 * - Token lemmatization (normalize word forms)
 * - No custom noun chunking (wink-eng-lite-web-model doesn't expose this)
 * 
 * Integration: Drop-in enhancement for existing scanner
 */

import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

// ==================== TYPE DEFINITIONS ====================

/**
 * Token with linguistic annotations
 */
export interface Token {
    text: string;           // Original text ("running")
    lemma: string;          // Base form ("run")
    pos: string;            // Universal POS tag ("VERB")
    start: number;          // Character offset in document
    end: number;            // End offset
    sentenceIndex: number;  // Which sentence this belongs to
    isStopWord: boolean;    // Common word to filter out
    isPunctuation: boolean; // Skip in entity extraction
}

/**
 * Sentence with precise boundaries
 */
export interface Sentence {
    index: number;          // Sentence number in document
    text: string;           // Full sentence text
    tokens: Token[];        // All tokens in sentence
    start: number;          // Character offset (computed)
    end: number;            // End offset (computed)
}

/**
 * Complete document analysis
 */
export interface LinguisticAnalysis {
    text: string;
    sentences: Sentence[];
    tokens: Token[];
    statistics: {
        sentenceCount: number;
        tokenCount: number;
        avgTokensPerSentence: number;
    };
}

/**
 * Co-occurrence detection result
 */
export interface CoOccurrence {
    entity1: string;
    entity2: string;
    sentenceIndex: number;
    tokenDistance: number;  // How many tokens apart
    context: string;        // Full sentence text
}

// ==================== WINK PROCESSOR ====================

export class WinkProcessor {
    private nlp: any;
    private its: any;
    private as: any;
    private initialized: boolean = false;

    constructor() {
        this.nlp = null;
        this.its = null;
        this.as = null;
        // Explicitly bind methods if necessary, though arrow functions or standard calls work
    }

    /**
     * Lazy initialization (only when first used)
     * Pipeline: tokenization + sbd + pos (for lemmas)
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            // Configure pipeline: sentence boundary detection + POS tagging
            // per https://winkjs.org/wink-nlp/processing-pipeline.html
            this.nlp = winkNLP(model, ['sbd', 'pos']);
            this.its = this.nlp.its;
            this.as = this.nlp.as;
            this.initialized = true;
            console.log('[WinkProcessor] Initialized with pipeline: tokenization → sbd → pos');
        }
    }

    /**
     * Analyze document text with full linguistic processing
     * 
     * @param text - Plain text to analyze
     * @returns Complete linguistic analysis
     */
    analyze(text: string): LinguisticAnalysis {
        this.ensureInitialized();

        const doc = this.nlp.readDoc(text);
        const allTokens: Token[] = [];

        // Extract raw data from all tokens
        const tokenValues = doc.tokens().out();
        const tokenLemmas = doc.tokens().out(this.its.lemma);
        const tokenPOSTags = doc.tokens().out(this.its.pos);
        const tokenStopFlags = doc.tokens().out(this.its.stopWordFlag);
        const tokenTypes = doc.tokens().out(this.its.type);

        // Calculate global offsets by aligning with text
        let cursor = 0;
        for (let i = 0; i < tokenValues.length; i++) {
            const val = tokenValues[i];
            // Find next occurrence
            const start = text.indexOf(val, cursor);
            // Robustness: if not found (unexpected), just use cursor (or search from current cursor without skipping?)
            // If not found, it implies normalization changed the text (e.g. quotes). 
            // We'll advance cursor and hope for best.
            const safeStart = start !== -1 ? start : cursor;
            const end = safeStart + val.length;

            // We will assign sentenceIndex later
            allTokens.push({
                text: val,
                lemma: tokenLemmas[i] || val.toLowerCase(),
                pos: tokenPOSTags[i] || 'X',
                start: safeStart,
                end: end,
                sentenceIndex: -1, // placeholder
                isStopWord: tokenStopFlags[i] || false,
                isPunctuation: tokenTypes[i] === 'punctuation',
            });

            cursor = end;
        }

        // Group into sentences
        const sentences: Sentence[] = [];
        // its.span returns [startIdx, endIdx] (inclusive) for tokens in the sentence
        const sentenceSpans = doc.sentences().out(this.its.span);
        const sentenceTexts = doc.sentences().out();

        for (let sIdx = 0; sIdx < sentenceTexts.length; sIdx++) {
            const span = sentenceSpans[sIdx];
            if (!span) continue;

            const [startIdx, endIdx] = span;
            const sentTokens = allTokens.slice(startIdx, endIdx + 1);

            // Update sentenceIndex
            sentTokens.forEach(t => t.sentenceIndex = sIdx);

            const sentStart = sentTokens[0]?.start ?? 0;
            const sentEnd = sentTokens[sentTokens.length - 1]?.end ?? 0;

            sentences.push({
                index: sIdx,
                text: sentenceTexts[sIdx],
                tokens: sentTokens,
                start: sentStart,
                end: sentEnd
            });
        }

        return {
            text,
            sentences,
            tokens: allTokens,
            statistics: {
                sentenceCount: sentences.length,
                tokenCount: allTokens.length,
                avgTokensPerSentence: allTokens.length / Math.max(1, sentences.length),
            },
        };
    }

    /**
     * Get sentence boundaries (replaces naive split on periods)
     * 
     * Example: "Dr. Smith works at NASA. He founded SpaceX."
     * Returns: 2 sentences (not 3!)
     */
    getSentences(text: string): Array<{ text: string; start: number; end: number }> {
        const analysis = this.analyze(text);
        return analysis.sentences.map(s => ({
            text: s.text,
            start: s.start,
            end: s.end,
        }));
    }

    /**
     * Find co-occurrences of entities within sentence boundaries
     * 
     * @param text - Document text
     * @param entityMentions - Array of entity mentions with positions
     * @returns Co-occurrence pairs
     */
    findCoOccurrences(
        text: string,
        entityMentions: Array<{ text: string; start: number; end: number }>
    ): CoOccurrence[] {
        const analysis = this.analyze(text);
        const coOccurrences: CoOccurrence[] = [];

        // Group mentions by sentence
        for (const sentence of analysis.sentences) {
            const mentionsInSentence = entityMentions.filter(m =>
                m.start >= sentence.start && m.end <= sentence.end
            );

            // Generate pairs (all combinations)
            for (let i = 0; i < mentionsInSentence.length; i++) {
                for (let j = i + 1; j < mentionsInSentence.length; j++) {
                    const m1 = mentionsInSentence[i];
                    const m2 = mentionsInSentence[j];

                    // Calculate token distance
                    const m1TokenIndex = sentence.tokens.findIndex(t => t.start >= m1.start);
                    const m2TokenIndex = sentence.tokens.findIndex(t => t.start >= m2.start);
                    const tokenDistance = Math.abs(m1TokenIndex - m2TokenIndex);

                    coOccurrences.push({
                        entity1: m1.text,
                        entity2: m2.text,
                        sentenceIndex: sentence.index,
                        tokenDistance,
                        context: sentence.text,
                    });
                }
            }
        }

        return coOccurrences;
    }

    /**
     * Get POS context around entity mention (for disambiguation)
     * 
     * Example: "Apple products" → after POS: NOUN (company)
     *          "eat an apple" → before POS: DET (fruit)
     */
    getContextualPOS(
        text: string,
        offset: number,
        window: number = 3
    ): {
        before: string[];
        after: string[];
    } {
        const analysis = this.analyze(text);

        const targetTokenIndex = analysis.tokens.findIndex(
            t => t.start <= offset && t.end > offset
        );

        if (targetTokenIndex === -1) {
            return { before: [], after: [] };
        }

        const beforeTokens = analysis.tokens
            .slice(Math.max(0, targetTokenIndex - window), targetTokenIndex)
            .map(t => t.pos);

        const afterTokens = analysis.tokens
            .slice(targetTokenIndex + 1, targetTokenIndex + window + 1)
            .map(t => t.pos);

        return { before: beforeTokens, after: afterTokens };
    }

    /**
     * Extract proper noun sequences as entity candidates
     * 
     * Pattern: Multiple consecutive PROPN (proper noun) tokens
     * Example: "New York City" → [PROPN, PROPN, PROPN]
     */
    extractProperNounSequences(text: string): Array<{
        text: string;
        start: number;
        end: number;
        tokens: Token[];
    }> {
        const analysis = this.analyze(text);
        const sequences: Array<{
            text: string;
            start: number;
            end: number;
            tokens: Token[];
        }> = [];

        let currentSequence: Token[] = [];

        for (const token of analysis.tokens) {
            if (token.pos === 'PROPN') {
                currentSequence.push(token);
            } else {
                if (currentSequence.length > 0) {
                    sequences.push({
                        text: currentSequence.map(t => t.text).join(' '),
                        start: currentSequence[0].start,
                        end: currentSequence[currentSequence.length - 1].end,
                        tokens: [...currentSequence],
                    });
                    currentSequence = [];
                }
            }
        }

        // Flush final sequence
        if (currentSequence.length > 0) {
            sequences.push({
                text: currentSequence.map(t => t.text).join(' '),
                start: currentSequence[0].start,
                end: currentSequence[currentSequence.length - 1].end,
                tokens: [...currentSequence],
            });
        }

        return sequences;
    }
}

// ==================== SINGLETON INSTANCE ====================

let winkInstance: WinkProcessor | null = null;

export function getWinkProcessor(): WinkProcessor {
    if (!winkInstance) {
        winkInstance = new WinkProcessor();
    }
    return winkInstance;
}
