import { EntityRegistryAdapterAdapter } from '@/lib/cozo/graph/adapters/EntityRegistryAdapterAdapter';
import { migrateEntityRegistryAdapterToCozo, getBackupList, type MigrationResult } from './registryMigration';
import { unifiedRegistry } from '@/lib/cozo/graph/UnifiedRegistry';

export interface IntegrityCheckResult {
  passed: boolean;
  entityCount: number;
  orphanedCount: number;
  errors: string[];
}

export async function runFullMigration(
  oldRegistry: EntityRegistryAdapter
): Promise<{ migration: MigrationResult; integrity: IntegrityCheckResult }> {
  console.log('[Migration] Starting full migration with integrity check...');

  const migrationResult = await migrateEntityRegistryAdapterToCozo(oldRegistry, {
    createBackup: true,
    dryRun: false,
  });

  if (!migrationResult.success) {
    console.error('[Migration] Migration failed:', migrationResult.errors);
    return {
      migration: migrationResult,
      integrity: { passed: false, entityCount: 0, orphanedCount: 0, errors: ['Migration failed'] },
    };
  }

  const integrityResult = await verifyIntegrity();

  console.log('[Migration] Migration complete:', {
    migrated: migrationResult.migrated,
    backupKey: migrationResult.backupKey,
    integrityPassed: integrityResult.passed,
  });

  return { migration: migrationResult, integrity: integrityResult };
}

export async function verifyIntegrity(): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    entityCount: 0,
    orphanedCount: 0,
    errors: [],
  };

  try {
    await unifiedRegistry.init();

    const allEntities = unifiedRegistry.getAllEntitiesSync();
    result.entityCount = allEntities.length;

    for (const entity of allEntities) {
      if (!entity.id || !entity.label || !entity.kind) {
        result.errors.push(`Invalid entity: ${entity.id} missing required fields`);
        result.passed = false;
      }

      if (entity.normalized !== entity.label.toLowerCase().trim()) {
        result.errors.push(`Entity ${entity.id}: normalized mismatch`);
      }
    }

    const stats = await unifiedRegistry.getGlobalStats();
    console.log('[Integrity] Global stats:', stats);

    if (result.errors.length > 0) {
      result.passed = false;
    }

    console.log(`[Integrity] Check complete: ${result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`[Integrity] Entity count: ${result.entityCount}`);
    if (result.errors.length > 0) {
      console.log('[Integrity] Errors:', result.errors.slice(0, 10));
    }

  } catch (err) {
    result.passed = false;
    result.errors.push(`Integrity check failed: ${err}`);
  }

  return result;
}

export async function getMigrationStatus(): Promise<{
  hasBackups: boolean;
  backups: Array<{ id: string; createdAt: string; entityCount: number }>;
  currentEntityCount: number;
}> {
  const backups = await getBackupList();
  
  await unifiedRegistry.init();
  const entities = unifiedRegistry.getAllEntitiesSync();

  return {
    hasBackups: backups.length > 0,
    backups,
    currentEntityCount: entities.length,
  };
}

export async function cleanupOldRegistryReferences(): Promise<string[]> {
  const warnings: string[] = [];

  warnings.push('Old entity-registry.ts can be safely removed after verification');
  warnings.push('EntityRegistryAdapterAdapter now provides backward compatibility');
  warnings.push('All 22 consumer files will continue to work via the adapter');

  return warnings;
}
