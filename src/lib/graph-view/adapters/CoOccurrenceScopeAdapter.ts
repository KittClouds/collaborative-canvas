import { cozoDb } from '@/lib/cozo/db';
import type { GraphData, GraphNode, GraphEdge, CoOccurrenceOptions } from '../types';
import { buildNodeVisual, buildEdgeVisual } from '../utils/styling';

interface NoteEntityRow {
  entityId: string;
  entityName: string;
  entityKind: string;
  mentionCount: number;
}

interface CoOccurrenceRow {
  sourceId: string;
  targetId: string;
  weight: number;
}

const DEFAULT_WINDOW_SIZE = 3;
const DEFAULT_MIN_WEIGHT = 1;

export class CoOccurrenceScopeAdapter {
  async build(noteId: string, options: CoOccurrenceOptions = {}): Promise<GraphData> {
    const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
    const minWeight = options.minWeight ?? DEFAULT_MIN_WEIGHT;

    const [entities, coOccurrences] = await Promise.all([
      this.queryNoteEntities(noteId),
      this.queryCoOccurrences(noteId, windowSize),
    ]);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const entityMap = new Map<string, NoteEntityRow>();
    for (const entity of entities) {
      entityMap.set(entity.entityId, entity);
    }

    for (const entity of entities) {
      if (options.minConfidence) {
        continue;
      }

      if (options.entityKinds && !options.entityKinds.includes(entity.entityKind)) {
        continue;
      }

      nodes.push({
        id: entity.entityId,
        type: 'concept',
        label: entity.entityName,
        scope: 'cooccurrence',
        metadata: {
          entityKind: entity.entityKind,
          frequency: entity.mentionCount,
        },
        visual: buildNodeVisual('concept', entity.entityKind, entity.mentionCount),
      });
    }

    for (const cooc of coOccurrences) {
      if (cooc.weight < minWeight) continue;

      const sourceExists = entityMap.has(cooc.sourceId);
      const targetExists = entityMap.has(cooc.targetId);

      if (sourceExists && targetExists) {
        edges.push({
          id: `cooc:${cooc.sourceId}:${cooc.targetId}`,
          source: cooc.sourceId,
          target: cooc.targetId,
          type: 'cooccurrence',
          scope: 'cooccurrence',
          weight: cooc.weight,
          visual: buildEdgeVisual('cooccurrence', cooc.weight),
        });
      }
    }

    if (options.calculatePMI && entities.length > 0) {
      await this.enrichWithPMI(edges, entityMap, noteId);
    }

    let finalNodes = nodes;
    if (options.maxNodes && nodes.length > options.maxNodes) {
      finalNodes = nodes
        .sort((a, b) => (b.metadata.frequency || 0) - (a.metadata.frequency || 0))
        .slice(0, options.maxNodes);

      const nodeIds = new Set(finalNodes.map(n => n.id));
      const filteredEdges = edges.filter(
        e => nodeIds.has(e.source) && nodeIds.has(e.target)
      );
      return this.buildGraphData(finalNodes, filteredEdges, noteId);
    }

    return this.buildGraphData(nodes, edges, noteId);
  }

  private async queryNoteEntities(noteId: string): Promise<NoteEntityRow[]> {
    const query = `
      entity_mentions[entity_id, entity_name, entity_kind, cnt] :=
        *episode{id: episode_id, note_id},
        note_id == $note_id,
        *mentions{episode_id, entity_id},
        *entity{id: entity_id, name: entity_name, entity_kind},
        cnt = count(entity_id)

      ?[entity_id, entity_name, entity_kind, cnt] := 
        entity_mentions[entity_id, entity_name, entity_kind, cnt]
    `;

    try {
      const result = cozoDb.runQuery(query, { note_id: noteId });
      if (!result.rows) return [];

      return result.rows.map((row: unknown[]) => ({
        entityId: row[0] as string,
        entityName: row[1] as string,
        entityKind: row[2] as string,
        mentionCount: row[3] as number,
      }));
    } catch (err) {
      console.error('[CoOccurrenceScopeAdapter] Failed to query note entities:', err);
      return [];
    }
  }

  private async queryCoOccurrences(noteId: string, windowSize: number): Promise<CoOccurrenceRow[]> {
    const query = `
      pairs[e1, e2, weight] :=
        *episode{id: episode_id, note_id},
        note_id == $note_id,
        *mentions{episode_id, entity_id: e1, sentence_index: s1},
        *mentions{episode_id, entity_id: e2, sentence_index: s2},
        e1 < e2,
        s1 != null,
        s2 != null,
        abs(s1 - s2) <= $window_size,
        weight = count(e1, e2)

      ?[source, target, weight] := pairs[source, target, weight]
    `;

    try {
      const result = cozoDb.runQuery(query, {
        note_id: noteId,
        window_size: windowSize,
      });

      if (!result.rows) return [];

      return result.rows.map((row: unknown[]) => ({
        sourceId: row[0] as string,
        targetId: row[1] as string,
        weight: row[2] as number,
      }));
    } catch (err) {
      console.error('[CoOccurrenceScopeAdapter] Failed to query co-occurrences:', err);
      return [];
    }
  }

  private async enrichWithPMI(
    edges: GraphEdge[],
    entityMap: Map<string, NoteEntityRow>,
    noteId: string
  ): Promise<void> {
    const totalMentions = Array.from(entityMap.values()).reduce(
      (sum, e) => sum + e.mentionCount,
      0
    );

    if (totalMentions === 0) return;

    for (const edge of edges) {
      const sourceEntity = entityMap.get(edge.source);
      const targetEntity = entityMap.get(edge.target);

      if (!sourceEntity || !targetEntity || !edge.weight) continue;

      const pAB = edge.weight / totalMentions;
      const pA = sourceEntity.mentionCount / totalMentions;
      const pB = targetEntity.mentionCount / totalMentions;

      if (pA > 0 && pB > 0 && pAB > 0) {
        const pmi = Math.log2(pAB / (pA * pB));
        edge.metadata = { ...edge.metadata, pmi };
      }
    }
  }

  private buildGraphData(nodes: GraphNode[], edges: GraphEdge[], noteId: string): GraphData {
    return {
      nodes,
      edges,
      scope: 'cooccurrence',
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        focusNodeId: noteId,
        scopeId: noteId,
        builtAt: Date.now(),
      },
    };
  }
}
