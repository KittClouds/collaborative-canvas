import type { SyncEngine } from './SyncEngine';
import type { MigrationResult } from './types';
import { toSyncNote, toSyncFolder } from './converters';
import type { Note, Folder } from '@/contexts/NotesContext';

const STORAGE_KEY = 'networked-notes-data';
const MIGRATION_FLAG_KEY = 'cozo-migration-complete';
const BACKUP_KEY = 'networked-notes-data-backup';

interface StoredData {
  notes: Note[];
  folders: Folder[];
}

function parseStorageData(data: string): StoredData {
  const parsed = JSON.parse(data);
  return {
    notes: parsed.notes.map((n: Record<string, unknown>) => ({
      ...n,
      createdAt: new Date(n.createdAt as string),
      updatedAt: new Date(n.updatedAt as string),
    })),
    folders: parsed.folders.map((f: Record<string, unknown>) => ({
      ...f,
      createdAt: new Date(f.createdAt as string),
    })),
  };
}

export async function migrateLocalStorageToCozoDB(engine: SyncEngine): Promise<MigrationResult> {
  const result: MigrationResult = { migrated: 0, skipped: 0, errors: [] };

  try {
    const migrationFlag = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (migrationFlag === 'true') {
      console.log('[Migration] Already complete, skipping');
      return result;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('[Migration] No localStorage data found');
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return result;
    }

    const existingNotes = engine.getNotes();
    if (existingNotes.length > 0) {
      console.log('[Migration] CozoDB already has data, skipping');
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return result;
    }

    console.log('[Migration] Starting localStorage → CozoDB migration');

    const { notes, folders } = parseStorageData(stored);

    const sortedFolders = [...folders].sort((a, b) => {
      const aDepth = a.parentId ? 1 : 0;
      const bDepth = b.parentId ? 1 : 0;
      return aDepth - bDepth;
    });

    for (const folder of sortedFolders) {
      try {
        const syncFolder = toSyncFolder(folder, folders);
        engine.createFolder({
          id: syncFolder.id,
          name: syncFolder.name,
          parentId: syncFolder.parentId,
          color: syncFolder.color,
          entityKind: syncFolder.entityKind,
          entitySubtype: syncFolder.entitySubtype,
          entityLabel: syncFolder.entityLabel,
          isTypedRoot: syncFolder.isTypedRoot,
          isSubtypeRoot: syncFolder.isSubtypeRoot,
          inheritedKind: syncFolder.inheritedKind,
          inheritedSubtype: syncFolder.inheritedSubtype,
        });
        result.migrated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Folder ${folder.id}: ${message}`);
      }
    }

    for (const note of notes) {
      try {
        const syncNote = toSyncNote(note);
        engine.createNote({
          id: syncNote.id,
          title: syncNote.title,
          content: syncNote.content,
          folderId: syncNote.folderId,
          entityKind: syncNote.entityKind,
          entitySubtype: syncNote.entitySubtype,
          entityLabel: syncNote.entityLabel,
          isCanonicalEntity: syncNote.isCanonicalEntity,
          isPinned: syncNote.isPinned,
          isFavorite: syncNote.isFavorite,
          tags: syncNote.tags,
        });
        result.migrated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Note ${note.id}: ${message}`);
      }
    }

    await engine.flushNow();

    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    localStorage.setItem(BACKUP_KEY, stored);

    console.log(`[Migration] Complete: ${result.migrated} items migrated, ${result.errors.length} errors`);

    if (result.errors.length > 0) {
      console.warn('[Migration] Errors:', result.errors);
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Migration failed: ${message}`);
    console.error('[Migration] Fatal error:', err);
  }

  return result;
}

export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
}

export function resetMigration(): void {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
}
