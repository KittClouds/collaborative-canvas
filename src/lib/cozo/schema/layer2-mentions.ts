export const MENTIONS_SCHEMA = `
:create mentions {
    id: Uuid,
    episode_id: Uuid,
    entity_id: Uuid,
    
    context: String,
    char_position: Int,
    sentence_index: Int? default null,
    
    confidence: Float default 1.0,
    extraction_method: String default "regex",
    created_at: Float default now()
}
`;

export const MENTIONS_QUERIES = {
  upsert: `
    ?[id, episode_id, entity_id, context, char_position, sentence_index,
      confidence, extraction_method, created_at] <- 
      [[$id, $episode_id, $entity_id, $context, $char_position, $sentence_index,
        $confidence, $extraction_method, $created_at]]
    :put mentions {
      id, episode_id, entity_id, context, char_position, sentence_index,
      confidence, extraction_method, created_at
    }
  `,

  getByEpisodeId: `
    ?[id, entity_id, context, char_position, sentence_index, confidence] := 
      *mentions{id, episode_id, entity_id, context, char_position, sentence_index, confidence},
      episode_id == $episode_id
  `,

  getByEntityId: `
    ?[id, episode_id, context, char_position, sentence_index, confidence] := 
      *mentions{id, episode_id, entity_id, context, char_position, sentence_index, confidence},
      entity_id == $entity_id
  `,

  getEntityMentionsWithNotes: `
    ?[mention_id, note_id, note_title, context, char_position, sentence_index] := 
      *mentions{id: mention_id, episode_id, entity_id, context, char_position, sentence_index},
      entity_id == $entity_id,
      *episode{id: episode_id, note_id},
      *note{id: note_id, title: note_title}
  `,

  getMentionCountByEntity: `
    ?[entity_id, entity_name, mention_count] := 
      *mentions{entity_id},
      *entity{id: entity_id, name: entity_name},
      mention_count = count(entity_id)
    :order -mention_count
  `,

  getCoOccurrencesInSentence: `
    ?[entity_a_id, entity_b_id, sentence_key, episode_id] := 
      *mentions{episode_id, entity_id: entity_a_id, sentence_index},
      *mentions{episode_id, entity_id: entity_b_id, sentence_index: same_sentence},
      sentence_index == same_sentence,
      entity_a_id < entity_b_id,
      sentence_key = concat(to_string(episode_id), ":", to_string(sentence_index))
  `,

  getCoOccurrencesInEpisode: `
    ?[entity_a_id, entity_b_id, episode_id] := 
      *mentions{episode_id, entity_id: entity_a_id},
      *mentions{episode_id, entity_id: entity_b_id},
      entity_a_id < entity_b_id
  `,

  delete: `
    ?[id] <- [[$id]]
    :rm mentions { id }
  `,

  deleteByEpisodeId: `
    ?[id] := 
      *mentions{id, episode_id},
      episode_id == $episode_id
    :rm mentions { id }
  `,

  deleteByEntityId: `
    ?[id] := 
      *mentions{id, entity_id},
      entity_id == $entity_id
    :rm mentions { id }
  `,

  getMentionContexts: `
    ?[entity_name, context, note_title, char_position] := 
      *mentions{entity_id, episode_id, context, char_position},
      *entity{id: entity_id, name: entity_name},
      *episode{id: episode_id, note_id},
      *note{id: note_id, title: note_title},
      entity_id == $entity_id
    :order char_position
  `,
};
