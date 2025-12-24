import { runNer } from '@/lib/extraction';
import { getGraph } from '@/lib/graph/graphInstance';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, NodeId, ExtractionMethod } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { matchVerbPatterns, detectCoOccurrences, type EntitySpan } from '@/lib/relationships/extractors';
import { relationshipRegistry } from '@/lib/relationships';
import { RelationshipSource } from '@/lib/relationships/types';

const NER_TO_ENTITY_KIND: Record<string, EntityKind> = {
  'PERSON': 'CHARACTER',
  'PER': 'CHARACTER',
  'LOC': 'LOCATION',
  'LOCATION': 'LOCATION',
  'GPE': 'LOCATION',
  'ORG': 'FACTION',
  'ORGANIZATION': 'FACTION',
  'EVENT': 'EVENT',
  'FAC': 'LOCATION',
  'PRODUCT': 'ITEM',
  'WORK_OF_ART': 'CONCEPT',
  'MISC': 'CONCEPT',
};

export interface NERExtractionResult {
  entities: UnifiedNode[];
  edgesCreated: number;
  relationshipsCreated: number;
  processingTime: number;
}

export interface NERSpan {
  text: string;
  start: number;
  end: number;
  nerLabel: string;
  confidence: number;
}

export class NERExtractor {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  async extractFromNote(
    noteId: NodeId,
    content: string,
    threshold: number = 0.5
  ): Promise<NERExtractionResult> {
    const startTime = performance.now();
    const createdEntities: UnifiedNode[] = [];
    let edgesCreated = 0;
    let relationshipsCreated = 0;

    try {
      const plainText = this.extractPlainText(content);
      if (!plainText || plainText.length < 10) {
        return { entities: [], edgesCreated: 0, relationshipsCreated: 0, processingTime: 0 };
      }

      const nerSpans = await runNer(plainText, { threshold });
      const entityGroups = this.groupNERSpans(nerSpans);

      const entitySpans: EntitySpan[] = [];

      for (const [key, spans] of entityGroups.entries()) {
        const [label, nerLabel] = key.split('|');
        const entityKind = NER_TO_ENTITY_KIND[nerLabel] || 'CONCEPT';

        let entityNode = this.graph.findEntityByLabel(label, entityKind);

        if (!entityNode) {
          entityNode = this.graph.addExtractedEntity(
            label,
            entityKind,
            {
              method: 'ner' as ExtractionMethod,
              confidence: Math.max(...spans.map(s => s.confidence)),
              mentions: spans.map(span => ({
                noteId,
                charPosition: span.start,
                context: this.getContext(plainText, span.start, span.end),
              })),
              frequency: spans.length,
            },
            noteId
          );
          createdEntities.push(entityNode);
        } else {
          for (const span of spans) {
            this.graph.addMention(entityNode.data.id, {
              noteId,
              charPosition: span.start,
              context: this.getContext(plainText, span.start, span.end),
            });
          }
        }

        for (const span of spans) {
          entitySpans.push({
            label,
            start: span.start,
            end: span.end,
            kind: entityKind,
          });

          const existingEdges = this.graph.getEdgesBetween(noteId, entityNode.data.id);
          const hasMention = existingEdges.some(e =>
            e.data.type === 'MENTIONS' &&
            e.data.extractionMethod === 'ner'
          );

          if (!hasMention) {
            this.graph.addEdge({
              source: noteId,
              target: entityNode.data.id,
              type: 'MENTIONS',
              context: this.getContext(plainText, span.start, span.end),
              confidence: span.confidence,
              extractionMethod: 'ner',
              noteIds: [noteId],
            });
            edgesCreated++;
          }
        }
      }

      // Run verb pattern matching on extracted entities
      if (entitySpans.length >= 2) {
        const verbRelationships = matchVerbPatterns(plainText, entitySpans);

        for (const rel of verbRelationships) {
          const sourceNode = this.graph.findEntityByLabel(rel.sourceLabel);
          const targetNode = this.graph.findEntityByLabel(rel.targetLabel);

          if (sourceNode && targetNode) {
            // Add to graph
            try {
              this.graph.createRelationship(
                sourceNode.data.id,
                targetNode.data.id,
                rel.type as any,
                {
                  weight: rel.confidence,
                  confidence: rel.confidence,
                  extractionMethod: 'ner',
                  noteIds: [noteId],
                  context: rel.context,
                }
              );

              // Also add to RelationshipRegistry
              relationshipRegistry.add({
                sourceEntityId: sourceNode.data.id,
                targetEntityId: targetNode.data.id,
                type: rel.type,
                inverseType: rel.inverseType,
                bidirectional: rel.bidirectional,
                namespace: 'ner_extraction',
                attributes: {
                  verbMatch: rel.verbMatch,
                  context: rel.context,
                },
                provenance: [{
                  source: RelationshipSource.NER_EXTRACTION,
                  originId: noteId,
                  timestamp: new Date(),
                  confidence: rel.confidence,
                  context: rel.context,
                }],
              });

              relationshipsCreated++;
            } catch (err) {
              // Relationship may already exist
            }
          }
        }
      }

      const processingTime = performance.now() - startTime;
      return { entities: createdEntities, edgesCreated, relationshipsCreated, processingTime };
    } catch (error) {
      console.error('NER extraction failed:', error);
      return { entities: [], edgesCreated: 0, relationshipsCreated: 0, processingTime: 0 };
    }
  }

