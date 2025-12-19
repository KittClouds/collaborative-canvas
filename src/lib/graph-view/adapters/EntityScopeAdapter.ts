import { cozoDb } from '@/lib/cozo/db';
import type { GraphData, GraphNode, GraphEdge, AdapterOptions } from '../types';
import { buildNodeVisual, buildEdgeVisual } from '../utils/styling';

interface EntityRow {
  id: string;
  name: string;
  entityKind: string;
  entitySubtype: string | null;
  frequency: number;
  confidence: number;
  degreeCentrality: number | null;
  canonicalNoteId: string | null;
  extractionMethod: string;
  blueprintTypeId: string | null;
}

interface EntityEdgeRow {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  weight: number;
  confidence: number;
}

interface CanonicalNoteRow {
  id: string;
  title: string;
  entityKind: string;
  entitySubtype: string | null;
  entityLabel: string | null;
}

interface BlueprintTypeRow {
  entityTypeId: string;
  entityKind: string;
  displayName: string;
  color: string | null;
  icon: string | null;
}

export class EntityScopeAdapter {
  async build(options: AdapterOptions = {}): Promise<GraphData> {
    const [entities, edges, canonicalNotes, blueprintTypes] = await Promise.all([
      this.queryEntities(options),
      this.queryEntityEdges(),
      this.queryCanonicalNotes(),
      this.queryBlueprintTypes(),
    ]);

    const nodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];
    const entityNoteMap = new Map<string, string>();

    for (const bp of blueprintTypes) {
      nodes.push({
        id: `blueprint:${bp.entityTypeId}`,
        type: 'blueprint',
        label: bp.displayName,
        scope: 'entity',
        metadata: {
          entityKind: bp.entityKind,
          blueprintTypeId: bp.entityTypeId,
        },
        visual: {
          ...buildNodeVisual('blueprint', bp.entityKind),
          color: bp.color || buildNodeVisual('blueprint', bp.entityKind).color,
        },
      });
    }

    for (const entity of entities) {
      if (options.minConfidence && entity.confidence < options.minConfidence) {
        continue;
      }

      if (options.entityKinds && !options.entityKinds.includes(entity.entityKind)) {
        continue;
      }

      nodes.push({
        id: entity.id,
        type: 'entity',
        label: entity.name,
        scope: 'entity',
        metadata: {
          entityKind: entity.entityKind,
          entitySubtype: entity.entitySubtype || undefined,
          confidence: entity.confidence,
          frequency: entity.frequency,
          extractionMethod: entity.extractionMethod,
          blueprintTypeId: entity.blueprintTypeId || undefined,
        },
        visual: buildNodeVisual(
          'entity',
          entity.entityKind,
          entity.frequency,
          entity.degreeCentrality || undefined,
          entity.confidence
        ),
      });

      if (entity.canonicalNoteId) {
        entityNoteMap.set(entity.id, entity.canonicalNoteId);
      }

      if (entity.blueprintTypeId) {
        graphEdges.push({
          id: `bp-link:${entity.id}:${entity.blueprintTypeId}`,
          source: `blueprint:${entity.blueprintTypeId}`,
          target: entity.id,
          type: 'contains',
          scope: 'entity',
          visual: buildEdgeVisual('contains'),
        });
      }
    }

    for (const note of canonicalNotes) {
      const existingEntity = nodes.find(n =>
        n.type === 'entity' &&
        entityNoteMap.get(n.id) === note.id
      );

      if (!existingEntity) {
        nodes.push({
          id: note.id,
          type: 'note',
          label: note.title,
          scope: 'entity',
          metadata: {
            entityKind: note.entityKind,
            entitySubtype: note.entitySubtype || undefined,
            isCanonical: true,
            isTyped: true,
          },
          visual: buildNodeVisual('note', note.entityKind),
        });
      }
    }

    for (const edge of edges) {
      const sourceExists = nodes.some(n => n.id === edge.sourceId);
      const targetExists = nodes.some(n => n.id === edge.targetId);

      if (sourceExists && targetExists) {
        graphEdges.push({
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          type: 'relationship',
          scope: 'entity',
          weight: edge.weight,
          confidence: edge.confidence,
          label: edge.edgeType,
          visual: buildEdgeVisual('relationship', edge.weight, edge.confidence),
        });
      }
    }

    for (const [entityId, noteId] of entityNoteMap) {
      const noteExists = nodes.some(n => n.id === noteId);
      if (noteExists) {
        graphEdges.push({
          id: `canonical:${entityId}:${noteId}`,
          source: entityId,
          target: noteId,
          type: 'contains',
          scope: 'entity',
          visual: buildEdgeVisual('contains'),
        });
      }
    }

    let finalNodes = nodes;
    if (options.maxNodes && nodes.length > options.maxNodes) {
      finalNodes = nodes
        .sort((a, b) => (b.metadata.frequency || 0) - (a.metadata.frequency || 0))
        .slice(0, options.maxNodes);
      
      const nodeIds = new Set(finalNodes.map(n => n.id));
      const filteredEdges = graphEdges.filter(
        e => nodeIds.has(e.source) && nodeIds.has(e.target)
      );
      return this.buildGraphData(finalNodes, filteredEdges);
    }

