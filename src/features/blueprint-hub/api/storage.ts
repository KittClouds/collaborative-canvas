import { getBlueprintStore } from '@/lib/storage/index';
import { generateId } from '@/lib/utils/ids';
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
  VersionStatus,
  ExtractionProfile,
  CreateExtractionProfileInput,
  LabelMapping,
  CreateLabelMappingInput,
  IgnoreEntry,
  CreateIgnoreEntryInput,
} from '../types';

const store = () => getBlueprintStore();

export async function createBlueprintMeta(input: CreateBlueprintMetaInput): Promise<BlueprintMeta> {
  return store().createBlueprintMeta(input);
}

export async function updateBlueprintMeta(
  blueprint_id: string,
  updates: Partial<CreateBlueprintMetaInput>
): Promise<BlueprintMeta> {
  return store().updateBlueprintMeta(blueprint_id, updates);
}

export async function getBlueprintMetaById(blueprint_id: string): Promise<BlueprintMeta | null> {
  return store().getBlueprintMetaById(blueprint_id);
}

export async function getAllBlueprintMetas(): Promise<BlueprintMeta[]> {
  return store().getAllBlueprintMetas();
}

export async function deleteBlueprintMeta(blueprint_id: string): Promise<void> {
  return store().deleteBlueprintMeta(blueprint_id);
}

export async function createVersion(input: CreateVersionInput): Promise<BlueprintVersion> {
  return store().createVersion(input);
}

export async function getVersionById(version_id: string): Promise<BlueprintVersion | null> {
  return store().getVersionById(version_id);
}

export async function getVersionsByBlueprintId(blueprint_id: string): Promise<BlueprintVersion[]> {
  return store().getVersionsByBlueprintId(blueprint_id);
}

export async function getLatestPublishedVersion(blueprint_id: string): Promise<BlueprintVersion | null> {
  const versions = await store().getVersionsByBlueprintId(blueprint_id);
  const published = versions.filter(v => v.status === 'published');
  if (published.length === 0) return null;
  return published.sort((a, b) => b.version_number - a.version_number)[0];
}

export async function publishVersion(version_id: string): Promise<BlueprintVersion> {
  await store().updateVersionStatus(version_id, 'published');
  const version = await store().getVersionById(version_id);
  if (!version) {
    throw new Error(`Version not found after publish: ${version_id}`);
  }
  return version;
}

export async function deleteVersion(version_id: string): Promise<void> {
  return store().deleteVersion(version_id);
}

export async function createEntityType(input: CreateEntityTypeInput): Promise<EntityTypeDef> {
  return store().createEntityType(input);
}

export async function updateEntityType(
  entity_type_id: string,
  updates: Partial<CreateEntityTypeInput>
): Promise<EntityTypeDef> {
  return store().updateEntityType(entity_type_id, updates);
}

export async function getEntityTypeById(entity_type_id: string): Promise<EntityTypeDef | null> {
  return store().getEntityTypeById(entity_type_id);
}

export async function getAllEntityTypesByVersion(version_id: string): Promise<EntityTypeDef[]> {
  return store().getEntityTypesByVersionId(version_id);
}

export async function deleteEntityType(entity_type_id: string): Promise<void> {
  const fields = await store().getFieldsByEntityTypeId(entity_type_id);
  for (const field of fields) {
    await store().deleteField(field.field_id);
  }
  return store().deleteEntityType(entity_type_id);
}

export async function createField(input: CreateFieldInput): Promise<FieldDef> {
  return store().createField(input);
}

export async function updateField(field_id: string, updates: Partial<CreateFieldInput>): Promise<FieldDef> {
  return store().updateField(field_id, updates);
}

export async function getFieldById(field_id: string): Promise<FieldDef | null> {
  return store().getFieldById(field_id);
}

export async function getAllFieldsByEntityType(entity_type_id: string): Promise<FieldDef[]> {
  return store().getFieldsByEntityTypeId(entity_type_id);
}

export async function getAllFieldsByVersion(version_id: string): Promise<FieldDef[]> {
  const entityTypes = await store().getEntityTypesByVersionId(version_id);
  const allFields: FieldDef[] = [];
  for (const et of entityTypes) {
    const fields = await store().getFieldsByEntityTypeId(et.entity_type_id);
    allFields.push(...fields);
  }
  return allFields;
}

export async function deleteField(field_id: string): Promise<void> {
  return store().deleteField(field_id);
}

export async function createRelationshipType(input: CreateRelationshipTypeInput): Promise<RelationshipTypeDef> {
  return store().createRelationshipType(input);
}

export async function updateRelationshipType(
  relationship_type_id: string,
  updates: Partial<CreateRelationshipTypeInput>
): Promise<RelationshipTypeDef> {
  return store().updateRelationshipType(relationship_type_id, updates);
}

export async function getRelationshipTypeById(relationship_type_id: string): Promise<RelationshipTypeDef | null> {
  return store().getRelationshipTypeById(relationship_type_id);
}

export async function getAllRelationshipTypesByVersion(version_id: string): Promise<RelationshipTypeDef[]> {
  return store().getRelationshipTypesByVersionId(version_id);
}

export async function deleteRelationshipType(relationship_type_id: string): Promise<void> {
  const attrs = await store().getRelationshipAttributesByTypeId(relationship_type_id);
  for (const attr of attrs) {
    await store().deleteRelationshipAttribute(attr.attribute_id);
  }
  return store().deleteRelationshipType(relationship_type_id);
}

export async function createRelationshipAttribute(
  input: CreateRelationshipAttributeInput
): Promise<RelationshipAttributeDef> {
  return store().createRelationshipAttribute(input);
}

