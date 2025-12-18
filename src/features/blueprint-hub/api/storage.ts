// Blueprint Hub Storage API
// TypeScript functions to perform CRUD operations for blueprint entities

import { v4 as uuidv4 } from 'uuid';
import { cozoDb } from '../../../lib/cozo/db';
import { BLUEPRINT_STORAGE_QUERIES } from './queries';
import type {
  BlueprintMeta,
  BlueprintVersion,
  EntityTypeDef,
  FieldDef,
  RelationshipTypeDef,
  RelationshipAttributeDef,
  ViewTemplateDef,
  MOCDef,
  CreateBlueprintMetaInput,
  CreateVersionInput,
  CreateEntityTypeInput,
  CreateFieldInput,
  CreateRelationshipTypeInput,
  CreateRelationshipAttributeInput,
  CreateViewTemplateInput,
  CreateMOCInput,
  CompiledBlueprint,
  CompiledEntityType,
  CompiledRelationshipType,
  VersionStatus,
} from '../types';

// ==================== Helper Functions ====================

function parseRow<T>(row: unknown[]): T {
  return row as unknown as T;
}

function parseRows<T>(result: { rows?: unknown[][] }): T[] {
  if (!result.rows || result.rows.length === 0) {
    return [];
  }
  return result.rows.map(row => parseRow<T>(row));
}

function parseSingleRow<T>(result: { rows?: unknown[][] }): T | null {
  if (!result.rows || result.rows.length === 0) {
    return null;
  }
  return parseRow<T>(result.rows[0]);
}

// ==================== Blueprint Meta Operations ====================

export async function createBlueprintMeta(
  input: CreateBlueprintMetaInput
): Promise<BlueprintMeta> {
  const now = Date.now();
  const blueprint_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertBlueprintMeta, {
    blueprint_id,
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? null,
    author: input.author ?? null,
    tags: input.tags ?? [],
    is_system: input.is_system ?? false,
    created_at: now,
    updated_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create blueprint meta: ${result.message}`);
  }

  return {
    blueprint_id,
    name: input.name,
    description: input.description,
    category: input.category,
    author: input.author,
    tags: input.tags ?? [],
    is_system: input.is_system ?? false,
    created_at: now,
    updated_at: now,
  };
}

export async function updateBlueprintMeta(
  blueprint_id: string,
  updates: Partial<CreateBlueprintMetaInput>
): Promise<BlueprintMeta> {
  const existing = await getBlueprintMetaById(blueprint_id);
  if (!existing) {
    throw new Error(`Blueprint meta not found: ${blueprint_id}`);
  }

  const now = Date.now();
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertBlueprintMeta, {
    blueprint_id,
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description ?? null,
    category: updates.category ?? existing.category ?? null,
    author: updates.author ?? existing.author ?? null,
    tags: updates.tags ?? existing.tags,
    is_system: updates.is_system ?? existing.is_system,
    created_at: existing.created_at,
    updated_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to update blueprint meta: ${result.message}`);
  }

  return {
    blueprint_id,
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    category: updates.category ?? existing.category,
    author: updates.author ?? existing.author,
    tags: updates.tags ?? existing.tags,
    is_system: updates.is_system ?? existing.is_system,
    created_at: existing.created_at,
    updated_at: now,
  };
}

export async function getBlueprintMetaById(
  blueprint_id: string
): Promise<BlueprintMeta | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getBlueprintMetaById, {
    blueprint_id,
  });

  const row = parseSingleRow<[string, string, string | null, string | null, string | null, string[], boolean, number, number]>(result);
  if (!row) return null;

  return {
    blueprint_id: row[0],
    name: row[1],
    description: row[2] ?? undefined,
    category: row[3] ?? undefined,
    author: row[4] ?? undefined,
    tags: row[5],
    is_system: row[6],
    created_at: row[7],
    updated_at: row[8],
  };
}

export async function getAllBlueprintMetas(): Promise<BlueprintMeta[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getAllBlueprintMetas);
  
  const rows = parseRows<[string, string, string | null, string | null, string | null, string[], boolean, number, number]>(result);
  return rows.map(row => ({
    blueprint_id: row[0],
    name: row[1],
    description: row[2] ?? undefined,
    category: row[3] ?? undefined,
    author: row[4] ?? undefined,
    tags: row[5],
    is_system: row[6],
    created_at: row[7],
    updated_at: row[8],
  }));
}

