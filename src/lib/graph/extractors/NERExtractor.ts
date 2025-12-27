import { runNer } from '@/lib/extraction';
// Removed: UnifiedGraph imports
import type { UnifiedNode, NodeId } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { matchVerbPatterns, type EntitySpan } from '@/lib/relationships';
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
  constructor() {
    // this.graph = getGraph();
  }

  async extractFromNote(
    noteId: NodeId,
    content: string,
    threshold: number = 0.5
  ): Promise<NERExtractionResult> {
    console.warn('NERExtractor.extractFromNote: UnifiedGraph is removed. This is a stub.');
    return { entities: [], edgesCreated: 0, relationshipsCreated: 0, processingTime: 0 };
  }

  async extractFromNotes(
    noteIds: NodeId[],
    getContent: (noteId: string) => string
  ): Promise<NERExtractionResult> {
    return {
      entities: [],
      edgesCreated: 0,
      relationshipsCreated: 0,
      processingTime: 0,
    };
  }

  async reextractFromNote(noteId: NodeId, content: string): Promise<NERExtractionResult> {
    return { entities: [], edgesCreated: 0, relationshipsCreated: 0, processingTime: 0 };
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
