import type { IEntityExtractor, ExtractableNote } from '../EntityExtractor';
import type { ExtractionResult, ExtractedEntity, ExtractedRelationship, EntityMention } from '../types';
import { parseNoteConnectionsFromDocument } from '@/lib/entities/documentParser';
import type { JSONContent } from '@tiptap/react';

/**
 * Regex-based extractor that wraps the existing document parser
 * Produces standardized ExtractionResult from existing parsing logic
 */
export class RegexExtractor implements IEntityExtractor {
  /**
   * Extract entities and relationships from a note using regex patterns
   */
  extract(note: ExtractableNote): ExtractionResult {
    const timestamp = new Date().toISOString();
    
    // Handle empty content
    if (!note.content) {
      return {
        entities: [],
        relationships: [],
        metadata: {
          noteId: note.id,
          extractionMethod: 'regex',
          timestamp
        }
      };
    }

    // Parse content as JSON
    let jsonContent: JSONContent;
    try {
      jsonContent = JSON.parse(note.content);
    } catch {
      // If not valid JSON, treat as plain text
      return {
        entities: [],
        relationships: [],
        metadata: {
          noteId: note.id,
          extractionMethod: 'regex',
          timestamp
        }
      };
    }

    // Use existing document parser
    const connections = parseNoteConnectionsFromDocument(jsonContent);

    // Convert EntityReference[] to ExtractedEntity[]
    const entities: ExtractedEntity[] = connections.entities.map(entityRef => {
      const positions: EntityMention[] = (entityRef.positions || []).map(charPos => ({
        noteId: note.id,
        charPosition: charPos,
        context: this.extractContext(note.content, charPos)
      }));

      // If no positions found, create at least one mention for this note
      if (positions.length === 0) {
        positions.push({
          noteId: note.id,
          charPosition: 0,
          context: entityRef.label
        });
      }

      return {
        kind: entityRef.kind,
        label: entityRef.label,
        subtype: entityRef.subtype,
        confidence: 1.0, // Regex extraction is deterministic
        extractionMethod: 'regex' as const,
        positions,
        attributes: entityRef.attributes
      };
    });

    // Convert Triple[] to ExtractedRelationship[]
    const relationships: ExtractedRelationship[] = connections.triples.map(triple => ({
      sourceLabel: triple.subject.label,
      sourceKind: triple.subject.kind,
      targetLabel: triple.object.label,
      targetKind: triple.object.kind,
      relationshipType: triple.predicate,
      weight: 1,
      confidence: 1.0,
      extractionMethod: 'regex' as const,
      noteIds: [note.id],
      metadata: {
        subjectSubtype: triple.subject.subtype,
        objectSubtype: triple.object.subtype
      }
    }));

    return {
      entities,
      relationships,
      metadata: {
        noteId: note.id,
        extractionMethod: 'regex',
        timestamp
      }
    };
  }

  /**
   * Extract surrounding context for an entity mention
   */
  private extractContext(content: string, charPosition: number, contextLength: number = 50): string {
    // For JSON content, try to extract plain text first
    let plainText: string;
    try {
      const json = JSON.parse(content);
      plainText = this.extractPlainText(json);
    } catch {
      plainText = content;
    }

    const start = Math.max(0, charPosition - contextLength);
    const end = Math.min(plainText.length, charPosition + contextLength);
    
    let context = plainText.slice(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < plainText.length) context = context + '...';
    
    return context.trim();
  }

  /**
   * Extract plain text from TipTap JSON content
   */
  private extractPlainText(node: any): string {
    if (!node) return '';
    
    if (typeof node.text === 'string') {
      return node.text;
    }
    
    if (Array.isArray(node.content)) {
      return node.content.map((child: any) => this.extractPlainText(child)).join(' ');
    }
    
    return '';
  }
}
