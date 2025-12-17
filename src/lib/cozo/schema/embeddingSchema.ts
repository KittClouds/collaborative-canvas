import { cozoDb } from '../db';

export const EMBEDDING_SCHEMA_VERSION = 1;

export async function applyEmbeddingSchema(): Promise<void> {
  try {
    await cozoDb.run(`
      { :create embedding_sync_job {
        id: Uuid,
        =>
        scope_type: String,
        scope_id: String,
        model: String,
        status: String,
        progress: Float,
        total_items: Int,
        processed_items: Int,
        started_at: Int,
        completed_at: Int?,
        error_message: String?
      }}
    `);
    console.log('Created embedding_sync_job table');
  } catch (e: any) {
    if (!e.message?.includes('already exists')) {
      console.error('Failed to create embedding_sync_job table:', e);
    }
  }

  try {
    await cozoDb.run(`
      { :create note_embedding {
        note_id: String,
        =>
        embedding_small: [Float]?,
        embedding_medium: [Float]?,
        embedding_model: String?,
        content_hash: String,
        created_at: Int,
        updated_at: Int
      }}
    `);
    console.log('Created note_embedding table');
  } catch (e: any) {
    if (!e.message?.includes('already exists')) {
      console.error('Failed to create note_embedding table:', e);
    }
  }

  try {
    await cozoDb.run(`
      { :create embedding_stats {
        scope_type: String,
        scope_id: String,
        =>
        embeddings_count: Int,
        total_notes: Int,
        synced_notes: Int,
        last_sync_at: Int?,
        updated_at: Int
      }}
    `);
    console.log('Created embedding_stats table');
  } catch (e: any) {
    if (!e.message?.includes('already exists')) {
      console.error('Failed to create embedding_stats table:', e);
    }
  }
}

export async function getEmbeddingForNote(noteId: string): Promise<{
  embeddingSmall?: number[];
  embeddingMedium?: number[];
  contentHash?: string;
} | null> {
  try {
    const result = cozoDb.runQuery(`
      ?[embedding_small, embedding_medium, content_hash] :=
        *note_embedding{note_id, embedding_small, embedding_medium, content_hash},
        note_id == $note_id
    `, { note_id: noteId });

    if (result.rows && result.rows.length > 0) {
      const [embeddingSmall, embeddingMedium, contentHash] = result.rows[0];
      return {
        embeddingSmall: embeddingSmall as number[] | undefined,
        embeddingMedium: embeddingMedium as number[] | undefined,
        contentHash: contentHash as string | undefined,
      };
    }
    return null;
  } catch (e) {
    console.error('Failed to get embedding for note:', e);
    return null;
  }
}

export async function saveEmbeddingForNote(
  noteId: string,
  embedding: number[],
  model: 'small' | 'medium',
  contentHash: string
): Promise<void> {
  const now = Date.now();
  const field = model === 'small' ? 'embedding_small' : 'embedding_medium';

  try {
    const existing = await getEmbeddingForNote(noteId);

    if (existing) {
      const updateData: Record<string, unknown> = {
        note_id: noteId,
        [field]: embedding,
        embedding_model: model === 'small' ? 'mdbr-leaf-ir' : 'modernbert-embed-base',
        content_hash: contentHash,
        updated_at: now,
        created_at: existing.contentHash ? now : now,
      };

      if (model === 'small') {
        updateData.embedding_medium = existing.embeddingMedium || null;
      } else {
        updateData.embedding_small = existing.embeddingSmall || null;
      }

      cozoDb.runQuery(`
        ?[note_id, embedding_small, embedding_medium, embedding_model, content_hash, created_at, updated_at] <- [[
          $note_id, $embedding_small, $embedding_medium, $embedding_model, $content_hash, $created_at, $updated_at
        ]]
        :put note_embedding {
          note_id,
          embedding_small,
          embedding_medium,
          embedding_model,
          content_hash,
          created_at,
          updated_at
        }
      `, updateData);
    } else {
      const insertData: Record<string, unknown> = {
        note_id: noteId,
        embedding_small: model === 'small' ? embedding : null,
        embedding_medium: model === 'medium' ? embedding : null,
        embedding_model: model === 'small' ? 'mdbr-leaf-ir' : 'modernbert-embed-base',
        content_hash: contentHash,
        created_at: now,
        updated_at: now,
      };

      cozoDb.runQuery(`
        ?[note_id, embedding_small, embedding_medium, embedding_model, content_hash, created_at, updated_at] <- [[
          $note_id, $embedding_small, $embedding_medium, $embedding_model, $content_hash, $created_at, $updated_at
        ]]
        :put note_embedding {
          note_id,
          embedding_small,
          embedding_medium,
          embedding_model,
          content_hash,
          created_at,
          updated_at
        }
      `, insertData);
    }
  } catch (e) {
    console.error('Failed to save embedding for note:', e);
    throw e;
  }
}

