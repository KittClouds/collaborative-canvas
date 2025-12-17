export const FOLDER_SCHEMA = `
:create folder {
    id: Uuid,
    name: String,
    path: String default "",
    parent_id: Uuid? default null,
    created_at: Float default now(),
    color: String? default null,
    
    entity_kind: String? default null,
    entity_subtype: String? default null,
    entity_label: String? default null,
    
    is_typed_root: Bool default false,
    is_subtype_root: Bool default false,
    inherited_kind: String? default null,
    inherited_subtype: String? default null
}
`;

export const FOLDER_QUERIES = {
  upsert: `
    ?[id, name, path, parent_id, created_at, color,
      entity_kind, entity_subtype, entity_label,
      is_typed_root, is_subtype_root, inherited_kind, inherited_subtype] <- 
      [[$id, $name, $path, $parent_id, $created_at, $color,
        $entity_kind, $entity_subtype, $entity_label,
        $is_typed_root, $is_subtype_root, $inherited_kind, $inherited_subtype]]
    :put folder {
      id, name, path, parent_id, created_at, color,
      entity_kind, entity_subtype, entity_label,
      is_typed_root, is_subtype_root, inherited_kind, inherited_subtype
    }
  `,

  getById: `
    ?[id, name, path, parent_id, created_at, color,
      entity_kind, entity_subtype, entity_label,
      is_typed_root, is_subtype_root, inherited_kind, inherited_subtype] := 
      *folder{id, name, path, parent_id, created_at, color,
        entity_kind, entity_subtype, entity_label,
        is_typed_root, is_subtype_root, inherited_kind, inherited_subtype},
      id == $id
  `,

  getChildren: `
    ?[id, name, path, parent_id, created_at, color,
      entity_kind, entity_subtype, entity_label,
      is_typed_root, is_subtype_root, inherited_kind, inherited_subtype] := 
      *folder{id, name, path, parent_id, created_at, color,
        entity_kind, entity_subtype, entity_label,
        is_typed_root, is_subtype_root, inherited_kind, inherited_subtype},
      parent_id == $parent_id
  `,

  getRootFolders: `
    ?[id, name, path, parent_id, created_at, color,
      entity_kind, entity_subtype, entity_label,
      is_typed_root, is_subtype_root, inherited_kind, inherited_subtype] := 
      *folder{id, name, path, parent_id, created_at, color,
        entity_kind, entity_subtype, entity_label,
        is_typed_root, is_subtype_root, inherited_kind, inherited_subtype},
      is_null(parent_id)
  `,

  getTypedRoots: `
    ?[id, name, entity_kind, entity_subtype] := 
      *folder{id, name, entity_kind, entity_subtype, is_typed_root},
      is_typed_root == true
  `,

  delete: `
    ?[id] <- [[$id]]
    :rm folder { id }
  `,

  getAll: `
    ?[id, name, path, parent_id, created_at, color,
      entity_kind, entity_subtype, entity_label,
      is_typed_root, is_subtype_root, inherited_kind, inherited_subtype] := 
      *folder{id, name, path, parent_id, created_at, color,
        entity_kind, entity_subtype, entity_label,
        is_typed_root, is_subtype_root, inherited_kind, inherited_subtype}
  `,

  getAncestors: `
    ancestors[id, ancestor_id, depth] := 
      *folder{id, parent_id: ancestor_id},
      ancestor_id != null,
      depth = 1
    
    ancestors[id, ancestor_id, depth] := 
      *folder{id, parent_id},
      parent_id != null,
      ancestors[parent_id, ancestor_id, d],
      depth = d + 1
    
    ?[ancestor_id, depth] := 
      ancestors[$id, ancestor_id, depth]
    :order depth
  `,

  getDescendants: `
    descendants[id, descendant_id, depth] := 
      *folder{id: descendant_id, parent_id: id},
      depth = 1
    
    descendants[id, descendant_id, depth] := 
      *folder{id: child_id, parent_id: id},
      descendants[child_id, descendant_id, d],
      depth = d + 1
    
    ?[descendant_id, depth] := 
      descendants[$id, descendant_id, depth]
    :order depth
  `,
};

export const FOLDER_PATH_RULE = `
folder_path[id, path] := 
    *folder{id, name, parent_id},
    is_null(parent_id),
    path = concat("/", name)

folder_path[id, path] := 
    *folder{id, name, parent_id},
    parent_id != null,
    folder_path[parent_id, parent_path],
    path = concat(parent_path, "/", name)
`;
