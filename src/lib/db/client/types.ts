// ============================================
// WORKER MESSAGE TYPES
// ============================================

export type WorkerMessageType =
  | 'INIT'
  | 'EXEC'
  | 'QUERY'
  // Node operations
  | 'INSERT_NODE'
  | 'UPDATE_NODE'
  | 'DELETE_NODE'
  | 'GET_NODE'
  | 'GET_ALL_NODES'
  | 'GET_NODES_BY_TYPE'
  | 'GET_NODES_BY_PARENT'
  | 'GET_NODES_BY_ENTITY_KIND'
  // Edge operations
  | 'INSERT_EDGE'
  | 'UPDATE_EDGE'
  | 'DELETE_EDGE'
  | 'GET_EDGE'
  | 'GET_EDGES_BY_SOURCE'
  | 'GET_EDGES_BY_TARGET'
  | 'GET_EDGES_BETWEEN'
  | 'GET_ALL_EDGES'
  // Embedding operations
  | 'INSERT_EMBEDDING'
  | 'UPDATE_EMBEDDING'
  | 'GET_EMBEDDING'
  | 'GET_ALL_EMBEDDINGS'
  | 'DELETE_EMBEDDING'
  // Batch operations
  | 'BATCH_SYNC'
  | 'BATCH_INSERT_EDGES'
  // Metadata operations
  | 'GET_META'
  | 'SET_META'
  // FTS operations
  | 'FTS_SEARCH'
  // ResoRank cache operations
  | 'GET_RESORANK_CACHE'
  | 'SET_RESORANK_CACHE'
  | 'CLEAR_RESORANK_CACHE'
  // Transaction operations (Weapons-Grade Sync)
  | 'TRANSACTION_EXECUTE';

export interface WorkerMessage {
  id: string;
  type: WorkerMessageType;
  payload: unknown;
}

export interface WorkerResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================
// NODE TYPES (Full Schema)
// ============================================

export type NodeType = 'NOTE' | 'FOLDER' | 'ENTITY' | 'BLUEPRINT' | 'TEMPORAL';

export interface SQLiteNode {
  id: string;
  type: NodeType;
  label: string;
  content: string | null;
  parent_id: string | null;
  depth: number;

  // Entity classification
  entity_kind: string | null;
  entity_subtype: string | null;
  is_entity: number;
  source_note_id: string | null;

  // Blueprint system
  blueprint_id: string | null;

  // Narrative ordering
  sequence: number | null;

  // Display properties
  color: string | null;
  is_pinned: number;
  favorite: number;

  // Timestamps
  created_at: number;
  updated_at: number;

  // Complex data (JSON strings)
  attributes: string | null;
  extraction: string | null;
  temporal: string | null;
  narrative_metadata: string | null;
  scene_metadata: string | null;
  event_metadata: string | null;
  blueprint_data: string | null;

  // Inherited context
  inherited_kind: string | null;
  inherited_subtype: string | null;

  // Type flags
  is_typed_root: number;
  is_subtype_root: number;
}

export interface SQLiteNodeInput {
  id?: string;
  type: NodeType;
  label: string;
  content?: string | null;
  parent_id?: string | null;
  depth?: number;

  // Entity classification
  entity_kind?: string | null;
  entity_subtype?: string | null;
  is_entity?: boolean;
  source_note_id?: string | null;

  // Blueprint system
  blueprint_id?: string | null;

  // Narrative ordering
  sequence?: number | null;

  // Display properties
  color?: string | null;
  is_pinned?: boolean;
  favorite?: boolean;

  // Complex data (will be JSON.stringify'd)
  attributes?: Record<string, unknown> | null;
  extraction?: ExtractionData | null;
  temporal?: TemporalData | null;
  narrative_metadata?: NarrativeMetadata | null;
  scene_metadata?: SceneMetadata | null;
  event_metadata?: EventMetadata | null;
  blueprint_data?: BlueprintData | null;

  // Inherited context
  inherited_kind?: string | null;
  inherited_subtype?: string | null;

  // Type flags
  is_typed_root?: boolean;
  is_subtype_root?: boolean;
}

// ============================================
// EDGE TYPES
// ============================================

export interface SQLiteEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  context: string | null;
  bidirectional: number;
  temporal_relation: string | null;
  causality: string | null;
  note_ids: string | null;
  extraction_method: string | null;
  created_at: number;
  properties: string | null;
}

