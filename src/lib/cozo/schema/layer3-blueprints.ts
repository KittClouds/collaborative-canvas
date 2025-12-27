// Layer 3: Blueprint Hub - Meta-Schema Management
// Defines schemas for versioned entity type definitions, fields, relationships, and views

export const BLUEPRINT_META_SCHEMA = `
:create blueprint_meta {
    blueprint_id: Uuid,
    name: String,
    description: String? default null,
    category: String? default null,
    author: String? default null,
    tags: [String] default [],
    is_system: Bool default false,
    created_at: Float default now(),
    updated_at: Float default now()
}
`;

export const BLUEPRINT_VERSION_SCHEMA = `
:create blueprint_version {
    version_id: Uuid,
    blueprint_id: Uuid,
    version_number: Int,
    status: String default "draft",
    change_summary: String? default null,
    published_at: Float? default null,
    created_at: Float default now()
}
`;

export const BLUEPRINT_ENTITY_TYPE_SCHEMA = `
:create blueprint_entity_type {
    entity_type_id: Uuid,
    version_id: Uuid,
    entity_kind: String,
    entity_subtype: String? default null,
    display_name: String,
    description: String? default null,
    icon: String? default null,
    color: String? default null,
    is_abstract: Bool default false,
    parent_type_id: Uuid? default null,
    created_at: Float default now()
}
`;

export const BLUEPRINT_FIELD_SCHEMA = `
:create blueprint_field {
    field_id: Uuid,
    entity_type_id: Uuid,
    field_name: String,
    display_label: String,
    data_type: String,
    is_required: Bool default false,
    is_array: Bool default false,
    default_value: String? default null,
    validation_rules: Json? default null,
    ui_hints: Json? default null,
    display_order: Int default 0,
    group_name: String? default null,
    description: String? default null,
    created_at: Float default now()
}
`;

export const BLUEPRINT_RELATIONSHIP_TYPE_SCHEMA = `
:create blueprint_relationship_type {
    relationship_type_id: Uuid,
    version_id: Uuid,
    relationship_name: String,
    display_label: String,
    source_entity_kind: String,
    target_entity_kind: String,
    direction: String default "directed",
    cardinality: String default "many_to_many",
    is_symmetric: Bool default false,
    inverse_label: String? default null,
    description: String? default null,
    verb_patterns: Json? default null,
    confidence: Float default 0.75,
    pattern_category: String? default null,
    created_at: Float default now()
}
`;

export const BLUEPRINT_ATTRIBUTE_SCHEMA = `
:create blueprint_attribute {
    attribute_id: Uuid,
    relationship_type_id: Uuid,
    attribute_name: String,
    display_label: String,
    data_type: String,
    is_required: Bool default false,
    default_value: String? default null,
    description: String? default null,
    created_at: Float default now()
}
`;

export const BLUEPRINT_VIEW_TEMPLATE_SCHEMA = `
:create blueprint_view_template {
    view_id: Uuid,
    version_id: Uuid,
    view_name: String,
    view_type: String,
    entity_kind: String? default null,
    field_layout: Json? default null,
    display_config: Json? default null,
    is_default: Bool default false,
    description: String? default null,
    created_at: Float default now()
}
`;

export const BLUEPRINT_MOC_SCHEMA = `
:create blueprint_moc {
    moc_id: Uuid,
    version_id: Uuid,
    moc_name: String,
    entity_kinds: [String],
    grouping_rules: Json? default null,
    filter_rules: Json? default null,
    sort_rules: Json? default null,
    view_config: Json? default null,
    description: String? default null,
    created_at: Float default now()
}
`;

export const EXTRACTION_PROFILE_SCHEMA = `
:create extraction_profile {
    profile_id: Uuid,
    version_id: Uuid,
    enabled: Bool default true,
    model_id: String default "onnx-community/NeuroBERT-NER-ONNX",
    confidence_threshold: Float default 0.4,
    resolution_policy: String default "mention_first",
    created_at: Float default now()
}
`;

