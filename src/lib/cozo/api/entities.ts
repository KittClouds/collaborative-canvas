import { cozoDb } from '../db';
import { ENTITY_QUERIES } from '../schema/layer2-entities';
import { generateId } from '@/lib/utils/ids';

export interface EntityStats {
  entityId: string;
  totalMentions: number;
  noteCount: number;
  relationshipCount: number;
  aliases: string[];
}

export interface IntegrityReport {
  orphanedEntities: string[];
  orphanedEdges: string[];
  danglingMentions: string[];
}

export interface IntegrityRepairResult {
  repaired: number;
  errors: string[];
}

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
  const id = generateId();
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
 * Get mention contexts for an entity (graph metadata)
 */
export async function getEntityMentionContexts(
  entityId: string
): Promise<Array<{ noteId: string; context: string; position: number }>> {
  const result = await cozoDb.runQuery(`
        ?[note_id, context, char_position] := 
          *mentions{episode_id, entity_id, context, char_position},
          entity_id == $entity_id,
          *episode{id: episode_id, note_id}
        :order char_position
        :limit 100
    `, { entity_id: entityId });

  if (!result.ok || !result.rows) return [];

  return result.rows.map(([noteId, context, pos]) => ({
    noteId,          // FK to SQLite (for UI navigation)
    context,         // Sentence/paragraph snippet
    position: pos,
  }));
}


/**
 * Delete entity and cascade cleanup mentions/edges
 */
