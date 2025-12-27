/**
 * TripleExtractor - Specialized logic for triple/relationship parsing
 */
import type { PatternMatchEvent } from '../types';
import { entityRegistry } from '@/lib/cozo/graph/adapters';

export interface ExtractedTriple {
    subject: { kind: string; label: string; id?: string };
    predicate: string;
    object: { kind: string; label: string; id?: string };
    context: string;
    confidence: number;
    position: number;
}

/**
 * Parses triple patterns and validates entities
 */
export class TripleExtractor {
    /**
     * Parse triple from pattern match event
     */
    parseTriple(event: PatternMatchEvent, fullText: string): ExtractedTriple | null {
        if (event.kind !== 'triple') return null;

        const { captures } = event;

        // Extract from pattern captures
        // Handle both TRIPLE_PATTERN and INLINE_RELATIONSHIP_PATTERN
        const subjectKind = captures.subjectKind || 'CONCEPT';
        const subjectLabel = captures.subjectLabel;
        const predicate = captures.predicate;
        const objectKind = captures.objectKind || 'CONCEPT'; // Inline pattern may not have objectKind
        const objectLabel = captures.objectLabel;

        if (!subjectLabel || !predicate || !objectLabel) {
            return null;
        }

        // Resolve entity IDs if they exist in registry
        const subjectEntity = entityRegistry.findEntityByLabel(subjectLabel);
        const objectEntity = entityRegistry.findEntityByLabel(objectLabel);

        // Extract context (50 chars before/after)
        const start = Math.max(0, event.position - 50);
        const end = Math.min(fullText.length, event.position + event.length + 50);
        const context = fullText.substring(start, end);

        return {
            subject: {
                kind: subjectKind,
                label: subjectLabel,
                id: subjectEntity?.id,
            },
            predicate,
            object: {
                kind: objectKind,
                label: objectLabel,
                id: objectEntity?.id,
            },
            context,
            confidence: 0.95, // Explicit triple = high confidence
            position: event.position,
        };
    }

    /**
     * Parse multiple triples from events
     */
    parseTriples(events: PatternMatchEvent[], fullText: string): ExtractedTriple[] {
        return events
            .filter(e => e.kind === 'triple')
            .map(e => this.parseTriple(e, fullText))
            .filter((t): t is ExtractedTriple => t !== null);
    }

    /**
     * Validate triple (both entities should exist or be creatable)
     */
    validateTriple(triple: ExtractedTriple): boolean {
        // For now, all explicit triples are valid
        // Future: Add constraint checking based on entity kinds
        return Boolean(triple.subject.label && triple.predicate && triple.object.label);
    }

    /**
     * Enrich triple with entity metadata from registry
     */
    enrichTriple(triple: ExtractedTriple): ExtractedTriple {
        const subjectEntity = entityRegistry.findEntityByLabel(triple.subject.label);
        const objectEntity = entityRegistry.findEntityByLabel(triple.object.label);

        return {
            ...triple,
            subject: {
                ...triple.subject,
                id: subjectEntity?.id,
                kind: subjectEntity?.kind || triple.subject.kind,
            },
            object: {
                ...triple.object,
                id: objectEntity?.id,
                kind: objectEntity?.kind || triple.object.kind,
            },
        };
    }
}

export const tripleExtractor = new TripleExtractor();
