import { cozoDb } from '../db';

export interface ProvenanceRecord {
    episodeId: string;
    noteId: string;
    noteTitle: string;
    validAt: Date;
    contentSnippet: string; // Using 'context' from mentions
    context: string;        // Duplicate of above, as requested by prompt
    charPosition: number;
    sentenceIndex?: number;
}

export async function traceEntityProvenance(
    entityId: string
): Promise<ProvenanceRecord[]> {
    const query = `
    ?[episode_id, note_id, note_title, valid_at, context, char_position, sentence_index] :=
      *mentions{episode_id, entity_id, context, char_position, sentence_index},
      entity_id == $entity_id,
      *episode{id: episode_id, note_id, valid_at},
      *note{id: note_id, title: note_title}
    :order valid_at
    :limit 50
  `;

    try {
        const result = await cozoDb.runQuery(query, { entity_id: entityId });
        if (result.ok && result.rows) {
            return result.rows.map((row: any[]) => ({
                episodeId: row[0],
                noteId: row[1],
                noteTitle: row[2],
                validAt: new Date(row[3]),
                contentSnippet: row[4],
                context: row[4],
                charPosition: row[5],
                sentenceIndex: row[6] ?? undefined
            }));
        }
    } catch (err) {
        console.error('Provenance tracing failed', err);
    }

    return [];
}
