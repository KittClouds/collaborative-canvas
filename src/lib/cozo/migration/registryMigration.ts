import { EntityRegistryAdapter } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';
import { unifiedRegistry } from '@/lib/cozo/graph/UnifiedRegistry';
import type { EntityKind } from '@/lib/types/entityTypes';

export interface MigrationResult {
  success: boolean;
  migrated: number;
  skipped: number;
  errors: string[];
  backupKey: string | null;
}

const BACKUP_STORE_NAME = 'entity-registry-backup';

async function createIndexedDBBackup(registryData: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('entity-migration', 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.createObjectStore(BACKUP_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
      const store = tx.objectStore(BACKUP_STORE_NAME);

      const backupKey = `backup-${Date.now()}`;
      const backupRecord = {
        id: backupKey,
        data: registryData,
        createdAt: new Date().toISOString(),
      };

      const putRequest = store.put(backupRecord);

      putRequest.onsuccess = () => {
        db.close();
        resolve(backupKey);
      };

      putRequest.onerror = () => {
        db.close();
        reject(new Error('Failed to create backup'));
      };
    };

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB for backup'));
    };
  });
}

function mapEntityKind(kind: string): EntityKind {
  const kindMap: Record<string, EntityKind> = {
    character: 'CHARACTER',
    location: 'LOCATION',
    item: 'ITEM',
    faction: 'FACTION',
    event: 'EVENT',
    concept: 'CONCEPT',
    npc: 'NPC',
    scene: 'SCENE',
    arc: 'ARC',
    act: 'ACT',
    chapter: 'CHAPTER',
    beat: 'BEAT',
    timeline: 'TIMELINE',
    narrative: 'NARRATIVE',
  };
  return (kindMap[kind?.toLowerCase()] || kind?.toUpperCase() || 'CONCEPT') as EntityKind;
}

export async function migrateEntityRegistryAdapterToCozo(
  registry: EntityRegistryAdapter,
  options: { createBackup?: boolean; dryRun?: boolean } = {}
): Promise<MigrationResult> {
  const { createBackup = true, dryRun = false } = options;

  const result: MigrationResult = {
    success: false,
    migrated: 0,
    skipped: 0,
    errors: [],
    backupKey: null,
  };

  try {
    const allEntities = registry.getAllEntities();
    console.log(`[Migration] Starting migration of ${allEntities.length} entities`);

    if (allEntities.length === 0) {
      result.success = true;
      console.log('[Migration] No entities to migrate');
      return result;
    }

    if (createBackup && !dryRun) {
      try {
        const registryData = {
          entities: allEntities.map(e => ({
            ...e,
            ...e,
            mentionsByNote: Object.fromEntries(e.mentionsByNote),
            noteAppearances: Array.from(e.mentionsByNote.keys()),
            firstMentionDate: e.createdAt.toISOString(),
            lastSeenDate: e.lastSeenDate.toISOString(),
          })),
          exportedAt: new Date().toISOString(),
        };

        result.backupKey = await createIndexedDBBackup(registryData);
        console.log(`[Migration] Created backup: ${result.backupKey}`);
      } catch (err) {
        result.errors.push(`Backup failed: ${err}`);
        console.error('[Migration] Backup failed:', err);
        return result;
      }
    }

    await unifiedRegistry.init();

    if (dryRun) {
      console.log('[Migration] Dry run - would migrate:', allEntities.length);
      result.migrated = allEntities.length;
      result.success = true;
      return result;
    }

    for (const entity of allEntities) {
      try {
        const kind = mapEntityKind(entity.kind);
        const noteId = entity.firstNote || 'unknown';

        await unifiedRegistry.registerEntity(entity.label, kind, noteId, {
          subtype: entity.subtype,
          aliases: entity.aliases,
          metadata: {
            ...entity.attributes,
            ...(entity.attributes || {}),
            migratedFrom: 'entity-registry',
            migrationDate: new Date().toISOString(),
            originalTotalMentions: entity.totalMentions,
          },
        });

        if (entity.mentionsByNote) {
          for (const [mentionNoteId, count] of entity.mentionsByNote.entries()) {
            if (mentionNoteId !== noteId) {
              const registered = await unifiedRegistry.findEntityByLabel(entity.label);
              if (registered) {
                await unifiedRegistry.updateNoteMentions(registered.id, mentionNoteId, count);
              }
            }
          }
        }

        result.migrated++;

        if (result.migrated % 50 === 0) {
          console.log(`[Migration] Progress: ${result.migrated}/${allEntities.length}`);
        }
      } catch (err) {
        result.errors.push(`Failed to migrate entity ${entity.id} (${entity.label}): ${err}`);
        result.skipped++;
      }
    }

    result.success = result.errors.length === 0;
    console.log(`[Migration] Complete. Migrated: ${result.migrated}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);

    return result;
  } catch (err) {
    result.errors.push(`Migration failed: ${err}`);
    console.error('[Migration] Fatal error:', err);
    return result;
  }
}

export async function getBackupList(): Promise<Array<{ id: string; createdAt: string; entityCount: number }>> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('entity-migration', 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.createObjectStore(BACKUP_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.close();
        resolve([]);
        return;
      }

      const tx = db.transaction(BACKUP_STORE_NAME, 'readonly');
      const store = tx.objectStore(BACKUP_STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const backups = getAllRequest.result.map((b: any) => ({
          id: b.id,
          createdAt: b.createdAt,
          entityCount: b.data?.entities?.length || 0,
        }));
        db.close();
        resolve(backups);
      };

      getAllRequest.onerror = () => {
        db.close();
        reject(new Error('Failed to get backups'));
      };
    };

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };
  });
}

export async function deleteBackup(backupKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('entity-migration', 1);

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
      const store = tx.objectStore(BACKUP_STORE_NAME);
      const deleteRequest = store.delete(backupKey);

      deleteRequest.onsuccess = () => {
        db.close();
        resolve();
      };

      deleteRequest.onerror = () => {
        db.close();
        reject(new Error('Failed to delete backup'));
      };
    };

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };
  });
}
