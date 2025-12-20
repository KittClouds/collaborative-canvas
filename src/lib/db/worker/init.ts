import sqlite3InitModule from '@sqliteai/sqlite-wasm';
import { SCHEMA_STATEMENTS, FTS_TRIGGERS, VALIDATION_TRIGGERS, SCHEMA_VERSION } from './schema';

export type SQLite3Database = ReturnType<typeof createDatabase>;

let sqlite3Instance: Awaited<ReturnType<typeof sqlite3InitModule>> | null = null;
let dbInstance: SQLite3Database | null = null;

function createDatabase(sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>>) {
  if ('opfs' in sqlite3) {
    return new sqlite3.oo1.OpfsDb('/canvas.sqlite3');
  }
  console.warn('OPFS not available, using in-memory database');
  return new sqlite3.oo1.DB(':memory:', 'c');
}

export async function initializeSQLite(): Promise<SQLite3Database> {
  if (dbInstance) {
    return dbInstance;
  }

  console.log('[SQLite Worker] Loading SQLite3 module...');
  const startTime = performance.now();

  sqlite3Instance = await sqlite3InitModule({
    print: console.log,
    printErr: console.error,
  });

  console.log(`[SQLite Worker] SQLite3 version: ${sqlite3Instance.version.libVersion}`);

  dbInstance = createDatabase(sqlite3Instance);
  console.log(`[SQLite Worker] Database opened: ${dbInstance.filename}`);

  runMigrations(dbInstance);

  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log(`[SQLite Worker] Initialized in ${elapsed}ms`);

  return dbInstance;
}

function safeExec(db: SQLite3Database, stmt: string, context: string, silent = false): boolean {
  try {
    db.exec(stmt);
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('already exists') || errorMsg.includes('duplicate column')) {
      return true;
    }
    if (!silent) {
      console.warn(`[SQLite Worker] ${context}:`, stmt.substring(0, 60), '-', errorMsg);
    }
    return false;
  }
}

function getTableColumns(db: SQLite3Database, tableName: string): Set<string> {
  try {
    const result = db.exec({
      sql: `PRAGMA table_info(${tableName})`,
      returnValue: 'resultRows',
      rowMode: 'object',
    }) as Array<{ name: string }>;
    return new Set(result.map(r => r.name));
  } catch {
    return new Set();
  }
}

function migrateNodesTable(db: SQLite3Database): void {
  const existingColumns = getTableColumns(db, 'nodes');
  if (existingColumns.size === 0) {
    return;
  }

  const newColumns: Array<{ name: string; def: string }> = [
    { name: 'entity_kind', def: 'TEXT' },
    { name: 'entity_subtype', def: 'TEXT' },
    { name: 'is_entity', def: 'INTEGER DEFAULT 0' },
    { name: 'source_note_id', def: 'TEXT' },
    { name: 'blueprint_id', def: 'TEXT' },
    { name: 'sequence', def: 'INTEGER' },
    { name: 'color', def: 'TEXT' },
    { name: 'is_pinned', def: 'INTEGER DEFAULT 0' },
    { name: 'favorite', def: 'INTEGER DEFAULT 0' },
    { name: 'attributes', def: 'TEXT' },
    { name: 'extraction', def: 'TEXT' },
    { name: 'temporal', def: 'TEXT' },
    { name: 'narrative_metadata', def: 'TEXT' },
    { name: 'scene_metadata', def: 'TEXT' },
    { name: 'event_metadata', def: 'TEXT' },
    { name: 'blueprint_data', def: 'TEXT' },
    { name: 'inherited_kind', def: 'TEXT' },
    { name: 'inherited_subtype', def: 'TEXT' },
    { name: 'is_typed_root', def: 'INTEGER DEFAULT 0' },
    { name: 'is_subtype_root', def: 'INTEGER DEFAULT 0' },
  ];

  let addedCount = 0;
  for (const col of newColumns) {
    if (!existingColumns.has(col.name)) {
      const success = safeExec(
        db,
        `ALTER TABLE nodes ADD COLUMN ${col.name} ${col.def}`,
        'Migrate nodes',
        true
      );
      if (success) addedCount++;
    }
  }

  if (addedCount > 0) {
    console.log(`[SQLite Worker] Added ${addedCount} new columns to nodes table`);
  }
}

