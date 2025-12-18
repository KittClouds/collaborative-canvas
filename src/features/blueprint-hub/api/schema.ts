// Blueprint Hub Schema Initialization for CozoDB

export const BLUEPRINT_HUB_SCHEMA = {
    // Blueprint Meta - stores blueprint project metadata
    blueprint_meta: `
    :create blueprint_meta {
      blueprint_id: String,
      =>
      name: String,
      description: String,
      category: String,
      author: String?,
      tags: [String],
      is_system: Bool,
      created_at: Int,
      updated_at: Int,
    }
  `,

    // Blueprint Versions - stores different versions of each blueprint
    blueprint_version: `
    :create blueprint_version {
      version_id: String,
      =>
      blueprint_id: String,
      version_number: Int,
      status: String,
      change_summary: String,
      published_at: Int?,
      created_at: Int,
    }
  `,

    // Entity Types - defines types of entities (Character, Location, etc.)
    blueprint_entity_type: `
    :create blueprint_entity_type {
      entity_type_id: String,
      =>
      version_id: String,
      entity_kind: String,
      entity_subtype: String?,
      display_name: String,
      description: String,
      icon: String?,
      color: String?,
      is_abstract: Bool,
      parent_type_id: String?,
      created_at: Int,
    }
  `,

    // Fields - custom fields for entity types
    blueprint_field: `
    :create blueprint_field {
      field_id: String,
      =>
      entity_type_id: String,
      field_name: String,
      display_label: String,
      data_type: String,
      is_required: Bool,
      is_array: Bool,
      default_value: String?,
      validation_rules: Json?,
      ui_hints: Json?,
      display_order: Int,
      group_name: String?,
      description: String,
      created_at: Int,
    }
  `,

    // Relationship Types - defines how entities can be related
    blueprint_relationship_type: `
    :create blueprint_relationship_type {
      relationship_type_id: String,
      =>
      version_id: String,
      relationship_name: String,
      display_label: String,
      source_entity_kind: String,
      target_entity_kind: String,
      direction: String,
      cardinality: String,
      is_symmetric: Bool,
      inverse_label: String?,
      description: String,
      created_at: Int,
    }
  `,

    // Relationship Attributes - attributes for relationships
    blueprint_attribute: `
    :create blueprint_attribute {
      attribute_id: String,
      =>
      relationship_type_id: String,
      attribute_name: String,
      display_label: String,
      data_type: String,
      is_required: Bool,
      default_value: String?,
      description: String,
      created_at: Int,
    }
  `,

    // View Templates - UI view configurations for entity types
    blueprint_view_template: `
    :create blueprint_view_template {
      view_id: String,
      =>
      version_id: String,
      view_name: String,
      view_type: String,
      entity_kind: String,
      field_layout: Json,
      display_config: Json,
      is_default: Bool,
      description: String,
      created_at: Int,
    }
  `,

    // MOCs (Maps of Content) - organizational structures
    blueprint_moc: `
    :create blueprint_moc {
      moc_id: String,
      =>
      version_id: String,
      moc_name: String,
      entity_kinds: [String],
      grouping_rules: Json?,
      filter_rules: Json?,
      sort_rules: Json?,
      view_config: Json?,
      description: String,
      created_at: Int,
    }
  `,
};

/**
 * Initialize all Blueprint Hub tables in CozoDB.
 * Call this after CozoDB is initialized.
 */
export async function initBlueprintHubSchema(cozoDb: any): Promise<void> {
    const tables = Object.entries(BLUEPRINT_HUB_SCHEMA);

    for (const [tableName, schema] of tables) {
        try {
            const result = cozoDb.runQuery(schema);
            if (result.ok) {
                console.log(`✓ Blueprint Hub: Created table ${tableName}`);
            } else {
                // Table might already exist, check error message
                if (result.message && result.message.includes('already exists')) {
                    console.log(`✓ Blueprint Hub: Table ${tableName} already exists`);
                } else {
                    console.error(`✗ Blueprint Hub: Failed to create ${tableName}:`, result.message);
                }
            }
        } catch (error) {
            console.error(`✗ Blueprint Hub: Error creating ${tableName}:`, error);
            throw error;
        }
    }

    console.log('Blueprint Hub schema initialization complete');
}
