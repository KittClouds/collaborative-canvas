import { getGraph } from '@/lib/graph/graphInstance';
import { generateId } from '@/lib/utils/ids';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedEdge } from '@/lib/graph/types';
import type {
  IEdgeStore,
  EntityEdge,
  CreateEdgeInput,
} from '../interfaces';

export class EdgeStoreImpl implements IEdgeStore {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  async createEdge(input: CreateEdgeInput): Promise<EntityEdge> {
    const id = generateId();
    const created_at = Date.now();
    const valid_at = Date.now();

    const edge = this.graph.addEdge({
      source: input.source_id,
      target: input.target_id,
      type: input.edge_type || 'RELATED_TO',
      weight: 1,
      confidence: input.confidence ?? 1.0,
      context: undefined,
      attributes: {
        group_id: input.group_id,
        scope_type: input.scope_type || 'note',
        episode_ids: input.episode_id ? [input.episode_id] : [],
        note_ids: input.note_id ? [input.note_id] : [],
        extraction_methods: [],
        valid_at,
        invalid_at: null,
        fact: null,
        pmi_score: null,
      },
    });

    return {
      id: edge.data.id,
      source_id: input.source_id,
      target_id: input.target_id,
      created_at,
      valid_at,
      invalid_at: null,
      group_id: input.group_id,
      scope_type: input.scope_type || 'note',
      edge_type: input.edge_type || 'RELATED_TO',
      fact: null,
      episode_ids: input.episode_id ? [input.episode_id] : [],
      note_ids: input.note_id ? [input.note_id] : [],
      weight: 1,
      pmi_score: null,
      confidence: input.confidence ?? 1.0,
      extraction_methods: [],
    };
  }

  async createMentionEdge(input: CreateEdgeInput): Promise<EntityEdge> {
    const id = generateId();
    const created_at = Date.now();
    const valid_at = Date.now();

    const edge = this.graph.addEdge({
      source: input.source_id,
      target: input.target_id,
      type: 'MENTIONS',
      weight: 1,
      confidence: input.confidence ?? 1.0,
      context: undefined,
      extractionMethod: 'ner',
      attributes: {
        group_id: input.group_id,
        scope_type: input.scope_type || 'note',
        episode_ids: input.episode_id ? [input.episode_id] : [],
        note_ids: input.note_id ? [input.note_id] : [],
        extraction_methods: ['ner'],
        valid_at,
        invalid_at: null,
        fact: null,
        pmi_score: null,
      },
    });

    return {
      id: edge.data.id,
      source_id: input.source_id,
      target_id: input.target_id,
      created_at,
      valid_at,
      invalid_at: null,
      group_id: input.group_id,
      scope_type: input.scope_type || 'note',
      edge_type: 'MENTIONS',
      fact: null,
      episode_ids: input.episode_id ? [input.episode_id] : [],
      note_ids: input.note_id ? [input.note_id] : [],
      weight: 1,
      pmi_score: null,
      confidence: input.confidence ?? 1.0,
      extraction_methods: ['ner'],
    };
  }

  async getEdgeById(id: string): Promise<EntityEdge | null> {
    const edge = this.graph.getEdge(id);
    if (!edge) return null;
    return this.edgeToEntityEdge(edge);
  }

  async getEdgesBySourceId(sourceId: string): Promise<EntityEdge[]> {
    const cy = this.graph.getInstance();
    const edges = cy.edges().filter(e => e.data('source') === sourceId);
    return edges.map(e => this.cyEdgeToEntityEdge(e)).toArray();
  }

  async getEdgesByTargetId(targetId: string): Promise<EntityEdge[]> {
    const cy = this.graph.getInstance();
    const edges = cy.edges().filter(e => e.data('target') === targetId);
    return edges.map(e => this.cyEdgeToEntityEdge(e)).toArray();
  }

  async getEdgesBetween(sourceId: string, targetId: string): Promise<EntityEdge[]> {
    const edges = this.graph.getEdgesBetween(sourceId, targetId);
    return edges.map(e => this.edgeToEntityEdge(e));
  }

  async deleteEdge(id: string): Promise<void> {
    this.graph.removeEdge(id);
  }

  async getAllEdges(groupId?: string): Promise<EntityEdge[]> {
    const cy = this.graph.getInstance();
    let edges = cy.edges();
    
    if (groupId) {
      edges = edges.filter(e => {
        const attrs = e.data('attributes') as Record<string, unknown> | undefined;
        return attrs?.group_id === groupId;
      });
    }
    
    return edges.map(e => this.cyEdgeToEntityEdge(e)).toArray();
  }

  private edgeToEntityEdge(edge: UnifiedEdge): EntityEdge {
    const attrs = (edge.data.attributes as Record<string, unknown>) || {};
    
    return {
      id: edge.data.id,
      source_id: edge.data.source,
      target_id: edge.data.target,
      created_at: edge.data.createdAt || Date.now(),
      valid_at: (attrs.valid_at as number) || Date.now(),
      invalid_at: attrs.invalid_at as number | null,
      group_id: (attrs.group_id as string) || '',
      scope_type: (attrs.scope_type as string) || 'note',
      edge_type: edge.data.type || 'RELATED_TO',
      fact: attrs.fact as string | null,
      episode_ids: (attrs.episode_ids as string[]) || [],
      note_ids: (attrs.note_ids as string[]) || [],
      weight: edge.data.weight || 1,
      pmi_score: attrs.pmi_score as number | null,
      confidence: edge.data.confidence || 1.0,
      extraction_methods: (attrs.extraction_methods as string[]) || [],
    };
  }

  private cyEdgeToEntityEdge(cyEdge: cytoscape.EdgeSingular): EntityEdge {
    const data = cyEdge.data();
    const attrs = (data.attributes as Record<string, unknown>) || {};
    
    return {
      id: data.id,
      source_id: data.source,
      target_id: data.target,
      created_at: data.createdAt || Date.now(),
      valid_at: (attrs.valid_at as number) || Date.now(),
      invalid_at: attrs.invalid_at as number | null,
      group_id: (attrs.group_id as string) || '',
      scope_type: (attrs.scope_type as string) || 'note',
      edge_type: data.type || 'RELATED_TO',
      fact: attrs.fact as string | null,
      episode_ids: (attrs.episode_ids as string[]) || [],
      note_ids: (attrs.note_ids as string[]) || [],
      weight: data.weight || 1,
      pmi_score: attrs.pmi_score as number | null,
      confidence: data.confidence || 1.0,
      extraction_methods: (attrs.extraction_methods as string[]) || [],
    };
  }
}

let edgeStoreInstance: EdgeStoreImpl | null = null;

export function getEdgeStoreImpl(): EdgeStoreImpl {
  if (!edgeStoreInstance) {
    edgeStoreInstance = new EdgeStoreImpl();
  }
  return edgeStoreInstance;
}

export function resetEdgeStore(): void {
  edgeStoreInstance = null;
}