export async function deleteBlueprintMeta(blueprint_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteBlueprintMeta, {
    blueprint_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete blueprint meta: ${result.message}`);
  }
}

// ==================== Blueprint Version Operations ====================

export async function createVersion(
  input: CreateVersionInput
): Promise<BlueprintVersion> {
  const now = Date.now();
  const version_id = uuidv4();

  // Get the max version number for this blueprint
  const maxVersionResult = cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getMaxVersionNumber, {
    blueprint_id: input.blueprint_id,
  });

  let version_number = 1;
  if (maxVersionResult.rows && maxVersionResult.rows.length > 0 && maxVersionResult.rows[0][0] !== null) {
    version_number = (maxVersionResult.rows[0][0] as number) + 1;
  }

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.createVersion, {
    version_id,
    blueprint_id: input.blueprint_id,
    version_number,
    status: input.status ?? 'draft',
    change_summary: input.change_summary ?? null,
    published_at: null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create version: ${result.message}`);
  }

  return {
    version_id,
    blueprint_id: input.blueprint_id,
    version_number,
    status: input.status ?? 'draft',
    change_summary: input.change_summary,
    published_at: undefined,
    created_at: now,
  };
}

export async function getVersionById(version_id: string): Promise<BlueprintVersion | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getVersionById, {
    version_id,
  });

  const row = parseSingleRow<[string, string, number, string, string | null, number | null, number]>(result);
  if (!row) return null;

  return {
    version_id: row[0],
    blueprint_id: row[1],
    version_number: row[2],
    status: row[3] as VersionStatus,
    change_summary: row[4] ?? undefined,
    published_at: row[5] ?? undefined,
    created_at: row[6],
  };
}

export async function getVersionsByBlueprintId(
  blueprint_id: string
): Promise<BlueprintVersion[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getVersionsByBlueprintId, {
    blueprint_id,
  });

  const rows = parseRows<[string, string, number, string, string | null, number | null, number]>(result);
  return rows.map(row => ({
    version_id: row[0],
    blueprint_id: row[1],
    version_number: row[2],
    status: row[3] as VersionStatus,
    change_summary: row[4] ?? undefined,
    published_at: row[5] ?? undefined,
    created_at: row[6],
  }));
}

export async function getLatestPublishedVersion(
  blueprint_id: string
): Promise<BlueprintVersion | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getLatestPublishedVersion, {
    blueprint_id,
  });

  const row = parseSingleRow<[string, string, number, number | null, number]>(result);
  if (!row) return null;

  return {
    version_id: row[0],
    blueprint_id: row[1],
    version_number: row[2],
    status: 'published',
    published_at: row[3] ?? undefined,
    created_at: row[4],
  };
}

export async function publishVersion(version_id: string): Promise<BlueprintVersion> {
  const now = Date.now();
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.updateVersionStatus, {
    version_id,
    status: 'published',
    published_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to publish version: ${result.message}`);
  }

  const version = await getVersionById(version_id);
  if (!version) {
    throw new Error(`Version not found after publish: ${version_id}`);
  }

  return version;
}

export async function deleteVersion(version_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteVersion, {
    version_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete version: ${result.message}`);
  }
}

// ==================== Entity Type Operations ====================

