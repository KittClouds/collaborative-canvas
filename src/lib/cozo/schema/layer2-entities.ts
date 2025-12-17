export const ENTITY_KINDS = [
  'CHARACTER',
  'LOCATION',
  'NPC',
  'ITEM',
  'FACTION',
  'SCENE',
  'EVENT',
  'CONCEPT',
  'ARC',
  'ACT',
  'CHAPTER',
  'BEAT',
  'TIMELINE',
  'NARRATIVE',
] as const;

export type CozoEntityKind = typeof ENTITY_KINDS[number];

export const ENTITY_SCHEMA = `
:create entity {
    id: Uuid,
    
    name: String,
    entity_kind: String,
    entity_subtype: String? default null,
    
    group_id: String,
    scope_type: String default "note",
    
    created_at: Float default now(),
    extraction_method: String default "regex",
    summary: String? default null,
    aliases: [String] default [],
    
    canonical_note_id: Uuid? default null,
    
    frequency: Int default 1,
    degree_centrality: Float? default null,
    betweenness_centrality: Float? default null,
    closeness_centrality: Float? default null,
    community_id: String? default null,
    
    attributes: Json? default null,
    
    temporal_span: Json? default null,
    participants: [Uuid] default []
}
`;

export const ENTITY_QUERIES = {
  upsert: `
    ?[id, name, entity_kind, entity_subtype, group_id, scope_type, created_at,
      extraction_method, summary, aliases, canonical_note_id, frequency,
      degree_centrality, betweenness_centrality, closeness_centrality, community_id,
      attributes, temporal_span, participants] <- 
      [[$id, $name, $entity_kind, $entity_subtype, $group_id, $scope_type, $created_at,
        $extraction_method, $summary, $aliases, $canonical_note_id, $frequency,
        $degree_centrality, $betweenness_centrality, $closeness_centrality, $community_id,
        $attributes, $temporal_span, $participants]]
    :put entity {
      id, name, entity_kind, entity_subtype, group_id, scope_type, created_at,
      extraction_method, summary, aliases, canonical_note_id, frequency,
      degree_centrality, betweenness_centrality, closeness_centrality, community_id,
      attributes, temporal_span, participants
    }
  `,

  getById: `
    ?[id, name, entity_kind, entity_subtype, group_id, scope_type, created_at,
      extraction_method, summary, aliases, canonical_note_id, frequency,
      degree_centrality, betweenness_centrality, closeness_centrality, community_id,
      attributes, temporal_span, participants] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, scope_type, created_at,
        extraction_method, summary, aliases, canonical_note_id, frequency,
        degree_centrality, betweenness_centrality, closeness_centrality, community_id,
        attributes, temporal_span, participants},
      id == $id
  `,

  getByGroupId: `
    ?[id, name, entity_kind, entity_subtype, frequency, community_id, attributes] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, frequency, community_id, attributes},
      group_id == $group_id
  `,

  getByKind: `
    ?[id, name, entity_subtype, group_id, frequency, canonical_note_id] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, frequency, canonical_note_id},
      entity_kind == $kind
  `,

  getByKindAndScope: `
    ?[id, name, entity_subtype, frequency, canonical_note_id, attributes] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, scope_type, frequency, canonical_note_id, attributes},
      entity_kind == $kind,
      scope_type == $scope_type
  `,

  findByName: `
    ?[id, name, entity_kind, entity_subtype, group_id, frequency] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, frequency},
      name == $name,
      group_id == $group_id
  `,

  findByNameAndKind: `
    ?[id, name, entity_subtype, group_id, frequency, canonical_note_id] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, frequency, canonical_note_id},
      name == $name,
      entity_kind == $kind,
      group_id == $group_id
  `,

  searchByName: `
    ?[id, name, entity_kind, entity_subtype, group_id, frequency] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, frequency},
      contains(lowercase(name), lowercase($query))
  `,

  getWithCanonicalNote: `
    ?[id, name, entity_kind, canonical_note_id, note_title] := 
      *entity{id, name, entity_kind, canonical_note_id},
      canonical_note_id != null,
      *note{id: canonical_note_id, title: note_title}
  `,

  getByCommunity: `
    ?[id, name, entity_kind, frequency, degree_centrality] := 
      *entity{id, name, entity_kind, frequency, degree_centrality, community_id},
      community_id == $community_id
    :order -frequency
  `,

  getTopByFrequency: `
    ?[id, name, entity_kind, frequency, group_id] := 
      *entity{id, name, entity_kind, frequency, group_id},
      group_id == $group_id
    :order -frequency
    :limit $limit
  `,

  getTopByCentrality: `
    ?[id, name, entity_kind, degree_centrality, betweenness_centrality, group_id] := 
      *entity{id, name, entity_kind, degree_centrality, betweenness_centrality, group_id},
      group_id == $group_id,
      degree_centrality != null
    :order -degree_centrality
    :limit $limit
  `,

  updateFrequency: `
    ?[id, frequency] <- [[$id, $frequency]]
    :update entity { id => frequency }
  `,

  updateCentrality: `
    ?[id, degree_centrality, betweenness_centrality, closeness_centrality] <- 
      [[$id, $degree_centrality, $betweenness_centrality, $closeness_centrality]]
    :update entity { id => degree_centrality, betweenness_centrality, closeness_centrality }
  `,

  updateCommunity: `
    ?[id, community_id] <- [[$id, $community_id]]
    :update entity { id => community_id }
  `,

  delete: `
    ?[id] <- [[$id]]
    :rm entity { id }
  `,

  deleteByGroupId: `
    ?[id] := 
      *entity{id, group_id},
      group_id == $group_id
    :rm entity { id }
  `,

  getParticipants: `
    ?[participant_id, participant_name, participant_kind] := 
      *entity{id, participants},
      id == $entity_id,
      participant_id in participants,
      *entity{id: participant_id, name: participant_name, entity_kind: participant_kind}
  `,

  getNarrativeEntities: `
    ?[id, name, entity_kind, entity_subtype, temporal_span, group_id] := 
      *entity{id, name, entity_kind, entity_subtype, temporal_span, group_id},
      entity_kind in ["ARC", "ACT", "CHAPTER", "SCENE", "BEAT", "EVENT", "TIMELINE", "NARRATIVE"]
  `,
};

export function getCanonicalEntityId(kind: string, name: string): string {
  const normalizedName = name.trim().replace(/\s+/g, '_').toUpperCase();
  return `${kind}:${normalizedName}`;
}
