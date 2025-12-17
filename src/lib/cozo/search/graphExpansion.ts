import { cozoDb } from '../db';
import type { VectorSearchResult } from './vectorSearch';

export interface GraphExpansionOptions {
  maxHops: number;
  maxExpanded: number;
  minCooccurrence: number;
}

export interface ExpandedResult extends VectorSearchResult {
  expansionReason?: string;
  graphDistance?: number;
  connectedEntities?: string[];
}

export async function expandResultsViaGraph(
  vectorResults: VectorSearchResult[],
  options: GraphExpansionOptions
): Promise<ExpandedResult[]> {
  if (vectorResults.length === 0) return [];

  const noteIds = vectorResults.map(r => r.noteId);

  let mentionedEntityIds: string[] = [];

  try {
    const mentionsQuery = `
      ?[entity_id] :=
        *mentions{episode_id, entity_id},
        *episode{id: episode_id, note_id},
        note_id in $note_ids
    `;

    const mentionsResult = cozoDb.runQuery(mentionsQuery, { note_ids: noteIds });

    if (mentionsResult.rows) {
      mentionedEntityIds = mentionsResult.rows.map((row: unknown[]) => row[0] as string);
    }
  } catch (e) {
    console.warn('Could not fetch entity mentions, skipping graph expansion:', e);
    return vectorResults.map(r => ({ ...r, graphDistance: 0 }));
  }

  if (mentionedEntityIds.length === 0) {
    return vectorResults.map(r => ({ ...r, graphDistance: 0 }));
  }

  let connectedEntityIds: string[] = [];
  const entityDistances: Record<string, number> = {};

  try {
    const graphQuery = `
      connected[entity_id, 1] :=
        entity_id in $seed_entities

      connected[target_id, hop + 1] :=
        connected[source_id, hop],
        (*entity_edge{source_id, target_id, weight};
         *entity_edge{source_id: target_id, target_id: source_id, weight}),
        weight >= $min_weight,
        hop < $max_hops,
        not(target_id in $seed_entities)

      ?[entity_id, min_hop] :=
        connected[entity_id, hop],
        min_hop = min(hop)
    `;

    const graphResult = cozoDb.runQuery(graphQuery, {
      seed_entities: mentionedEntityIds,
      min_weight: options.minCooccurrence,
      max_hops: options.maxHops,
    });

    if (graphResult.rows) {
      for (const [entityId, distance] of graphResult.rows) {
        connectedEntityIds.push(entityId as string);
        entityDistances[entityId as string] = distance as number;
      }
    }
  } catch (e) {
    console.warn('Graph expansion query failed:', e);
    return vectorResults.map(r => ({ ...r, graphDistance: 0 }));
  }

  let expandedNoteIds: Array<{ noteId: string; entities: string[] }> = [];

  try {
    const expansionQuery = `
      ?[note_id, entity_names] :=
        *mentions{episode_id, entity_id},
        entity_id in $connected_entities,
        *episode{id: episode_id, note_id},
        not(note_id in $original_notes),
        *entity{id: entity_id, name: entity_name},
        entity_names = collect(entity_name)

      :limit $max_expanded
    `;

    const expansionResult = cozoDb.runQuery(expansionQuery, {
      connected_entities: connectedEntityIds,
      original_notes: noteIds,
      max_expanded: options.maxExpanded,
    });

    if (expansionResult.rows) {
      expandedNoteIds = expansionResult.rows.map((row: unknown[]) => ({
        noteId: row[0] as string,
        entities: row[1] as string[],
      }));
    }
  } catch (e) {
    console.warn('Could not fetch expanded notes:', e);
  }

  const results: ExpandedResult[] = vectorResults.map(r => ({
    ...r,
    graphDistance: 0,
  }));

  for (const expanded of expandedNoteIds) {
    results.push({
      noteId: expanded.noteId,
      score: 0.5,
      expansionReason: `Connected via: ${expanded.entities.slice(0, 3).join(', ')}`,
      graphDistance: 1,
      connectedEntities: expanded.entities,
    });
  }

  return results;
}
