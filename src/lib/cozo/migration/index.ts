export { 
  runFullMigration,
  migrateNotesToCozo,
  migrateFoldersToCozo,
  migrateLinksToCozo,
  noteToCozo,
  folderToCozo,
  upsertNote,
  upsertFolder,
  upsertWikilink,
  upsertTag,
  extractWikilinks,
  extractTags,
  extractPlainText,
  computeFolderPath,
  resolveWikilinks,
  type MigrationResult 
} from './bridge';