export async function createEntityType(
  input: CreateEntityTypeInput
): Promise<EntityTypeDef> {
  const now = Date.now();
  const entity_type_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertEntityType, {
    entity_type_id,
    version_id: input.version_id,
    entity_kind: input.entity_kind,
    entity_subtype: input.entity_subtype ?? null,
    display_name: input.display_name,
    description: input.description ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    is_abstract: input.is_abstract ?? false,
    parent_type_id: input.parent_type_id ?? null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create entity type: ${result.message}`);
  }

  return {
    entity_type_id,
    version_id: input.version_id,
    entity_kind: input.entity_kind,
    entity_subtype: input.entity_subtype,
    display_name: input.display_name,
    description: input.description,
    icon: input.icon,
    color: input.color,
    is_abstract: input.is_abstract ?? false,
    parent_type_id: input.parent_type_id,
    created_at: now,
  };
}

export async function updateEntityType(
  entity_type_id: string,
  updates: Partial<CreateEntityTypeInput>
): Promise<EntityTypeDef> {
  const existing = await getEntityTypeById(entity_type_id);
  if (!existing) {
    throw new Error(`Entity type not found: ${entity_type_id}`);
  }

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertEntityType, {
    entity_type_id,
    version_id: existing.version_id,
    entity_kind: updates.entity_kind ?? existing.entity_kind,
    entity_subtype: updates.entity_subtype ?? existing.entity_subtype ?? null,
    display_name: updates.display_name ?? existing.display_name,
    description: updates.description ?? existing.description ?? null,
    icon: updates.icon ?? existing.icon ?? null,
    color: updates.color ?? existing.color ?? null,
    is_abstract: updates.is_abstract ?? existing.is_abstract,
    parent_type_id: updates.parent_type_id ?? existing.parent_type_id ?? null,
    created_at: existing.created_at,
  });

  if (!result.ok) {
    throw new Error(`Failed to update entity type: ${result.message}`);
  }

  return {
    entity_type_id,
    version_id: existing.version_id,
    entity_kind: updates.entity_kind ?? existing.entity_kind,
    entity_subtype: updates.entity_subtype ?? existing.entity_subtype,
    display_name: updates.display_name ?? existing.display_name,
    description: updates.description ?? existing.description,
    icon: updates.icon ?? existing.icon,
    color: updates.color ?? existing.color,
    is_abstract: updates.is_abstract ?? existing.is_abstract,
    parent_type_id: updates.parent_type_id ?? existing.parent_type_id,
    created_at: existing.created_at,
  };
}

export async function getEntityTypeById(
  entity_type_id: string
): Promise<EntityTypeDef | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getEntityTypeById, {
    entity_type_id,
  });

  const row = parseSingleRow<[string, string, string, string | null, string, string | null, string | null, string | null, boolean, string | null, number]>(result);
  if (!row) return null;

  return {
    entity_type_id: row[0],
    version_id: row[1],
    entity_kind: row[2],
    entity_subtype: row[3] ?? undefined,
    display_name: row[4],
    description: row[5] ?? undefined,
    icon: row[6] ?? undefined,
    color: row[7] ?? undefined,
    is_abstract: row[8],
    parent_type_id: row[9] ?? undefined,
    created_at: row[10],
  };
}

export async function getAllEntityTypesByVersion(
  version_id: string
): Promise<EntityTypeDef[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getEntityTypesByVersionId, {
    version_id,
  });

  const rows = parseRows<[string, string, string, string | null, string, string | null, string | null, string | null, boolean, string | null, number]>(result);
  return rows.map(row => ({
    entity_type_id: row[0],
    version_id: row[1],
    entity_kind: row[2],
    entity_subtype: row[3] ?? undefined,
    display_name: row[4],
    description: row[5] ?? undefined,
    icon: row[6] ?? undefined,
    color: row[7] ?? undefined,
    is_abstract: row[8],
    parent_type_id: row[9] ?? undefined,
    created_at: row[10],
  }));
}

export async function deleteEntityType(entity_type_id: string): Promise<void> {
  // Delete all fields for this entity type first
  await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteFieldsByEntityTypeId, {
    entity_type_id,
  });

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteEntityType, {
    entity_type_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete entity type: ${result.message}`);
  }
}

// ==================== Field Operations ====================

