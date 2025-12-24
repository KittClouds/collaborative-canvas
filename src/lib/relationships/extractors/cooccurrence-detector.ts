/**
 * Co-occurrence Detector - Detect entity proximity relationships
 * 
 * Entities appearing close together in text often have semantic relationships.
 * This module detects such co-occurrences for weak relationship signals.
 */

import type { EntitySpan } from './verb-patterns';

export interface CoOccurrence {
    entities: string[];
    entitySpans: EntitySpan[];
    context: string;
    proximity: number;
    sentenceIndex: number;
    strength: number;
}

export interface CoOccurrenceOptions {
    windowSize?: number;
    minEntities?: number;
    useSentenceBoundaries?: boolean;
    maxProximity?: number;
}

const DEFAULT_OPTIONS: Required<CoOccurrenceOptions> = {
    windowSize: 150,
    minEntities: 2,
    useSentenceBoundaries: true,
    maxProximity: 200,
};

function splitIntoSentences(text: string): Array<{ text: string; start: number; end: number }> {
    const sentences: Array<{ text: string; start: number; end: number }> = [];
    const regex = /[^.!?]+[.!?]+/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        sentences.push({
            text: match[0].trim(),
            start: match.index,
            end: match.index + match[0].length,
        });
    }

    if (sentences.length === 0 && text.trim()) {
        sentences.push({ text: text.trim(), start: 0, end: text.length });
    }

    return sentences;
}

function calculateStrength(proximity: number, maxProximity: number): number {
    if (proximity <= 0) return 1.0;
    if (proximity >= maxProximity) return 0.1;

    return 1.0 - (proximity / maxProximity) * 0.6;
}

export function detectCoOccurrences(
    text: string,
    entities: EntitySpan[],
    options: CoOccurrenceOptions = {}
): CoOccurrence[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (entities.length < opts.minEntities) return [];

    const coOccurrences: CoOccurrence[] = [];

    if (opts.useSentenceBoundaries) {
        const sentences = splitIntoSentences(text);

        for (let sentenceIdx = 0; sentenceIdx < sentences.length; sentenceIdx++) {
            const sentence = sentences[sentenceIdx];

            const entitiesInSentence = entities.filter(
                e => e.start >= sentence.start && e.end <= sentence.end
            );

            if (entitiesInSentence.length >= opts.minEntities) {
                const sortedEntities = [...entitiesInSentence].sort((a, b) => a.start - b.start);

                let minStart = Infinity;
                let maxEnd = -Infinity;
                for (const e of sortedEntities) {
                    if (e.start < minStart) minStart = e.start;
                    if (e.end > maxEnd) maxEnd = e.end;
                }
                const proximity = maxEnd - minStart;

                coOccurrences.push({
                    entities: sortedEntities.map(e => e.label),
                    entitySpans: sortedEntities,
                    context: sentence.text,
                    proximity,
                    sentenceIndex: sentenceIdx,
                    strength: calculateStrength(proximity, opts.maxProximity),
                });
            }
        }
    }

    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sortedEntities.length - 1; i++) {
        const entity1 = sortedEntities[i];
        const windowEnd = entity1.end + opts.windowSize;
        const windowEntities: EntitySpan[] = [entity1];

        for (let j = i + 1; j < sortedEntities.length; j++) {
            const entity2 = sortedEntities[j];
            if (entity2.start <= windowEnd) {
                windowEntities.push(entity2);
            } else {
                break;
            }
        }

        if (windowEntities.length >= opts.minEntities) {
            const existing = coOccurrences.find(co =>
                co.entities.length === windowEntities.length &&
                windowEntities.every(e => co.entities.includes(e.label))
            );

            if (!existing) {
                const contextStart = Math.max(0, windowEntities[0].start - 20);
                const contextEnd = Math.min(
                    text.length,
                    windowEntities[windowEntities.length - 1].end + 20
                );

                const proximity = windowEntities[windowEntities.length - 1].end - windowEntities[0].start;

                coOccurrences.push({
                    entities: windowEntities.map(e => e.label),
                    entitySpans: windowEntities,
                    context: text.slice(contextStart, contextEnd),
                    proximity,
                    sentenceIndex: -1,
                    strength: calculateStrength(proximity, opts.maxProximity),
                });
            }
        }
    }

    const uniqueCoOccurrences: CoOccurrence[] = [];
    const seen = new Set<string>();

    for (const co of coOccurrences) {
        const key = [...co.entities].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCoOccurrences.push(co);
        }
    }

    return uniqueCoOccurrences.sort((a, b) => b.strength - a.strength);
}

export function coOccurrenceToRelationship(
    coOccurrence: CoOccurrence
): Array<{ sourceLabel: string; targetLabel: string; strength: number }> {
    const pairs: Array<{ sourceLabel: string; targetLabel: string; strength: number }> = [];

    const entities = coOccurrence.entities;
    for (let i = 0; i < entities.length - 1; i++) {
        for (let j = i + 1; j < entities.length; j++) {
            pairs.push({
                sourceLabel: entities[i],
                targetLabel: entities[j],
                strength: coOccurrence.strength,
            });
        }
    }

    return pairs;
}
