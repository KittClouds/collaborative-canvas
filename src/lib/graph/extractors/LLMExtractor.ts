import { getGraph } from '@/lib/graph/graphInstance';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, UnifiedEdge, NodeId, ExtractionMethod } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';

export interface LLMEntity {
  label: string;
  kind: EntityKind;
  subtype?: string;
  confidence: number;
  description?: string;
  attributes?: Record<string, unknown>;
}

export interface LLMRelationship {
  sourceLabel: string;
  targetLabel: string;
  type: string;
  description?: string;
  confidence: number;
}

export interface LLMExtractionPrompt {
  systemPrompt: string;
  userPrompt: string;
  expectedFormat: 'json' | 'structured';
}

export interface LLMExtractionResult {
  entities: UnifiedNode[];
  edges: UnifiedEdge[];
  relationships: LLMRelationship[];
  rawResponse: string;
  processingTime: number;
}

export interface LLMExtractionOptions {
  llmProvider?: 'openai' | 'anthropic' | 'local';
  model?: string;
  entityKinds?: EntityKind[];
  extractRelationships?: boolean;
}

export class LLMExtractor {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  async extractFromNote(
    noteId: NodeId,
    content: string,
    options: LLMExtractionOptions = {}
  ): Promise<LLMExtractionResult> {
    const startTime = performance.now();
    const createdEntities: UnifiedNode[] = [];
    const createdEdges: UnifiedEdge[] = [];

    try {
      const plainText = this.extractPlainText(content);
      if (!plainText || plainText.length < 20) {
        return {
          entities: [],
          edges: [],
          relationships: [],
          rawResponse: '',
          processingTime: 0,
        };
      }

      const prompt = this.buildExtractionPrompt(plainText, options.entityKinds);
      const response = await this.callLLM(prompt, options);
      const extraction = this.parseLLMResponse(response);

      for (const llmEntity of extraction.entities) {
        let entityNode = this.graph.findEntityByLabel(llmEntity.label, llmEntity.kind);

        if (!entityNode) {
          entityNode = this.graph.addExtractedEntity(
            llmEntity.label,
            llmEntity.kind,
            {
              method: 'llm' as ExtractionMethod,
              confidence: llmEntity.confidence,
              mentions: [{
                noteId,
                charPosition: 0,
                context: plainText.slice(0, 100),
              }],
              frequency: 1,
            },
            noteId
          );
          createdEntities.push(entityNode);
        }

        const existingEdges = this.graph.getEdgesBetween(noteId, entityNode.data.id);
        const hasMention = existingEdges.some(e => e.data.type === 'MENTIONS');

        if (!hasMention) {
          const edge = this.graph.addEdge({
            source: noteId,
            target: entityNode.data.id,
            type: 'MENTIONS',
            context: plainText.slice(0, 100),
            confidence: llmEntity.confidence,
            extractionMethod: 'llm',
            noteIds: [noteId],
          });
          createdEdges.push(edge);
        }
      }

      if (options.extractRelationships) {
        for (const rel of extraction.relationships) {
          const sourceNode = this.findEntityAcrossKinds(rel.sourceLabel);
          const targetNode = this.findEntityAcrossKinds(rel.targetLabel);

          if (sourceNode && targetNode) {
            const edge = this.graph.createRelationship(
              sourceNode.data.id,
              targetNode.data.id,
              rel.type as any,
              {
                weight: rel.confidence,
                confidence: rel.confidence,
                extractionMethod: 'llm',
                noteIds: [noteId],
              }
            );
            createdEdges.push(edge);
          }
        }
      }

      const processingTime = performance.now() - startTime;
      return {
        entities: createdEntities,
        edges: createdEdges,
        relationships: extraction.relationships,
        rawResponse: response,
        processingTime,
      };
    } catch (error) {
      console.error('LLM extraction failed:', error);
      return {
        entities: [],
        edges: [],
        relationships: [],
        rawResponse: '',
        processingTime: 0,
      };
    }
  }

  private findEntityAcrossKinds(label: string): UnifiedNode | null {
    const kinds: EntityKind[] = ['CHARACTER', 'LOCATION', 'FACTION', 'ITEM', 'EVENT', 'CONCEPT'];
    for (const kind of kinds) {
      const node = this.graph.findEntityByLabel(label, kind);
      if (node) return node;
    }
    return null;
  }

  private buildExtractionPrompt(text: string, entityKinds?: EntityKind[]): LLMExtractionPrompt {
    const kinds = entityKinds || ['CHARACTER', 'LOCATION', 'FACTION', 'ITEM', 'EVENT', 'CONCEPT'];

    return {
      systemPrompt: `You are an expert entity and relationship extractor for narrative content.
Extract entities and their relationships from the provided text.

Entity Types: ${kinds.join(', ')}

Return a JSON object with this structure:
{
  "entities": [
    {
      "label": "Entity Name",
      "kind": "CHARACTER|LOCATION|etc",
      "subtype": "optional subtype",
      "confidence": 0.0-1.0,
      "description": "brief description"
    }
  ],
  "relationships": [
    {
      "sourceLabel": "Entity A",
      "targetLabel": "Entity B",
      "type": "KNOWS|LOCATED_IN|OWNS|etc",
      "description": "relationship description",
      "confidence": 0.0-1.0
    }
  ]
}`,
      userPrompt: `Extract entities and relationships from this text:\n\n${text}`,
      expectedFormat: 'json',
    };
  }

  private async callLLM(
    prompt: LLMExtractionPrompt,
    _options: LLMExtractionOptions
  ): Promise<string> {
    try {
      // Import UnifiedLLMEngine dynamically to avoid circular deps
      const { UnifiedLLMEngine } = await import('@/lib/llm/UnifiedLLMEngine');

      const response = await UnifiedLLMEngine.chat(
        [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt },
        ],
        {
          temperature: 0.3, // Low temp for extraction
          maxTokens: 2048,
        },
        'extraction'
      );

      return response.content;
    } catch (error) {
      console.error('LLM extraction call failed:', error);
      // Return empty structure on failure
      return JSON.stringify({ entities: [], relationships: [] });
    }
  }

  private parseLLMResponse(response: string): {
    entities: LLMEntity[];
    relationships: LLMRelationship[];
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        entities: parsed.entities || [],
        relationships: parsed.relationships || [],
      };
    } catch {
      return { entities: [], relationships: [] };
    }
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
}

let llmExtractor: LLMExtractor | null = null;

export function getLLMExtractor(): LLMExtractor {
  if (!llmExtractor) {
    llmExtractor = new LLMExtractor();
  }
  return llmExtractor;
}