export async function createField(input: CreateFieldInput): Promise<FieldDef> {
  const now = Date.now();
  const field_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertField, {
    field_id,
    entity_type_id: input.entity_type_id,
    field_name: input.field_name,
    display_label: input.display_label,
    data_type: input.data_type,
    is_required: input.is_required ?? false,
    is_array: input.is_array ?? false,
    default_value: input.default_value ?? null,
    validation_rules: input.validation_rules ?? null,
    ui_hints: input.ui_hints ?? null,
    display_order: input.display_order ?? 0,
    group_name: input.group_name ?? null,
    description: input.description ?? null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create field: ${result.message}`);
  }

  return {
    field_id,
    entity_type_id: input.entity_type_id,
    field_name: input.field_name,
    display_label: input.display_label,
    data_type: input.data_type,
    is_required: input.is_required ?? false,
    is_array: input.is_array ?? false,
    default_value: input.default_value,
    validation_rules: input.validation_rules,
    ui_hints: input.ui_hints,
    display_order: input.display_order ?? 0,
    group_name: input.group_name,
    description: input.description,
    created_at: now,
  };
}

export async function updateField(
  field_id: string,
  updates: Partial<CreateFieldInput>
): Promise<FieldDef> {
  const existing = await getFieldById(field_id);
  if (!existing) {
    throw new Error(`Field not found: ${field_id}`);
  }

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertField, {
    field_id,
    entity_type_id: existing.entity_type_id,
    field_name: updates.field_name ?? existing.field_name,
    display_label: updates.display_label ?? existing.display_label,
    data_type: updates.data_type ?? existing.data_type,
    is_required: updates.is_required ?? existing.is_required,
    is_array: updates.is_array ?? existing.is_array,
    default_value: updates.default_value ?? existing.default_value ?? null,
    validation_rules: updates.validation_rules ?? existing.validation_rules ?? null,
    ui_hints: updates.ui_hints ?? existing.ui_hints ?? null,
    display_order: updates.display_order ?? existing.display_order,
    group_name: updates.group_name ?? existing.group_name ?? null,
    description: updates.description ?? existing.description ?? null,
    created_at: existing.created_at,
  });

  if (!result.ok) {
    throw new Error(`Failed to update field: ${result.message}`);
  }

  return {
    field_id,
    entity_type_id: existing.entity_type_id,
    field_name: updates.field_name ?? existing.field_name,
    display_label: updates.display_label ?? existing.display_label,
    data_type: updates.data_type ?? existing.data_type,
    is_required: updates.is_required ?? existing.is_required,
    is_array: updates.is_array ?? existing.is_array,
    default_value: updates.default_value ?? existing.default_value,
    validation_rules: updates.validation_rules ?? existing.validation_rules,
    ui_hints: updates.ui_hints ?? existing.ui_hints,
    display_order: updates.display_order ?? existing.display_order,
    group_name: updates.group_name ?? existing.group_name,
    description: updates.description ?? existing.description,
    created_at: existing.created_at,
  };
}

export async function getFieldById(field_id: string): Promise<FieldDef | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getFieldById, {
    field_id,
  });

  const row = parseSingleRow<[string, string, string, string, string, boolean, boolean, string | null, unknown, unknown, number, string | null, string | null, number]>(result);
  if (!row) return null;

  return {
    field_id: row[0],
    entity_type_id: row[1],
    field_name: row[2],
    display_label: row[3],
    data_type: row[4] as FieldDef['data_type'],
    is_required: row[5],
    is_array: row[6],
    default_value: row[7] ?? undefined,
    validation_rules: row[8] as FieldDef['validation_rules'],
    ui_hints: row[9] as FieldDef['ui_hints'],
    display_order: row[10],
    group_name: row[11] ?? undefined,
    description: row[12] ?? undefined,
    created_at: row[13],
  };
}

export async function getAllFieldsByEntityType(
  entity_type_id: string
): Promise<FieldDef[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getFieldsByEntityTypeId, {
    entity_type_id,
  });

  const rows = parseRows<[string, string, string, string, string, boolean, boolean, string | null, unknown, unknown, number, string | null, string | null, number]>(result);
  return rows.map(row => ({
    field_id: row[0],
    entity_type_id: row[1],
    field_name: row[2],
    display_label: row[3],
    data_type: row[4] as FieldDef['data_type'],
    is_required: row[5],
    is_array: row[6],
    default_value: row[7] ?? undefined,
    validation_rules: row[8] as FieldDef['validation_rules'],
    ui_hints: row[9] as FieldDef['ui_hints'],
    display_order: row[10],
    group_name: row[11] ?? undefined,
    description: row[12] ?? undefined,
    created_at: row[13],
  }));
}

export async function getAllFieldsByVersion(
  version_id: string
): Promise<FieldDef[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getFieldsByVersionId, {
    version_id,
  });

  const rows = parseRows<[string, string, string, string, string, boolean, boolean, string | null, unknown, unknown, number, string | null, string | null, number]>(result);
  return rows.map(row => ({
    field_id: row[0],
    entity_type_id: row[1],
    field_name: row[2],
    display_label: row[3],
    data_type: row[4] as FieldDef['data_type'],
    is_required: row[5],
    is_array: row[6],
    default_value: row[7] ?? undefined,
    validation_rules: row[8] as FieldDef['validation_rules'],
    ui_hints: row[9] as FieldDef['ui_hints'],
    display_order: row[10],
    group_name: row[11] ?? undefined,
    description: row[12] ?? undefined,
    created_at: row[13],
  }));
}

export async function deleteField(field_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteField, {
    field_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete field: ${result.message}`);
  }
}

// ==================== Relationship Type Operations ====================