export const EXTRACTION_LABEL_MAPPING_SCHEMA = `
:create extraction_label_mapping {
    mapping_id: Uuid,
    profile_id: Uuid,
    ner_label: String,
    target_entity_kinds: [String],
    priority: Int default 0,
    created_at: Float default now()
}
`;

export const EXTRACTION_IGNORE_LIST_SCHEMA = `
:create extraction_ignore_list {
    ignore_id: Uuid,
    profile_id: Uuid,
    surface_form: String? default null,
    ner_label: String? default null,
    created_at: Float default now()
}
`;

// Query templates for Blueprint Hub operations
export const BLUEPRINT_QUERIES = {
  // Blueprint Meta queries
  upsertBlueprintMeta: `
    ?[blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at] <- 
      [[$blueprint_id, $name, $description, $category, $author, $tags, $is_system, $created_at, $updated_at]]
    :put blueprint_meta {
      blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at
    }
  `,

  getBlueprintMeta: `
    ?[blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at] := 
      *blueprint_meta{blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at},
      blueprint_id == $blueprint_id
  `,

  getAllBlueprints: `
    ?[blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at] := 
      *blueprint_meta{blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at}
    :order created_at
  `,

  deleteBlueprintMeta: `
    ?[blueprint_id] <- [[$blueprint_id]]
    :rm blueprint_meta { blueprint_id }
  `,

  // Blueprint Version queries
  createVersion: `
    ?[version_id, blueprint_id, version_number, status, change_summary, published_at, created_at] <- 
      [[$version_id, $blueprint_id, $version_number, $status, $change_summary, $published_at, $created_at]]
    :put blueprint_version {
      version_id, blueprint_id, version_number, status, change_summary, published_at, created_at
    }
  `,

  getVersionsByBlueprint: `
    ?[version_id, blueprint_id, version_number, status, change_summary, published_at, created_at] := 
      *blueprint_version{version_id, blueprint_id, version_number, status, change_summary, published_at, created_at},
      blueprint_id == $blueprint_id
    :order -version_number
  `,

  getLatestPublishedVersion: `
    ?[version_id, blueprint_id, version_number, published_at] := 
      *blueprint_version{version_id, blueprint_id, version_number, status, published_at},
      blueprint_id == $blueprint_id,
      status == "published"
    :order -version_number
    :limit 1
  `,

  publishVersion: `
    ?[version_id, status, published_at] <- [[$version_id, "published", $published_at]]
    :update blueprint_version { version_id => status, published_at }
  `,

  deleteVersion: `
    ?[version_id] <- [[$version_id]]
    :rm blueprint_version { version_id }
  `,

  // Entity Type queries
  upsertEntityType: `
    ?[entity_type_id, version_id, entity_kind, entity_subtype, display_name, description, 
      icon, color, is_abstract, parent_type_id, created_at] <- 
      [[$entity_type_id, $version_id, $entity_kind, $entity_subtype, $display_name, $description,
        $icon, $color, $is_abstract, $parent_type_id, $created_at]]
    :put blueprint_entity_type {
      entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
      icon, color, is_abstract, parent_type_id, created_at
    }
  `,

  getEntityTypesByVersion: `
    ?[entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
      icon, color, is_abstract, parent_type_id, created_at] := 
      *blueprint_entity_type{entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
        icon, color, is_abstract, parent_type_id, created_at},
      version_id == $version_id
  `,

  getEntityTypeById: `
    ?[entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
      icon, color, is_abstract, parent_type_id, created_at] := 
      *blueprint_entity_type{entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
        icon, color, is_abstract, parent_type_id, created_at},
      entity_type_id == $entity_type_id
  `,

  deleteEntityType: `
    ?[entity_type_id] <- [[$entity_type_id]]
    :rm blueprint_entity_type { entity_type_id }
  `,

  // Field queries
  upsertField: `
    ?[field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
      default_value, validation_rules, ui_hints, display_order, group_name, description, created_at] <- 
      [[$field_id, $entity_type_id, $field_name, $display_label, $data_type, $is_required, $is_array,
        $default_value, $validation_rules, $ui_hints, $display_order, $group_name, $description, $created_at]]
    :put blueprint_field {
      field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
      default_value, validation_rules, ui_hints, display_order, group_name, description, created_at
    }
  `,

  getFieldsByEntityType: `
    ?[field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
      default_value, validation_rules, ui_hints, display_order, group_name, description, created_at] := 
      *blueprint_field{field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
        default_value, validation_rules, ui_hints, display_order, group_name, description, created_at},
      entity_type_id == $entity_type_id
    :order display_order
  `,

  deleteField: `
    ?[field_id] <- [[$field_id]]
    :rm blueprint_field { field_id }
  `,

  // Relationship Type queries
  upsertRelationshipType: `
    ?[relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description,
      verb_patterns, confidence, pattern_category, created_at] <- 
      [[$relationship_type_id, $version_id, $relationship_name, $display_label, $source_entity_kind,
        $target_entity_kind, $direction, $cardinality, $is_symmetric, $inverse_label, $description,
        $verb_patterns, $confidence, $pattern_category, $created_at]]
    :put blueprint_relationship_type {
      relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description,
      verb_patterns, confidence, pattern_category, created_at
    }
  `,

  getRelationshipTypesByVersion: `
    ?[relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description,
      verb_patterns, confidence, pattern_category, created_at] := 
      *blueprint_relationship_type{relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
        target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description,
        verb_patterns, confidence, pattern_category, created_at},
      version_id == $version_id
  `,

  // Get all relationship types with verb patterns (for Scanner)
  getAllRelationshipTypesWithPatterns: `
    ?[relationship_type_id, relationship_name, display_label, source_entity_kind, target_entity_kind,
      direction, is_symmetric, verb_patterns, confidence, pattern_category] := 
      *blueprint_relationship_type{relationship_type_id, relationship_name, display_label, source_entity_kind,
        target_entity_kind, direction, is_symmetric, verb_patterns, confidence, pattern_category},
      is_some(verb_patterns)
  `,

  deleteRelationshipType: `
    ?[relationship_type_id] <- [[$relationship_type_id]]
    :rm blueprint_relationship_type { relationship_type_id }
  `,

  // Relationship Attribute queries
  upsertRelationshipAttribute: `
    ?[attribute_id, relationship_type_id, attribute_name, display_label, data_type,
      is_required, default_value, description, created_at] <- 
      [[$attribute_id, $relationship_type_id, $attribute_name, $display_label, $data_type,
        $is_required, $default_value, $description, $created_at]]
    :put blueprint_attribute {
      attribute_id, relationship_type_id, attribute_name, display_label, data_type,
      is_required, default_value, description, created_at
    }
  `,

  getAttributesByRelationshipType: `
    ?[attribute_id, relationship_type_id, attribute_name, display_label, data_type,
      is_required, default_value, description, created_at] := 
      *blueprint_attribute{attribute_id, relationship_type_id, attribute_name, display_label, data_type,
        is_required, default_value, description, created_at},
      relationship_type_id == $relationship_type_id
  `,

  deleteRelationshipAttribute: `
    ?[attribute_id] <- [[$attribute_id]]
    :rm blueprint_attribute { attribute_id }
  `,

  // View Template queries
  upsertViewTemplate: `
    ?[view_id, version_id, view_name, view_type, entity_kind, field_layout,
      display_config, is_default, description, created_at] <- 
      [[$view_id, $version_id, $view_name, $view_type, $entity_kind, $field_layout,
        $display_config, $is_default, $description, $created_at]]
    :put blueprint_view_template {
      view_id, version_id, view_name, view_type, entity_kind, field_layout,
      display_config, is_default, description, created_at
    }
  `,

  getViewTemplatesByVersion: `
    ?[view_id, version_id, view_name, view_type, entity_kind, field_layout,
      display_config, is_default, description, created_at] := 
      *blueprint_view_template{view_id, version_id, view_name, view_type, entity_kind, field_layout,
        display_config, is_default, description, created_at},
      version_id == $version_id
  `,

  deleteViewTemplate: `
    ?[view_id] <- [[$view_id]]
    :rm blueprint_view_template { view_id }
  `,

  // MOC queries
  upsertMOC: `
    ?[moc_id, version_id, moc_name, entity_kinds, grouping_rules, filter_rules,
      sort_rules, view_config, description, created_at] <- 
      [[$moc_id, $version_id, $moc_name, $entity_kinds, $grouping_rules, $filter_rules,
        $sort_rules, $view_config, $description, $created_at]]
    :put blueprint_moc {
      moc_id, version_id, moc_name, entity_kinds, grouping_rules, filter_rules,
      sort_rules, view_config, description, created_at
    }
  `,

  getMOCsByVersion: `
    ?[moc_id, version_id, moc_name, entity_kinds, grouping_rules, filter_rules,
      sort_rules, view_config, description, created_at] := 
      *blueprint_moc{moc_id, version_id, moc_name, entity_kinds, grouping_rules, filter_rules,
        sort_rules, view_config, description, created_at},
      version_id == $version_id
  `,

  deleteMOC: `
    ?[moc_id] <- [[$moc_id]]
    :rm blueprint_moc { moc_id }
  `,

  // Extraction Profile queries
  upsertExtractionProfile: `
    ?[profile_id, version_id, enabled, model_id, confidence_threshold, resolution_policy, created_at] <- 
      [[$profile_id, $version_id, $enabled, $model_id, $confidence_threshold, $resolution_policy, $created_at]]
    :put extraction_profile {
      profile_id, version_id, enabled, model_id, confidence_threshold, resolution_policy, created_at
    }
  `,

  getExtractionProfileByVersion: `
    ?[profile_id, version_id, enabled, model_id, confidence_threshold, resolution_policy, created_at] := 
      *extraction_profile{profile_id, version_id, enabled, model_id, confidence_threshold, resolution_policy, created_at},
      version_id == $version_id
  `,

  deleteExtractionProfile: `
    ?[profile_id] <- [[$profile_id]]
    :rm extraction_profile { profile_id }
  `,

  // Extraction Label Mapping queries
  upsertLabelMapping: `
    ?[mapping_id, profile_id, ner_label, target_entity_kinds, priority, created_at] <- 
      [[$mapping_id, $profile_id, $ner_label, $target_entity_kinds, $priority, $created_at]]
    :put extraction_label_mapping {
      mapping_id, profile_id, ner_label, target_entity_kinds, priority, created_at
    }
  `,

  getLabelMappingsByProfile: `
    ?[mapping_id, profile_id, ner_label, target_entity_kinds, priority, created_at] := 
      *extraction_label_mapping{mapping_id, profile_id, ner_label, target_entity_kinds, priority, created_at},
      profile_id == $profile_id
    :order priority
  `,

  deleteLabelMapping: `
    ?[mapping_id] <- [[$mapping_id]]
    :rm extraction_label_mapping { mapping_id }
  `,

  deleteLabelMappingsByProfile: `
    ?[profile_id, mapping_id] := 
      *extraction_label_mapping{mapping_id, profile_id},
      profile_id == $profile_id
    :rm extraction_label_mapping { mapping_id }
  `,

  // Extraction Ignore List queries
  addToIgnoreList: `
    ?[ignore_id, profile_id, surface_form, ner_label, created_at] <- 
      [[$ignore_id, $profile_id, $surface_form, $ner_label, $created_at]]
    :put extraction_ignore_list {
      ignore_id, profile_id, surface_form, ner_label, created_at
    }
  `,

  getIgnoreListByProfile: `
    ?[ignore_id, profile_id, surface_form, ner_label, created_at] := 
      *extraction_ignore_list{ignore_id, profile_id, surface_form, ner_label, created_at},
      profile_id == $profile_id
  `,

  removeFromIgnoreList: `
    ?[ignore_id] <- [[$ignore_id]]
    :rm extraction_ignore_list { ignore_id }
  `,

  deleteIgnoreListByProfile: `
    ?[profile_id, ignore_id] := 
      *extraction_ignore_list{ignore_id, profile_id},
      profile_id == $profile_id
    :rm extraction_ignore_list { ignore_id }
  `,
};
