// CozoScript Query Templates for Blueprint Hub Storage API

export const BLUEPRINT_STORAGE_QUERIES = {
  // ==================== Blueprint Meta Queries ====================
  
  upsertBlueprintMeta: `
    ?[blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at] <- 
      [[$blueprint_id, $name, $description, $category, $author, $tags, $is_system, $created_at, $updated_at]]
    :put blueprint_meta {
      blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at
    }
  `,

  getBlueprintMetaById: `
    ?[blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at] := 
      *blueprint_meta{blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at},
      blueprint_id == $blueprint_id
  `,

  getAllBlueprintMetas: `
    ?[blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at] := 
      *blueprint_meta{blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at}
    :order created_at
  `,

  getBlueprintMetasByCategory: `
    ?[blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at] := 
      *blueprint_meta{blueprint_id, name, description, category, author, tags, is_system, created_at, updated_at},
      category == $category
    :order created_at
  `,

  searchBlueprintMetas: `
    ?[blueprint_id, name, description, category, tags] := 
      *blueprint_meta{blueprint_id, name, description, category, tags},
      contains(lowercase(name), lowercase($query))
  `,

  deleteBlueprintMeta: `
    ?[blueprint_id] <- [[$blueprint_id]]
    :rm blueprint_meta { blueprint_id }
  `,

  // ==================== Blueprint Version Queries ====================

  createVersion: `
    ?[version_id, blueprint_id, version_number, status, change_summary, published_at, created_at] <- 
      [[$version_id, $blueprint_id, $version_number, $status, $change_summary, $published_at, $created_at]]
    :put blueprint_version {
      version_id, blueprint_id, version_number, status, change_summary, published_at, created_at
    }
  `,

  getVersionById: `
    ?[version_id, blueprint_id, version_number, status, change_summary, published_at, created_at] := 
      *blueprint_version{version_id, blueprint_id, version_number, status, change_summary, published_at, created_at},
      version_id == $version_id
  `,

  getVersionsByBlueprintId: `
    ?[version_id, blueprint_id, version_number, status, change_summary, published_at, created_at] := 
      *blueprint_version{version_id, blueprint_id, version_number, status, change_summary, published_at, created_at},
      blueprint_id == $blueprint_id
    :order -version_number
  `,

  getLatestVersionByBlueprintId: `
    ?[version_id, blueprint_id, version_number, status, change_summary, published_at, created_at] := 
      *blueprint_version{version_id, blueprint_id, version_number, status, change_summary, published_at, created_at},
      blueprint_id == $blueprint_id
    :order -version_number
    :limit 1
  `,

  getLatestPublishedVersion: `
    ?[version_id, blueprint_id, version_number, published_at, created_at] := 
      *blueprint_version{version_id, blueprint_id, version_number, status, published_at, created_at},
      blueprint_id == $blueprint_id,
      status == "published"
    :order -version_number
    :limit 1
  `,

  getMaxVersionNumber: `
    ?[max_version] := 
      *blueprint_version{blueprint_id, version_number},
      blueprint_id == $blueprint_id,
      max_version = max(version_number)
  `,

  updateVersionStatus: `
    ?[version_id, status, published_at] <- [[$version_id, $status, $published_at]]
    :update blueprint_version { version_id => status, published_at }
  `,

  deleteVersion: `
    ?[version_id] <- [[$version_id]]
    :rm blueprint_version { version_id }
  `,

  // ==================== Entity Type Queries ====================

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

  getEntityTypeById: `
    ?[entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
      icon, color, is_abstract, parent_type_id, created_at] := 
      *blueprint_entity_type{entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
        icon, color, is_abstract, parent_type_id, created_at},
      entity_type_id == $entity_type_id
  `,

  getEntityTypesByVersionId: `
    ?[entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
      icon, color, is_abstract, parent_type_id, created_at] := 
      *blueprint_entity_type{entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
        icon, color, is_abstract, parent_type_id, created_at},
      version_id == $version_id
  `,

  getEntityTypeByKind: `
    ?[entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
      icon, color, is_abstract, parent_type_id, created_at] := 
      *blueprint_entity_type{entity_type_id, version_id, entity_kind, entity_subtype, display_name, description,
        icon, color, is_abstract, parent_type_id, created_at},
      version_id == $version_id,
      entity_kind == $entity_kind
  `,

  deleteEntityType: `
    ?[entity_type_id] <- [[$entity_type_id]]
    :rm blueprint_entity_type { entity_type_id }
  `,

  deleteEntityTypesByVersionId: `
    ?[entity_type_id] := 
      *blueprint_entity_type{entity_type_id, version_id},
      version_id == $version_id
    :rm blueprint_entity_type { entity_type_id }
  `,

  // ==================== Field Queries ====================

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

  getFieldById: `
    ?[field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
      default_value, validation_rules, ui_hints, display_order, group_name, description, created_at] := 
      *blueprint_field{field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
        default_value, validation_rules, ui_hints, display_order, group_name, description, created_at},
      field_id == $field_id
  `,

  getFieldsByEntityTypeId: `
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

  deleteFieldsByEntityTypeId: `
    ?[field_id] := 
      *blueprint_field{field_id, entity_type_id},
      entity_type_id == $entity_type_id
    :rm blueprint_field { field_id }
  `,

  getFieldsByVersionId: `
    ?[field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
      default_value, validation_rules, ui_hints, display_order, group_name, description, created_at] := 
      *blueprint_field{field_id, entity_type_id, field_name, display_label, data_type, is_required, is_array,
        default_value, validation_rules, ui_hints, display_order, group_name, description, created_at},
      *blueprint_entity_type{entity_type_id, version_id},
      version_id == $version_id
    :order entity_type_id, display_order
  `,

  // ==================== Relationship Type Queries ====================

  upsertRelationshipType: `
    ?[relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at] <- 
      [[$relationship_type_id, $version_id, $relationship_name, $display_label, $source_entity_kind,
        $target_entity_kind, $direction, $cardinality, $is_symmetric, $inverse_label, $description, $created_at]]
    :put blueprint_relationship_type {
      relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at
    }
  `,

  getRelationshipTypeById: `
    ?[relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at] := 
      *blueprint_relationship_type{relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
        target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at},
      relationship_type_id == $relationship_type_id
  `,

  getRelationshipTypesByVersionId: `
    ?[relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at] := 
      *blueprint_relationship_type{relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
        target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at},
      version_id == $version_id
  `,

  getRelationshipTypesByEntityKind: `
    ?[relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
      target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at] := 
      *blueprint_relationship_type{relationship_type_id, version_id, relationship_name, display_label, source_entity_kind,
        target_entity_kind, direction, cardinality, is_symmetric, inverse_label, description, created_at},
      version_id == $version_id,
      or(source_entity_kind == $entity_kind, target_entity_kind == $entity_kind)
  `,

  deleteRelationshipType: `
    ?[relationship_type_id] <- [[$relationship_type_id]]
    :rm blueprint_relationship_type { relationship_type_id }
  `,

  deleteRelationshipTypesByVersionId: `
    ?[relationship_type_id] := 
      *blueprint_relationship_type{relationship_type_id, version_id},
      version_id == $version_id
    :rm blueprint_relationship_type { relationship_type_id }
  `,

  // ==================== Relationship Attribute Queries ====================

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

  getRelationshipAttributeById: `
    ?[attribute_id, relationship_type_id, attribute_name, display_label, data_type,
      is_required, default_value, description, created_at] := 
      *blueprint_attribute{attribute_id, relationship_type_id, attribute_name, display_label, data_type,
        is_required, default_value, description, created_at},
      attribute_id == $attribute_id
  `,

  getRelationshipAttributesByTypeId: `
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

  deleteRelationshipAttributesByTypeId: `
    ?[attribute_id] := 
      *blueprint_attribute{attribute_id, relationship_type_id},
      relationship_type_id == $relationship_type_id
    :rm blueprint_attribute { attribute_id }
  `,

  // ==================== View Template Queries ====================

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

  getViewTemplateById: `
    ?[view_id, version_id, view_name, view_type, entity_kind, field_layout,
      display_config, is_default, description, created_at] := 
      *blueprint_view_template{view_id, version_id, view_name, view_type, entity_kind, field_layout,
        display_config, is_default, description, created_at},
      view_id == $view_id
  `,

  getViewTemplatesByVersionId: `
    ?[view_id, version_id, view_name, view_type, entity_kind, field_layout,
      display_config, is_default, description, created_at] := 
      *blueprint_view_template{view_id, version_id, view_name, view_type, entity_kind, field_layout,
        display_config, is_default, description, created_at},
      version_id == $version_id
  `,

  getViewTemplatesByEntityKind: `
    ?[view_id, version_id, view_name, view_type, entity_kind, field_layout,
      display_config, is_default, description, created_at] := 
      *blueprint_view_template{view_id, version_id, view_name, view_type, entity_kind, field_layout,
        display_config, is_default, description, created_at},
      version_id == $version_id,
      entity_kind == $target_entity_kind
  `,

  getDefaultViewTemplate: `
    ?[view_id, version_id, view_name, view_type, entity_kind, field_layout,
      display_config, is_default, description, created_at] := 
      *blueprint_view_template{view_id, version_id, view_name, view_type, entity_kind, field_layout,
        display_config, is_default, description, created_at},
      version_id == $version_id,
      entity_kind == $target_entity_kind,
      is_default == true
    :limit 1
  `,

  deleteViewTemplate: `
    ?[view_id] <- [[$view_id]]
    :rm blueprint_view_template { view_id }
  `,

  deleteViewTemplatesByVersionId: `
    ?[view_id] := 
      *blueprint_view_template{view_id, version_id},
      version_id == $version_id
    :rm blueprint_view_template { view_id }
  `,

  // ==================== MOC Queries ====================

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

  getMOCById: `
    ?[moc_id, version_id, moc_name, entity_kinds, grouping_rules, filter_rules,
      sort_rules, view_config, description, created_at] := 
      *blueprint_moc{moc_id, version_id, moc_name, entity_kinds, grouping_rules, filter_rules,
        sort_rules, view_config, description, created_at},
      moc_id == $moc_id
  `,

  getMOCsByVersionId: `
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

  deleteMOCsByVersionId: `
    ?[moc_id] := 
      *blueprint_moc{moc_id, version_id},
      version_id == $version_id
    :rm blueprint_moc { moc_id }
  `,
};