function runMigrations(db: SQLite3Database): void {
  console.log('[SQLite Worker] Running schema migrations...');

  db.exec('PRAGMA foreign_keys = ON;');

  const currentVersion = getSchemaVersion(db);
  console.log(`[SQLite Worker] Current schema version: ${currentVersion}, target: ${SCHEMA_VERSION}`);

  const tables: string[] = [];
  const indexes: string[] = [];
  const virtualTables: string[] = [];
  
  for (const stmt of SCHEMA_STATEMENTS) {
    const trimmed = stmt.trim().toUpperCase();
    if (trimmed.startsWith('CREATE TABLE')) {
      tables.push(stmt);
    } else if (trimmed.startsWith('CREATE INDEX')) {
      indexes.push(stmt);
    } else if (trimmed.startsWith('CREATE VIRTUAL')) {
      virtualTables.push(stmt);
    } else {
      tables.push(stmt);
    }
  }

  console.log(`[SQLite Worker] Creating ${tables.length} tables...`);
  for (const stmt of tables) {
    safeExec(db, stmt, 'Table creation');
  }

  if (currentVersion > 0 && currentVersion < SCHEMA_VERSION) {
    console.log('[SQLite Worker] Migrating existing tables...');
    migrateNodesTable(db);
  }

  console.log(`[SQLite Worker] Creating ${indexes.length} indexes...`);
  for (const stmt of indexes) {
    safeExec(db, stmt, 'Index creation', true);
  }

  console.log(`[SQLite Worker] Creating ${virtualTables.length} virtual tables...`);
  for (const stmt of virtualTables) {
    safeExec(db, stmt, 'Virtual table creation');
  }

  console.log(`[SQLite Worker] Creating ${FTS_TRIGGERS.length} FTS triggers...`);
  for (const stmt of FTS_TRIGGERS) {
    safeExec(db, stmt, 'FTS trigger creation', true);
  }

  console.log(`[SQLite Worker] Creating ${VALIDATION_TRIGGERS.length} validation triggers...`);
  for (const stmt of VALIDATION_TRIGGERS) {
    safeExec(db, stmt, 'Validation trigger creation', true);
  }

  if (currentVersion < SCHEMA_VERSION) {
    setSchemaVersion(db, SCHEMA_VERSION);
    console.log(`[SQLite Worker] Schema upgraded to version ${SCHEMA_VERSION}`);
  }

  initializeMetadata(db);

  console.log(`[SQLite Worker] Schema version: ${getSchemaVersion(db)}`);
}

function initializeMetadata(db: SQLite3Database): void {
  const now = Date.now();
  
  // Set default metadata values if they don't exist
  const defaults: [string, string][] = [
    ['created_at', now.toString()],
    ['last_modified', now.toString()],
    ['graph_stats', JSON.stringify({ nodeCount: 0, edgeCount: 0 })],
    ['resorank_version', '0'],
  ];

  for (const [key, value] of defaults) {
    try {
      db.exec({
        sql: `INSERT OR IGNORE INTO metadata (key, value, updated_at) VALUES (?, ?, ?)`,
        bind: [key, value, now],
      });
    } catch {
      // Ignore errors for default metadata
    }
  }
}

function getSchemaVersion(db: SQLite3Database): number {
  try {
    const result = db.exec({
      sql: "SELECT value FROM metadata WHERE key = 'schema_version'",
      returnValue: 'resultRows',
    });
    if (result && result.length > 0) {
      return parseInt(result[0][0] as string, 10);
    }
  } catch {
    // Table might not exist yet
  }
  return 0;
}

function setSchemaVersion(db: SQLite3Database, version: number): void {
  const now = Date.now();
  db.exec({
    sql: `INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES ('schema_version', ?, ?)`,
    bind: [version.toString(), now],
  });
}

export function getDatabase(): SQLite3Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeSQLite() first.');
  }
  return dbInstance;
}
