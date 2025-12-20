import type {
  IEmbeddingStore,
  EmbeddingRecord,
} from '../interfaces';
import { dbClient, blobToFloat32 } from '@/lib/db';

export class EmbeddingStoreImpl implements IEmbeddingStore {
  private cache: Map<string, EmbeddingRecord> = new Map();
  private stats: Map<string, {
    embeddingsCount: number;
    totalNotes: number;
    syncedNotes: number;
    lastSyncAt?: Date;
  }> = new Map();

  async saveEmbedding(
    noteId: string,
    embedding: number[],
    model: 'small' | 'medium',
    contentHash: string
  ): Promise<void> {
    const now = Date.now();
    const float32 = new Float32Array(embedding);
    const text = '';

    if (dbClient.isReady()) {
      try {
        await dbClient.saveEmbedding(noteId, float32, model, text, contentHash);
      } catch (err) {
        console.error('[EmbeddingStore] Failed to save to SQLite:', err);
      }
    }

    const existing = this.cache.get(noteId);
    if (existing) {
      const updated: EmbeddingRecord = {
        ...existing,
        contentHash,
        updatedAt: now,
      };

      if (model === 'small') {
        updated.embeddingSmall = embedding;
        updated.embeddingModel = 'mdbr-leaf-ir';
      } else {
        updated.embeddingMedium = embedding;
        updated.embeddingModel = 'modernbert-embed-base';
      }

      this.cache.set(noteId, updated);
    } else {
      const record: EmbeddingRecord = {
        noteId,
        embeddingSmall: model === 'small' ? embedding : undefined,
        embeddingMedium: model === 'medium' ? embedding : undefined,
        embeddingModel: model === 'small' ? 'mdbr-leaf-ir' : 'modernbert-embed-base',
        contentHash,
        createdAt: now,
        updatedAt: now,
      };

      this.cache.set(noteId, record);
    }
  }

  async getEmbedding(noteId: string): Promise<EmbeddingRecord | null> {
    const cached = this.cache.get(noteId);
    if (cached) {
      return cached;
    }

    if (dbClient.isReady()) {
      try {
        const sqliteEmb = await dbClient.getEmbedding(noteId);
        if (sqliteEmb) {
          const record: EmbeddingRecord = {
            noteId: sqliteEmb.node_id,
            embeddingSmall: sqliteEmb.embedding_small 
              ? Array.from(blobToFloat32(sqliteEmb.embedding_small)) 
              : undefined,
            embeddingMedium: sqliteEmb.embedding_medium 
              ? Array.from(blobToFloat32(sqliteEmb.embedding_medium)) 
              : undefined,
            embeddingModel: sqliteEmb.model_medium || sqliteEmb.model_small || undefined,
            contentHash: sqliteEmb.content_hash,
            createdAt: sqliteEmb.created_at,
            updatedAt: sqliteEmb.updated_at,
          };
          this.cache.set(noteId, record);
          return record;
        }
      } catch (err) {
        console.error('[EmbeddingStore] Failed to get from SQLite:', err);
      }
    }

    return null;
  }

  async getAllEmbeddings(): Promise<EmbeddingRecord[]> {
    if (dbClient.isReady()) {
      try {
        const sqliteEmbeddings = await dbClient.getAllEmbeddings();
        for (const sqliteEmb of sqliteEmbeddings) {
          if (!this.cache.has(sqliteEmb.node_id)) {
            const record: EmbeddingRecord = {
              noteId: sqliteEmb.node_id,
              embeddingSmall: sqliteEmb.embedding_small 
                ? Array.from(blobToFloat32(sqliteEmb.embedding_small)) 
                : undefined,
              embeddingMedium: sqliteEmb.embedding_medium 
                ? Array.from(blobToFloat32(sqliteEmb.embedding_medium)) 
                : undefined,
              embeddingModel: sqliteEmb.model_medium || sqliteEmb.model_small || undefined,
              contentHash: sqliteEmb.content_hash,
              createdAt: sqliteEmb.created_at,
              updatedAt: sqliteEmb.updated_at,
            };
            this.cache.set(sqliteEmb.node_id, record);
          }
        }
      } catch (err) {
        console.error('[EmbeddingStore] Failed to get all from SQLite:', err);
      }
    }

    return Array.from(this.cache.values());
  }

  async deleteEmbedding(noteId: string): Promise<void> {
    this.cache.delete(noteId);

    if (dbClient.isReady()) {
      try {
        await dbClient.deleteEmbedding(noteId);
      } catch (err) {
        console.error('[EmbeddingStore] Failed to delete from SQLite:', err);
      }
    }
  }

  async getEmbeddingStats(scopeType: string, scopeId: string): Promise<{
    embeddingsCount: number;
    totalNotes: number;
    syncedNotes: number;
    lastSyncAt?: Date;
  } | null> {
    const key = `${scopeType}:${scopeId}`;
    return this.stats.get(key) || null;
  }

  async updateEmbeddingStats(
    scopeType: string,
    scopeId: string,
    stats: {
      embeddingsCount: number;
      totalNotes: number;
      syncedNotes: number;
    }
  ): Promise<void> {
    const key = `${scopeType}:${scopeId}`;
    this.stats.set(key, {
      ...stats,
      lastSyncAt: new Date(),
    });
  }

  clear(): void {
    this.cache.clear();
    this.stats.clear();
  }

  getCount(): number {
    return this.cache.size;
  }
}

let embeddingStoreInstance: EmbeddingStoreImpl | null = null;

export function getEmbeddingStoreImpl(): EmbeddingStoreImpl {
  if (!embeddingStoreInstance) {
    embeddingStoreInstance = new EmbeddingStoreImpl();
  }
  return embeddingStoreInstance;
}

export function resetEmbeddingStore(): void {
  embeddingStoreInstance = null;
}
