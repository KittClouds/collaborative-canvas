/**
 * CoOccurrenceExtractor - Proximity-Based Co-occurrence Detection
 * 
 * Uses ResoRank segment masks for INSTANT proximity checks (bitwise AND).
 * IDF-weighted salience prioritizes rare entity pairs.
 */

import type { DocumentContext, EntityMention } from '../core/DocumentContext';
import type { UnifiedCoOccurrence } from '@/lib/relationships/unified-types';

export class CoOccurrenceExtractor {
    /**
     * Extract co-occurrences using ResoRank proximity masks
     * 
     * ALGORITHM:
     * 1. Group entity mentions by sentence (spatial index)
     * 2. For each sentence with 2+ entities:
     *    a. Check all entity pairs
     *    b. Use segment mask bitwise AND for instant proximity
     *    c. Calculate IDF-weighted salience
     * 3. Return ranked co-occurrences
     */
    extract(context: DocumentContext): UnifiedCoOccurrence[] {
        const coOccurrences: UnifiedCoOccurrence[] = [];

        // Build sentence-based spatial index
        const sentenceBuckets = new Map<number, EntityMention[]>();

        for (const mention of context.entityMentions) {
            const sentenceIndex = mention.sentenceIndex;
            if (sentenceIndex === undefined) continue;

            if (!sentenceBuckets.has(sentenceIndex)) {
                sentenceBuckets.set(sentenceIndex, []);
            }
            sentenceBuckets.get(sentenceIndex)!.push(mention);
        }

        // Extract co-occurrences within sentences
        for (const [sentenceIdx, mentions] of sentenceBuckets) {
            if (mentions.length < 2) continue;

            const sentence = context.winkAnalysis.sentences[sentenceIdx];

            // Check all entity pairs
            for (let i = 0; i < mentions.length - 1; i++) {
                for (let j = i + 1; j < mentions.length; j++) {
                    const entity1 = mentions[i];
                    const entity2 = mentions[j];

                    // INSTANT proximity check (bitwise AND + popcount)
                    const segmentOverlap = context.getEntityProximity(entity1, entity2);

                    if (segmentOverlap === 0) continue;  // No proximity

                    // Calculate token distance from Wink tokens
                    const tokenDistance = Math.abs(entity1.tokenIndex - entity2.tokenIndex);

                    // IDF-weighted salience (rare entities = higher importance)
                    const avgIdf = (entity1.idf + entity2.idf) / 2;
                    const salience = avgIdf * segmentOverlap;

                    // Combined confidence from ResoRank scores
                    const confidence = entity1.score * entity2.score;

                    coOccurrences.push({
                        entity1: {
                            id: entity1.entity.id,
                            label: entity1.entity.label,
                            kind: entity1.entity.kind
                        },
                        entity2: {
                            id: entity2.entity.id,
                            label: entity2.entity.label,
                            kind: entity2.entity.kind
                        },
                        context: sentence?.text || '',
                        tokenDistance,
                        segmentOverlap,
                        salience,
                        confidence,
                        sentenceIndex: sentenceIdx,
                        noteId: context.noteId
                    });
                }
            }
        }

        // Sort by salience (descending)
        coOccurrences.sort((a, b) => b.salience - a.salience);

        return coOccurrences;
    }
}