export async function deleteEntity(entityId: string): Promise<void> {
  await cozoDb.runQuery(`
    ?[id] := *mentions{id, entity_id}, entity_id == $entity_id
    :rm mentions { id }
  `, { entity_id: entityId });

  await cozoDb.runQuery(`
    ?[source_id, target_id, edge_type] := 
      *entity_edge{source_id, target_id, edge_type},
      source_id == $entity_id
    :rm entity_edge { source_id, target_id, edge_type }
  `, { entity_id: entityId });

  await cozoDb.runQuery(`
    ?[source_id, target_id, edge_type] := 
      *entity_edge{source_id, target_id, edge_type},
      target_id == $entity_id
    :rm entity_edge { source_id, target_id, edge_type }
  `, { entity_id: entityId });

  const result = await cozoDb.runQuery(ENTITY_QUERIES.delete, {
    id: entityId,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete entity: ${result.message}`);
  }
}

/**
 * Batch upsert multiple entities
 */
export async function batchUpsertEntities(inputs: CreateEntityInput[]): Promise<Entity[]> {
  const results: Entity[] = [];
  const errors: string[] = [];

  for (const input of inputs) {
    try {
      const entity = await upsertEntity(input);
      results.push(entity);
    } catch (err) {
      errors.push(`Failed to upsert ${input.name}: ${err}`);
    }
  }

  if (errors.length > 0) {
    console.warn('[CoZo] Batch upsert had errors:', errors);
  }

  return results;
}

/**
 * Merge two entities: migrate all references from source to target, then delete source
 */
export async function mergeEntities(targetId: string, sourceId: string): Promise<boolean> {
  if (targetId === sourceId) return false;

  const target = await getEntityById(targetId);
  const source = await getEntityById(sourceId);

  if (!target || !source) return false;

  await cozoDb.runQuery(`
    ?[id, entity_id, episode_id, context, char_position, confidence, validation_status, created_at] := 
      *mentions{id, entity_id, episode_id, context, char_position, confidence, validation_status, created_at},
      entity_id == $source_id
    
    ?[id, entity_id, episode_id, context, char_position, confidence, validation_status, created_at] <- 
      [[id, $target_id, episode_id, context, char_position, confidence, validation_status, created_at]]
    :put mentions { id, entity_id, episode_id, context, char_position, confidence, validation_status, created_at }
  `, { source_id: sourceId, target_id: targetId });

  await cozoDb.runQuery(`
    ?[source_id, target_id, edge_type, weight, evidence_note_ids, created_at] := 
      *entity_edge{source_id, target_id, edge_type, weight, evidence_note_ids, created_at},
      source_id == $source_id
    :rm entity_edge { source_id, target_id, edge_type }
  `, { source_id: sourceId });

  await cozoDb.runQuery(`
    ?[source_id, target_id, edge_type, weight, evidence_note_ids, created_at] := 
      *entity_edge{source_id, target_id, edge_type, weight, evidence_note_ids, created_at},
      target_id == $source_id
    :rm entity_edge { source_id, target_id, edge_type }
  `, { source_id: sourceId });

  const mergedAliases = [...(target.aliases || [])];
  if (source.name && !mergedAliases.includes(source.name)) {
    mergedAliases.push(source.name);
  }
  for (const alias of source.aliases || []) {
    if (!mergedAliases.includes(alias)) {
      mergedAliases.push(alias);
    }
  }

  const newFrequency = (target.frequency || 1) + (source.frequency || 1);

  await cozoDb.runQuery(`
    ?[id, aliases, frequency] <- [[$id, $aliases, $frequency]]
    :update entity { id => aliases, frequency }
  `, { 
    id: targetId, 
    aliases: mergedAliases,
    frequency: newFrequency
  });

  await deleteEntity(sourceId);

  return true;
}

/**
 * Get entity statistics including mentions, notes, and relationships
 */
export async function getEntityStats(entityId: string): Promise<EntityStats | null> {
  const entity = await getEntityById(entityId);
  if (!entity) return null;

  const mentionResult = await cozoDb.runQuery(`
    ?[count(id)] := *mentions{id, entity_id}, entity_id == $entity_id
  `, { entity_id: entityId });

  const noteResult = await cozoDb.runQuery(`
    ?[count_unique(note_id)] := 
      *mentions{entity_id, episode_id},
      entity_id == $entity_id,
      *episode{id: episode_id, note_id}
  `, { entity_id: entityId });

  const edgeResult = await cozoDb.runQuery(`
    ?[count(edge_type)] := 
      *entity_edge{source_id, target_id, edge_type},
      source_id == $entity_id or target_id == $entity_id
  `, { entity_id: entityId });

  return {
    entityId,
    totalMentions: mentionResult.ok && mentionResult.rows?.[0] ? mentionResult.rows[0][0] : 0,
    noteCount: noteResult.ok && noteResult.rows?.[0] ? noteResult.rows[0][0] : 0,
    relationshipCount: edgeResult.ok && edgeResult.rows?.[0] ? edgeResult.rows[0][0] : 0,
    aliases: entity.aliases || [],
  };
}

/**
 * Handle note deletion: cleanup episodes, mentions, and orphaned entities
 */
export async function onNoteDeleted(noteId: string): Promise<void> {
  const episodeResult = await cozoDb.runQuery(`
    ?[id] := *episode{id, note_id}, note_id == $note_id
  `, { note_id: noteId });

  if (!episodeResult.ok || !episodeResult.rows) return;

  for (const [episodeId] of episodeResult.rows) {
    await cozoDb.runQuery(`
      ?[id] := *mentions{id, episode_id}, episode_id == $episode_id
      :rm mentions { id }
    `, { episode_id: episodeId });
  }

  await cozoDb.runQuery(`
    ?[id] := *episode{id, note_id}, note_id == $note_id
    :rm episode { id }
  `, { note_id: noteId });

  await cleanupOrphanedEntities();
}

/**
 * Find and remove entities with zero mentions
 */
export async function cleanupOrphanedEntities(): Promise<string[]> {
  const result = await cozoDb.runQuery(`
    orphaned[entity_id] := 
      *entity{id: entity_id},
      not *mentions{entity_id}
    
    ?[entity_id] := orphaned[entity_id]
  `);

  if (!result.ok || !result.rows) return [];

  const orphanedIds = result.rows.map(r => r[0] as string);

  for (const entityId of orphanedIds) {
    await cozoDb.runQuery(ENTITY_QUERIES.delete, { id: entityId });
  }

  return orphanedIds;
}

/**
 * Add an alias to an entity
 */
export async function addEntityAlias(entityId: string, alias: string): Promise<boolean> {
  const entity = await getEntityById(entityId);
  if (!entity) return false;

  const normalizedAlias = alias.trim();
  if (!normalizedAlias) return false;

  const currentAliases = entity.aliases || [];
  if (currentAliases.includes(normalizedAlias)) return false;

  const newAliases = [...currentAliases, normalizedAlias];

  const result = await cozoDb.runQuery(`
    ?[id, aliases] <- [[$id, $aliases]]
    :update entity { id => aliases }
  `, { id: entityId, aliases: newAliases });

  return result.ok;
}

/**
 * Remove an alias from an entity
 */
export async function removeEntityAlias(entityId: string, alias: string): Promise<boolean> {
  const entity = await getEntityById(entityId);
  if (!entity) return false;

  const currentAliases = entity.aliases || [];
  const normalizedAlias = alias.trim();
  const index = currentAliases.indexOf(normalizedAlias);
  
  if (index === -1) return false;

  const newAliases = currentAliases.filter(a => a !== normalizedAlias);

  const result = await cozoDb.runQuery(`
    ?[id, aliases] <- [[$id, $aliases]]
    :update entity { id => aliases }
  `, { id: entityId, aliases: newAliases });

  return result.ok;
}

/**
 * Increment entity frequency by a given amount
 */
export async function incrementEntityFrequency(entityId: string, increment: number = 1): Promise<void> {
  const entity = await getEntityById(entityId);
  if (!entity) return;

  const newFrequency = (entity.frequency || 0) + increment;

  await cozoDb.runQuery(ENTITY_QUERIES.updateFrequency, {
    id: entityId,
    frequency: newFrequency
  });
}

/**
 * Search entities by name (fuzzy match)
 */
export async function searchEntities(
  query: string,
  groupId?: string,
  limit: number = 50
): Promise<Entity[]> {
  const normalizedQuery = query.trim().toLowerCase();
  
  const queryStr = groupId
    ? `
      ?[id, name, entity_kind, entity_subtype, group_id, frequency] := 
        *entity{id, name, entity_kind, entity_subtype, group_id, frequency},
        contains(lowercase(name), $query),
        group_id == $group_id
      :order -frequency
      :limit $limit
    `
    : `
      ?[id, name, entity_kind, entity_subtype, group_id, frequency] := 
        *entity{id, name, entity_kind, entity_subtype, group_id, frequency},
        contains(lowercase(name), $query)
      :order -frequency
      :limit $limit
    `;

  const params = groupId 
    ? { query: normalizedQuery, group_id: groupId, limit }
    : { query: normalizedQuery, limit };

  const result = await cozoDb.runQuery(queryStr, params);

  if (!result.ok || !result.rows) return [];

  return result.rows.map((row: any) => ({
    id: row[0],
    name: row[1],
    entity_kind: row[2],
    entity_subtype: row[3],
    group_id: row[4],
    frequency: row[5],
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
 * Check database integrity for entity-related tables
 */
export async function checkIntegrity(): Promise<IntegrityReport> {
  const orphanedEntitiesResult = await cozoDb.runQuery(`
    orphaned[entity_id] := 
      *entity{id: entity_id},
      not *mentions{entity_id}
    ?[entity_id] := orphaned[entity_id]
  `);

  const orphanedEdgesResult = await cozoDb.runQuery(`
    orphaned[source_id, target_id, edge_type] := 
      *entity_edge{source_id, target_id, edge_type},
      not *entity{id: source_id}
    
    orphaned[source_id, target_id, edge_type] := 
      *entity_edge{source_id, target_id, edge_type},
      not *entity{id: target_id}
    
    ?[source_id, target_id, edge_type] := orphaned[source_id, target_id, edge_type]
  `);

  const danglingMentionsResult = await cozoDb.runQuery(`
    dangling[mention_id] := 
      *mentions{id: mention_id, entity_id},
      not *entity{id: entity_id}
    ?[mention_id] := dangling[mention_id]
  `);

  return {
    orphanedEntities: orphanedEntitiesResult.ok && orphanedEntitiesResult.rows
      ? orphanedEntitiesResult.rows.map(r => r[0] as string)
      : [],
    orphanedEdges: orphanedEdgesResult.ok && orphanedEdgesResult.rows
      ? orphanedEdgesResult.rows.map(r => `${r[0]}:${r[2]}:${r[1]}`)
      : [],
    danglingMentions: danglingMentionsResult.ok && danglingMentionsResult.rows
      ? danglingMentionsResult.rows.map(r => r[0] as string)
      : [],
  };
}

/**
 * Repair integrity issues found by checkIntegrity
 */
export async function repairIntegrity(): Promise<IntegrityRepairResult> {
  const report = await checkIntegrity();
  let repaired = 0;
  const errors: string[] = [];

  for (const mentionId of report.danglingMentions) {
    try {
      await cozoDb.runQuery(`
        ?[id] <- [[$id]]
        :rm mentions { id }
      `, { id: mentionId });
      repaired++;
    } catch (err) {
      errors.push(`Failed to remove dangling mention ${mentionId}: ${err}`);
    }
  }

  for (const edgeKey of report.orphanedEdges) {
    const [sourceId, edgeType, targetId] = edgeKey.split(':');
    try {
      await cozoDb.runQuery(`
        ?[source_id, target_id, edge_type] <- [[$source_id, $target_id, $edge_type]]
        :rm entity_edge { source_id, target_id, edge_type }
      `, { source_id: sourceId, target_id: targetId, edge_type: edgeType });
      repaired++;
    } catch (err) {
      errors.push(`Failed to remove orphaned edge ${edgeKey}: ${err}`);
    }
  }

  return { repaired, errors };
}

/**
 * Get entities by kind
 */
export async function getEntitiesByKind(kind: string, groupId?: string): Promise<Entity[]> {
  const result = await cozoDb.runQuery(ENTITY_QUERIES.getByKind, { kind });

  if (!result.ok || !result.rows) return [];

  return result.rows
    .filter((row: any) => !groupId || row[3] === groupId)
    .map((row: any) => ({
      id: row[0],
      name: row[1],
      entity_kind: kind,
      entity_subtype: row[2],
      group_id: row[3],
      frequency: row[4],
      canonical_note_id: row[5],
      scope_type: 'note',
      created_at: Date.now(),
      extraction_method: 'ner',
      summary: null,
      aliases: [],
      participants: [],
    }));
}

/**
 * Find entity by alias
 */
export async function findEntityByAlias(alias: string, groupId: string): Promise<Entity | null> {
  const normalizedAlias = alias.trim().toLowerCase();

  const result = await cozoDb.runQuery(`
    ?[id, name, entity_kind, entity_subtype, group_id, frequency, aliases] := 
      *entity{id, name, entity_kind, entity_subtype, group_id, frequency, aliases},
      group_id == $group_id,
      a in aliases,
      lowercase(a) == $alias
    :limit 1
  `, { alias: normalizedAlias, group_id: groupId });

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
    frequency: row[5],
    aliases: row[6] || [],
    scope_type: 'note',
    created_at: Date.now(),
    extraction_method: 'ner',
    summary: null,
    canonical_note_id: null,
    participants: [],
  };
}

/**
 * Update entity properties
 */
export async function updateEntity(
  entityId: string, 
  updates: Partial<Pick<Entity, 'name' | 'entity_kind' | 'entity_subtype' | 'summary' | 'aliases' | 'attributes'>>
): Promise<boolean> {
  const entity = await getEntityById(entityId);
  if (!entity) return false;

  const updateFields: string[] = [];
  const params: Record<string, any> = { id: entityId };

  if (updates.name !== undefined) {
    updateFields.push('name');
    params.name = updates.name;
    params.normalized_name = updates.name.trim().toLowerCase();
    updateFields.push('normalized_name');
  }
  if (updates.entity_kind !== undefined) {
    updateFields.push('entity_kind');
    params.entity_kind = updates.entity_kind;
  }
  if (updates.entity_subtype !== undefined) {
    updateFields.push('entity_subtype');
    params.entity_subtype = updates.entity_subtype;
  }
  if (updates.summary !== undefined) {
    updateFields.push('summary');
    params.summary = updates.summary;
  }
  if (updates.aliases !== undefined) {
    updateFields.push('aliases');
    params.aliases = updates.aliases;
  }
  if (updates.attributes !== undefined) {
    updateFields.push('attributes');
    params.attributes = updates.attributes;
  }

  if (updateFields.length === 0) return true;

  const paramList = updateFields.map(f => `$${f}`).join(', ');
  const fieldList = updateFields.join(', ');
  const updateSpec = updateFields.map(f => f).join(', ');

  const query = `
    ?[id, ${fieldList}] <- [[$id, ${paramList}]]
    :update entity { id => ${updateSpec} }
  `;

  const result = await cozoDb.runQuery(query, params);
  return result.ok;
}
