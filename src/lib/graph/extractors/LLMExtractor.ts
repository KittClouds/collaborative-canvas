// Removed: UnifiedGraph imports
import type { UnifiedNode, UnifiedEdge, NodeId } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { relationshipRegistry } from '@/lib/relationships';
import { RelationshipSource } from '@/lib/relationships/types';

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
  constructor() {
    // this.graph = getGraph();
  }

  async extractFromNote(
    noteId: NodeId,
    content: string,
    options: LLMExtractionOptions = {}
  ): Promise<LLMExtractionResult> {
    console.warn('LLMExtractor.extractFromNote: UnifiedGraph is removed. This is a stub.');
    return {
      entities: [],
      edges: [],
      relationships: [],
      rawResponse: '',
      processingTime: 0,
    };
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
