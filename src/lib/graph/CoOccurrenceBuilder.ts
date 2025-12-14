import type { 
  GraphEntity, 
  GraphRelationship, 
  ExtractedRelationship,
  ExtractionResult
} from './types';

export type CoOccurrenceWindow = 'note' | 'sentence' | 'paragraph';

/**
 * Builds co-occurrence relationships between entities
 * Works with entities from ANY extraction method
 */
export class CoOccurrenceBuilder {
  /**
   * Build co-occurrence edges from merged graph entities
   */
  static buildFromEntities(
    entities: GraphEntity[],
    windowType: CoOccurrenceWindow = 'note'
  ): GraphRelationship[] {
    const edgeMap = new Map<string, GraphRelationship>();

    if (windowType === 'note') {
      // Group entities by note
      const entitiesByNote = this.groupEntitiesByNote(entities);

      // Create co-occurrence edges for all pairs within each note
      entitiesByNote.forEach((noteEntities, noteId) => {
        this.createPairwiseEdges(noteEntities, noteId, edgeMap);
      });
    } else if (windowType === 'sentence') {
      // Sentence-level co-occurrence (requires sentenceIndex in mentions)
      this.buildSentenceLevelCoOccurrence(entities, edgeMap);
    } else if (windowType === 'paragraph') {
      // Paragraph-level co-occurrence (future implementation)
      // For now, fall back to note-level
      const entitiesByNote = this.groupEntitiesByNote(entities);
      entitiesByNote.forEach((noteEntities, noteId) => {
        this.createPairwiseEdges(noteEntities, noteId, edgeMap);
      });
    }

    return Array.from(edgeMap.values());
  }

  /**
   * Merge explicit relationships from extraction results
   * (e.g., LLM-extracted "Jon Snow ALLY_OF Arya Stark")
   */
  static mergeExplicitRelationships(
    results: ExtractionResult[],
    entityIdMap: Map<string, string>
  ): GraphRelationship[] {
    const relMap = new Map<string, GraphRelationship>();

    results.forEach(result => {
      result.relationships.forEach(extracted => {
        const sourceKey = `${extracted.sourceKind}:${extracted.sourceLabel}`;
        const targetKey = `${extracted.targetKind}:${extracted.targetLabel}`;
        
        const sourceId = entityIdMap.get(sourceKey);
        const targetId = entityIdMap.get(targetKey);

        if (!sourceId || !targetId) {
          console.warn(`Cannot resolve entity IDs for relationship`, extracted);
          return;
        }

        const edgeId = this.getEdgeId(sourceId, targetId, extracted.relationshipType);

        if (!relMap.has(edgeId)) {
          relMap.set(edgeId, {
            id: edgeId,
            sourceId,
            targetId,
            type: extracted.relationshipType,
            weight: 0,
            confidence: 0,
            noteIds: [],
            extractionMethods: [],
            metadata: {}
          });
        }

        const rel = relMap.get(edgeId)!;
        rel.weight += extracted.weight;
        
        // Add unique note IDs
        extracted.noteIds.forEach(noteId => {
          if (!rel.noteIds.includes(noteId)) {
            rel.noteIds.push(noteId);
          }
        });
        
        if (!rel.extractionMethods.includes(extracted.extractionMethod)) {
          rel.extractionMethods.push(extracted.extractionMethod);
        }

        // Average confidence
        rel.confidence = (rel.confidence + extracted.confidence) / 2;

        // Merge metadata
        if (extracted.metadata) {
          rel.metadata = { ...rel.metadata, ...extracted.metadata };
        }
      });
    });

    return Array.from(relMap.values());
  }

  /**
   * Calculate PMI (Pointwise Mutual Information) for co-occurrence edges
   * Measures how much more often entities co-occur than by random chance
   */
  static calculatePMI(
    relationships: GraphRelationship[],
    entities: GraphEntity[],
    totalDocuments: number
  ): void {
    if (totalDocuments === 0) return;

    const entityFreqMap = new Map<string, number>();
    entities.forEach(e => entityFreqMap.set(e.id, e.noteIds.length));

    relationships.forEach(rel => {
      const freqA = entityFreqMap.get(rel.sourceId) || 1;
      const freqB = entityFreqMap.get(rel.targetId) || 1;
      const coOccurFreq = rel.noteIds.length;

      // PMI = log(P(A,B) / (P(A) * P(B)))
      const pAB = coOccurFreq / totalDocuments;
      const pA = freqA / totalDocuments;
      const pB = freqB / totalDocuments;

      // Avoid division by zero and log of zero
      if (pA > 0 && pB > 0 && pAB > 0) {
        const pmi = Math.log2(pAB / (pA * pB));
        
        if (!rel.metadata) rel.metadata = {};
        rel.metadata.pmi = pmi;
      }
    });
  }

