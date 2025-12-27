import { getWinkProcessor } from '@/lib/entities/nlp/WinkProcessor';
import type { PatternMatchEvent } from '../types';
import type { EnrichedMatch } from './types';
import { EntityKind } from '@/lib/entities/entityTypes';

/**
 * Enriches pattern matches with NLP analysis
 */
export class NLPEnricher {
    private wink = getWinkProcessor();

    /**
     * Enrich a single pattern match
     */
    enrichMatch(
        event: PatternMatchEvent,
        fullText: string
    ): EnrichedMatch {
        const enriched: EnrichedMatch = {
            ...event,
            baseConfidence: this.getBaseConfidence(event),
            nlpConfidence: 1.0,
            finalConfidence: 1.0,
            validatedByPOS: false,
            validatedByChunk: false,
        };

        // Skip enrichment for explicit syntax (already high confidence)
        if (event.kind === 'entity' || event.kind === 'triple') {
            enriched.nlpConfidence = 1.0;
            enriched.finalConfidence = enriched.baseConfidence;
            return enriched;
        }

        // Get linguistic analysis (WinkProcessor caches internal analysis if text is same, 
        // but ideally we should pass analysis object if available to avoid re-parsing)
        const analysis = this.wink.analyze(fullText);

        // Find containing sentence
        enriched.sentence = analysis.sentences.find(
            s => event.position >= s.start && event.position <= s.end
        );

        if (!enriched.sentence) {
            enriched.nlpConfidence = 0.5; // Penalize if no sentence found
            enriched.finalConfidence = enriched.baseConfidence * enriched.nlpConfidence;
            return enriched;
        }

        // Get POS context
        enriched.posContext = this.wink.getContextualPOS(
            fullText,
            event.position,
            3
        );

        // Validate with POS patterns
        if (event.captures.entityKind) {
            enriched.validatedByPOS = this.validatePOSContext(
                event.captures.entityKind as EntityKind,
                enriched.posContext
            );

            if (enriched.validatedByPOS) {
                enriched.nlpConfidence *= 1.2; // Boost confidence
            }
        }

        // Check if part of noun chunk
        const nounChunks = this.wink.extractNounChunks(fullText);
        const containingChunk = nounChunks.find(
            chunk => event.position >= chunk.start && (event.position + event.length) <= chunk.end
        );

        if (containingChunk) {
            enriched.nounChunk = {
                text: containingChunk.text,
                isProperNoun: containingChunk.isProperNoun,
            };
            enriched.validatedByChunk = true;
            enriched.nlpConfidence *= 1.1; // Slight boost
        }

        // Clamp confidence to [0, 1]
        enriched.nlpConfidence = Math.min(1.0, enriched.nlpConfidence);
        enriched.finalConfidence = enriched.baseConfidence * enriched.nlpConfidence;

        return enriched;
    }

    /**
     * Batch enrich multiple matches
     */
    enrichMatches(
        events: PatternMatchEvent[],
        fullText: string
    ): EnrichedMatch[] {
        // Analysis only once for batch
        // Optimization: WinkProcessor analyze() re-runs pipeline every call.
        // If performance becomes an issue, we should modify extractNounChunks/getContextualPOS 
        // to accept a pre-computed analysis object.
        // For now, relies on the fact that analyze() is fast enough (650k tokens/sec).
        return events.map(event => this.enrichMatch(event, fullText));
    }

    /**
     * Get base confidence from pattern type
     */
    private getBaseConfidence(event: PatternMatchEvent): number {
        switch (event.kind) {
            case 'entity':
            case 'triple':
                return 0.95; // Explicit syntax = very high
            case 'wikilink':
            case 'backlink':
                return 0.90;
            case 'tag':
            case 'mention':
                return 0.85;
            case 'temporal':
                return 0.75;
            default:
                return 0.70;
        }
    }

    /**
     * Validate POS context against entity kind patterns
     */
    private validatePOSContext(
        kind: EntityKind,
        context: { before: string[]; after: string[] }
    ): boolean {
        // Simplified patterns 
        const patterns: Partial<Record<EntityKind, { before: string[]; after: string[] }>> = {
            CHARACTER: { before: ['DET', 'PRON'], after: ['VERB', 'AUX'] },
            LOCATION: { before: ['ADP'], after: ['PUNCT', 'VERB'] },
            ITEM: { before: ['DET', 'ADJ'], after: ['VERB', 'AUX'] },
        };

        const pattern = patterns[kind];
        if (!pattern) return false;

        const matchesBefore = context.before.some(p => pattern.before.includes(p));
        const matchesAfter = context.after.some(p => pattern.after.includes(p));

        return matchesBefore || matchesAfter;
    }
}

export const nlpEnricher = new NLPEnricher();
