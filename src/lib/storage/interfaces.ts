import type { EntityKind } from '@/lib/types/entityTypes';
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

export type GraphScope = 'note' | 'folder' | 'vault';
export type ExtractionMethod = 'regex' | 'llm' | 'ner' | 'manual';

export interface Entity {
  id: string;
  name: string;
  entity_kind: string;
  entity_subtype?: string | null;
  group_id: string;
  scope_type: string;
  created_at: number;
  extraction_method: string;
  summary?: string | null;
  aliases: string[];
  canonical_note_id?: string | null;
  frequency: number;
  degree_centrality?: number | null;
  betweenness_centrality?: number | null;
  closeness_centrality?: number | null;
  community_id?: string | null;
  attributes?: Record<string, unknown>;
  temporal_span?: unknown;
  participants: string[];
}

export interface CreateEntityInput {
  name: string;
  entity_kind: string;
  entity_subtype?: string;
  group_id: string;
  scope_type?: string;
  summary?: string;
  aliases?: string[];
  canonical_note_id?: string;
  attributes?: Record<string, unknown>;
}

export interface EntityEdge {
  id: string;
  source_id: string;
  target_id: string;
  created_at: number;
  valid_at: number;
  invalid_at?: number | null;
  group_id: string;
  scope_type: string;
  edge_type: string;
  fact?: string | null;
  episode_ids: string[];
  note_ids: string[];
  weight: number;
  pmi_score?: number | null;
  confidence: number;
  extraction_methods: string[];
}

export interface CreateEdgeInput {
  source_id: string;
  target_id: string;
  group_id: string;
  edge_type?: string;
  scope_type?: string;
  confidence?: number;
  note_id?: string;
  episode_id?: string;
  spanStart?: number;
  spanEnd?: number;
}

export interface Mention {
  id: string;
  episode_id: string;
  entity_id: string;
  context: string;
  char_position: number;
  sentence_index?: number | null;
  confidence: number;
  extraction_method: string;
  created_at: number;
  status?: 'pending' | 'accepted' | 'rejected';
  resolved_entity_id?: string | null;
}

export interface CreateMentionInput {
  episode_id: string;
  entity_id?: string;
  context: string;
  char_position: number;
  sentence_index?: number | null;
  confidence?: number;
  extraction_method?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  resolved_entity_id?: string | null;
}

export interface EmbeddingRecord {
  noteId: string;
  embeddingSmall?: number[];
  embeddingMedium?: number[];
  embeddingModel?: string;
  contentHash: string;
  createdAt: number;
  updatedAt: number;
}

export interface GraphSnapshot {
  entities: Entity[];
  edges: EntityEdge[];
  timestamp: number;
}

export interface HistoryEntry {
  timestamp: number;
  action: 'create' | 'update' | 'delete';
  data: unknown;
}

export interface IEntityStore {
  upsertEntity(input: CreateEntityInput): Promise<Entity>;
  getEntityById(id: string): Promise<Entity | null>;
  findEntityByName(name: string, kind: string, groupId: string): Promise<Entity | null>;
  findEntityByNameOnly(name: string, groupId: string): Promise<Entity | null>;
  deleteEntity(id: string): Promise<void>;
  getEntitiesByKind(kind: string, groupId: string): Promise<Entity[]>;
  getAllEntities(groupId: string): Promise<Entity[]>;
  updateEntityFrequency(id: string, frequency: number): Promise<void>;
}

export interface IEdgeStore {
  createEdge(input: CreateEdgeInput): Promise<EntityEdge>;
  createMentionEdge(input: CreateEdgeInput): Promise<EntityEdge>;
  getEdgeById(id: string): Promise<EntityEdge | null>;
  getEdgesBySourceId(sourceId: string): Promise<EntityEdge[]>;
  getEdgesByTargetId(targetId: string): Promise<EntityEdge[]>;
  getEdgesBetween(sourceId: string, targetId: string): Promise<EntityEdge[]>;
  deleteEdge(id: string): Promise<void>;
  getAllEdges(groupId?: string): Promise<EntityEdge[]>;
}

export interface IMentionStore {
  createMention(input: CreateMentionInput): Promise<Mention>;
  getMentionById(id: string): Promise<Mention | null>;
  getMentionsByNoteId(noteId: string): Promise<Mention[]>;
  getMentionsByEntityId(entityId: string): Promise<Mention[]>;
  updateMentionStatus(id: string, status: 'pending' | 'accepted' | 'rejected', resolvedEntityId?: string): Promise<void>;
  deleteMention(id: string): Promise<void>;
}

export interface IBlueprintStore {
  initialize(): Promise<void>;

