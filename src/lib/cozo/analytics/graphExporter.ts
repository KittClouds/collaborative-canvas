import { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import { cozoDb } from '../db';
import { mapRowToEntity, mapRowToEntityEdge } from '../types';
import type { EntityKind } from '@/lib/entities/entityTypes';

export async function exportGraphToUnified(groupId: string): Promise<UnifiedGraph> {
  const graph = new UnifiedGraph();

  const nodeQuery = `
    ?[id, name, kind, subtype, group, scope, created, method, summ, aliases, canon, freq, 
      degree, betweenness, closeness, comm, attrs, span, parts] :=
      *entity{id, name, entity_kind: kind, entity_subtype: subtype, group_id: group, 
              scope_type: scope, created_at: created, extraction_method: method, 
              summary: summ, aliases, canonical_note_id: canon, frequency: freq, 
              betweenness_centrality: betweenness, closeness_centrality: closeness, 
              community_id: comm, attributes: attrs, temporal_span: span, participants: parts},
      group == $group_id
  `;

  try {
    const nodeResult = cozoDb.runQuery(nodeQuery, { group_id: groupId });
    if (nodeResult.rows) {
      for (const row of nodeResult.rows) {
        const entity = mapRowToEntity(row);
        if (!graph.hasNode(entity.id)) {
          graph.createEntity(entity.name, entity.entityKind as EntityKind, {
            entitySubtype: entity.entitySubtype,
            attributes: {
              ...entity.attributes,
              degreeCentrality: entity.degreeCentrality,
              betweennessCentrality: entity.betweennessCentrality,
              closenessCentrality: entity.closenessCentrality,
              communityId: entity.communityId,
            },
            extraction: {
              method: entity.extractionMethod as 'regex' | 'ner' | 'llm' | 'manual',
              confidence: 1.0,
              mentions: [],
              frequency: entity.frequency || 1,
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to export nodes:', err);
    throw err;
  }

  const edgeQuery = `
    ?[id, source, target, created, valid, invalid, group, scope, type, fact, eps, notes, 
      weight, pmi, conf, methods] :=
      *entity_edge{id, source_id: source, target_id: target, created_at: created, 
                   valid_at: valid, invalid_at: invalid, group_id: group, scope_type: scope, 
                   edge_type: type, fact, episode_ids: eps, note_ids: notes, weight, 
                   pmi_score: pmi, confidence: conf, extraction_methods: methods},
      group == $group_id
  `;

  try {
    const edgeResult = cozoDb.runQuery(edgeQuery, { group_id: groupId });
    if (edgeResult.rows) {
      for (const row of edgeResult.rows) {
        const edge = mapRowToEntityEdge(row);
        
        if (graph.hasNode(edge.sourceId) && graph.hasNode(edge.targetId)) {
          graph.createRelationship(edge.sourceId, edge.targetId, edge.edgeType, {
            weight: edge.weight,
            pmi: edge.pmiScore,
            confidence: edge.confidence,
            noteIds: edge.noteIds,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to export edges:', err);
    throw err;
  }

  const stats = graph.getStats();
  console.log(`Exported graph: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
  return graph;
}
