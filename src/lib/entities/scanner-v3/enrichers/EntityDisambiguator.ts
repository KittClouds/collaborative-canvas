import { ContextualDisambiguator } from '@/lib/entities/nlp/ContextualDisambiguator';
import type { EnrichedMatch } from './types';
import { entityRegistry } from '@/lib/cozo/graph/adapters';

/**
 * Resolves entity mentions to canonical IDs
 */
export class EntityDisambiguator {
    private disambiguator = new ContextualDisambiguator();

    /**
     * Disambiguate an enriched match
     */
    disambiguate(match: EnrichedMatch): {
        resolvedEntityId?: string;
        confidence: number;
        candidates: Array<{ id: string; label: string; score: number }>;
    } {
        if (!match.sentence) {
            return { confidence: 0.5, candidates: [] };
        }

        const mentionText = match.captures.label || match.fullMatch;

        // Use ContextualDisambiguator
        // We assume getEntityById returns the entity (it handles both ID and resolution if correctly implemented)
        // But ContextualDisambiguator.disambiguate relies on ResoRank search over EXISTING entities.
        // If this is a new entity, it won't resolve.
        const results = this.disambiguator.disambiguate(
            mentionText,
            match.sentence,
            match.position
        );

        if (results.length === 0) {
            return { confidence: 0.5, candidates: [] };
        }

        // Best match
        const best = results[0];

        return {
            resolvedEntityId: best.entity.id,
            confidence: best.score,
            candidates: results.slice(0, 3).map(r => ({
                id: r.entity.id,
                label: r.entity.label,
                score: r.score,
            })),
        };
    }

    /**
     * Batch disambiguate
     */
    disambiguateMatches(matches: EnrichedMatch[]): Map<string, string> {
        const resolutions = new Map<string, string>(); // mention → entity ID

        for (const match of matches) {
            // Explicit entities are usually canonical, but we might want to check for duplicates/aliases
            // E.g. [Jon] vs [Jon Snow]

            const result = this.disambiguate(match);

            if (result.resolvedEntityId && result.confidence > 0.7) {
                const mentionText = match.captures.label || match.fullMatch;
                resolutions.set(mentionText.toLowerCase(), result.resolvedEntityId);
            }
        }

        return resolutions;
    }
}

export const entityDisambiguator = new EntityDisambiguator();
