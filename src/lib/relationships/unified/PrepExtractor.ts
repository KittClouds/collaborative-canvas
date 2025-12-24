/**
 * PrepExtractor - Preposition-Based Relationship Extraction
 * 
 * Extracts relationships from prepositional patterns like:
 * - "Entity at Location"
 * - "Entity in Organization"
 * - "Entity from Location"
 * - "Entity with Entity"
 */

import type { DocumentContext, EntityMention, PrepOccurrence } from '../core/DocumentContext';
import type { ExtractedRelationship } from '@/lib/relationships/unified-types';
import { inferRelationshipType } from '../rules/RelationshipRules';

const MAX_TOKEN_DISTANCE = 8;  // Maximum distance between entity and preposition

export class PrepExtractor {
    /**
     * Extract preposition-based relationships from document
     * 
     * ALGORITHM:
     * 1. For each sentence with 2+ entities
     * 2. Get prepositions in that sentence (cached index)
     * 3. For each preposition, find nearby entities
     * 4. Match entity before prep as source, entity after as target
     * 5. Infer relationship type from preposition + entity kinds
     */
    extract(context: DocumentContext): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];

        // Process only sentences with 2+ entities
        const candidateSentences = context.getSentencesWithMinEntities(2);

        for (const sentence of candidateSentences) {
            const mentions = context.getEntitiesInSentence(sentence.index);  // ✅ Cached
            const preps = context.getPrepsInSentence(sentence.index);

            if (preps.length === 0) continue;

            // For each preposition, find Entity-Prep-Entity patterns
            for (const prep of preps) {
                // Find entities before and after the preposition
                const beforePrep = mentions.filter(m =>
                    m.tokenIndex < prep.tokenIndex &&
                    prep.tokenIndex - m.tokenIndex <= MAX_TOKEN_DISTANCE
                );

                const afterPrep = mentions.filter(m =>
                    m.tokenIndex > prep.tokenIndex &&
                    m.tokenIndex - prep.tokenIndex <= MAX_TOKEN_DISTANCE
                );

                if (beforePrep.length === 0 || afterPrep.length === 0) continue;

                // Take closest entities to the preposition
                const source = beforePrep[beforePrep.length - 1];  // Closest before
                const target = afterPrep[0];  // Closest after

                const relationship = this.extractPrepRelationship(
                    source,
                    prep,
                    target,
                    sentence.text,
                    sentence.index,
                    context.noteId
                );

                if (relationship) {
                    relationships.push(relationship);
                }
            }
        }

        return relationships;
    }

    /**
     * Extract a single preposition-based relationship
     */
    private extractPrepRelationship(
        source: EntityMention,
        prep: PrepOccurrence,
        target: EntityMention,
        sentenceText: string,
        sentenceIndex: number,
        noteId: string
    ): ExtractedRelationship | null {
        // Infer relationship type from preposition + entity kinds
        const relType = inferRelationshipType(
            'PREP',
            undefined,
            prep.prep,
            source.entity.kind,
            target.entity.kind
        );

        if (!relType) return null;

        // Calculate combined confidence
        const distancePenalty = 1.0 - (Math.abs(target.tokenIndex - source.tokenIndex) / (MAX_TOKEN_DISTANCE * 2));
        const confidence = relType.confidence * source.score * target.score * distancePenalty;

        return {
            source: {
                entity: source.entity,
                text: source.text,
                position: source.position
            },
            target: {
                entity: target.entity,
                text: target.text,
                position: target.position
            },
            predicate: relType.type,
            inversePredicate: relType.inverseType,
            pattern: 'PREP',
            confidence,
            context: {
                sentence: sentenceText,
                sentenceIndex,
                preposition: prep.prep
            },
            metadata: {
                extractedAt: new Date(),
                noteId
            }
        };
    }
}