export async function createRelationshipType(
  input: CreateRelationshipTypeInput
): Promise<RelationshipTypeDef> {
  const now = Date.now();
  const relationship_type_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertRelationshipType, {
    relationship_type_id,
    version_id: input.version_id,
    relationship_name: input.relationship_name,
    display_label: input.display_label,
    source_entity_kind: input.source_entity_kind,
    target_entity_kind: input.target_entity_kind,
    direction: input.direction ?? 'directed',
    cardinality: input.cardinality ?? 'many_to_many',
    is_symmetric: input.is_symmetric ?? false,
    inverse_label: input.inverse_label ?? null,
    description: input.description ?? null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create relationship type: ${result.message}`);
  }

  return {
    relationship_type_id,
    version_id: input.version_id,
    relationship_name: input.relationship_name,
    display_label: input.display_label,
    source_entity_kind: input.source_entity_kind,
    target_entity_kind: input.target_entity_kind,
    direction: input.direction ?? 'directed',
    cardinality: input.cardinality ?? 'many_to_many',
    is_symmetric: input.is_symmetric ?? false,
    inverse_label: input.inverse_label,
    description: input.description,
    created_at: now,
  };
}

export async function updateRelationshipType(
  relationship_type_id: string,
  updates: Partial<CreateRelationshipTypeInput>
): Promise<RelationshipTypeDef> {
  const existing = await getRelationshipTypeById(relationship_type_id);
  if (!existing) {
    throw new Error(`Relationship type not found: ${relationship_type_id}`);
  }

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertRelationshipType, {
    relationship_type_id,
    version_id: existing.version_id,
    relationship_name: updates.relationship_name ?? existing.relationship_name,
    display_label: updates.display_label ?? existing.display_label,
    source_entity_kind: updates.source_entity_kind ?? existing.source_entity_kind,
    target_entity_kind: updates.target_entity_kind ?? existing.target_entity_kind,
    direction: updates.direction ?? existing.direction,
    cardinality: updates.cardinality ?? existing.cardinality,
    is_symmetric: updates.is_symmetric ?? existing.is_symmetric,
    inverse_label: updates.inverse_label ?? existing.inverse_label ?? null,
    description: updates.description ?? existing.description ?? null,
    created_at: existing.created_at,
  });

  if (!result.ok) {
    throw new Error(`Failed to update relationship type: ${result.message}`);
  }

  return {
    relationship_type_id,
    version_id: existing.version_id,
    relationship_name: updates.relationship_name ?? existing.relationship_name,
    display_label: updates.display_label ?? existing.display_label,
    source_entity_kind: updates.source_entity_kind ?? existing.source_entity_kind,
    target_entity_kind: updates.target_entity_kind ?? existing.target_entity_kind,
    direction: updates.direction ?? existing.direction,
    cardinality: updates.cardinality ?? existing.cardinality,
    is_symmetric: updates.is_symmetric ?? existing.is_symmetric,
    inverse_label: updates.inverse_label ?? existing.inverse_label,
    description: updates.description ?? existing.description,
    created_at: existing.created_at,
  };
}

export async function getRelationshipTypeById(
  relationship_type_id: string
): Promise<RelationshipTypeDef | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getRelationshipTypeById, {
    relationship_type_id,
  });

  const row = parseSingleRow<[string, string, string, string, string, string, string, string, boolean, string | null, string | null, number]>(result);
  if (!row) return null;

  return {
    relationship_type_id: row[0],
    version_id: row[1],
    relationship_name: row[2],
    display_label: row[3],
    source_entity_kind: row[4],
    target_entity_kind: row[5],
    direction: row[6] as RelationshipTypeDef['direction'],
    cardinality: row[7] as RelationshipTypeDef['cardinality'],
    is_symmetric: row[8],
    inverse_label: row[9] ?? undefined,
    description: row[10] ?? undefined,
    created_at: row[11],
  };
}

export async function getAllRelationshipTypesByVersion(
  version_id: string
): Promise<RelationshipTypeDef[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getRelationshipTypesByVersionId, {
    version_id,
  });

  const rows = parseRows<[string, string, string, string, string, string, string, string, boolean, string | null, string | null, number]>(result);
  return rows.map(row => ({
    relationship_type_id: row[0],
    version_id: row[1],
    relationship_name: row[2],
    display_label: row[3],
    source_entity_kind: row[4],
    target_entity_kind: row[5],
    direction: row[6] as RelationshipTypeDef['direction'],
    cardinality: row[7] as RelationshipTypeDef['cardinality'],
    is_symmetric: row[8],
    inverse_label: row[9] ?? undefined,
    description: row[10] ?? undefined,
    created_at: row[11],
  }));
}

export async function deleteRelationshipType(relationship_type_id: string): Promise<void> {
  // Delete all attributes for this relationship type first
  await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteRelationshipAttributesByTypeId, {
    relationship_type_id,
  });

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteRelationshipType, {
    relationship_type_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete relationship type: ${result.message}`);
  }
}

// ==================== Relationship Attribute Operations ====================

