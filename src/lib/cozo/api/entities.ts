import { cozoDb } from '../db';
import { ENTITY_QUERIES } from '../schema/layer2-entities';
import { v4 as uuidv4 } from 'uuid';

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
  attributes?: any;
  temporal_span?: any;
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
  attributes?: any;
}

/**
 * Create or find entity by name and kind (with deduplication)
 */
export async function upsertEntity(input: CreateEntityInput): Promise<Entity> {
  const group_id = input.group_id;
  const name = input.name.trim();
  const entity_kind = input.entity_kind;

  // Check if entity exists by name and kind
  const existingResult = await cozoDb.runQuery(ENTITY_QUERIES.findByNameAndKind, {
    name,
    kind: entity_kind,
    group_id,
  });

  if (existingResult.ok && existingResult.rows && existingResult.rows.length > 0) {
    // Entity exists, return it
    const row = existingResult.rows[0];
    return {
      id: row[0],
      name: row[1],
      entity_kind,
      entity_subtype: row[2],
      group_id: row[3],
      frequency: row[4],
      canonical_note_id: row[5],
      scope_type: input.scope_type || 'note',
      created_at: Date.now(),
      extraction_method: 'ner',
      summary: null,
      aliases: [],
      participants: [],
    };
  }

  // Create new entity
  const id = uuidv4();
  const created_at = Date.now();

  const result = await cozoDb.runQuery(ENTITY_QUERIES.upsert, {
    id,
    name,
    entity_kind,
    entity_subtype: input.entity_subtype ?? null,
    group_id,
    scope_type: input.scope_type || 'note',
    created_at,
    extraction_method: 'ner',
    summary: input.summary ?? null,
    aliases: input.aliases || [],
    canonical_note_id: input.canonical_note_id ?? null,
    frequency: 1,
    degree_centrality: null,
    betweenness_centrality: null,
    closeness_centrality: null,
    community_id: null,
    attributes: input.attributes ?? null,
    temporal_span: null,
    participants: [],
  });

  if (!result.ok) {
    throw new Error(`Failed to create entity: ${result.message}`);
  }

  return {
    id,
    name,
    entity_kind,
    entity_subtype: input.entity_subtype,
    group_id,
    scope_type: input.scope_type || 'note',
    created_at,
    extraction_method: 'ner',
    summary: input.summary,
    aliases: input.aliases || [],
    canonical_note_id: input.canonical_note_id,
    frequency: 1,
    participants: [],
  };
}

/**
 * Get entity by ID
 */
export async function getEntityById(entityId: string): Promise<Entity | null> {
  const result = await cozoDb.runQuery(ENTITY_QUERIES.getById, {
    id: entityId,
  });

  if (!result.ok || !result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row[0],
    name: row[1],
    entity_kind: row[2],
    entity_subtype: row[3],
    group_id: row[4],
    scope_type: row[5],
    created_at: row[6],
    extraction_method: row[7],
    summary: row[8],
    aliases: row[9] || [],
    canonical_note_id: row[10],
    frequency: row[11],
    degree_centrality: row[12],
    betweenness_centrality: row[13],
    closeness_centrality: row[14],
    community_id: row[15],
    attributes: row[16],
    temporal_span: row[17],
    participants: row[18] || [],
  };
}

/**
 * Find entity by name (normalized matching with aliases)
 */
export async function findEntityByName(
  name: string,
  groupId: string,
  kind?: string
): Promise<Entity | null> {
  const normalizedName = name.trim().toLowerCase();

  const query = kind
    ? ENTITY_QUERIES.findByNameAndKind
    : ENTITY_QUERIES.findByName;

  const params = kind
    ? { name, kind, group_id: groupId }
    : { name, group_id: groupId };

  const result = await cozoDb.runQuery(query, params);

  if (!result.ok || !result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row[0],
    name: row[1],
    entity_kind: kind || row[2],
    entity_subtype: row[kind ? 2 : 3],
    group_id: row[kind ? 3 : 4],
    frequency: row[kind ? 4 : 5],
    canonical_note_id: kind ? row[5] : null,
    scope_type: 'note',
    created_at: Date.now(),
    extraction_method: 'ner',
    summary: null,
    aliases: [],
    participants: [],
  };
}

/**
 * Get all entities by group ID
 */
export async function getEntitiesByGroupId(groupId: string): Promise<Entity[]> {
  const result = await cozoDb.runQuery(ENTITY_QUERIES.getByGroupId, {
    group_id: groupId,
  });

  if (!result.ok || !result.rows || result.rows.length === 0) {
    return [];
  }

  return result.rows.map((row: any) => ({
    id: row[0],
    name: row[1],
    entity_kind: row[2],
    entity_subtype: row[3],
    frequency: row[4],
    community_id: row[5],
    attributes: row[6],
    group_id: groupId,
    scope_type: 'note',
    created_at: Date.now(),
    extraction_method: 'ner',
    summary: null,
    aliases: [],
    canonical_note_id: null,
    participants: [],
  }));
}

/**
 * Delete entity
 */
export async function deleteEntity(entityId: string): Promise<void> {
  const result = await cozoDb.runQuery(ENTITY_QUERIES.delete, {
    id: entityId,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete entity: ${result.message}`);
  }
}
