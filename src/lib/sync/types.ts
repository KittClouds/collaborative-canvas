import type { EntityKind } from '@/lib/entities/entityTypes';

export interface SyncNote {
  id: string;
  title: string;
  content: string;
  contentText: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  entityKind: EntityKind | null;
  entitySubtype: string | null;
  entityLabel: string | null;
  isCanonicalEntity: boolean;
  isPinned: boolean;
  isFavorite: boolean;
  tags: string[];
}

export interface SyncFolder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  createdAt: number;
  color: string | null;
  entityKind: EntityKind | null;
  entitySubtype: string | null;
  entityLabel: string | null;
  isTypedRoot: boolean;
  isSubtypeRoot: boolean;
  inheritedKind: EntityKind | null;
  inheritedSubtype: string | null;
}

export type EntitySource = 'blueprint' | 'extracted' | 'concept' | 'manual';

export type ProvenanceSource = 'ner' | 'llm' | 'regex' | 'wikilink' | 'blueprint' | 'manual' | 'title';

export interface ProvenanceRecord {
  source: ProvenanceSource;
  extractorVersion?: string;
  confidence: number;
  timestamp: number;
  noteId?: string;
}

export interface AlternateTypeInterpretation {
  entityKind: string;
  entitySubtype?: string;
  source: string;
  confidence: number;
  reason?: string;
}

export interface SyncEntity {
  id: string;
  name: string;
  normalizedName: string;
  entityKind: string;
  entitySubtype: string | null;
  groupId: string;
  scopeType: 'note' | 'folder' | 'vault';
  frequency: number;
  canonicalNoteId: string | null;
  aliases: string[];
  summary: string | null;
  createdAt: number;
  extractionMethod: 'regex' | 'llm' | 'manual';
  source: EntitySource;
  confidence: number;
  blueprintTypeId: string | null;
  blueprintVersionId: string | null;
  blueprintFields: Record<string, unknown> | null;
  provenanceData: ProvenanceRecord[];
  alternateTypes: AlternateTypeInterpretation[];
}

export interface SyncEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  weight: number;
  groupId: string;
  scopeType: 'note' | 'folder' | 'vault';
  createdAt: number;
  validAt: number;
  invalidAt: number | null;
  confidence: number;
  fact: string | null;
  episodeIds: string[];
  noteIds: string[];
}

export interface SyncWikilink {
  id: string;
  sourceNoteId: string;
  targetTitle: string;
  targetNoteId: string | null;
  displayText: string | null;
  linkType: 'wikilink' | 'entity' | 'mention';
  context: string | null;
  charPosition: number | null;
  createdAt: number;
}

export type MutationType =
  | 'CREATE_NOTE'
  | 'UPDATE_NOTE'
  | 'DELETE_NOTE'
  | 'CREATE_FOLDER'
  | 'UPDATE_FOLDER'
  | 'DELETE_FOLDER'
  | 'CREATE_EDGE'
  | 'DELETE_EDGE'
  | 'UPSERT_ENTITY'
  | 'DELETE_ENTITY'
  | 'CREATE_WIKILINK'
  | 'DELETE_WIKILINK';

export interface Mutation<T = unknown> {
  id: string;
  type: MutationType;
  payload: T;
  timestamp: number;
  status: 'pending' | 'committed' | 'failed';
}

export interface CreateNotePayload {
  id?: string;
  title: string;
  content?: string;
  folderId?: string | null;
  entityKind?: EntityKind | null;
  entitySubtype?: string | null;
  entityLabel?: string | null;
  isCanonicalEntity?: boolean;
  isPinned?: boolean;
  isFavorite?: boolean;
  tags?: string[];
}

export interface UpdateNotePayload {
  id: string;
  patch: Partial<Omit<SyncNote, 'id' | 'createdAt'>>;
}

export interface CreateFolderPayload {
  id?: string;
  name: string;
  parentId?: string | null;
  color?: string | null;
  entityKind?: EntityKind | null;
  entitySubtype?: string | null;
  entityLabel?: string | null;
  isTypedRoot?: boolean;
  isSubtypeRoot?: boolean;
  inheritedKind?: EntityKind | null;
  inheritedSubtype?: string | null;
}

