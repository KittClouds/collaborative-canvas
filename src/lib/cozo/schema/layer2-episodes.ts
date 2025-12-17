export const EPISODE_SCHEMA = `
:create episode {
    id: Uuid,
    note_id: Uuid,
    created_at: Float default now(),
    valid_at: Float default now(),
    
    content_text: String,
    content_json: Json? default null,
    block_id: String? default null,
    
    group_id: String,
    scope_type: String default "note",
    
    extraction_method: String default "regex",
    processed_at: Float? default null,
    
    sentence_index: Int? default null,
    paragraph_index: Int? default null
}
`;

export const EPISODE_QUERIES = {
  upsert: `
    ?[id, note_id, created_at, valid_at, content_text, content_json, block_id,
      group_id, scope_type, extraction_method, processed_at, sentence_index, paragraph_index] <- 
      [[$id, $note_id, $created_at, $valid_at, $content_text, $content_json, $block_id,
        $group_id, $scope_type, $extraction_method, $processed_at, $sentence_index, $paragraph_index]]
    :put episode {
      id, note_id, created_at, valid_at, content_text, content_json, block_id,
      group_id, scope_type, extraction_method, processed_at, sentence_index, paragraph_index
    }
  `,

  getByNoteId: `
    ?[id, created_at, valid_at, content_text, content_json, block_id,
      group_id, scope_type, extraction_method, processed_at, sentence_index, paragraph_index] := 
      *episode{id, note_id, created_at, valid_at, content_text, content_json, block_id,
        group_id, scope_type, extraction_method, processed_at, sentence_index, paragraph_index},
      note_id == $note_id
  `,

  getByGroupId: `
    ?[id, note_id, created_at, valid_at, content_text, block_id,
      extraction_method, processed_at, sentence_index, paragraph_index] := 
      *episode{id, note_id, created_at, valid_at, content_text, block_id,
        group_id, extraction_method, processed_at, sentence_index, paragraph_index},
      group_id == $group_id
  `,

  getByScope: `
    ?[id, note_id, created_at, valid_at, content_text, block_id, group_id,
      extraction_method, processed_at] := 
      *episode{id, note_id, created_at, valid_at, content_text, block_id, group_id,
        scope_type, extraction_method, processed_at},
      scope_type == $scope_type
  `,

  getUnprocessed: `
    ?[id, note_id, content_text, group_id, scope_type] := 
      *episode{id, note_id, content_text, group_id, scope_type, processed_at},
      is_null(processed_at)
  `,

  markProcessed: `
    ?[id, processed_at] <- [[$id, now()]]
    :update episode { id => processed_at }
  `,

  delete: `
    ?[id] <- [[$id]]
    :rm episode { id }
  `,

  deleteByNoteId: `
    ?[id] := 
      *episode{id, note_id},
      note_id == $note_id
    :rm episode { id }
  `,

  getById: `
    ?[id, note_id, created_at, valid_at, content_text, content_json, block_id,
      group_id, scope_type, extraction_method, processed_at, sentence_index, paragraph_index] := 
      *episode{id, note_id, created_at, valid_at, content_text, content_json, block_id,
        group_id, scope_type, extraction_method, processed_at, sentence_index, paragraph_index},
      id == $id
  `,

  getTimeTravel: `
    ?[id, note_id, content_text, block_id, valid_at] := 
      *episode{id, note_id, content_text, block_id, group_id, valid_at},
      group_id == $group_id,
      valid_at <= $as_of_time
    :order -valid_at
    :limit $limit
  `,
};

export function buildGroupId(scopeType: 'note' | 'folder' | 'vault', scopeId: string): string {
  if (scopeType === 'vault') {
    return 'vault:global';
  }
  return `${scopeType}:${scopeId}`;
}

export function parseGroupId(groupId: string): { scopeType: string; scopeId: string } {
  const [scopeType, scopeId] = groupId.split(':');
  return { scopeType, scopeId: scopeId || 'global' };
}
