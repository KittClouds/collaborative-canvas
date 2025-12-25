export const LAYER1_INDICES = `
// Layer 1 indices (notes, folders, etc.) are now managed exclusively by SQLite.
`;

export const LAYER2_INDICES = `
:create episode:note { note_id: Uuid => episode_id: Uuid }
:create episode:group { group_id: String => episode_id: Uuid }
:create episode:scope { scope_type: String, group_id: String => episode_id: Uuid }

:create entity:name_group { name: String, group_id: String, entity_kind: String => entity_id: Uuid }
:create entity:kind { entity_kind: String, scope_type: String => entity_id: Uuid }
:create entity:canonical { canonical_note_id: Uuid? => entity_id: Uuid }
:create entity:community { community_id: String?, group_id: String => entity_id: Uuid }

:create entity_edge:source { source_id: Uuid => edge_id: Uuid }
:create entity_edge:target { target_id: Uuid => edge_id: Uuid }
:create entity_edge:scope { group_id: String => edge_id: Uuid }
:create entity_edge:type { edge_type: String, group_id: String => edge_id: Uuid }

:create mentions:episode { episode_id: Uuid => mention_id: Uuid }
:create mentions:entity { entity_id: Uuid => mention_id: Uuid }

:create narrative_hierarchy:parent { parent_id: Uuid, child_kind: String => hierarchy_id: Uuid }
:create narrative_hierarchy:child { child_id: Uuid => hierarchy_id: Uuid }

:create temporal_point:entity { entity_id: Uuid => temporal_id: Uuid }
:create temporal_point:chapter_scene { chapter: Int?, scene: Int? => temporal_id: Uuid }
`;

export const ALL_INDICES = `
${LAYER2_INDICES}
`;

export const INDEX_QUERIES = {
  rebuildEntityIndices: `
    ?[name, group_id, entity_kind, entity_id] := 
      *entity{id: entity_id, name, group_id, entity_kind}
    :replace entity:name_group { name, group_id, entity_kind => entity_id }
    
    ?[entity_kind, scope_type, entity_id] := 
      *entity{id: entity_id, entity_kind, scope_type}
    :replace entity:kind { entity_kind, scope_type => entity_id }
    
    ?[canonical_note_id, entity_id] := 
      *entity{id: entity_id, canonical_note_id}
    :replace entity:canonical { canonical_note_id => entity_id }
    
    ?[community_id, group_id, entity_id] := 
      *entity{id: entity_id, community_id, group_id}
    :replace entity:community { community_id, group_id => entity_id }
  `,

  rebuildEdgeIndices: `
    ?[source_id, edge_id] := *entity_edge{id: edge_id, source_id}
    :replace entity_edge:source { source_id => edge_id }
    
    ?[target_id, edge_id] := *entity_edge{id: edge_id, target_id}
    :replace entity_edge:target { target_id => edge_id }
    
    ?[group_id, edge_id] := *entity_edge{id: edge_id, group_id}
    :replace entity_edge:scope { group_id => edge_id }
    
    ?[edge_type, group_id, edge_id] := *entity_edge{id: edge_id, edge_type, group_id}
    :replace entity_edge:type { edge_type, group_id => edge_id }
  `,

  rebuildAllIndices: `
    ?[name, group_id, entity_kind, entity_id] := 
      *entity{id: entity_id, name, group_id, entity_kind}
    :replace entity:name_group { name, group_id, entity_kind => entity_id }
    
    ?[source_id, edge_id] := *entity_edge{id: edge_id, source_id}
    :replace entity_edge:source { source_id => edge_id }
    
    ?[target_id, edge_id] := *entity_edge{id: edge_id, target_id}
    :replace entity_edge:target { target_id => edge_id }
  `,
};