export async function createRelationshipAttribute(
  input: CreateRelationshipAttributeInput
): Promise<RelationshipAttributeDef> {
  const now = Date.now();
  const attribute_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertRelationshipAttribute, {
    attribute_id,
    relationship_type_id: input.relationship_type_id,
    attribute_name: input.attribute_name,
    display_label: input.display_label,
    data_type: input.data_type,
    is_required: input.is_required ?? false,
    default_value: input.default_value ?? null,
    description: input.description ?? null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create relationship attribute: ${result.message}`);
  }

  return {
    attribute_id,
    relationship_type_id: input.relationship_type_id,
    attribute_name: input.attribute_name,
    display_label: input.display_label,
    data_type: input.data_type,
    is_required: input.is_required ?? false,
    default_value: input.default_value,
    description: input.description,
    created_at: now,
  };
}

export async function getRelationshipAttributeById(
  attribute_id: string
): Promise<RelationshipAttributeDef | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getRelationshipAttributeById, {
    attribute_id,
  });

  const row = parseSingleRow<[string, string, string, string, string, boolean, string | null, string | null, number]>(result);
  if (!row) return null;

  return {
    attribute_id: row[0],
    relationship_type_id: row[1],
    attribute_name: row[2],
    display_label: row[3],
    data_type: row[4] as RelationshipAttributeDef['data_type'],
    is_required: row[5],
    default_value: row[6] ?? undefined,
    description: row[7] ?? undefined,
    created_at: row[8],
  };
}

export async function getAllRelationshipAttributesByType(
  relationship_type_id: string
): Promise<RelationshipAttributeDef[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getRelationshipAttributesByTypeId, {
    relationship_type_id,
  });

  const rows = parseRows<[string, string, string, string, string, boolean, string | null, string | null, number]>(result);
  return rows.map(row => ({
    attribute_id: row[0],
    relationship_type_id: row[1],
    attribute_name: row[2],
    display_label: row[3],
    data_type: row[4] as RelationshipAttributeDef['data_type'],
    is_required: row[5],
    default_value: row[6] ?? undefined,
    description: row[7] ?? undefined,
    created_at: row[8],
  }));
}

export async function deleteRelationshipAttribute(attribute_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteRelationshipAttribute, {
    attribute_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete relationship attribute: ${result.message}`);
  }
}

// ==================== View Template Operations ====================

export async function createViewTemplate(
  input: CreateViewTemplateInput
): Promise<ViewTemplateDef> {
  const now = Date.now();
  const view_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertViewTemplate, {
    view_id,
    version_id: input.version_id,
    view_name: input.view_name,
    view_type: input.view_type,
    entity_kind: input.entity_kind ?? null,
    field_layout: input.field_layout ?? null,
    display_config: input.display_config ?? null,
    is_default: input.is_default ?? false,
    description: input.description ?? null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create view template: ${result.message}`);
  }

  return {
    view_id,
    version_id: input.version_id,
    view_name: input.view_name,
    view_type: input.view_type,
    entity_kind: input.entity_kind,
    field_layout: input.field_layout,
    display_config: input.display_config,
    is_default: input.is_default ?? false,
    description: input.description,
    created_at: now,
  };
}

export async function getViewTemplateById(view_id: string): Promise<ViewTemplateDef | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getViewTemplateById, {
    view_id,
  });

  const row = parseSingleRow<[string, string, string, string, string | null, unknown, unknown, boolean, string | null, number]>(result);
  if (!row) return null;

  return {
    view_id: row[0],
    version_id: row[1],
    view_name: row[2],
    view_type: row[3] as ViewTemplateDef['view_type'],
    entity_kind: row[4] ?? undefined,
    field_layout: row[5] as ViewTemplateDef['field_layout'],
    display_config: row[6] as ViewTemplateDef['display_config'],
    is_default: row[7],
    description: row[8] ?? undefined,
    created_at: row[9],
  };
}

export async function getAllViewTemplatesByVersion(
  version_id: string
): Promise<ViewTemplateDef[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getViewTemplatesByVersionId, {
    version_id,
  });

  const rows = parseRows<[string, string, string, string, string | null, unknown, unknown, boolean, string | null, number]>(result);
  return rows.map(row => ({
    view_id: row[0],
    version_id: row[1],
    view_name: row[2],
    view_type: row[3] as ViewTemplateDef['view_type'],
    entity_kind: row[4] ?? undefined,
    field_layout: row[5] as ViewTemplateDef['field_layout'],
    display_config: row[6] as ViewTemplateDef['display_config'],
    is_default: row[7],
    description: row[8] ?? undefined,
    created_at: row[9],
  }));
}

export async function deleteViewTemplate(view_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteViewTemplate, {
    view_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete view template: ${result.message}`);
  }
}

// ==================== MOC Operations ====================