  getBlueprintMetaById(id: string): Promise<BlueprintMeta | null>;
  createBlueprintMeta(input: CreateBlueprintMetaInput): Promise<BlueprintMeta>;
  updateBlueprintMeta(id: string, updates: Partial<CreateBlueprintMetaInput>): Promise<BlueprintMeta>;
  getAllBlueprintMetas(): Promise<BlueprintMeta[]>;
  deleteBlueprintMeta(id: string): Promise<void>;

  getVersionById(id: string): Promise<BlueprintVersion | null>;
  getVersionsByBlueprintId(blueprintId: string): Promise<BlueprintVersion[]>;
  createVersion(input: CreateVersionInput): Promise<BlueprintVersion>;
  updateVersionStatus(id: string, status: VersionStatus): Promise<void>;
  deleteVersion(id: string): Promise<void>;

  getEntityTypeById(id: string): Promise<EntityTypeDef | null>;
  getEntityTypesByVersionId(versionId: string): Promise<EntityTypeDef[]>;
  createEntityType(input: CreateEntityTypeInput): Promise<EntityTypeDef>;
  updateEntityType(id: string, updates: Partial<CreateEntityTypeInput>): Promise<EntityTypeDef>;
  deleteEntityType(id: string): Promise<void>;

  getFieldById(id: string): Promise<FieldDef | null>;
  getFieldsByEntityTypeId(entityTypeId: string): Promise<FieldDef[]>;
  createField(input: CreateFieldInput): Promise<FieldDef>;
  updateField(id: string, updates: Partial<CreateFieldInput>): Promise<FieldDef>;
  deleteField(id: string): Promise<void>;

  getRelationshipTypeById(id: string): Promise<RelationshipTypeDef | null>;
  getRelationshipTypesByVersionId(versionId: string): Promise<RelationshipTypeDef[]>;
  createRelationshipType(input: CreateRelationshipTypeInput): Promise<RelationshipTypeDef>;
  updateRelationshipType(id: string, updates: Partial<CreateRelationshipTypeInput>): Promise<RelationshipTypeDef>;
  deleteRelationshipType(id: string): Promise<void>;

  getRelationshipAttributeById(id: string): Promise<RelationshipAttributeDef | null>;
  getRelationshipAttributesByTypeId(relationshipTypeId: string): Promise<RelationshipAttributeDef[]>;
  createRelationshipAttribute(input: CreateRelationshipAttributeInput): Promise<RelationshipAttributeDef>;
  deleteRelationshipAttribute(id: string): Promise<void>;

  getViewTemplateById(id: string): Promise<ViewTemplateDef | null>;
  getViewTemplatesByVersionId(versionId: string): Promise<ViewTemplateDef[]>;
  createViewTemplate(input: CreateViewTemplateInput): Promise<ViewTemplateDef>;
  updateViewTemplate(id: string, updates: Partial<CreateViewTemplateInput>): Promise<ViewTemplateDef>;
  deleteViewTemplate(id: string): Promise<void>;

  getMOCById(id: string): Promise<MOCDef | null>;
  getMOCsByVersionId(versionId: string): Promise<MOCDef[]>;
  createMOC(input: CreateMOCInput): Promise<MOCDef>;
  updateMOC(id: string, updates: Partial<CreateMOCInput>): Promise<MOCDef>;
  deleteMOC(id: string): Promise<void>;
}

export interface ITemporalStore {
  getSnapshot(groupId: string, timestamp: number): Promise<GraphSnapshot>;
  getEntityHistory(entityId: string): Promise<HistoryEntry[]>;
  getEdgeHistory(sourceId: string, targetId: string): Promise<HistoryEntry[]>;
  recordChange(entityId: string, action: 'create' | 'update' | 'delete', data: unknown): void;
}

export interface IEmbeddingStore {
  saveEmbedding(noteId: string, embedding: number[], model: 'small' | 'medium', contentHash: string): Promise<void>;
  getEmbedding(noteId: string): Promise<EmbeddingRecord | null>;
  getAllEmbeddings(): Promise<EmbeddingRecord[]>;
  deleteEmbedding(noteId: string): Promise<void>;
  getEmbeddingStats(scopeType: string, scopeId: string): Promise<{
    embeddingsCount: number;
    totalNotes: number;
    syncedNotes: number;
    lastSyncAt?: Date;
  } | null>;
  updateEmbeddingStats(scopeType: string, scopeId: string, stats: {
    embeddingsCount: number;
    totalNotes: number;
    syncedNotes: number;
  }): Promise<void>;
}

export interface IStorageService {
  entities: IEntityStore;
  edges: IEdgeStore;
  mentions: IMentionStore;
  blueprints: IBlueprintStore;
  temporal: ITemporalStore;
  embeddings: IEmbeddingStore;
}
