// Blueprint Hub Type Definitions
// Comprehensive interfaces for all blueprint entities aligned with CozoDB schema

// ==================== Core Data Types ====================

export type FieldDataType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'json' 
  | 'uuid' 
  | 'text' 
  | 'enum'
  | 'reference';

export type RelationshipDirection = 'directed' | 'undirected' | 'bidirectional';

export type RelationshipCardinality = 
  | 'one_to_one' 
  | 'one_to_many' 
  | 'many_to_one' 
  | 'many_to_many';

export type VersionStatus = 'draft' | 'published' | 'archived' | 'deprecated';

export type ViewType = 
  | 'card' 
  | 'table' 
  | 'form' 
  | 'kanban' 
  | 'timeline' 
  | 'graph' 
  | 'custom';

// ==================== Validation & UI Hints ====================

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'custom' | 'required' | 'unique';
  value?: number | string | boolean;
  message?: string;
  customValidator?: string; // Reference to custom validator function
}

export interface UIHints {
  placeholder?: string;
  helpText?: string;
  widget?: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'datepicker' | 'colorpicker' | 'reference-picker';
  options?: Array<{ label: string; value: string | number }>;
  multiline?: boolean;
  rows?: number;
  readonly?: boolean;
  hidden?: boolean;
  conditional?: {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'notIn';
    value: unknown;
  };
}

// ==================== Blueprint Meta ====================

