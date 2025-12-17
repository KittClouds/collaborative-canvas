import { embeddingService, type EmbeddingModel } from './embeddingService';
import { saveEmbeddingForNote, updateEmbeddingStats } from '../cozo/schema/embeddingSchema';

export type SyncScope =
  | { type: 'note'; noteId: string }
  | { type: 'folder'; folderId: string }
  | { type: 'folders'; folderIds: string[]; includeQuickNotes?: boolean }
  | { type: 'global' };

export interface SyncOptions {
  model?: EmbeddingModel;
  forceReembed?: boolean;
}

export interface SyncProgress {
  phase: 'preparing' | 'embedding' | 'saving' | 'complete' | 'cancelled' | 'error';
  current: number;
  total: number;
  currentNote?: string;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
  cancelled?: boolean;
}

export interface SyncStatus {
  isRunning: boolean;
  progress?: SyncProgress;
  scope?: SyncScope;
}

type ProgressCallback = (progress: SyncProgress) => void;

class EmbeddingSyncService {
  private status: SyncStatus = { isRunning: false };
  private progressListeners: Set<ProgressCallback> = new Set();
  private cancelRequested = false;
  private getNotes: (() => Array<{ id: string; title: string; content: string; folderId?: string }>) | null = null;

  setNotesProvider(provider: () => Array<{ id: string; title: string; content: string; folderId?: string }>) {
    this.getNotes = provider;
  }

  async sync(scope: SyncScope, options: SyncOptions = {}): Promise<SyncResult> {
    if (this.status.isRunning) {
      return { success: false, itemsSynced: 0, errors: ['Sync already in progress'] };
    }

    if (!this.getNotes) {
      return { success: false, itemsSynced: 0, errors: ['Notes provider not set'] };
    }

    this.cancelRequested = false;
    this.status = { isRunning: true, scope };
    const model = options.model || 'small';
    const errors: string[] = [];
    let itemsSynced = 0;

    try {
      this.notifyProgress({ phase: 'preparing', current: 0, total: 0 });

      const allNotes = this.getNotes();
      const notesToSync = this.filterNotesForScope(allNotes, scope);

      if (notesToSync.length === 0) {
        this.notifyProgress({ phase: 'complete', current: 0, total: 0 });
        return { success: true, itemsSynced: 0, errors: [] };
      }

      await embeddingService.initialize();

      const total = notesToSync.length;
      this.notifyProgress({ phase: 'embedding', current: 0, total });

      for (let i = 0; i < notesToSync.length; i++) {
        if (this.cancelRequested) {
          this.notifyProgress({ phase: 'cancelled', current: i, total });
          return { success: false, itemsSynced, errors, cancelled: true };
        }

        const note = notesToSync[i];
        this.notifyProgress({
          phase: 'embedding',
          current: i + 1,
          total,
          currentNote: note.title,
        });

        try {
          const textContent = this.extractTextFromContent(note.content);
          if (!textContent.trim()) {
            continue;
          }

          const contentHash = await this.hashContent(textContent);
          const embedding = await embeddingService.embed(textContent, model);

          this.notifyProgress({
            phase: 'saving',
            current: i + 1,
            total,
            currentNote: note.title,
          });

          await saveEmbeddingForNote(
            note.id,
            Array.from(embedding),
            model,
            contentHash
          );

          itemsSynced++;
        } catch (e: any) {
          errors.push(`Failed to embed "${note.title}": ${e.message}`);
          console.error(`Failed to embed note ${note.id}:`, e);
        }
      }

      const scopeType = scope.type;
      const scopeId = scope.type === 'note' ? scope.noteId :
                      scope.type === 'folder' ? scope.folderId :
                      scope.type === 'folders' ? scope.folderIds.join(',') : 'global';

      await updateEmbeddingStats(scopeType, scopeId, {
        embeddingsCount: itemsSynced,
        totalNotes: notesToSync.length,
        syncedNotes: itemsSynced,
        lastSyncAt: new Date(),
      });

      this.notifyProgress({ phase: 'complete', current: total, total });

      return { success: errors.length === 0, itemsSynced, errors };
    } catch (e: any) {
      this.notifyProgress({ phase: 'error', current: 0, total: 0, error: e.message });
      return { success: false, itemsSynced, errors: [e.message] };
    } finally {
      this.status = { isRunning: false };
    }
  }

  private filterNotesForScope(
    notes: Array<{ id: string; title: string; content: string; folderId?: string }>,
    scope: SyncScope
  ): Array<{ id: string; title: string; content: string; folderId?: string }> {
    switch (scope.type) {
      case 'note':
        return notes.filter(n => n.id === scope.noteId);
      case 'folder':
        return notes.filter(n => n.folderId === scope.folderId);
      case 'folders':
        const folderSet = new Set(scope.folderIds);
        return notes.filter(n => {
          if (scope.includeQuickNotes && !n.folderId) return true;
          return n.folderId && folderSet.has(n.folderId);
        });
      case 'global':
        return notes;
      default:
        return [];
    }
  }

  private extractTextFromContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return this.extractTextFromTiptap(parsed);
    } catch {
      return content;
    }
  }

  private extractTextFromTiptap(node: any): string {
    if (!node) return '';

    let text = '';

    if (node.type === 'text' && node.text) {
      text += node.text;
    }

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        text += this.extractTextFromTiptap(child);
        if (child.type === 'paragraph' || child.type === 'heading') {
          text += '\n';
        }
      }
    }

    return text;
  }

  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  cancel(): void {
    if (this.status.isRunning) {
      this.cancelRequested = true;
    }
  }

  onProgress(callback: ProgressCallback): () => void {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  private notifyProgress(progress: SyncProgress): void {
    this.status.progress = progress;
    this.progressListeners.forEach(cb => cb(progress));
  }
}

export const syncService = new EmbeddingSyncService();
