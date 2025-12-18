import { cozoDb } from '../db';
import { ENTITY_EDGE_QUERIES } from '../schema/layer2-edges';
import { v4 as uuidv4 } from 'uuid';

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

/**
 * Create a generic edge between entities
 */
export async function createEdge(input: CreateEdgeInput): Promise<EntityEdge> {
  const id = uuidv4();
  const created_at = Date.now();
  const valid_at = Date.now();

  const result = await cozoDb.runQuery(ENTITY_EDGE_QUERIES.upsert, {
    id,
    source_id: input.source_id,
    target_id: input.target_id,
    created_at,
    valid_at,
    invalid_at: null,
    group_id: input.group_id,
    scope_type: input.scope_type || 'note',
    edge_type: input.edge_type || 'RELATED_TO',
    fact: null,
    episode_ids: input.episode_id ? [input.episode_id] : [],
    note_ids: input.note_id ? [input.note_id] : [],
    weight: 1,
    pmi_score: null,
    confidence: input.confidence ?? 1.0,
    extraction_methods: [],
  });

  if (!result.ok) {
    throw new Error(`Failed to create edge: ${result.message}`);
  }

  return {
    id,
    source_id: input.source_id,
    target_id: input.target_id,
    created_at,
    valid_at,
    invalid_at: null,
    group_id: input.group_id,
    scope_type: input.scope_type || 'note',
    edge_type: input.edge_type || 'RELATED_TO',
    fact: null,
    episode_ids: input.episode_id ? [input.episode_id] : [],
    note_ids: input.note_id ? [input.note_id] : [],
    weight: 1,
    pmi_score: null,
    confidence: input.confidence ?? 1.0,
    extraction_methods: [],
  };
}

/**
 * Create a MENTIONS edge between note and entity
 */
export async function createMentionEdge(input: CreateEdgeInput): Promise<EntityEdge> {
  const id = uuidv4();
  const created_at = Date.now();
  const valid_at = Date.now();

  const result = await cozoDb.runQuery(ENTITY_EDGE_QUERIES.upsert, {
    id,
    source_id: input.source_id,
    target_id: input.target_id,
    created_at,
    valid_at,
    invalid_at: null,
    group_id: input.group_id,
    scope_type: input.scope_type || 'note',
    edge_type: input.edge_type || 'MENTIONS',
    fact: null,
    episode_ids: input.episode_id ? [input.episode_id] : [],
    note_ids: input.note_id ? [input.note_id] : [],
    weight: 1,
    pmi_score: null,
    confidence: input.confidence ?? 1.0,
    extraction_methods: ['ner'],
  });

  if (!result.ok) {
    throw new Error(`Failed to create mention edge: ${result.message}`);
  }

  return {
    id,
    source_id: input.source_id,
    target_id: input.target_id,
    created_at,
    valid_at,
    invalid_at: null,
    group_id: input.group_id,
    scope_type: input.scope_type || 'note',
    edge_type: input.edge_type || 'MENTIONS',
    fact: null,
    episode_ids: input.episode_id ? [input.episode_id] : [],
    note_ids: input.note_id ? [input.note_id] : [],
    weight: 1,
    pmi_score: null,
    confidence: input.confidence ?? 1.0,
    extraction_methods: ['ner'],
  };
}

/**
 * Get edges by source entity (full objects)
 */
export async function getEdgesBySourceId(sourceId: string): Promise<EntityEdge[]> {
  const result = await cozoDb.runQuery(ENTITY_EDGE_QUERIES.getBySourceId, {
    source_id: sourceId,
  });

  if (!result.ok || !result.rows) {
    return [];
  }

  return result.rows.map((row: any) => ({
    id: row[0],
    source_id: sourceId,
    target_id: row[1],
    edge_type: row[2],
    weight: row[3],
    fact: row[4],
    confidence: row[5],
    created_at: Date.now(),
    valid_at: Date.now(),
    invalid_at: null,
    group_id: '',
    scope_type: 'note',
    episode_ids: [],
    note_ids: [],
    extraction_methods: [],
  }));
}

/**
 * Get edges by target entity
 */
export async function getEdgesByTargetId(targetId: string): Promise<EntityEdge[]> {
  const result = await cozoDb.runQuery(ENTITY_EDGE_QUERIES.getByTargetId, {
    target_id: targetId,
  });

  if (!result.ok || !result.rows) {
    return [];
  }

  return result.rows.map((row: any) => ({
    id: row[0],
    source_id: row[1],
    target_id: targetId,
    edge_type: row[2],
    weight: row[3],
    fact: row[4],
    confidence: row[5],
    created_at: Date.now(),
    valid_at: Date.now(),
    invalid_at: null,
    group_id: '',
    scope_type: 'note',
    episode_ids: [],
    note_ids: [],
    extraction_methods: [],
  }));
}

/**
 * Delete edge
 */
export async function deleteEdge(edgeId: string): Promise<void> {
  const result = await cozoDb.runQuery(ENTITY_EDGE_QUERIES.delete, {
    id: edgeId,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete edge: ${result.message}`);
  }
}
