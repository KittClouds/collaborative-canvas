import type { 
  ExtractionResult, 
  ExtractedEntity, 
  GraphEntity,
  ExtractionMethod,
  EntityMention
} from './types';

/**
 * Interface for note structure (to avoid circular imports)
 */
export interface ExtractableNote {
  id: string;
  title: string;
  content: string;
}

/**
 * Interface that ALL extraction methods must implement
 */
export interface IEntityExtractor {
  extract(note: ExtractableNote): Promise<ExtractionResult> | ExtractionResult;
}

/**
 * Orchestrates entity extraction and deduplication
 */
export class EntityExtractor {
  private extractors: Map<ExtractionMethod, IEntityExtractor> = new Map();

  /**
   * Register an extraction method (regex, LLM, etc.)
   */
  registerExtractor(method: ExtractionMethod, extractor: IEntityExtractor): void {
    this.extractors.set(method, extractor);
  }

  /**
   * Check if an extractor is registered
   */
  hasExtractor(method: ExtractionMethod): boolean {
    return this.extractors.has(method);
  }

  /**
   * Extract entities from a single note using specified methods
   */
  async extractFromNote(
    note: ExtractableNote, 
    methods: ExtractionMethod[] = ['regex']
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];

    for (const method of methods) {
      const extractor = this.extractors.get(method);
      if (!extractor) {
        console.warn(`No extractor registered for method: ${method}`);
        continue;
      }

      try {
        const startTime = performance.now();
        const result = await extractor.extract(note);
        result.metadata.processingTime = performance.now() - startTime;
        results.push(result);
      } catch (error) {
        console.error(`Extraction failed for ${method}:`, error);
      }
    }

    return results;
  }

  /**
   * Extract entities from multiple notes (folder/vault scope)
   */
  async extractFromNotes(
    notes: ExtractableNote[], 
    methods: ExtractionMethod[] = ['regex']
  ): Promise<ExtractionResult[]> {
    const allResults: ExtractionResult[] = [];

    for (const note of notes) {
      const noteResults = await this.extractFromNote(note, methods);
      allResults.push(...noteResults);
    }

    return allResults;
  }

  /**
   * Generate canonical entity ID (kind + normalized label)
   */
  static getEntityId(kind: string, label: string): string {
    const normalizedLabel = label.trim().replace(/\s+/g, '_').toUpperCase();
    return `${kind}:${normalizedLabel}`;
  }

  /**
   * Merge extraction results into deduplicated graph entities
   * Handles entities found by multiple methods or in multiple notes
   */
  static mergeExtractionResults(results: ExtractionResult[]): GraphEntity[] {
    const entityMap = new Map<string, GraphEntity>();

    results.forEach(result => {
      result.entities.forEach(extracted => {
        const canonicalId = EntityExtractor.getEntityId(extracted.kind, extracted.label);

        if (!entityMap.has(canonicalId)) {
          entityMap.set(canonicalId, {
            id: canonicalId,
            kind: extracted.kind,
            label: extracted.label,
            subtype: extracted.subtype,
            frequency: 0,
            noteIds: [],
            mentions: [],
            extractionMethods: [],
            attributes: {},
            confidence: 0
          });
        }

        const graphEntity = entityMap.get(canonicalId)!;

        // Update subtype if not set
        if (!graphEntity.subtype && extracted.subtype) {
          graphEntity.subtype = extracted.subtype;
        }

        // Merge data
        graphEntity.frequency += extracted.positions.length || 1;
        graphEntity.mentions.push(...extracted.positions);
        
        // Track unique note IDs
        extracted.positions.forEach(pos => {
          if (!graphEntity.noteIds.includes(pos.noteId)) {
            graphEntity.noteIds.push(pos.noteId);
          }
        });

        // Track extraction methods
        if (!graphEntity.extractionMethods.includes(extracted.extractionMethod)) {
          graphEntity.extractionMethods.push(extracted.extractionMethod);
        }

        // Merge attributes (LLM might provide additional properties)
        if (extracted.attributes) {
          graphEntity.attributes = {
            ...graphEntity.attributes,
            ...extracted.attributes
          };
        }

        // Average confidence scores
        const previousTotal = graphEntity.confidence * (graphEntity.frequency - (extracted.positions.length || 1));
        const newTotal = previousTotal + (extracted.confidence * (extracted.positions.length || 1));
        graphEntity.confidence = newTotal / graphEntity.frequency;
      });
    });

    return Array.from(entityMap.values());
  }

  /**
   * Build a lookup map from "KIND:LABEL" to canonical entity ID
   */
  static buildEntityIdMap(entities: GraphEntity[]): Map<string, string> {
    const map = new Map<string, string>();
    entities.forEach(entity => {
      const key = `${entity.kind}:${entity.label}`;
      map.set(key, entity.id);
    });
    return map;
  }
}
