// Blueprint Compiler Service
// Compiles a blueprint version into a fully resolved artifact with inheritance

import {
  getBlueprintMetaById,
  getVersionById,
  getAllEntityTypesByVersion,
  getAllFieldsByEntityType,
  getAllRelationshipTypesByVersion,
  getAllRelationshipAttributesByType,
  getAllViewTemplatesByVersion,
  getAllMOCsByVersion,
  getExtractionProfile,
  getLabelMappings,
  getIgnoreList,
} from '../api/storage';
import type {
  CompiledBlueprint,
  CompiledEntityType,
  CompiledRelationshipType,
  EntityTypeDef,
  FieldDef,
} from '../types';

const MAX_INHERITANCE_DEPTH = 10;

/**
 * Compiles a blueprint version by:
 * 1. Fetching all entities, fields, relationships, views, and MOCs
 * 2. Resolving inheritance for entity types (child fields override parent fields)
 * 3. Attaching attributes to relationship types
 * 4. Computing a hash for the compiled artifact
 */
export async function compileBlueprint(versionId: string): Promise<CompiledBlueprint> {
  // Fetch version
  const version = await getVersionById(versionId);
  if (!version) {
    throw new Error(`Version not found: ${versionId}`);
  }

  // Fetch blueprint meta
  const meta = await getBlueprintMetaById(version.blueprint_id);
  if (!meta) {
    throw new Error(`Blueprint meta not found: ${version.blueprint_id}`);
  }

  // Fetch all entity types
  const entityTypeDefs = await getAllEntityTypesByVersion(versionId);

  // Build entity type map
  const entityTypeMap = new Map<string, EntityTypeDef>();
  for (const entityType of entityTypeDefs) {
    entityTypeMap.set(entityType.entity_type_id, entityType);
  }

  // Build fields map (entity_type_id -> FieldDef[])
  const fieldsMap = new Map<string, FieldDef[]>();
  for (const entityType of entityTypeDefs) {
    const fields = await getAllFieldsByEntityType(entityType.entity_type_id);
    fieldsMap.set(entityType.entity_type_id, fields);
  }

  // Compile entity types with inheritance resolution
  const compiledEntityTypes: CompiledEntityType[] = [];
  const compiledEntityTypeMap = new Map<string, CompiledEntityType>();

  for (const entityType of entityTypeDefs) {
    const compiledType = compileEntityTypeWithInheritance(
      entityType,
      entityTypeMap,
      fieldsMap,
      compiledEntityTypeMap
    );
    compiledEntityTypes.push(compiledType);
    compiledEntityTypeMap.set(compiledType.entity_type_id, compiledType);
  }

  // Wire up parent-child relationships
  for (const compiledType of compiledEntityTypes) {
    if (compiledType.parent_type_id) {
      const parent = compiledEntityTypeMap.get(compiledType.parent_type_id);
      if (parent) {
        compiledType.parentType = parent;
        parent.childTypes.push(compiledType);
      }
    }
  }

  // Fetch all relationship types with their attributes
  const relationshipTypeDefs = await getAllRelationshipTypesByVersion(versionId);
  const compiledRelationshipTypes: CompiledRelationshipType[] = [];
  for (const relType of relationshipTypeDefs) {
    const attributes = await getAllRelationshipAttributesByType(relType.relationship_type_id);
    compiledRelationshipTypes.push({
      ...relType,
      attributes,
    });
  }

  // Fetch view templates and MOCs
  const viewTemplates = await getAllViewTemplatesByVersion(versionId);
  const mocs = await getAllMOCsByVersion(versionId);

  // Fetch extraction profile with label mappings and ignore list
  const extractionProfile = await getExtractionProfile(versionId);
  let enrichedProfile;
  
  if (extractionProfile) {
    const labelMappings = await getLabelMappings(extractionProfile.profile_id);
    const ignoreList = await getIgnoreList(extractionProfile.profile_id);
    
    enrichedProfile = {
      ...extractionProfile,
      labelMappings,
      ignoreList,
    };
  }

  const compiled: CompiledBlueprint = {
    meta,
    version,
    entityTypes: compiledEntityTypes,
    relationshipTypes: compiledRelationshipTypes,
    viewTemplates,
    mocs,
    extractionProfile: enrichedProfile ?? undefined,
  };

  return compiled;
}

/**
 * Recursively compiles an entity type with inheritance.
 * Child fields override parent fields if they share the same field_name.
 */
function compileEntityTypeWithInheritance(
  entityType: EntityTypeDef,
  entityTypeMap: Map<string, EntityTypeDef>,
  fieldsMap: Map<string, FieldDef[]>,
  compiledCache: Map<string, CompiledEntityType>,
  depth = 0
): CompiledEntityType {
  // Check cache
  if (compiledCache.has(entityType.entity_type_id)) {
    return compiledCache.get(entityType.entity_type_id)!;
  }

  // Guard against circular inheritance or excessive depth
  if (depth > MAX_INHERITANCE_DEPTH) {
    console.warn(
      `Maximum inheritance depth (${MAX_INHERITANCE_DEPTH}) reached for entity type: ${entityType.entity_type_id}`
    );
    // Return entity with its own fields only
    const ownFields = fieldsMap.get(entityType.entity_type_id) ?? [];
    return {
      ...entityType,
      fields: ownFields,
      parentType: undefined,
      childTypes: [],
    };
  }

  // Get own fields
  const ownFields = fieldsMap.get(entityType.entity_type_id) ?? [];

  // Resolve parent fields if this type has a parent
  let mergedFields = [...ownFields];
  if (entityType.parent_type_id) {
    const parentDef = entityTypeMap.get(entityType.parent_type_id);
    if (parentDef) {
      // Recursively compile parent
      const compiledParent = compileEntityTypeWithInheritance(
        parentDef,
        entityTypeMap,
        fieldsMap,
        compiledCache,
        depth + 1
      );

      // Merge fields: child overrides parent by field_name
      mergedFields = mergeFields(compiledParent.fields, ownFields);
    }
  }

  const compiled: CompiledEntityType = {
    ...entityType,
    fields: mergedFields,
    parentType: undefined, // Will be set in a second pass
    childTypes: [], // Will be populated in a second pass
  };

  // Cache before returning to handle circular references
  compiledCache.set(entityType.entity_type_id, compiled);

  return compiled;
}

/**
 * Merges parent and child fields.
 * Child fields override parent fields with the same field_name.
 */
function mergeFields(parentFields: FieldDef[], childFields: FieldDef[]): FieldDef[] {
  const fieldMap = new Map<string, FieldDef>();

  // Add all parent fields
  for (const field of parentFields) {
    fieldMap.set(field.field_name, field);
  }

  // Override with child fields
  for (const field of childFields) {
    fieldMap.set(field.field_name, field);
  }

  return Array.from(fieldMap.values());
}

/**
 * Computes a simple hash for the compiled blueprint.
 * Uses JSON string length as a simple hash for now.
 */
export function computeBlueprintHash(compiled: CompiledBlueprint): string {
  const jsonString = JSON.stringify(compiled);
  const hash = jsonString.length.toString(36);
  return hash;
}
