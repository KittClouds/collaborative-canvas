import type {
  IEmbeddingStore,
  EmbeddingRecord,
} from '../interfaces';

export class EmbeddingStoreImpl implements IEmbeddingStore {
  private embeddings: Map<string, EmbeddingRecord> = new Map();
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
    const existing = this.embeddings.get(noteId);

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

      this.embeddings.set(noteId, updated);
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

      this.embeddings.set(noteId, record);
    }
  }

  async getEmbedding(noteId: string): Promise<EmbeddingRecord | null> {
    return this.embeddings.get(noteId) || null;
  }

  async getAllEmbeddings(): Promise<EmbeddingRecord[]> {
    return Array.from(this.embeddings.values());
  }

  async deleteEmbedding(noteId: string): Promise<void> {
    this.embeddings.delete(noteId);
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
    this.embeddings.clear();
    this.stats.clear();
  }

  getCount(): number {
    return this.embeddings.size;
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
