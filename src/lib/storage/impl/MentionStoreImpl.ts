import { getGraph } from '@/lib/graph/graphInstance';
import { generateId } from '@/lib/utils/ids';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type {
  IMentionStore,
  Mention,
  CreateMentionInput,
} from '../interfaces';

export class MentionStoreImpl implements IMentionStore {
  private graph: UnifiedGraph;
  private mentions: Map<string, Mention> = new Map();
  private byNoteId: Map<string, Set<string>> = new Map();
  private byEntityId: Map<string, Set<string>> = new Map();

  constructor() {
    this.graph = getGraph();
  }

  async createMention(input: CreateMentionInput): Promise<Mention> {
    const id = generateId();
    const created_at = Date.now();
    const entity_id = input.entity_id || generateId();

    const mention: Mention = {
      id,
      episode_id: input.episode_id,
      entity_id,
      context: input.context,
      char_position: input.char_position,
      sentence_index: input.sentence_index,
      confidence: input.confidence ?? 1.0,
      extraction_method: input.extraction_method || 'ner',
      created_at,
      status: input.status,
      resolved_entity_id: input.resolved_entity_id,
    };

    this.mentions.set(id, mention);
    
    if (!this.byEntityId.has(entity_id)) {
      this.byEntityId.set(entity_id, new Set());
    }
    this.byEntityId.get(entity_id)!.add(id);

    return mention;
  }

  async getMentionById(id: string): Promise<Mention | null> {
    return this.mentions.get(id) || null;
  }

  async getMentionsByNoteId(noteId: string): Promise<Mention[]> {
    const cy = this.graph.getInstance();
    const mentionEdges = cy.edges().filter(edge => {
      const data = edge.data();
      return data.source === noteId && data.type === 'MENTIONS';
    });

    return mentionEdges.map(edge => {
      const data = edge.data();
      return {
        id: data.id,
        episode_id: noteId,
        entity_id: data.target,
        context: data.context || '',
        char_position: data.charPosition || 0,
        sentence_index: null,
        confidence: data.confidence || 1.0,
        extraction_method: data.extractionMethod || 'ner',
        created_at: data.createdAt || Date.now(),
      };
    }).toArray();
  }

  async getMentionsByEntityId(entityId: string): Promise<Mention[]> {
    const mentionIds = this.byEntityId.get(entityId);
    if (!mentionIds) {
      const cy = this.graph.getInstance();
      const mentionEdges = cy.edges().filter(edge => {
        const data = edge.data();
        return data.target === entityId && data.type === 'MENTIONS';
      });

      return mentionEdges.map(edge => {
        const data = edge.data();
        return {
          id: data.id,
          episode_id: data.source,
          entity_id: entityId,
          context: data.context || '',
          char_position: data.charPosition || 0,
          sentence_index: null,
          confidence: data.confidence || 1.0,
          extraction_method: data.extractionMethod || 'ner',
          created_at: data.createdAt || Date.now(),
        };
      }).toArray();
    }
    
    return Array.from(mentionIds)
      .map(id => this.mentions.get(id))
      .filter((m): m is Mention => m !== undefined);
  }

  async updateMentionStatus(
    id: string,
    status: 'pending' | 'accepted' | 'rejected',
    resolvedEntityId?: string
  ): Promise<void> {
    const mention = this.mentions.get(id);
    if (!mention) return;

    mention.status = status;
    if (resolvedEntityId) {
      if (mention.entity_id !== resolvedEntityId) {
        this.byEntityId.get(mention.entity_id)?.delete(id);
        
        if (!this.byEntityId.has(resolvedEntityId)) {
          this.byEntityId.set(resolvedEntityId, new Set());
        }
        this.byEntityId.get(resolvedEntityId)!.add(id);
      }
      mention.resolved_entity_id = resolvedEntityId;
      mention.entity_id = resolvedEntityId;
    }
  }

  async deleteMention(id: string): Promise<void> {
    const mention = this.mentions.get(id);
    if (!mention) return;

    this.byEntityId.get(mention.entity_id)?.delete(id);
    this.mentions.delete(id);
  }
}

let mentionStoreInstance: MentionStoreImpl | null = null;

export function getMentionStoreImpl(): MentionStoreImpl {
  if (!mentionStoreInstance) {
    mentionStoreInstance = new MentionStoreImpl();
  }
  return mentionStoreInstance;
}

export function resetMentionStore(): void {
  mentionStoreInstance = null;
}