export interface SQLiteEdgeInput {
  id?: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  context?: string | null;
  bidirectional?: boolean;
  temporal_relation?: TemporalRelation | null;
  causality?: CausalityData | null;
  note_ids?: string[];
  extraction_method?: 'regex' | 'ner' | 'llm' | 'manual' | null;
  properties?: Record<string, unknown> | null;
}

// ============================================
// JSON FIELD TYPES
// ============================================

export interface ExtractionData {
  method: 'regex' | 'ner' | 'llm' | 'manual';
  confidence: number;
  mentions: EntityMention[];
  frequency: number;
}

export interface EntityMention {
  noteId: string;
  position: { start: number; end: number };
  context: string;
}

export interface TemporalData {
  start: string;
  end?: string;
  duration?: number;
  precision: 'minute' | 'hour' | 'day' | 'month' | 'year';
  timezone?: string;
  fuzzy?: {
    type: 'circa' | 'before' | 'after' | 'between';
    range?: [string, string];
  };
}

export interface NarrativeMetadata {
  sequence?: number;
  arc?: string;
  chapter?: string;
  scene?: string;
  beat?: string;
  pov?: string;
  mood?: string;
  location?: string;
}

export interface SceneMetadata {
  location: string;
  secondaryLocations?: string[];
  povCharacterId?: string;
  participants: string[];
  sceneType: 'setup' | 'conflict' | 'revelation' | 'transition' | 'climax' | 'resolution';
  conflict?: string;
  sensoryDetails?: string;
  timeOfDay?: string;
}

export interface EventMetadata {
  eventType: 'plot' | 'historical' | 'personal' | 'world' | 'background';
  scope: 'personal' | 'local' | 'regional' | 'global' | 'cosmic';
  participants: string[];
  impact: 'minor' | 'moderate' | 'major' | 'catastrophic';
  visibility: 'secret' | 'private' | 'public' | 'legendary';
  description?: string;
  causeEventId?: string;
  consequenceEventIds?: string[];
}

export interface BlueprintData {
  entityKind: string;
  schema: Record<string, BlueprintFieldSchema>;
}

export interface BlueprintFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'text' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  items?: { type: string };
}

export interface TemporalRelation {
  relationType: 'BEFORE' | 'AFTER' | 'DURING' | 'OVERLAPS' | 'MEETS';
  confidence: number;
  offset?: number;
}

export interface CausalityData {
  strength: number;
  directness: 'direct' | 'indirect';
  necessity: number;
  sufficiency: number;
  delay?: number;
  certainty: number;
}

// ============================================
// EMBEDDING TYPES
// ============================================

export interface SQLiteEmbedding {
  node_id: string;
  text: string;
  embedding_small: Uint8Array | null;
  embedding_medium: Uint8Array | null;
  model_small: string | null;
  model_medium: string | null;
  content_hash: string;
  created_at: number;
  updated_at: number;
}

export interface SQLiteEmbeddingInput {
  node_id: string;
  text: string;
  embedding: Float32Array;
  model: 'small' | 'medium';
  content_hash: string;
}

// ============================================
// METADATA & CACHE TYPES
// ============================================

export interface SQLiteMetadata {
  key: string;
  value: string;
  updated_at: number;
}

export interface ResoRankCacheEntry {
  term: string;
  doc_frequency: number;
  idf: number;
  computed_at: number;
}

// ============================================
// FTS TYPES
// ============================================

export interface FTSSearchResult {
  node_id: string;
  label: string;
  content: string;
  rank: number;
}

export interface FTSSearchOptions {
  query: string;
  type?: NodeType;
  entity_kind?: string;
  limit?: number;
}

// ============================================
// CONSTANTS
// ============================================

export const EMBEDDING_DIMS = {
  small: 256,
  medium: 768,
} as const;

export const EMBEDDING_MODELS = {
  small: 'mdbr-leaf-ir',
  medium: 'modernbert-embed-base',
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function float32ToBlob(arr: Float32Array): Uint8Array {
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}

export function blobToFloat32(blob: Uint8Array): Float32Array {
  const buffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
  return new Float32Array(buffer);
}

export function serializeJson<T>(data: T | null | undefined): string | null {
  if (data === null || data === undefined) return null;
  return JSON.stringify(data);
}

export function parseJson<T>(data: string | null | undefined): T | null {
  if (data === null || data === undefined) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
