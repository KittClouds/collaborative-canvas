import { generateId } from '@/lib/utils/ids';
import type {
  IBlueprintStore,
} from '../interfaces';
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
} from '@/features/blueprint-hub/types';

export class BlueprintStoreImpl implements IBlueprintStore {
  private blueprintMetas: Map<string, BlueprintMeta> = new Map();
  private versions: Map<string, BlueprintVersion> = new Map();
  private entityTypes: Map<string, EntityTypeDef> = new Map();
  private fields: Map<string, FieldDef> = new Map();
  private relationshipTypes: Map<string, RelationshipTypeDef> = new Map();
  private relationshipAttributes: Map<string, RelationshipAttributeDef> = new Map();
  private viewTemplates: Map<string, ViewTemplateDef> = new Map();
  private mocs: Map<string, MOCDef> = new Map();

  private versionCounter: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    console.log('BlueprintStore initialized (in-memory)');
  }

  async getBlueprintMetaById(id: string): Promise<BlueprintMeta | null> {
    return this.blueprintMetas.get(id) || null;
  }

  async createBlueprintMeta(input: CreateBlueprintMetaInput): Promise<BlueprintMeta> {
    const now = Date.now();
    const blueprint_id = generateId();

    const meta: BlueprintMeta = {
      blueprint_id,
      name: input.name,
      description: input.description,
      category: input.category,
      author: input.author,
      tags: input.tags || [],
      is_system: input.is_system ?? false,
      created_at: now,
      updated_at: now,
    };

    this.blueprintMetas.set(blueprint_id, meta);
    return meta;
  }

  async updateBlueprintMeta(id: string, updates: Partial<CreateBlueprintMetaInput>): Promise<BlueprintMeta> {
    const existing = this.blueprintMetas.get(id);
    if (!existing) {
      throw new Error(`Blueprint meta not found: ${id}`);
    }

    const updated: BlueprintMeta = {
      ...existing,
      ...updates,
      updated_at: Date.now(),
    };

    this.blueprintMetas.set(id, updated);
    return updated;
  }

  async getAllBlueprintMetas(): Promise<BlueprintMeta[]> {
    return Array.from(this.blueprintMetas.values());
  }

  async deleteBlueprintMeta(id: string): Promise<void> {
    this.blueprintMetas.delete(id);
  }

  async getVersionById(id: string): Promise<BlueprintVersion | null> {
    return this.versions.get(id) || null;
  }

  async getVersionsByBlueprintId(blueprintId: string): Promise<BlueprintVersion[]> {
    return Array.from(this.versions.values())
      .filter(v => v.blueprint_id === blueprintId)
      .sort((a, b) => b.version_number - a.version_number);
  }

  async createVersion(input: CreateVersionInput): Promise<BlueprintVersion> {
    const now = Date.now();
    const version_id = generateId();
    
    const currentCounter = this.versionCounter.get(input.blueprint_id) || 0;
    const version_number = currentCounter + 1;
    this.versionCounter.set(input.blueprint_id, version_number);

    const version: BlueprintVersion = {
      version_id,
      blueprint_id: input.blueprint_id,
      version_number,
      status: input.status || 'draft',
      change_summary: input.change_summary,
      published_at: input.status === 'published' ? now : undefined,
      created_at: now,
    };

    this.versions.set(version_id, version);
    return version;
  }

  async updateVersionStatus(id: string, status: VersionStatus): Promise<void> {
    const version = this.versions.get(id);
    if (!version) return;

    version.status = status;
    if (status === 'published') {
      version.published_at = Date.now();
    }
  }

  async deleteVersion(id: string): Promise<void> {
    this.versions.delete(id);
  }

  async getEntityTypeById(id: string): Promise<EntityTypeDef | null> {
    return this.entityTypes.get(id) || null;
  }

  async getEntityTypesByVersionId(versionId: string): Promise<EntityTypeDef[]> {
    return Array.from(this.entityTypes.values())
      .filter(et => et.version_id === versionId);
  }

  async createEntityType(input: CreateEntityTypeInput): Promise<EntityTypeDef> {
    const now = Date.now();
    const entity_type_id = generateId();

    const entityType: EntityTypeDef = {
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

    this.entityTypes.set(entity_type_id, entityType);
    return entityType;
  }

  async updateEntityType(id: string, updates: Partial<CreateEntityTypeInput>): Promise<EntityTypeDef> {
    const existing = this.entityTypes.get(id);
    if (!existing) {
      throw new Error(`Entity type not found: ${id}`);
    }

    const updated: EntityTypeDef = {
      ...existing,
      ...updates,
    };

    this.entityTypes.set(id, updated);
    return updated;
  }

  async deleteEntityType(id: string): Promise<void> {
    this.entityTypes.delete(id);
  }

  async getFieldById(id: string): Promise<FieldDef | null> {
    return this.fields.get(id) || null;
  }

  async getFieldsByEntityTypeId(entityTypeId: string): Promise<FieldDef[]> {
    return Array.from(this.fields.values())
      .filter(f => f.entity_type_id === entityTypeId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  async createField(input: CreateFieldInput): Promise<FieldDef> {
    const now = Date.now();
    const field_id = generateId();

    const existingFields = await this.getFieldsByEntityTypeId(input.entity_type_id);
    const display_order = input.display_order ?? existingFields.length;

    const field: FieldDef = {
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
      display_order,
      group_name: input.group_name,
      description: input.description,
      created_at: now,
    };

    this.fields.set(field_id, field);
    return field;
  }

  async updateField(id: string, updates: Partial<CreateFieldInput>): Promise<FieldDef> {
    const existing = this.fields.get(id);
    if (!existing) {
      throw new Error(`Field not found: ${id}`);
    }

    const updated: FieldDef = {
      ...existing,
      ...updates,
    };

    this.fields.set(id, updated);
    return updated;
  }

  async deleteField(id: string): Promise<void> {
    this.fields.delete(id);
  }

  async getRelationshipTypeById(id: string): Promise<RelationshipTypeDef | null> {
    return this.relationshipTypes.get(id) || null;
  }

  async getRelationshipTypesByVersionId(versionId: string): Promise<RelationshipTypeDef[]> {
    return Array.from(this.relationshipTypes.values())
      .filter(rt => rt.version_id === versionId);
  }

  async createRelationshipType(input: CreateRelationshipTypeInput): Promise<RelationshipTypeDef> {
    const now = Date.now();
    const relationship_type_id = generateId();

    const relationshipType: RelationshipTypeDef = {
      relationship_type_id,
      version_id: input.version_id,
      relationship_name: input.relationship_name,
      display_label: input.display_label,
      source_entity_kind: input.source_entity_kind,
      target_entity_kind: input.target_entity_kind,
      direction: input.direction || 'directed',
      cardinality: input.cardinality || 'many_to_many',
      is_symmetric: input.is_symmetric ?? false,
      inverse_label: input.inverse_label,
      description: input.description,
      created_at: now,
    };

    this.relationshipTypes.set(relationship_type_id, relationshipType);
    return relationshipType;
  }

  async updateRelationshipType(id: string, updates: Partial<CreateRelationshipTypeInput>): Promise<RelationshipTypeDef> {
    const existing = this.relationshipTypes.get(id);
    if (!existing) {
      throw new Error(`Relationship type not found: ${id}`);
    }

    const updated: RelationshipTypeDef = {
      ...existing,
      ...updates,
    };

    this.relationshipTypes.set(id, updated);
    return updated;
  }

  async deleteRelationshipType(id: string): Promise<void> {
    this.relationshipTypes.delete(id);
  }

  async getRelationshipAttributeById(id: string): Promise<RelationshipAttributeDef | null> {
    return this.relationshipAttributes.get(id) || null;
  }

  async getRelationshipAttributesByTypeId(relationshipTypeId: string): Promise<RelationshipAttributeDef[]> {
    return Array.from(this.relationshipAttributes.values())
      .filter(ra => ra.relationship_type_id === relationshipTypeId);
  }

  async createRelationshipAttribute(input: CreateRelationshipAttributeInput): Promise<RelationshipAttributeDef> {
    const now = Date.now();
    const attribute_id = generateId();

    const attribute: RelationshipAttributeDef = {
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

    this.relationshipAttributes.set(attribute_id, attribute);
    return attribute;
  }

  async deleteRelationshipAttribute(id: string): Promise<void> {
    this.relationshipAttributes.delete(id);
  }

  async getViewTemplateById(id: string): Promise<ViewTemplateDef | null> {
    return this.viewTemplates.get(id) || null;
  }

  async getViewTemplatesByVersionId(versionId: string): Promise<ViewTemplateDef[]> {
    return Array.from(this.viewTemplates.values())
      .filter(vt => vt.version_id === versionId);
  }

  async createViewTemplate(input: CreateViewTemplateInput): Promise<ViewTemplateDef> {
    const now = Date.now();
    const view_id = generateId();

    const viewTemplate: ViewTemplateDef = {
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

    this.viewTemplates.set(view_id, viewTemplate);
    return viewTemplate;
  }

  async updateViewTemplate(id: string, updates: Partial<CreateViewTemplateInput>): Promise<ViewTemplateDef> {
    const existing = this.viewTemplates.get(id);
    if (!existing) {
      throw new Error(`View template not found: ${id}`);
    }

    const updated: ViewTemplateDef = {
      ...existing,
      ...updates,
    };

    this.viewTemplates.set(id, updated);
    return updated;
  }

  async deleteViewTemplate(id: string): Promise<void> {
    this.viewTemplates.delete(id);
  }

  async getMOCById(id: string): Promise<MOCDef | null> {
    return this.mocs.get(id) || null;
  }

  async getMOCsByVersionId(versionId: string): Promise<MOCDef[]> {
    return Array.from(this.mocs.values())
      .filter(moc => moc.version_id === versionId);
  }

  async createMOC(input: CreateMOCInput): Promise<MOCDef> {
    const now = Date.now();
    const moc_id = generateId();

    const moc: MOCDef = {
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

    this.mocs.set(moc_id, moc);
    return moc;
  }

  async updateMOC(id: string, updates: Partial<CreateMOCInput>): Promise<MOCDef> {
    const existing = this.mocs.get(id);
    if (!existing) {
      throw new Error(`MOC not found: ${id}`);
    }

    const updated: MOCDef = {
      ...existing,
      ...updates,
    };

    this.mocs.set(id, updated);
    return updated;
  }

  async deleteMOC(id: string): Promise<void> {
    this.mocs.delete(id);
  }

  createDefaultBlueprint(id: string = 'default'): BlueprintMeta {
    const now = Date.now();
    const meta: BlueprintMeta = {
      blueprint_id: id,
      name: 'Default Blueprint',
      description: 'Default blueprint project',
      category: 'system',
      author: undefined,
      tags: [],
      is_system: true,
      created_at: now,
      updated_at: now,
    };
    this.blueprintMetas.set(id, meta);
    return meta;
  }
}

let blueprintStoreInstance: BlueprintStoreImpl | null = null;

export function getBlueprintStoreImpl(): BlueprintStoreImpl {
  if (!blueprintStoreInstance) {
    blueprintStoreInstance = new BlueprintStoreImpl();
  }
  return blueprintStoreInstance;
}

export function resetBlueprintStore(): void {
  blueprintStoreInstance = null;
}