export async function createMOC(input: CreateMOCInput): Promise<MOCDef> {
  const now = Date.now();
  const moc_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertMOC, {
    moc_id,
    version_id: input.version_id,
    moc_name: input.moc_name,
    entity_kinds: input.entity_kinds,
    grouping_rules: input.grouping_rules ?? null,
    filter_rules: input.filter_rules ?? null,
    sort_rules: input.sort_rules ?? null,
    view_config: input.view_config ?? null,
    description: input.description ?? null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to create MOC: ${result.message}`);
  }

  return {
    moc_id,
    version_id: input.version_id,
    moc_name: input.moc_name,
    entity_kinds: input.entity_kinds,
    grouping_rules: input.grouping_rules,
    filter_rules: input.filter_rules,
    sort_rules: input.sort_rules,
    view_config: input.view_config,
    description: input.description,
    created_at: now,
  };
}

export async function getMOCById(moc_id: string): Promise<MOCDef | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getMOCById, {
    moc_id,
  });

  const row = parseSingleRow<[string, string, string, string[], unknown, unknown, unknown, unknown, string | null, number]>(result);
  if (!row) return null;

  return {
    moc_id: row[0],
    version_id: row[1],
    moc_name: row[2],
    entity_kinds: row[3],
    grouping_rules: row[4] as MOCDef['grouping_rules'],
    filter_rules: row[5] as MOCDef['filter_rules'],
    sort_rules: row[6] as MOCDef['sort_rules'],
    view_config: row[7] as MOCDef['view_config'],
    description: row[8] ?? undefined,
    created_at: row[9],
  };
}

export async function getAllMOCsByVersion(version_id: string): Promise<MOCDef[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getMOCsByVersionId, {
    version_id,
  });

  const rows = parseRows<[string, string, string, string[], unknown, unknown, unknown, unknown, string | null, number]>(result);
  return rows.map(row => ({
    moc_id: row[0],
    version_id: row[1],
    moc_name: row[2],
    entity_kinds: row[3],
    grouping_rules: row[4] as MOCDef['grouping_rules'],
    filter_rules: row[5] as MOCDef['filter_rules'],
    sort_rules: row[6] as MOCDef['sort_rules'],
    view_config: row[7] as MOCDef['view_config'],
    description: row[8] ?? undefined,
    created_at: row[9],
  }));
}

export async function deleteMOC(moc_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteMOC, {
    moc_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete MOC: ${result.message}`);
  }
}

// ==================== Compiled Blueprint Operations ====================

export async function getCompiledBlueprint(
  blueprint_id: string,
  version_id?: string
): Promise<CompiledBlueprint | null> {
  const meta = await getBlueprintMetaById(blueprint_id);
  if (!meta) return null;

  let version: BlueprintVersion | null;
  if (version_id) {
    version = await getVersionById(version_id);
  } else {
    version = await getLatestPublishedVersion(blueprint_id);
    if (!version) {
      // If no published version, get the latest version
      const versions = await getVersionsByBlueprintId(blueprint_id);
      version = versions[0] ?? null;
    }
  }

  if (!version) return null;

  // Fetch all entity types
  const entityTypeDefs = await getAllEntityTypesByVersion(version.version_id);

  // Build entity type map with fields
  const entityTypeMap = new Map<string, CompiledEntityType>();
  for (const entityType of entityTypeDefs) {
    const fields = await getAllFieldsByEntityType(entityType.entity_type_id);
    entityTypeMap.set(entityType.entity_type_id, {
      ...entityType,
      fields,
      parentType: undefined,
      childTypes: [],
    });
  }

  // Wire up parent-child relationships
  for (const entityType of entityTypeMap.values()) {
    if (entityType.parent_type_id) {
      const parent = entityTypeMap.get(entityType.parent_type_id);
      if (parent) {
        entityType.parentType = parent;
        parent.childTypes.push(entityType);
      }
    }
  }

  // Fetch all relationship types with their attributes
  const relationshipTypeDefs = await getAllRelationshipTypesByVersion(version.version_id);
  const compiledRelationshipTypes: CompiledRelationshipType[] = [];
  for (const relType of relationshipTypeDefs) {
    const attributes = await getAllRelationshipAttributesByType(relType.relationship_type_id);
    compiledRelationshipTypes.push({
      ...relType,
      attributes,
    });
  }

  // Fetch view templates and MOCs
  const viewTemplates = await getAllViewTemplatesByVersion(version.version_id);
  const mocs = await getAllMOCsByVersion(version.version_id);

  return {
    meta,
    version,
    entityTypes: Array.from(entityTypeMap.values()),
    relationshipTypes: compiledRelationshipTypes,
    viewTemplates,
    mocs,
  };
}