export async function getEmbeddingStats(scopeType: string, scopeId: string): Promise<{
  embeddingsCount: number;
  totalNotes: number;
  syncedNotes: number;
  lastSyncAt?: Date;
} | null> {
  try {
    const result = cozoDb.runQuery(`
      ?[embeddings_count, total_notes, synced_notes, last_sync_at] :=
        *embedding_stats{scope_type, scope_id, embeddings_count, total_notes, synced_notes, last_sync_at},
        scope_type == $scope_type,
        scope_id == $scope_id
    `, { scope_type: scopeType, scope_id: scopeId });

    if (result.rows && result.rows.length > 0) {
      const [embeddingsCount, totalNotes, syncedNotes, lastSyncAt] = result.rows[0];
      return {
        embeddingsCount: embeddingsCount as number,
        totalNotes: totalNotes as number,
        syncedNotes: syncedNotes as number,
        lastSyncAt: lastSyncAt ? new Date(lastSyncAt as number) : undefined,
      };
    }
    return null;
  } catch (e) {
    console.error('Failed to get embedding stats:', e);
    return null;
  }
}

export async function updateEmbeddingStats(
  scopeType: string,
  scopeId: string,
  stats: {
    embeddingsCount: number;
    totalNotes: number;
    syncedNotes: number;
    lastSyncAt?: Date;
  }
): Promise<void> {
  const now = Date.now();

  try {
    cozoDb.runQuery(`
      ?[scope_type, scope_id, embeddings_count, total_notes, synced_notes, last_sync_at, updated_at] <- [[
        $scope_type, $scope_id, $embeddings_count, $total_notes, $synced_notes, $last_sync_at, $updated_at
      ]]
      :put embedding_stats {
        scope_type,
        scope_id,
        embeddings_count,
        total_notes,
        synced_notes,
        last_sync_at,
        updated_at
      }
    `, {
      scope_type: scopeType,
      scope_id: scopeId,
      embeddings_count: stats.embeddingsCount,
      total_notes: stats.totalNotes,
      synced_notes: stats.syncedNotes,
      last_sync_at: stats.lastSyncAt?.getTime() || null,
      updated_at: now,
    });
  } catch (e) {
    console.error('Failed to update embedding stats:', e);
    throw e;
  }
}

export async function getAllNoteEmbeddings(): Promise<Array<{
  noteId: string;
  embeddingSmall?: number[];
  embeddingMedium?: number[];
}>> {
  try {
    const result = cozoDb.runQuery(`
      ?[note_id, embedding_small, embedding_medium] :=
        *note_embedding{note_id, embedding_small, embedding_medium}
    `, {});

    if (!result.rows) return [];

    return result.rows.map((row: unknown[]) => ({
      noteId: row[0] as string,
      embeddingSmall: row[1] as number[] | undefined,
      embeddingMedium: row[2] as number[] | undefined,
    }));
  } catch (e) {
    console.error('Failed to get all note embeddings:', e);
    return [];
  }
}
