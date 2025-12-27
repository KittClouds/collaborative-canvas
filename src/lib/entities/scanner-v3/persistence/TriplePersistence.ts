import { relationshipRegistry } from '@/lib/cozo/graph/adapters';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import { RelationshipSource } from '@/lib/relationships/types';
import type { ExtractedTriple } from '../extractors/TripleExtractor';

/**
 * Persists triples to CoZo entity_edge table
 */
export class TriplePersistence {
    /**
     * Persist a single triple
     */
    async persistTriple(triple: ExtractedTriple, noteId: string): Promise<void> {
        // Ensure both entities exist (registerEntity returns Promise<Result>)
        let subjectId = triple.subject.id;
        if (!subjectId) {
            const subjectResult = await entityRegistry.registerEntity(
                triple.subject.label,
                triple.subject.kind as any,
                noteId
            );
            subjectId = subjectResult.entity.id;
        }

        let objectId = triple.object.id;
        if (!objectId) {
            const objectResult = await entityRegistry.registerEntity(
                triple.object.label,
                triple.object.kind as any,
                noteId
            );
            objectId = objectResult.entity.id;
        }

        // Register relationship (requires RelationshipInput)
        await relationshipRegistry.add({
            sourceEntityId: subjectId,
            targetEntityId: objectId,
            type: triple.predicate,
            provenance: [{
                source: RelationshipSource.MANUAL, // Explicit from extraction
                originId: noteId,
                confidence: triple.confidence,
                timestamp: new Date()
            }],
            attributes: {
                context: triple.context,
                explicit: true
            }
        });

        // Note: relationshipRegistry.add(rel) signature:
        // add(relationship: Omit<StoredRelationship, 'timestamp'>): Promise<void>
        // StoredRelationship: { sourceEntityId, targetEntityId, relationType, sourceNoteId, ... }

        console.log(
            `[TriplePersistence] Persisted: ${triple.subject.label} -[${triple.predicate}]-> ${triple.object.label}`
        );
    }

    /**
     * Batch persist triples
     */
    async persistTriples(triples: ExtractedTriple[], noteId: string): Promise<void> {
        for (const triple of triples) {
            try {
                await this.persistTriple(triple, noteId);
            } catch (error) {
                console.error('[TriplePersistence] Error persisting triple:', error, triple);
            }
        }
    }
}

export const triplePersistence = new TriplePersistence();
