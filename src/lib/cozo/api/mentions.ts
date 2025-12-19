import { cozoDb } from '../db';
import { MENTIONS_QUERIES } from '../schema/layer2-mentions';
import { generateId } from '@/lib/utils/ids';

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

/**
 * Create a mention record
 */
export async function createMention(input: CreateMentionInput): Promise<Mention> {
  const id = generateId();
  const created_at = Date.now();
  const entity_id = input.entity_id || generateId(); // Temporary ID if not resolved yet
  
  const result = await cozoDb.runQuery(MENTIONS_QUERIES.upsert, {
    id,
    episode_id: input.episode_id,
    entity_id,
    context: input.context,
    char_position: input.char_position,
    sentence_index: input.sentence_index ?? null,
    confidence: input.confidence ?? 1.0,
    extraction_method: input.extraction_method || 'ner',
    created_at,
  });

  if (!result.ok) {
    throw new Error(`Failed to create mention: ${result.message}`);
  }

  return {
    id,
    episode_id: input.episode_id,
    entity_id,
    context: input.context,
    char_position: input.char_position,
    sentence_index: input.sentence_index,
    confidence: input.confidence ?? 1.0,
    extraction_method: input.extraction_method || 'ner',
    created_at,
    status: input.status,
    resolved_entity_id: input.resolved_entity_id,
  };
}

/**
 * Update mention status (accept/reject) and optionally link to entity
 */
export async function updateMentionStatus(
  mentionId: string,
  status: 'pending' | 'accepted' | 'rejected',
  resolvedEntityId?: string
): Promise<void> {
  // For now, we can update by recreating with new entity_id
  // In a full implementation, you'd add status fields to the schema
  if (resolvedEntityId) {
    const result = await cozoDb.runQuery(`
      ?[id, entity_id] <- [[$id, $entity_id]]
      :update mentions { id => entity_id }
    `, {
      id: mentionId,
      entity_id: resolvedEntityId,
    });

    if (!result.ok) {
      throw new Error(`Failed to update mention status: ${result.message}`);
    }
  }
}

/**
 * Get all mentions for a note (via episode)
 */
export async function getMentionsByNoteId(noteId: string): Promise<Mention[]> {
  // First get episode_id from note_id
  const episodeResult = await cozoDb.runQuery(`
    ?[episode_id] := *episode{id: episode_id, note_id},
    note_id == $note_id
  `, { note_id: noteId });

  if (!episodeResult.ok || !episodeResult.rows || episodeResult.rows.length === 0) {
    return [];
  }

  const episodeId = episodeResult.rows[0][0];

  const result = await cozoDb.runQuery(MENTIONS_QUERIES.getByEpisodeId, {
    episode_id: episodeId,
  });

  if (!result.ok || !result.rows) {
    return [];
  }

  return result.rows.map((row: any) => ({
    id: row[0],
    entity_id: row[1],
    context: row[2],
    char_position: row[3],
    sentence_index: row[4],
    confidence: row[5],
    episode_id: episodeId,
    extraction_method: 'ner',
    created_at: Date.now(),
  }));
}

/**
 * Get all mentions of a specific entity
 */
export async function getMentionsByEntityId(entityId: string): Promise<Mention[]> {
  const result = await cozoDb.runQuery(MENTIONS_QUERIES.getByEntityId, {
    entity_id: entityId,
  });

  if (!result.ok || !result.rows) {
    return [];
  }

  return result.rows.map((row: any) => ({
    id: row[0],
    episode_id: row[1],
    entity_id: entityId,
    context: row[2],
    char_position: row[3],
    sentence_index: row[4],
    confidence: row[5],
    extraction_method: 'ner',
    created_at: Date.now(),
  }));
}

/**
 * Delete a mention
 */
export async function deleteMention(mentionId: string): Promise<void> {
  const result = await cozoDb.runQuery(MENTIONS_QUERIES.delete, {
    id: mentionId,
  });

  if (!result.ok) {
    throw new Error(`Failed to delete mention: ${result.message}`);
  }
}