  async extractFromNotes(
    noteIds: NodeId[],
    getContent: (noteId: string) => string
  ): Promise<NERExtractionResult> {
    const results: NERExtractionResult[] = [];
    for (const noteId of noteIds) {
      const content = getContent(noteId);
      const result = await this.extractFromNote(noteId, content);
      results.push(result);
    }
    return {
      entities: results.flatMap(r => r.entities),
      edgesCreated: results.reduce((sum, r) => sum + r.edgesCreated, 0),
      relationshipsCreated: results.reduce((sum, r) => sum + r.relationshipsCreated, 0),
      processingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
    };
  }

  async reextractFromNote(noteId: NodeId, content: string): Promise<NERExtractionResult> {
    this.removeNEREdgesFromNote(noteId);
    return this.extractFromNote(noteId, content);
  }

  private removeNEREdgesFromNote(noteId: NodeId): void {
    const cy = this.graph.getInstance();
    const edges = cy.edges().filter(edge => {
      const data = edge.data();
      return data.source === noteId &&
        data.type === 'MENTIONS' &&
        data.extractionMethod === 'ner';
    });
    edges.forEach(edge => {
      this.graph.removeEdge(edge.id());
    });
  }

  private groupNERSpans(spans: NERSpan[]): Map<string, NERSpan[]> {
    const groups = new Map<string, NERSpan[]>();
    for (const span of spans) {
      const key = `${span.text}|${span.nerLabel}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(span);
    }
    return groups;
  }

  private extractPlainText(content: string): string {
    try {
      const doc = JSON.parse(content);
      return this.extractText(doc);
    } catch {
      return content;
    }
  }

  private extractText(node: unknown): string {
    if (typeof node !== 'object' || node === null) return '';
    const obj = node as Record<string, unknown>;
    if (obj.type === 'text') {
      return (obj.text as string) || '';
    }
    if (Array.isArray(obj.content)) {
      return obj.content.map((n: unknown) => this.extractText(n)).join(' ');
    }
    return '';
  }

  private getContext(text: string, start: number, end: number): string {
    const contextStart = Math.max(0, start - 50);
    const contextEnd = Math.min(text.length, end + 50);
    return text.slice(contextStart, contextEnd);
  }
}

let nerExtractor: NERExtractor | null = null;

export function getNERExtractor(): NERExtractor {
  if (!nerExtractor) {
    nerExtractor = new NERExtractor();
  }
  return nerExtractor;
}
