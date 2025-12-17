export const NOTE_SCHEMA = `
:create note {
    id: Uuid,
    title: String,
    content_json: Json,
    content_text: String,
    folder_id: Uuid? default null,
    created_at: Float default now(),
    updated_at: Float default now(),
    
    entity_kind: String? default null,
    entity_subtype: String? default null,
    entity_label: String? default null,
    is_canonical_entity: Bool default false,
    
    is_pinned: Bool default false,
    is_favorite: Bool default false,
    tags: [String] default [],
    attributes: Json? default null
}
`;

export const NOTE_QUERIES = {
  upsert: `
    ?[id, title, content_json, content_text, folder_id, created_at, updated_at, 
      entity_kind, entity_subtype, entity_label, is_canonical_entity,
      is_pinned, is_favorite, tags, attributes] <- [[$id, $title, $content_json, $content_text, $folder_id, $created_at, $updated_at,
      $entity_kind, $entity_subtype, $entity_label, $is_canonical_entity,
      $is_pinned, $is_favorite, $tags, $attributes]]
    :put note {
      id, title, content_json, content_text, folder_id, created_at, updated_at,
      entity_kind, entity_subtype, entity_label, is_canonical_entity,
      is_pinned, is_favorite, tags, attributes
    }
  `,

  getById: `
    ?[id, title, content_json, content_text, folder_id, created_at, updated_at,
      entity_kind, entity_subtype, entity_label, is_canonical_entity,
      is_pinned, is_favorite, tags, attributes] := 
      *note{id, title, content_json, content_text, folder_id, created_at, updated_at,
        entity_kind, entity_subtype, entity_label, is_canonical_entity,
        is_pinned, is_favorite, tags, attributes},
      id == $id
  `,

  getByFolder: `
    ?[id, title, content_json, content_text, folder_id, created_at, updated_at,
      entity_kind, entity_subtype, entity_label, is_canonical_entity,
      is_pinned, is_favorite, tags, attributes] := 
      *note{id, title, content_json, content_text, folder_id, created_at, updated_at,
        entity_kind, entity_subtype, entity_label, is_canonical_entity,
        is_pinned, is_favorite, tags, attributes},
      folder_id == $folder_id
  `,

  getEntityNotes: `
    ?[id, title, entity_kind, entity_subtype, entity_label, attributes] := 
      *note{id, title, entity_kind, entity_subtype, entity_label, attributes, is_canonical_entity},
      is_canonical_entity == true
  `,

  getByEntityKindAndLabel: `
    ?[id, title, entity_kind, entity_subtype, entity_label, attributes] := 
      *note{id, title, entity_kind, entity_subtype, entity_label, attributes, is_canonical_entity},
      is_canonical_entity == true,
      entity_kind == $kind,
      entity_label == $label
  `,

  delete: `
    ?[id] <- [[$id]]
    :rm note { id }
  `,

  getAll: `
    ?[id, title, content_json, content_text, folder_id, created_at, updated_at,
      entity_kind, entity_subtype, entity_label, is_canonical_entity,
      is_pinned, is_favorite, tags, attributes] := 
      *note{id, title, content_json, content_text, folder_id, created_at, updated_at,
        entity_kind, entity_subtype, entity_label, is_canonical_entity,
        is_pinned, is_favorite, tags, attributes}
  `,

  searchByTitle: `
    ?[id, title, entity_kind, entity_label] := 
      *note{id, title, entity_kind, entity_label},
      contains(lowercase(title), lowercase($query))
  `,

  searchByContent: `
    ?[id, title, content_text] := 
      *note{id, title, content_text},
      contains(lowercase(content_text), lowercase($query))
  `,
};