export interface BlueprintMeta {
  blueprint_id: string;
  name: string;
  description?: string;
  category?: string;
  author?: string;
  tags: string[];
  is_system: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateBlueprintMetaInput {
  name: string;
  description?: string;
  category?: string;
  author?: string;
  tags?: string[];
  is_system?: boolean;
}

// ==================== Blueprint Version ====================

export interface BlueprintVersion {
  version_id: string;
  blueprint_id: string;
  version_number: number;
  status: VersionStatus;
  change_summary?: string;
  published_at?: number;
  created_at: number;
}

export interface CreateVersionInput {
  blueprint_id: string;
  change_summary?: string;
  status?: VersionStatus;
}

// ==================== Entity Type Definition ====================

export interface EntityTypeDef {
  entity_type_id: string;
  version_id: string;
  entity_kind: string;
  entity_subtype?: string;
  display_name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_abstract: boolean;
  parent_type_id?: string;
  created_at: number;
}

export interface CreateEntityTypeInput {
  version_id: string;
  entity_kind: string;
  entity_subtype?: string;
  display_name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_abstract?: boolean;
  parent_type_id?: string;
}

// ==================== Field Definition ====================

export interface FieldDef {
  field_id: string;
  entity_type_id: string;
  field_name: string;
  display_label: string;
  data_type: FieldDataType;
  is_required: boolean;
  is_array: boolean;
  default_value?: string;
  validation_rules?: ValidationRule[];
  ui_hints?: UIHints;
  display_order: number;
  group_name?: string;
  description?: string;
  created_at: number;
}

export interface CreateFieldInput {
  entity_type_id: string;
  field_name: string;
  display_label: string;
  data_type: FieldDataType;
  is_required?: boolean;
  is_array?: boolean;
  default_value?: string;
  validation_rules?: ValidationRule[];
  ui_hints?: UIHints;
  display_order?: number;
  group_name?: string;
  description?: string;
}

// ==================== Relationship Type Definition ====================

export interface RelationshipTypeDef {
  relationship_type_id: string;
  version_id: string;
  relationship_name: string;
  display_label: string;
  source_entity_kind: string;
  target_entity_kind: string;
  direction: RelationshipDirection;
  cardinality: RelationshipCardinality;
  is_symmetric: boolean;
  inverse_label?: string;
  description?: string;
  created_at: number;
}

export interface CreateRelationshipTypeInput {
  version_id: string;
  relationship_name: string;
  display_label: string;
  source_entity_kind: string;
  target_entity_kind: string;
  direction?: RelationshipDirection;
  cardinality?: RelationshipCardinality;
  is_symmetric?: boolean;
  inverse_label?: string;
  description?: string;
}

// ==================== Relationship Attribute ====================

export interface RelationshipAttributeDef {
  attribute_id: string;
  relationship_type_id: string;
  attribute_name: string;
  display_label: string;
  data_type: FieldDataType;
  is_required: boolean;
  default_value?: string;
  description?: string;
  created_at: number;
}

export interface CreateRelationshipAttributeInput {
  relationship_type_id: string;
  attribute_name: string;
  display_label: string;
  data_type: FieldDataType;
  is_required?: boolean;
  default_value?: string;
  description?: string;
}

// ==================== View Template ====================

export interface FieldLayoutConfig {
  fieldId: string;
  column?: number;
  row?: number;
  width?: number;
  height?: number;
  visible?: boolean;
}

export interface DisplayConfig {
  theme?: string;
  density?: 'compact' | 'comfortable' | 'spacious';
  showLabels?: boolean;
  groupByField?: string;
  sortByField?: string;
  sortOrder?: 'asc' | 'desc';
  customStyles?: Record<string, unknown>;
}

export interface ViewTemplateDef {
  view_id: string;
  version_id: string;
  view_name: string;
  view_type: ViewType;
  entity_kind?: string;
  field_layout?: FieldLayoutConfig[];
  display_config?: DisplayConfig;
  is_default: boolean;
  description?: string;
  created_at: number;
}

export interface CreateViewTemplateInput {
  version_id: string;
  view_name: string;
  view_type: ViewType;
  entity_kind?: string;
  field_layout?: FieldLayoutConfig[];
  display_config?: DisplayConfig;
  is_default?: boolean;
  description?: string;
}

// ==================== MOC (Map of Content) ====================

export interface GroupingRule {
  field: string;
  order?: 'asc' | 'desc';
  separator?: string;
}

export interface FilterRule {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
  logicalOp?: 'AND' | 'OR';
}

export interface SortRule {
  field: string;
  order: 'asc' | 'desc';
  priority?: number;
}

export interface MOCViewConfig {
  showCount?: boolean;
  showMetadata?: boolean;
  expandedByDefault?: boolean;
  customTemplate?: string;
}

export interface MOCDef {
  moc_id: string;
  version_id: string;
  moc_name: string;
  entity_kinds: string[];
  grouping_rules?: GroupingRule[];
  filter_rules?: FilterRule[];
  sort_rules?: SortRule[];
  view_config?: MOCViewConfig;
  description?: string;
  created_at: number;
}

export interface CreateMOCInput {
  version_id: string;
  moc_name: string;
  entity_kinds: string[];
  grouping_rules?: GroupingRule[];
  filter_rules?: FilterRule[];
  sort_rules?: SortRule[];
  view_config?: MOCViewConfig;
  description?: string;
}

// ==================== Compiled Blueprint ====================

export interface CompiledEntityType extends EntityTypeDef {
  fields: FieldDef[];
  parentType?: CompiledEntityType;
  childTypes: CompiledEntityType[];
}

export interface CompiledRelationshipType extends RelationshipTypeDef {
  attributes: RelationshipAttributeDef[];
}

export interface CompiledBlueprint {
  meta: BlueprintMeta;
  version: BlueprintVersion;
  entityTypes: CompiledEntityType[];
  relationshipTypes: CompiledRelationshipType[];
  viewTemplates: ViewTemplateDef[];
  mocs: MOCDef[];
  extractionProfile?: ExtractionProfile & {
    labelMappings: LabelMapping[];
    ignoreList: IgnoreEntry[];
  };
}

// ==================== Query Result Types ====================

export interface BlueprintMetaRow {
  blueprint_id: string;
  name: string;
  description: string | null;
  category: string | null;
  author: string | null;
  tags: string[];
  is_system: boolean;
  created_at: number;
  updated_at: number;
}

export interface BlueprintVersionRow {
  version_id: string;
  blueprint_id: string;
  version_number: number;
  status: string;
  change_summary: string | null;
  published_at: number | null;
  created_at: number;
}

export interface EntityTypeRow {
  entity_type_id: string;
  version_id: string;
  entity_kind: string;
  entity_subtype: string | null;
  display_name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_abstract: boolean;
  parent_type_id: string | null;
  created_at: number;
}

export interface FieldRow {
  field_id: string;
  entity_type_id: string;
  field_name: string;
  display_label: string;
  data_type: string;
  is_required: boolean;
  is_array: boolean;
  default_value: string | null;
  validation_rules: unknown;
  ui_hints: unknown;
  display_order: number;
  group_name: string | null;
  description: string | null;
  created_at: number;
}

export interface RelationshipTypeRow {
  relationship_type_id: string;
  version_id: string;
  relationship_name: string;
  display_label: string;
  source_entity_kind: string;
  target_entity_kind: string;
  direction: string;
  cardinality: string;
  is_symmetric: boolean;
  inverse_label: string | null;
  description: string | null;
  created_at: number;
}

export interface RelationshipAttributeRow {
  attribute_id: string;
  relationship_type_id: string;
  attribute_name: string;
  display_label: string;
  data_type: string;
  is_required: boolean;
  default_value: string | null;
  description: string | null;
  created_at: number;
}

export interface ViewTemplateRow {
  view_id: string;
  version_id: string;
  view_name: string;
  view_type: string;
  entity_kind: string | null;
  field_layout: unknown;
  display_config: unknown;
  is_default: boolean;
  description: string | null;
  created_at: number;
}

export interface MOCRow {
  moc_id: string;
  version_id: string;
  moc_name: string;
  entity_kinds: string[];
  grouping_rules: unknown;
  filter_rules: unknown;
  sort_rules: unknown;
  view_config: unknown;
  description: string | null;
  created_at: number;
}

// ==================== Utility Types ====================

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ==================== Extraction Profile Types ====================

export type ResolutionPolicy = 'entity_on_accept' | 'mention_first';

export interface ExtractionProfile {
  profile_id: string;
  version_id: string;
  enabled: boolean;
  model_id: string;
  confidence_threshold: number;
  resolution_policy: ResolutionPolicy;
  created_at: number;
}

export interface CreateExtractionProfileInput {
  version_id: string;
  enabled?: boolean;
  model_id?: string;
  confidence_threshold?: number;
  resolution_policy?: ResolutionPolicy;
}

export interface LabelMapping {
  mapping_id: string;
  profile_id: string;
  ner_label: string;
  target_entity_kinds: string[];
  priority: number;
  created_at: number;
}

export interface CreateLabelMappingInput {
  profile_id: string;
  ner_label: string;
  target_entity_kinds: string[];
  priority?: number;
}

export interface IgnoreEntry {
  ignore_id: string;
  profile_id: string;
  surface_form?: string;
  ner_label?: string;
  created_at: number;
}

export interface CreateIgnoreEntryInput {
  profile_id: string;
  surface_form?: string;
  ner_label?: string;
}
