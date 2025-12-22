/**
 * Ref Schema - SQLite table definitions for the Ref system
 * 
 * This replaces the legacy 'entities' and 'connections' tables
 * with a unified 'refs' table and supporting structures.
 */

/**
 * SQL Schema for Refs
 */
export const REF_SCHEMA = `
-- ============================================
-- REFS TABLE - Core reference storage
-- ============================================
CREATE TABLE IF NOT EXISTS refs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  target_resolved TEXT,
  predicate TEXT,
  attributes TEXT,
  source_note_id TEXT NOT NULL,
  confidence REAL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_refs_kind ON refs(kind);
CREATE INDEX IF NOT EXISTS idx_refs_target ON refs(target);
CREATE INDEX IF NOT EXISTS idx_refs_source_note ON refs(source_note_id);
CREATE INDEX IF NOT EXISTS idx_refs_target_resolved ON refs(target_resolved);

-- ============================================
-- REF_POSITIONS TABLE - Normalized positions
-- ============================================
CREATE TABLE IF NOT EXISTS ref_positions (
  ref_id TEXT NOT NULL,
  note_id TEXT NOT NULL,
  offset INTEGER NOT NULL,
  length INTEGER NOT NULL,
  context_before TEXT,
  context_after TEXT,
  
  PRIMARY KEY (ref_id, note_id, offset),
  FOREIGN KEY (ref_id) REFERENCES refs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ref_positions_note ON ref_positions(note_id);

-- ============================================
-- PATTERNS TABLE - User-defined patterns
-- ============================================
CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL,
  pattern TEXT NOT NULL,
  flags TEXT NOT NULL,
  captures TEXT NOT NULL,
  rendering TEXT,
  constraints TEXT,
  is_built_in INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_patterns_enabled ON patterns(enabled, priority DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_kind ON patterns(kind);

-- ============================================
-- REFS_FTS - Full-text search on refs
-- ============================================
CREATE VIRTUAL TABLE IF NOT EXISTS refs_fts USING fts5(
  target,
  target_resolved,
  attributes,
  content='refs',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS refs_ai AFTER INSERT ON refs BEGIN
  INSERT INTO refs_fts(rowid, target, target_resolved, attributes)
  VALUES (new.rowid, new.target, new.target_resolved, new.attributes);
END;

CREATE TRIGGER IF NOT EXISTS refs_ad AFTER DELETE ON refs BEGIN
  INSERT INTO refs_fts(refs_fts, rowid, target, target_resolved, attributes)
  VALUES ('delete', old.rowid, old.target, old.target_resolved, old.attributes);
END;

CREATE TRIGGER IF NOT EXISTS refs_au AFTER UPDATE ON refs BEGIN
  INSERT INTO refs_fts(refs_fts, rowid, target, target_resolved, attributes)
  VALUES ('delete', old.rowid, old.target, old.target_resolved, old.attributes);
  INSERT INTO refs_fts(rowid, target, target_resolved, attributes)
  VALUES (new.rowid, new.target, new.target_resolved, new.attributes);
END;
`;

/**
 * Migration SQL: Entities → Refs
 */
export const MIGRATION_ENTITIES_TO_REFS = `
-- Migrate existing entities to refs
INSERT INTO refs (id, kind, target, target_resolved, attributes, source_note_id, confidence, created_at, last_seen_at, payload)
SELECT 
  id,
  'entity',
  label,
  id,
  metadata,
  COALESCE(source_note_id, ''),
  1.0,
  created_at,
  COALESCE(updated_at, created_at),
  json_object(
    'entityKind', kind,
    'subtype', subtype,
    'aliases', COALESCE(aliases, '[]')
  )
FROM entities
WHERE NOT EXISTS (SELECT 1 FROM refs WHERE refs.id = entities.id);
`;

/**
 * Drop old tables (use with caution!)
 */
export const DROP_LEGACY_TABLES = `
-- WARNING: This will permanently delete old data
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS entity_mentions;
DROP TABLE IF EXISTS connections;
`;

/**
 * TypeScript types for database operations
 */
export interface RefRow {
    id: string;
    kind: string;
    target: string;
    target_resolved: string | null;
    predicate: string | null;
    attributes: string | null;
    source_note_id: string;
    confidence: number | null;
    created_at: number;
    last_seen_at: number;
    payload: string;
}

export interface RefPositionRow {
    ref_id: string;
    note_id: string;
    offset: number;
    length: number;
    context_before: string | null;
    context_after: string | null;
}

export interface PatternRow {
    id: string;
    name: string;
    description: string | null;
    kind: string;
    enabled: number;
    priority: number;
    pattern: string;
    flags: string;
    captures: string;
    rendering: string | null;
    constraints: string | null;
    is_built_in: number;
    created_at: number | null;
    updated_at: number | null;
}
