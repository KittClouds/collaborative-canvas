export const ENTITY_EDGE_SCHEMA = `
:create entity_edge {
    id: Uuid,
    source_id: Uuid,
    target_id: Uuid,
    
    created_at: Float default now(),
    valid_at: Float default now(),
    invalid_at: Float? default null,
    
    group_id: String,
    scope_type: String default "note",
    
    edge_type: String default "CO_OCCURS",
    fact: String? default null,
    
    episode_ids: [Uuid] default [],
    note_ids: [Uuid] default [],
    
    weight: Int default 1,
    pmi_score: Float? default null,
    
    confidence: Float default 1.0,
    extraction_methods: [String] default ["regex"]
}
`;

export const ENTITY_EDGE_QUERIES = {
  upsert: `
    ?[id, source_id, target_id, created_at, valid_at, invalid_at,
      group_id, scope_type, edge_type, fact, episode_ids, note_ids,
      weight, pmi_score, confidence, extraction_methods] <- 
      [[$id, $source_id, $target_id, $created_at, $valid_at, $invalid_at,
        $group_id, $scope_type, $edge_type, $fact, $episode_ids, $note_ids,
        $weight, $pmi_score, $confidence, $extraction_methods]]
    :put entity_edge {
      id, source_id, target_id, created_at, valid_at, invalid_at,
      group_id, scope_type, edge_type, fact, episode_ids, note_ids,
      weight, pmi_score, confidence, extraction_methods
    }
  `,

  getById: `
    ?[id, source_id, target_id, created_at, valid_at, invalid_at,
      group_id, scope_type, edge_type, fact, episode_ids, note_ids,
      weight, pmi_score, confidence, extraction_methods] := 
      *entity_edge{id, source_id, target_id, created_at, valid_at, invalid_at,
        group_id, scope_type, edge_type, fact, episode_ids, note_ids,
        weight, pmi_score, confidence, extraction_methods},
      id == $id
  `,

  getByGroupId: `
    ?[id, source_id, target_id, edge_type, weight, pmi_score, confidence] := 
      *entity_edge{id, source_id, target_id, group_id, edge_type, weight, pmi_score, confidence},
      group_id == $group_id
  `,

  getBySourceId: `
    ?[id, target_id, edge_type, weight, fact, confidence] := 
      *entity_edge{id, source_id, target_id, edge_type, weight, fact, confidence},
      source_id == $source_id
  `,

  getByTargetId: `
    ?[id, source_id, edge_type, weight, fact, confidence] := 
      *entity_edge{id, source_id, target_id, edge_type, weight, fact, confidence},
      target_id == $target_id
  `,

  getConnectedEntities: `
    ?[connected_id, edge_type, weight, direction] := 
      *entity_edge{source_id, target_id, edge_type, weight},
      source_id == $entity_id,
      connected_id = target_id,
      direction = "outgoing"
    
    ?[connected_id, edge_type, weight, direction] := 
      *entity_edge{source_id, target_id, edge_type, weight},
      target_id == $entity_id,
      connected_id = source_id,
      direction = "incoming"
  `,

  getEdgeBetween: `
    ?[id, edge_type, weight, fact, confidence, note_ids] := 
      *entity_edge{id, source_id, target_id, edge_type, weight, fact, confidence, note_ids},
      ((source_id == $entity_a && target_id == $entity_b) || 
       (source_id == $entity_b && target_id == $entity_a))
  `,

  getByEdgeType: `
    ?[id, source_id, target_id, weight, fact, group_id] := 
      *entity_edge{id, source_id, target_id, edge_type, weight, fact, group_id},
      edge_type == $edge_type
  `,

  getCoOccurrenceEdges: `
    ?[id, source_id, target_id, weight, pmi_score, note_ids] := 
      *entity_edge{id, source_id, target_id, group_id, edge_type, weight, pmi_score, note_ids},
      group_id == $group_id,
      edge_type == "CO_OCCURS"
    :order -weight
  `,

  getTopEdgesByWeight: `
    ?[id, source_id, target_id, source_name, target_name, edge_type, weight] := 
      *entity_edge{id, source_id, target_id, group_id, edge_type, weight},
      *entity{id: source_id, name: source_name},
      *entity{id: target_id, name: target_name},
      group_id == $group_id
    :order -weight
    :limit $limit
  `,

  getTopEdgesByPMI: `
    ?[id, source_id, target_id, source_name, target_name, edge_type, weight, pmi_score] := 
      *entity_edge{id, source_id, target_id, group_id, edge_type, weight, pmi_score},
      *entity{id: source_id, name: source_name},
      *entity{id: target_id, name: target_name},
      group_id == $group_id,
      pmi_score != null
    :order -pmi_score
    :limit $limit
  `,

  incrementWeight: `
    ?[id, weight, episode_ids, note_ids] := 
      *entity_edge{id, weight: old_weight, episode_ids: old_episodes, note_ids: old_notes},
      id == $id,
      weight = old_weight + 1,
      episode_ids = union(old_episodes, [$episode_id]),
      note_ids = union(old_notes, [$note_id])
    :update entity_edge { id => weight, episode_ids, note_ids }
  `,

  updatePMI: `
    ?[id, pmi_score] <- [[$id, $pmi_score]]
    :update entity_edge { id => pmi_score }
  `,

  invalidateEdge: `
    ?[id, invalid_at] <- [[$id, now()]]
    :update entity_edge { id => invalid_at }
  `,

  delete: `
    ?[id] <- [[$id]]
    :rm entity_edge { id }
  `,

  deleteByGroupId: `
    ?[id] := 
      *entity_edge{id, group_id},
      group_id == $group_id
    :rm entity_edge { id }
  `,

  getActiveEdges: `
    ?[id, source_id, target_id, edge_type, weight, group_id] := 
      *entity_edge{id, source_id, target_id, edge_type, weight, group_id, invalid_at},
      group_id == $group_id,
      is_null(invalid_at)
  `,

  getGraphForVisualization: `
    ?[source_id, source_name, source_kind, target_id, target_name, target_kind, edge_type, weight] := 
      *entity_edge{source_id, target_id, group_id, edge_type, weight, invalid_at},
      *entity{id: source_id, name: source_name, entity_kind: source_kind},
      *entity{id: target_id, name: target_name, entity_kind: target_kind},
      group_id == $group_id,
      is_null(invalid_at)
  `,
};

export function getEdgeId(sourceId: string, targetId: string, edgeType: string): string {
  const orderedIds = sourceId < targetId ? `${sourceId}--${targetId}` : `${targetId}--${sourceId}`;
  return `${orderedIds}::${edgeType}`;
}