    return this.buildGraphData(finalNodes, graphEdges);
  }

  async updateEntity(entityId: string): Promise<GraphNode | null> {
    const query = `
      ?[id, name, entity_kind, entity_subtype, frequency, confidence, 
        degree_centrality, canonical_note_id, extraction_method, blueprint_type_id] := 
        *entity{id, name, entity_kind, entity_subtype, frequency, confidence,
          degree_centrality, canonical_note_id, extraction_method, blueprint_type_id},
        id == $id
    `;

    try {
      const result = cozoDb.runQuery(query, { id: entityId });
      if (!result.rows || result.rows.length === 0) return null;

      const entity = this.parseEntityRow(result.rows[0] as unknown[]);

      return {
        id: entity.id,
        type: 'entity',
        label: entity.name,
        scope: 'entity',
        metadata: {
          entityKind: entity.entityKind,
          entitySubtype: entity.entitySubtype || undefined,
          confidence: entity.confidence,
          frequency: entity.frequency,
          extractionMethod: entity.extractionMethod,
          blueprintTypeId: entity.blueprintTypeId || undefined,
        },
        visual: buildNodeVisual(
          'entity',
          entity.entityKind,
          entity.frequency,
          entity.degreeCentrality || undefined,
          entity.confidence
        ),
      };
    } catch (err) {
      console.error('[EntityScopeAdapter] Failed to update entity:', err);
      return null;
    }
  }

  async getRelationshipsForEntity(entityId: string): Promise<GraphEdge[]> {
    const query = `
      ?[id, source_id, target_id, edge_type, weight, confidence] := 
        *entity_edge{id, source_id, target_id, edge_type, weight, confidence},
        or(source_id == $entity_id, target_id == $entity_id)
    `;

    try {
      const result = cozoDb.runQuery(query, { entity_id: entityId });
      if (!result.rows) return [];

      return result.rows.map((row: unknown[]) => {
        const edge = this.parseEdgeRow(row);
        return {
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          type: 'relationship' as const,
          scope: 'entity' as const,
          weight: edge.weight,
          confidence: edge.confidence,
          label: edge.edgeType,
          visual: buildEdgeVisual('relationship', edge.weight, edge.confidence),
        };
      });
    } catch (err) {
      console.error('[EntityScopeAdapter] Failed to get relationships:', err);
      return [];
    }
  }

  private async queryEntities(options: AdapterOptions): Promise<EntityRow[]> {
    const query = `
      ?[id, name, entity_kind, entity_subtype, frequency, confidence, 
        degree_centrality, canonical_note_id, extraction_method, blueprint_type_id] := 
        *entity{id, name, entity_kind, entity_subtype, frequency, confidence,
          degree_centrality, canonical_note_id, extraction_method, blueprint_type_id}
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return [];
      return result.rows.map((row: unknown[]) => this.parseEntityRow(row));
    } catch (err) {
      console.error('[EntityScopeAdapter] Failed to query entities:', err);
      return [];
    }
  }

  private async queryEntityEdges(): Promise<EntityEdgeRow[]> {
    const query = `
      ?[id, source_id, target_id, edge_type, weight, confidence] := 
        *entity_edge{id, source_id, target_id, edge_type, weight, confidence}
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return [];
      return result.rows.map((row: unknown[]) => this.parseEdgeRow(row));
    } catch (err) {
      console.error('[EntityScopeAdapter] Failed to query entity edges:', err);
      return [];
    }
  }

  private async queryCanonicalNotes(): Promise<CanonicalNoteRow[]> {
    const query = `
      ?[id, title, entity_kind, entity_subtype, entity_label] := 
        *note{id, title, entity_kind, entity_subtype, entity_label, is_canonical_entity},
        is_canonical_entity == true
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return [];
      return result.rows.map((row: unknown[]) => ({
        id: row[0] as string,
        title: row[1] as string,
        entityKind: row[2] as string,
        entitySubtype: row[3] as string | null,
        entityLabel: row[4] as string | null,
      }));
    } catch (err) {
      console.error('[EntityScopeAdapter] Failed to query canonical notes:', err);
      return [];
    }
  }

  private async queryBlueprintTypes(): Promise<BlueprintTypeRow[]> {
    const query = `
      ?[entity_type_id, entity_kind, display_name, color, icon] := 
        *blueprint_entity_type{entity_type_id, entity_kind, display_name, color, icon}
    `;

    try {
      const result = cozoDb.runQuery(query);
      if (!result.rows) return [];
      return result.rows.map((row: unknown[]) => ({
        entityTypeId: row[0] as string,
        entityKind: row[1] as string,
        displayName: row[2] as string,
        color: row[3] as string | null,
        icon: row[4] as string | null,
      }));
    } catch (err) {
      console.error('[EntityScopeAdapter] Failed to query blueprint types:', err);
      return [];
    }
  }

  private parseEntityRow(row: unknown[]): EntityRow {
    return {
      id: row[0] as string,
      name: row[1] as string,
      entityKind: row[2] as string,
      entitySubtype: row[3] as string | null,
      frequency: row[4] as number,
      confidence: row[5] as number,
      degreeCentrality: row[6] as number | null,
      canonicalNoteId: row[7] as string | null,
      extractionMethod: row[8] as string,
      blueprintTypeId: row[9] as string | null,
    };
  }

  private parseEdgeRow(row: unknown[]): EntityEdgeRow {
    return {
      id: row[0] as string,
      sourceId: row[1] as string,
      targetId: row[2] as string,
      edgeType: row[3] as string,
      weight: row[4] as number,
      confidence: row[5] as number,
    };
  }

  private buildGraphData(nodes: GraphNode[], edges: GraphEdge[]): GraphData {
    return {
      nodes,
      edges,
      scope: 'entity',
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        builtAt: Date.now(),
      },
    };
  }
}