// ==================== Extraction Profile Operations ====================

export async function getExtractionProfile(
  version_id: string
): Promise<import('../types').ExtractionProfile | null> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getExtractionProfileByVersion, {
    version_id,
  });

  const row = parseSingleRow<[string, string, boolean, string, number, string, number]>(result);
  if (!row) return null;

  return {
    profile_id: row[0],
    version_id: row[1],
    enabled: row[2],
    model_id: row[3],
    confidence_threshold: row[4],
    resolution_policy: row[5] as import('../types').ResolutionPolicy,
    created_at: row[6],
  };
}

export async function upsertExtractionProfile(
  profile: import('../types').CreateExtractionProfileInput & { profile_id?: string }
): Promise<import('../types').ExtractionProfile> {
  const now = Date.now();
  const profile_id = profile.profile_id ?? uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertExtractionProfile, {
    profile_id,
    version_id: profile.version_id,
    enabled: profile.enabled ?? true,
    model_id: profile.model_id ?? 'onnx-community/NeuroBERT-NER-ONNX',
    confidence_threshold: profile.confidence_threshold ?? 0.4,
    resolution_policy: profile.resolution_policy ?? 'mention_first',
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to upsert extraction profile: ${result.message}`);
  }

  return {
    profile_id,
    version_id: profile.version_id,
    enabled: profile.enabled ?? true,
    model_id: profile.model_id ?? 'onnx-community/NeuroBERT-NER-ONNX',
    confidence_threshold: profile.confidence_threshold ?? 0.4,
    resolution_policy: profile.resolution_policy ?? 'mention_first',
    created_at: now,
  };
}

export async function getLabelMappings(
  profile_id: string
): Promise<import('../types').LabelMapping[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getLabelMappingsByProfile, {
    profile_id,
  });

  const rows = parseRows<[string, string, string, string[], number, number]>(result);
  return rows.map(row => ({
    mapping_id: row[0],
    profile_id: row[1],
    ner_label: row[2],
    target_entity_kinds: row[3],
    priority: row[4],
    created_at: row[5],
  }));
}

export async function upsertLabelMapping(
  mapping: import('../types').CreateLabelMappingInput & { mapping_id?: string }
): Promise<import('../types').LabelMapping> {
  const now = Date.now();
  const mapping_id = mapping.mapping_id ?? uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.upsertLabelMapping, {
    mapping_id,
    profile_id: mapping.profile_id,
    ner_label: mapping.ner_label,
    target_entity_kinds: mapping.target_entity_kinds,
    priority: mapping.priority ?? 0,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to upsert label mapping: ${result.message}`);
  }

  return {
    mapping_id,
    profile_id: mapping.profile_id,
    ner_label: mapping.ner_label,
    target_entity_kinds: mapping.target_entity_kinds,
    priority: mapping.priority ?? 0,
    created_at: now,
  };
}

export async function deleteLabelMapping(mapping_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.deleteLabelMapping, {
    mapping_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete label mapping: ${result.message}`);
  }
}

export async function getIgnoreList(
  profile_id: string
): Promise<import('../types').IgnoreEntry[]> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.getIgnoreListByProfile, {
    profile_id,
  });

  const rows = parseRows<[string, string, string | null, string | null, number]>(result);
  return rows.map(row => ({
    ignore_id: row[0],
    profile_id: row[1],
    surface_form: row[2] ?? undefined,
    ner_label: row[3] ?? undefined,
    created_at: row[4],
  }));
}

export async function addToIgnoreList(
  input: import('../types').CreateIgnoreEntryInput
): Promise<import('../types').IgnoreEntry> {
  const now = Date.now();
  const ignore_id = uuidv4();

  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.addToIgnoreList, {
    ignore_id,
    profile_id: input.profile_id,
    surface_form: input.surface_form ?? null,
    ner_label: input.ner_label ?? null,
    created_at: now,
  });

  if (!result.ok) {
    throw new Error(`Failed to add to ignore list: ${result.message}`);
  }

  return {
    ignore_id,
    profile_id: input.profile_id,
    surface_form: input.surface_form,
    ner_label: input.ner_label,
    created_at: now,
  };
}

export async function removeFromIgnoreList(ignore_id: string): Promise<void> {
  const result = await cozoDb.runQuery(BLUEPRINT_STORAGE_QUERIES.removeFromIgnoreList, {
    ignore_id,
  });

  if (!result.ok) {
    throw new Error(`Failed to remove from ignore list: ${result.message}`);
  }
}
