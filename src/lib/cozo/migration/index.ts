export {
  migrateEntityRegistryToCozo,
  getBackupList,
  deleteBackup,
  type MigrationResult,
} from './registryMigration';

export {
  runFullMigration,
  verifyIntegrity,
  getMigrationStatus,
  cleanupOldRegistryReferences,
  type IntegrityCheckResult,
} from './runMigration';
