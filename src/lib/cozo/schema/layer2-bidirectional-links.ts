export const NOTE_ENTITY_LINKS_SCHEMA = `
:create note_entity_links {
    id: Uuid,
    source_id: Uuid,
    target_id: Uuid,
    
    link_type: String default "mention",
    mention_type: String,
    created_by: String,
    
    context: String,
    char_position: Int,
    sentence_index: Int? default null,
    
    position_type: String,
    position_weight: Float default 0.5,
    
    relevance: Float default 0.5,
    frequency_score: Float default 0.0,
    context_score: Float default 0.0,
    temporal_score: Float default 0.0,
    
    confidence: Float default 1.0,
    validated: Bool default false,
    
    created_at: Float default now(),
    updated_at: Float default now()
}
`;

export const ENTITY_BACKLINKS_SCHEMA = `
:create entity_backlinks {
    id: Uuid,
    entity_id: Uuid,
    note_id: Uuid,
    
    mention_count: Int default 1,
    avg_relevance: Float default 0.5,
    first_mention_pos: Int,
    last_mention_pos: Int,
    
    note_title: String,
    
    created_at: Float default now(),
    updated_at: Float default now()
}
`;

export const BIDIRECTIONAL_LINK_INDICES = `
::index create note_entity_links:source_idx {source_id}
::index create note_entity_links:target_idx {target_id}
::index create note_entity_links:relevance_idx {relevance}
::index create entity_backlinks:entity_idx {entity_id}
::index create entity_backlinks:note_idx {note_id}
`;

export const BIDIRECTIONAL_LINK_QUERIES = {
  createLink: `
    ?[id, source_id, target_id, link_type, mention_type, created_by,
      context, char_position, sentence_index, position_type, position_weight,
      relevance, frequency_score, context_score, temporal_score,
      confidence, validated, created_at, updated_at] <- [
      [$id, $source_id, $target_id, $link_type, $mention_type, $created_by,
       $context, $char_position, $sentence_index, $position_type, $position_weight,
       $relevance, $frequency_score, $context_score, $temporal_score,
       $confidence, $validated, now(), now()]
    ]
    :put note_entity_links {
      id, source_id, target_id, link_type, mention_type, created_by,
      context, char_position, sentence_index, position_type, position_weight,
      relevance, frequency_score, context_score, temporal_score,
      confidence, validated, created_at, updated_at
    }
  `,

  upsertBacklink: `
    ?[id, entity_id, note_id, mention_count, avg_relevance,
      first_mention_pos, last_mention_pos, note_title, created_at, updated_at] <- [
      [$id, $entity_id, $note_id, $mention_count, $avg_relevance,
       $first_mention_pos, $last_mention_pos, $note_title, $created_at, now()]
    ]
    :put entity_backlinks {
      id, entity_id, note_id, mention_count, avg_relevance,
      first_mention_pos, last_mention_pos, note_title, created_at, updated_at
    }
  `,

  getEntitiesInNote: `
    ?[entity_id, entity_name, entity_kind, mention_count, avg_relevance] := 
      *note_entity_links{source_id, target_id: entity_id, relevance},
      source_id == $note_id,
      *entity{id: entity_id, name: entity_name, entity_kind},
      mention_count = count(entity_id),
      avg_relevance = mean(relevance)
    :order -avg_relevance
  `,

  getNotesWithEntity: `
    ?[note_id, note_title, mention_count, avg_relevance, updated_at] := 
      *entity_backlinks{entity_id, note_id, mention_count, avg_relevance, note_title, updated_at},
      entity_id == $entity_id
    :order -avg_relevance
  `,

  deleteLinksByNote: `
    ?[id] := 
      *note_entity_links{id, source_id},
      source_id == $note_id
    :rm note_entity_links { id }
  `,

  deleteBacklinksByNote: `
    ?[id] := 
      *entity_backlinks{id, note_id},
      note_id == $note_id
    :rm entity_backlinks { id }
  `,
};

export const ALL_BIDIRECTIONAL_SCHEMAS = [
  NOTE_ENTITY_LINKS_SCHEMA,
  ENTITY_BACKLINKS_SCHEMA,
];
