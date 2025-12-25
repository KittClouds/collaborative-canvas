import Graph from 'graphology';
import { cozoDb } from '../db';
import { mapRowToEntity, mapRowToEntityEdge } from '../types';
import type { CozoEntity, CozoEntityEdge } from '../types';

export async function exportGraphToGraphology(groupId: string): Promise<Graph> {
  const graph = new Graph({ multi: true, type: 'directed' });

  // 1. Fetch Entities (Nodes)
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
          graph.addNode(entity.id, {
            ...entity,
            // Graphology attributes
            label: entity.name,
            size: entity.frequency || 1,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to export nodes:', err);
    throw err;
  }

  // 2. Fetch Edges
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
        
        // Ensure source/target exist (they should, but safety first)
        if (graph.hasNode(edge.sourceId) && graph.hasNode(edge.targetId)) {
          graph.addEdge(edge.sourceId, edge.targetId, {
            ...edge,
            weight: edge.weight,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to export edges:', err);
    throw err;
  }

  console.log(`Exported graph: ${graph.order} nodes, ${graph.size} edges`);
  return graph;
}
