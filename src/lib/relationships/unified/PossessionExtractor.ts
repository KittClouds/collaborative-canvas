/**
 * PossessionExtractor - Possessive Relationship Extraction
 * 
 * Extracts ownership/possession relationships from patterns like:
 * - "Entity's Property" (apostrophe-s)
 * - "Property of Entity" (of-genitive)
 */

import type { DocumentContext, PossessiveOccurrence } from '../core/DocumentContext';
import type { ExtractedRelationship } from '@/lib/relationships/unified-types';
import { inferRelationshipType } from '../rules/RelationshipRules';

export class PossessionExtractor {
    /**
     * Extract possessive relationships from document
     * 
     * Uses the pre-built possessive index from DocumentContext
     */
    extract(context: DocumentContext): ExtractedRelationship[] {
        const relationships: ExtractedRelationship[] = [];

        // Get pre-built possessive index
        const possessives = context.getPossessiveIndex();

        for (const poss of possessives) {
            if (!poss.ownerMention || !poss.ownedMention) continue;

            const relationship = this.extractPossessiveRelationship(
                poss,
                context.noteId
            );

            if (relationship) {
                relationships.push(relationship);
            }
        }

        return relationships;
    }

    /**
     * Extract a single possessive relationship
     */
    private extractPossessiveRelationship(
        poss: PossessiveOccurrence,
        noteId: string
    ): ExtractedRelationship | null {
        const owner = poss.ownerMention!;
        const owned = poss.ownedMention!;

        // Infer relationship type from entity kinds
        const relType = inferRelationshipType(
            'POSSESSION',
            undefined,
            undefined,
            owner.entity.kind,
            owned.entity.kind
        );

        if (!relType) return null;

        // Calculate confidence based on entity scores
        const confidence = relType.confidence * owner.score * owned.score;

        // Get sentence text for context
        const sentenceText = poss.sentenceIndex !== undefined
            ? `Possessive relationship in sentence ${poss.sentenceIndex}`
            : 'Possessive relationship';

        return {
            source: {
                entity: owner.entity,
                text: owner.text,
                position: owner.position
            },
            target: {
                entity: owned.entity,
                text: owned.text,
                position: owned.position
            },
            predicate: relType.type,
            inversePredicate: relType.inverseType,
            pattern: 'POSSESSION',
            confidence,
            context: {
                sentence: sentenceText,
                sentenceIndex: poss.sentenceIndex || 0,
                possessiveType: poss.type
            },
            metadata: {
                extractedAt: new Date(),
                noteId
            }
        };
    }
}
