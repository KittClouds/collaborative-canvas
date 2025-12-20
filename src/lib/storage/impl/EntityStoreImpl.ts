import { getGraph } from '@/lib/graph/graphInstance';
import { generateId } from '@/lib/utils/ids';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { EntityKind } from '@/lib/entities/entityTypes';
import type {
  IEntityStore,
  Entity,
  CreateEntityInput,
} from '../interfaces';

export class EntityStoreImpl implements IEntityStore {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  async upsertEntity(input: CreateEntityInput): Promise<Entity> {
    const name = input.name.trim();
    const existing = await this.findEntityByName(name, input.entity_kind, input.group_id);
    
    if (existing) {
      const newFrequency = existing.frequency + 1;
      await this.updateEntityFrequency(existing.id, newFrequency);
      return { ...existing, frequency: newFrequency };
    }

    const id = generateId();
    const created_at = Date.now();

    const node = this.graph.createEntity(name, input.entity_kind as EntityKind, {
      entitySubtype: input.entity_subtype,
      sourceNoteId: input.canonical_note_id,
      attributes: {
        ...input.attributes,
        group_id: input.group_id,
        scope_type: input.scope_type || 'note',
        extraction_method: 'ner',
        summary: input.summary,
        aliases: input.aliases || [],
        frequency: 1,
        participants: [],
      },
    });

    return {
      id: node.data.id,
      name,
      entity_kind: input.entity_kind,
      entity_subtype: input.entity_subtype,
      group_id: input.group_id,
      scope_type: input.scope_type || 'note',
      created_at,
      extraction_method: 'ner',
      summary: input.summary,
      aliases: input.aliases || [],
      canonical_note_id: input.canonical_note_id,
      frequency: 1,
      participants: [],
    };
  }

  async getEntityById(id: string): Promise<Entity | null> {
    const node = this.graph.getNode(id);
    if (!node || node.data.type !== 'ENTITY') {
      return null;
    }
    return this.nodeToEntity(node);
  }

  async findEntityByName(name: string, kind: string, groupId: string): Promise<Entity | null> {
    const normalizedName = name.trim().toLowerCase();
    const entities = this.graph.getEntitiesByKind(kind as EntityKind);
    
    for (const node of entities) {
      const attrs = node.data.attributes as Record<string, unknown> | undefined;
      const nodeGroupId = attrs?.group_id as string | undefined;
      
      if (nodeGroupId !== groupId) continue;
      
      if (node.data.label.toLowerCase() === normalizedName) {
        return this.nodeToEntity(node);
      }
      
      const aliases = (attrs?.aliases as string[]) || [];
      if (aliases.some(a => a.toLowerCase() === normalizedName)) {
        return this.nodeToEntity(node);
      }
    }
    
    return null;
  }

  async findEntityByNameOnly(name: string, groupId: string): Promise<Entity | null> {
    const normalizedName = name.trim().toLowerCase();
    const allNodes = this.graph.filterNodes(n => n.data.type === 'ENTITY');
    
    for (const node of allNodes) {
      const attrs = node.data.attributes as Record<string, unknown> | undefined;
      const nodeGroupId = attrs?.group_id as string | undefined;
      
      if (nodeGroupId !== groupId) continue;
      
      if (node.data.label.toLowerCase() === normalizedName) {
        return this.nodeToEntity(node);
      }
    }
    
    return null;
  }

  async deleteEntity(id: string): Promise<void> {
    this.graph.removeNode(id);
  }

  async getEntitiesByKind(kind: string, groupId: string): Promise<Entity[]> {
    const nodes = this.graph.getEntitiesByKind(kind as EntityKind);
    return nodes
      .filter(node => {
        const attrs = node.data.attributes as Record<string, unknown> | undefined;
        return attrs?.group_id === groupId;
      })
      .map(node => this.nodeToEntity(node));
  }

  async getAllEntities(groupId: string): Promise<Entity[]> {
    const allNodes = this.graph.filterNodes(n => n.data.type === 'ENTITY');
    return allNodes
      .filter(node => {
        const attrs = node.data.attributes as Record<string, unknown> | undefined;
        return attrs?.group_id === groupId;
      })
      .map(node => this.nodeToEntity(node));
  }

  async updateEntityFrequency(id: string, frequency: number): Promise<void> {
    const node = this.graph.getNode(id);
    if (!node) return;
    
    const attrs = (node.data.attributes as Record<string, unknown>) || {};
    this.graph.updateNode(id, {
      attributes: { ...attrs, frequency },
    });
  }

  private nodeToEntity(node: ReturnType<UnifiedGraph['getNode']>): Entity {
    if (!node) {
      throw new Error('Node is null');
    }
    
    const attrs = (node.data.attributes as Record<string, unknown>) || {};
    
    return {
      id: node.data.id,
      name: node.data.label,
      entity_kind: node.data.entityKind || 'CONCEPT',
      entity_subtype: node.data.entitySubtype,
      group_id: (attrs.group_id as string) || '',
      scope_type: (attrs.scope_type as string) || 'note',
      created_at: node.data.createdAt || Date.now(),
      extraction_method: (attrs.extraction_method as string) || 'ner',
      summary: attrs.summary as string | undefined,
      aliases: (attrs.aliases as string[]) || [],
      canonical_note_id: node.data.sourceNoteId,
      frequency: (attrs.frequency as number) || 1,
      degree_centrality: attrs.degree_centrality as number | undefined,
      betweenness_centrality: attrs.betweenness_centrality as number | undefined,
      closeness_centrality: attrs.closeness_centrality as number | undefined,
      community_id: attrs.community_id as string | undefined,
      attributes: attrs,
      temporal_span: attrs.temporal_span,
      participants: (attrs.participants as string[]) || [],
    };
  }
}

let entityStoreInstance: EntityStoreImpl | null = null;

export function getEntityStoreImpl(): EntityStoreImpl {
  if (!entityStoreInstance) {
    entityStoreInstance = new EntityStoreImpl();
  }
  return entityStoreInstance;
}

export function resetEntityStore(): void {
  entityStoreInstance = null;
}