export async function getRelationshipAttributeById(attribute_id: string): Promise<RelationshipAttributeDef | null> {
  return store().getRelationshipAttributeById(attribute_id);
}

export async function getAllRelationshipAttributesByType(
  relationship_type_id: string
): Promise<RelationshipAttributeDef[]> {
  return store().getRelationshipAttributesByTypeId(relationship_type_id);
}

export async function deleteRelationshipAttribute(attribute_id: string): Promise<void> {
  return store().deleteRelationshipAttribute(attribute_id);
}

export async function createViewTemplate(input: CreateViewTemplateInput): Promise<ViewTemplateDef> {
  return store().createViewTemplate(input);
}

export async function updateViewTemplate(
  view_id: string,
  updates: Partial<CreateViewTemplateInput>
): Promise<ViewTemplateDef> {
  return store().updateViewTemplate(view_id, updates);
}

export async function getViewTemplateById(view_id: string): Promise<ViewTemplateDef | null> {
  return store().getViewTemplateById(view_id);
}

export async function getAllViewTemplatesByVersion(version_id: string): Promise<ViewTemplateDef[]> {
  return store().getViewTemplatesByVersionId(version_id);
}

export async function deleteViewTemplate(view_id: string): Promise<void> {
  return store().deleteViewTemplate(view_id);
}

export async function createMOC(input: CreateMOCInput): Promise<MOCDef> {
  return store().createMOC(input);
}

export async function updateMOC(moc_id: string, updates: Partial<CreateMOCInput>): Promise<MOCDef> {
  return store().updateMOC(moc_id, updates);
}

export async function getMOCById(moc_id: string): Promise<MOCDef | null> {
  return store().getMOCById(moc_id);
}

export async function getAllMOCsByVersion(version_id: string): Promise<MOCDef[]> {
  return store().getMOCsByVersionId(version_id);
}

export async function deleteMOC(moc_id: string): Promise<void> {
  return store().deleteMOC(moc_id);
}

const extractionProfiles = new Map<string, ExtractionProfile>();
const labelMappings = new Map<string, LabelMapping>();
const ignoreEntries = new Map<string, IgnoreEntry>();

export async function getExtractionProfile(version_id: string): Promise<ExtractionProfile | null> {
  for (const profile of extractionProfiles.values()) {
    if (profile.version_id === version_id) {
      return profile;
    }
  }
  return null;
}

export async function upsertExtractionProfile(input: CreateExtractionProfileInput): Promise<ExtractionProfile> {
  let existing = await getExtractionProfile(input.version_id);
  
  if (existing) {
    const updated: ExtractionProfile = {
      ...existing,
      enabled: input.enabled ?? existing.enabled,
      model_id: input.model_id ?? existing.model_id,
      confidence_threshold: input.confidence_threshold ?? existing.confidence_threshold,
      resolution_policy: input.resolution_policy ?? existing.resolution_policy,
    };
    extractionProfiles.set(updated.profile_id, updated);
    return updated;
  }
  
  const newProfile: ExtractionProfile = {
    profile_id: generateId(),
    version_id: input.version_id,
    enabled: input.enabled ?? true,
    model_id: input.model_id ?? 'onnx-community/NeuroBERT-NER-ONNX',
    confidence_threshold: input.confidence_threshold ?? 0.4,
    resolution_policy: input.resolution_policy ?? 'mention_first',
    created_at: Date.now(),
  };
  extractionProfiles.set(newProfile.profile_id, newProfile);
  return newProfile;
}

export async function getLabelMappings(profile_id: string): Promise<LabelMapping[]> {
  const results: LabelMapping[] = [];
  for (const mapping of labelMappings.values()) {
    if (mapping.profile_id === profile_id) {
      results.push(mapping);
    }
  }
  return results.sort((a, b) => a.priority - b.priority);
}

export async function upsertLabelMapping(input: CreateLabelMappingInput): Promise<LabelMapping> {
  for (const mapping of labelMappings.values()) {
    if (mapping.profile_id === input.profile_id && mapping.ner_label === input.ner_label) {
      const updated: LabelMapping = {
        ...mapping,
        target_entity_kinds: input.target_entity_kinds,
        priority: input.priority ?? mapping.priority,
      };
      labelMappings.set(updated.mapping_id, updated);
      return updated;
    }
  }
  
  const newMapping: LabelMapping = {
    mapping_id: generateId(),
    profile_id: input.profile_id,
    ner_label: input.ner_label,
    target_entity_kinds: input.target_entity_kinds,
    priority: input.priority ?? 0,
    created_at: Date.now(),
  };
  labelMappings.set(newMapping.mapping_id, newMapping);
  return newMapping;
}

export async function deleteLabelMapping(mapping_id: string): Promise<void> {
  labelMappings.delete(mapping_id);
}

export async function getIgnoreList(profile_id: string): Promise<IgnoreEntry[]> {
  const results: IgnoreEntry[] = [];
  for (const entry of ignoreEntries.values()) {
    if (entry.profile_id === profile_id) {
      results.push(entry);
    }
  }
  return results;
}

export async function addToIgnoreList(input: CreateIgnoreEntryInput): Promise<IgnoreEntry> {
  const newEntry: IgnoreEntry = {
    ignore_id: generateId(),
    profile_id: input.profile_id,
    surface_form: input.surface_form,
    ner_label: input.ner_label,
    created_at: Date.now(),
  };
  ignoreEntries.set(newEntry.ignore_id, newEntry);
  return newEntry;
}

export async function removeFromIgnoreList(ignore_id: string): Promise<void> {
  ignoreEntries.delete(ignore_id);
}