  /**
   * Filter relationships by minimum weight
   */
  static filterByWeight(
    relationships: GraphRelationship[],
    minWeight: number
  ): GraphRelationship[] {
    return relationships.filter(r => r.weight >= minWeight);
  }

  /**
   * Filter relationships by confidence threshold
   */
  static filterByConfidence(
    relationships: GraphRelationship[],
    minConfidence: number
  ): GraphRelationship[] {
    return relationships.filter(r => r.confidence >= minConfidence);
  }

  /**
   * Filter relationships by PMI threshold
   */
  static filterByPMI(
    relationships: GraphRelationship[],
    minPMI: number
  ): GraphRelationship[] {
    return relationships.filter(r => (r.metadata?.pmi ?? 0) >= minPMI);
  }

  // ============= PRIVATE HELPERS =============

  private static groupEntitiesByNote(
    entities: GraphEntity[]
  ): Map<string, GraphEntity[]> {
    const grouped = new Map<string, GraphEntity[]>();

    entities.forEach(entity => {
      entity.noteIds.forEach(noteId => {
        if (!grouped.has(noteId)) {
          grouped.set(noteId, []);
        }
        grouped.get(noteId)!.push(entity);
      });
    });

    return grouped;
  }

  private static createPairwiseEdges(
    entities: GraphEntity[],
    noteId: string,
    edgeMap: Map<string, GraphRelationship>
  ): void {
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];

        const edgeId = this.getEdgeId(entityA.id, entityB.id, 'CO_OCCURS');

        if (!edgeMap.has(edgeId)) {
          edgeMap.set(edgeId, {
            id: edgeId,
            sourceId: entityA.id,
            targetId: entityB.id,
            type: 'CO_OCCURS',
            weight: 0,
            confidence: 1.0, // co-occurrence is deterministic
            noteIds: [],
            extractionMethods: ['regex'],
            metadata: {}
          });
        }

        const edge = edgeMap.get(edgeId)!;
        edge.weight++;
        if (!edge.noteIds.includes(noteId)) {
          edge.noteIds.push(noteId);
        }
      }
    }
  }

  private static buildSentenceLevelCoOccurrence(
    entities: GraphEntity[],
    edgeMap: Map<string, GraphRelationship>
  ): void {
    // Group mentions by note + sentence
    const sentenceGroups = new Map<string, Set<string>>();

    entities.forEach(entity => {
      entity.mentions.forEach(mention => {
        if (mention.sentenceIndex !== undefined) {
          const key = `${mention.noteId}:${mention.sentenceIndex}`;
          if (!sentenceGroups.has(key)) {
            sentenceGroups.set(key, new Set());
          }
          sentenceGroups.get(key)!.add(entity.id);
        }
      });
    });

    // Create edges for entities in same sentence
    sentenceGroups.forEach((entityIds, sentenceKey) => {
      const entityArray = Array.from(entityIds);
      const [noteId] = sentenceKey.split(':');

      for (let i = 0; i < entityArray.length; i++) {
        for (let j = i + 1; j < entityArray.length; j++) {
          const edgeId = this.getEdgeId(entityArray[i], entityArray[j], 'CO_OCCURS');

          if (!edgeMap.has(edgeId)) {
            edgeMap.set(edgeId, {
              id: edgeId,
              sourceId: entityArray[i],
              targetId: entityArray[j],
              type: 'CO_OCCURS',
              weight: 0,
              confidence: 1.0,
              noteIds: [],
              extractionMethods: ['regex'],
              metadata: { windowType: 'sentence' }
            });
          }

          const edge = edgeMap.get(edgeId)!;
          edge.weight++;
          if (!edge.noteIds.includes(noteId)) {
            edge.noteIds.push(noteId);
          }
        }
      }
    });
  }

  private static getEdgeId(idA: string, idB: string, type: string): string {
    // Deterministic, order-independent ID
    const orderedIds = idA < idB ? `${idA}--${idB}` : `${idB}--${idA}`;
    return `${orderedIds}::${type}`;
  }
}
