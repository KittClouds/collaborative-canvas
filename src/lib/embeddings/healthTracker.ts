import { getEmbeddingStore } from '@/lib/storage/index';
import type { SyncScope } from './syncService';

export interface EmbeddingHealth {
  embeddingsCount: number;
  totalNotes: number;
  syncedNotes: number;
  lastSyncAt?: Date;
}

type HealthCallback = (health: EmbeddingHealth) => void;

class EmbeddingHealthTracker {
  private listeners: Set<HealthCallback> = new Set();
  private cachedHealth: EmbeddingHealth | null = null;
  private getNotes: (() => Array<{ id: string; folderId?: string }>) | null = null;

  setNotesProvider(provider: () => Array<{ id: string; folderId?: string }>) {
    this.getNotes = provider;
  }

  async getHealth(scope?: SyncScope): Promise<EmbeddingHealth> {
    if (!this.getNotes) {
      return { embeddingsCount: 0, totalNotes: 0, syncedNotes: 0 };
    }

    const allNotes = this.getNotes();
    const embeddingStore = getEmbeddingStore();
    const allEmbeddings = await embeddingStore.getAllEmbeddings();

    const embeddingsMap = new Map(allEmbeddings.map(e => [e.noteId, e]));

    let relevantNotes: Array<{ id: string; folderId?: string }>;

    if (!scope || scope.type === 'global') {
      relevantNotes = allNotes;
    } else if (scope.type === 'note') {
      relevantNotes = allNotes.filter(n => n.id === scope.noteId);
    } else if (scope.type === 'folder') {
      relevantNotes = allNotes.filter(n => n.folderId === scope.folderId);
    } else if (scope.type === 'folders') {
      const folderSet = new Set(scope.folderIds);
      relevantNotes = allNotes.filter(n => {
        if (scope.includeQuickNotes && !n.folderId) return true;
        return n.folderId && folderSet.has(n.folderId);
      });
    } else {
      relevantNotes = allNotes;
    }

    let syncedNotes = 0;
    let embeddingsCount = 0;

    for (const note of relevantNotes) {
      const embedding = embeddingsMap.get(note.id);
      if (embedding && (embedding.embeddingSmall || embedding.embeddingMedium)) {
        syncedNotes++;
        if (embedding.embeddingSmall) embeddingsCount++;
        if (embedding.embeddingMedium) embeddingsCount++;
      }
    }

    const health: EmbeddingHealth = {
      embeddingsCount,
      totalNotes: relevantNotes.length,
      syncedNotes,
    };

    const scopeType = scope?.type || 'global';
    const scopeId = !scope ? 'global' :
                    scope.type === 'note' ? scope.noteId :
                    scope.type === 'folder' ? scope.folderId :
                    scope.type === 'folders' ? scope.folderIds.join(',') : 'global';

    const storedStats = await embeddingStore.getEmbeddingStats(scopeType, scopeId);
    if (storedStats?.lastSyncAt) {
      health.lastSyncAt = storedStats.lastSyncAt;
    }

    this.cachedHealth = health;
    return health;
  }

  async hasEmbedding(noteId: string): Promise<boolean> {
    const embedding = await getEmbeddingForNote(noteId);
    return !!(embedding?.embeddingSmall || embedding?.embeddingMedium);
  }

  async refreshHealth(): Promise<EmbeddingHealth> {
    const health = await this.getHealth();
    this.notifyListeners(health);
    return health;
  }

  onHealthChange(callback: HealthCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(health: EmbeddingHealth): void {
    this.listeners.forEach(cb => cb(health));
  }
}

export const healthTracker = new EmbeddingHealthTracker();
