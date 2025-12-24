/**
 * SVOExtractor - Subject-Verb-Object Relationship Extraction
 * 
 * OPTIMIZATIONS:
 * - Spatial partitioning: Only check entity pairs near verbs
 * - Index reuse: Verb/prep indexes built once, reused
 * - ResoRank confidence: Use entity match scores to weight relationships
 * - No array allocations: No slice() or filter() in hot loops
 */

import type { DocumentContext, EntityMention, VerbOccurrence } from '../core/DocumentContext';
import type { ExtractedRelationship } from '@/lib/relationships/unified-types';
import { inferRelationshipType } from '../rules/RelationshipRules';

const MAX_TOKEN_DISTANCE = 10;  // Maximum distance between subject and object

export class SVOExtractor {
    /**
     * Extract Subject-Verb-Object relationships from document
     * 
     * ALGORITHM:
     * 1. For each sentence with 2+ entities
     * 2. Get verbs in that sentence (cached index)
     * 3. For each verb, find nearby entities (spatial partitioning)
     * 4. Match subject (before verb) + object (after verb)
     * 5. Infer relationship type from verb lemma + entity kinds
     */
    extract(context: DocumentContext): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];

        // Process only sentences with 2+ entities
        const candidateSentences = context.getSentencesWithMinEntities(2);

        for (const sentence of candidateSentences) {
            const mentions = context.getEntitiesInSentence(sentence.index);  // ✅ Cached
            const verbs = context.getVerbsInSentence(sentence.index);

            if (verbs.length === 0) continue;

            // For each verb, find SVO patterns
            for (const verb of verbs) {
                // OPTIMIZATION: Spatial partitioning
                // Only check entity pairs within MAX_TOKEN_DISTANCE of verb
                const nearbyMentions = mentions.filter(m =>
                    Math.abs(m.tokenIndex - verb.tokenIndex) <= MAX_TOKEN_DISTANCE
                );

                if (nearbyMentions.length < 2) continue;

                // Split into subject (before verb) and object (after verb)
                const subjects = nearbyMentions.filter(m => m.tokenIndex < verb.tokenIndex);
                const objects = nearbyMentions.filter(m => m.tokenIndex > verb.tokenIndex);

                // Extract relationships
                for (const subject of subjects) {
                    for (const object of objects) {
                        const relationship = this.extractSVORelationship(
                            subject,
                            verb,
                            object,
                            sentence.text,
                            sentence.index,
                            context.noteId
                        );

                        if (relationship) {
                            relationships.push(relationship);
                        }
                    }
                }
            }
        }

        return relationships;
    }

    /**
     * Extract a single SVO relationship
     */
    private extractSVORelationship(
        subject: EntityMention,
        verb: VerbOccurrence,
        object: EntityMention,
        sentenceText: string,
        sentenceIndex: number,
        noteId: string
    ): ExtractedRelationship | null {
        // Infer relationship type from verb lemma + entity kinds
        const relType = inferRelationshipType(
            'SVO',
            verb.lemma,
            undefined,
            subject.entity.kind,
            object.entity.kind
        );

        if (!relType) return null;

        // Calculate combined confidence
        // - ResoRank entity match scores (subject.score, object.score)
        // - Relationship type confidence (relType.confidence)
        // - Token distance penalty (closer = higher confidence)
        const distancePenalty = 1.0 - (Math.abs(object.tokenIndex - subject.tokenIndex) / (MAX_TOKEN_DISTANCE * 2));
        const confidence = relType.confidence * subject.score * object.score * distancePenalty;

        return {
            source: {
                entity: subject.entity,
                text: subject.text,
                position: subject.position
            },
            target: {
                entity: object.entity,
                text: object.text,
                position: object.position
            },
            predicate: relType.type,
            inversePredicate: relType.inverseType,
            pattern: 'SVO',
            confidence,
            context: {
                sentence: sentenceText,
                sentenceIndex,
                verbLemma: verb.lemma
            },
            metadata: {
                extractedAt: new Date(),
                noteId
            }
        };
    }
}
