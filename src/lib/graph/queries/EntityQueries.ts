import { getGraph } from '@/lib/graph/graphInstance';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, NodeId } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';

export interface EntityMentionInfo {
  noteId: string;
  noteTitle: string;
  context: string;
  charPosition?: number;
  confidence: number;
  extractionMethod: 'regex' | 'ner' | 'llm' | 'manual';
}

export interface EntityWithMentions {
  entity: UnifiedNode;
  mentions: EntityMentionInfo[];
  totalMentions: number;
  noteIds: string[];
}

export class EntityQueries {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  getEntityMentions(entityId: NodeId): EntityMentionInfo[] {
    const cy = this.graph.getInstance();
    
    const mentionEdges = cy.edges().filter(edge => {
      const data = edge.data();
      return data.target === entityId && data.type === 'MENTIONS';
    });

    return mentionEdges.map(edge => {
      const edgeData = edge.data();
      const sourceNode = cy.getElementById(edgeData.source);

      return {
        noteId: edgeData.source,
        noteTitle: sourceNode.data('label') || 'Unknown',
        context: edgeData.context || '',
        charPosition: edgeData.charPosition,
        confidence: edgeData.confidence || 1.0,
        extractionMethod: edgeData.extractionMethod || 'manual',
      };
    }).toArray();
  }

  getEntityWithMentions(entityId: NodeId): EntityWithMentions | null {
    const entityNode = this.graph.getNode(entityId);
    if (!entityNode) return null;

    const mentions = this.getEntityMentions(entityId);
    const noteIds = [...new Set(mentions.map(m => m.noteId))];

    return {
      entity: entityNode,
      mentions,
      totalMentions: mentions.length,
      noteIds,
    };
  }

  getEntitiesInNote(noteId: NodeId): Array<{ entity: UnifiedNode; mentions: number }> {
    const cy = this.graph.getInstance();
    
    const mentionEdges = cy.edges().filter(edge => {
      const data = edge.data();
      return data.source === noteId && data.type === 'MENTIONS';
    });

    const entityMentions = new Map<string, number>();
    mentionEdges.forEach(edge => {
      const targetId = edge.data('target');
      entityMentions.set(targetId, (entityMentions.get(targetId) || 0) + 1);
    });

    return Array.from(entityMentions.entries())
      .map(([entityId, count]) => ({
        entity: this.graph.getNode(entityId)!,
        mentions: count,
      }))
      .filter(item => item.entity !== null);
  }

  getCoOccurringEntities(entityId: NodeId, minSharedNotes: number = 2): Array<{
    entity: UnifiedNode;
    sharedNotes: string[];
    coOccurrenceScore: number;
  }> {
    const cy = this.graph.getInstance();
    
    const entityNoteEdges = cy.edges().filter(edge => {
      const data = edge.data();
      return data.target === entityId && data.type === 'MENTIONS';
    });
    
    const entityNotes = new Set(entityNoteEdges.map(e => e.data('source')).toArray());

    const coOccurrences = new Map<string, Set<string>>();

    for (const noteId of entityNotes) {
      const noteEdges = cy.edges().filter(edge => {
        const data = edge.data();
        return data.source === noteId && data.type === 'MENTIONS';
      });
      
      const otherEntities = noteEdges
        .map(e => e.data('target'))
        .toArray()
        .filter(id => id !== entityId);

      for (const otherId of otherEntities) {
        if (!coOccurrences.has(otherId)) {
          coOccurrences.set(otherId, new Set());
        }
        coOccurrences.get(otherId)!.add(noteId);
      }
    }

    return Array.from(coOccurrences.entries())
      .filter(([_, notes]) => notes.size >= minSharedNotes)
      .map(([otherId, sharedNotes]) => ({
        entity: this.graph.getNode(otherId)!,
        sharedNotes: Array.from(sharedNotes),
        coOccurrenceScore: sharedNotes.size / entityNotes.size,
      }))
      .filter(item => item.entity !== null)
      .sort((a, b) => b.coOccurrenceScore - a.coOccurrenceScore);
  }

  getTopEntities(limit: number = 10): Array<{ 
    entity: UnifiedNode; 
    mentions: number; 
    noteCount: number 
  }> {
    const entities = this.graph.getNodesByType('ENTITY');
    const cy = this.graph.getInstance();

    return entities
      .map(entity => {
        const entityId = entity.data.id;
        const mentionEdges = cy.edges().filter(edge => {
          const data = edge.data();
          return data.target === entityId && data.type === 'MENTIONS';
        });
        
        const noteIds = new Set(mentionEdges.map(e => e.data('source')).toArray());

        return {
          entity,
          mentions: mentionEdges.length,
          noteCount: noteIds.size,
        };
      })
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, limit);
  }

  searchEntities(query: string, kind?: EntityKind): UnifiedNode[] {
    return this.graph.searchByLabel(query, {
      nodeTypes: ['ENTITY'],
      entityKinds: kind ? [kind] : undefined,
    });
  }

  getEntitiesByKind(kind: EntityKind): UnifiedNode[] {
    return this.graph.getEntitiesByKind(kind);
  }
}

let entityQueries: EntityQueries | null = null;

export function getEntityQueries(): EntityQueries {
  if (!entityQueries) {
    entityQueries = new EntityQueries();
  }
  return entityQueries;
}