export interface UpdateFolderPayload {
  id: string;
  patch: Partial<Omit<SyncFolder, 'id' | 'createdAt'>>;
}

export interface CreateEdgePayload {
  id?: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  weight?: number;
  groupId: string;
  scopeType: 'note' | 'folder' | 'vault';
  confidence?: number;
  fact?: string | null;
  episodeIds?: string[];
  noteIds?: string[];
}

export interface UpsertEntityPayload {
  id?: string;
  name: string;
  entityKind: string;
  entitySubtype?: string | null;
  groupId: string;
  scopeType: 'note' | 'folder' | 'vault';
  frequency?: number;
  canonicalNoteId?: string | null;
  aliases?: string[];
  summary?: string | null;
  extractionMethod?: 'regex' | 'llm' | 'manual';
  source?: EntitySource;
  confidence?: number;
  blueprintTypeId?: string | null;
  blueprintVersionId?: string | null;
  blueprintFields?: Record<string, unknown> | null;
  provenanceData?: ProvenanceRecord[];
  alternateTypes?: AlternateTypeInterpretation[];
}

export type GraphNodeType = 'note' | 'blueprint_entity' | 'extracted_entity' | 'concept' | 'folder';

export type EdgeSourceType = 'wikilink' | 'cooccurrence' | 'blueprint_relation' | 'semantic' | 'temporal' | 'spatial' | 'llm_extraction' | 'ner_cooccurrence';

export const EDGE_CONFIDENCE_WEIGHTS: Record<EdgeSourceType, number> = {
  blueprint_relation: 1.0,
  wikilink: 0.95,
  llm_extraction: 0.8,
  ner_cooccurrence: 0.7,
  semantic: 0.6,
  temporal: 0.5,
  spatial: 0.5,
  cooccurrence: 0.4,
};

export interface GraphNode {
  id: string;
  label: string;
  nodeType: GraphNodeType;
  kind: string;
  subtype: string | null;
  frequency: number;
  noteIds: string[];
  size: number;
  color: string;
  x?: number;
  y?: number;
  confidence: number;
  provenance: string[];
  alternateTypes?: AlternateTypeInterpretation[];
  blueprintTypeId?: string;
  blueprintFields?: Record<string, unknown>;
  parentId?: string;
  isCanonical?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  width: number;
  edgeSource: EdgeSourceType;
  confidence: number;
  isHighConfidence: boolean;
}

export interface CentralityScores {
  degree: number;
  betweenness: number;
  closeness: number;
}

export interface CentralityConfig {
  confidenceThreshold: number;
  includeExtractedEntities: boolean;
  includeConcepts: boolean;
  minEdgeWeight: number;
}

export const DEFAULT_CENTRALITY_CONFIG: CentralityConfig = {
  confidenceThreshold: 0.5,
  includeExtractedEntities: true,
  includeConcepts: true,
  minEdgeWeight: 0,
};

export interface GraphProjection {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: Map<string, GraphNode>;
  adjacencyList: Map<string, Set<string>>;
  nodesByKind: Map<string, GraphNode[]>;
  nodesByType: Map<GraphNodeType, GraphNode[]>;
  nodesByFolder: Map<string, GraphNode[]>;
  centrality: Map<string, CentralityScores>;
  communities: Map<string, string>;
  lastUpdated: number;
  isDirty: boolean;
  confidenceThreshold: number;
}

export interface AppState {
  notes: SyncNote[];
  folders: SyncFolder[];
  entities: SyncEntity[];
  edges: SyncEdge[];
  notesById: Map<string, SyncNote>;
  foldersById: Map<string, SyncFolder>;
  entitiesById: Map<string, SyncEntity>;
  edgesById: Map<string, SyncEdge>;
  graphProjection: GraphProjection;
  isHydrated: boolean;
  lastSyncAt: number | null;
}

export interface SyncMetrics {
  flushCount: number;
  avgFlushTimeMs: number;
  totalMutations: number;
  failedMutations: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
}
