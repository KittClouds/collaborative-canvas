export const SCHEMA_VERSION = 3;

export const SCHEMA_STATEMENTS: string[] = [
  // ============================================
  // NODES TABLE - Complete graph node storage
  // ============================================
  `CREATE TABLE IF NOT EXISTS nodes (
    -- Primary identity
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('NOTE', 'FOLDER', 'ENTITY', 'BLUEPRINT', 'TEMPORAL')),
    label TEXT NOT NULL,
    
    -- Content (ProseMirror JSON for notes)
    content TEXT,
    
    -- Hierarchy (folder tree)
    parent_id TEXT,
    depth INTEGER DEFAULT 0,
    
    -- Entity classification
    entity_kind TEXT,
    entity_subtype TEXT,
    is_entity INTEGER DEFAULT 0,
    source_note_id TEXT,
    
    -- Blueprint system
    blueprint_id TEXT,
    
    -- Narrative ordering
    sequence INTEGER,
    
    -- Display properties
    color TEXT,
    is_pinned INTEGER DEFAULT 0,
    favorite INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Complex data (JSON blobs)
    attributes TEXT,
    extraction TEXT,
    temporal TEXT,
    narrative_metadata TEXT,
    scene_metadata TEXT,
    event_metadata TEXT,
    blueprint_data TEXT,
    
    -- Inherited context (denormalized)
    inherited_kind TEXT,
    inherited_subtype TEXT,
    
    -- Type flags (denormalized)
    is_typed_root INTEGER DEFAULT 0,
    is_subtype_root INTEGER DEFAULT 0,
    
    -- Foreign keys
    FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (source_note_id) REFERENCES nodes(id) ON DELETE SET NULL,
    FOREIGN KEY (blueprint_id) REFERENCES nodes(id) ON DELETE SET NULL
  )`,

  // ============================================
  // EDGES TABLE - Graph relationships
  // ============================================
  `CREATE TABLE IF NOT EXISTS edges (
    -- Primary identity
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    type TEXT NOT NULL,
    
    -- Relationship strength
    weight REAL DEFAULT 1.0,
    
    -- Context
    context TEXT,
    bidirectional INTEGER DEFAULT 0,
    
    -- Temporal relationships (JSON)
    temporal_relation TEXT,
    
    -- Causal relationships (JSON)
    causality TEXT,
    
    -- Co-occurrence tracking
    note_ids TEXT,
    extraction_method TEXT,
    
    -- Metadata
    created_at INTEGER NOT NULL,
    properties TEXT,
    
    -- Foreign keys
    FOREIGN KEY (source) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target) REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Prevent duplicate edges
    UNIQUE(source, target, type)
  )`,

  // ============================================
  // EMBEDDINGS TABLE - Vector storage
  // ============================================
  `CREATE TABLE IF NOT EXISTS embeddings (
    node_id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    embedding_small BLOB,
    embedding_medium BLOB,
    model_small TEXT,
    model_medium TEXT,
    content_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  )`,

  // ============================================
  // METADATA TABLE - App state
  // ============================================
  `CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // ============================================
  // RESORANK CACHE TABLE - IDF values
  // ============================================
  `CREATE TABLE IF NOT EXISTS resorank_cache (
    term TEXT PRIMARY KEY,
    doc_frequency INTEGER NOT NULL,
    idf REAL NOT NULL,
    computed_at INTEGER NOT NULL
  )`,

  // ============================================
  // FTS5 VIRTUAL TABLE - Full-text search
  // ============================================
  `CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    node_id UNINDEXED,
    label,
    content,
    tags,
    entity_kind UNINDEXED,
    type UNINDEXED,
    tokenize='porter unicode61 remove_diacritics 1'
  )`,

  // ============================================
  // NODE INDEXES
  // ============================================

  // Primary lookups
  `CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id)`,

  // Entity queries
  `CREATE INDEX IF NOT EXISTS idx_nodes_entity_kind ON nodes(entity_kind)`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_source_note ON nodes(source_note_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_blueprint ON nodes(blueprint_id)`,

  // Temporal queries
  `CREATE INDEX IF NOT EXISTS idx_nodes_updated ON nodes(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at DESC)`,

  // Narrative ordering
  `CREATE INDEX IF NOT EXISTS idx_nodes_sequence ON nodes(parent_id, sequence)`,

  // Type-specific roots
  `CREATE INDEX IF NOT EXISTS idx_nodes_typed_root ON nodes(entity_kind, is_typed_root)`,

  // Composite indexes
  `CREATE INDEX IF NOT EXISTS idx_nodes_type_parent ON nodes(type, parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_kind_subtype ON nodes(entity_kind, entity_subtype)`,

  // ============================================
  // EDGE INDEXES
  // ============================================

  // Graph traversal
  `CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source)`,
  `CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target)`,
  `CREATE INDEX IF NOT EXISTS idx_edges_source_target ON edges(source, target)`,

  // Filtered traversal
  `CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)`,
  `CREATE INDEX IF NOT EXISTS idx_edges_source_type ON edges(source, type)`,
  `CREATE INDEX IF NOT EXISTS idx_edges_target_type ON edges(target, type)`,

  // Co-occurrence queries
  `CREATE INDEX IF NOT EXISTS idx_edges_type_weight ON edges(type, weight DESC)`,

  // ============================================
  // UNIFIED RELATIONSHIPS TABLE
  // ============================================
  `CREATE TABLE IF NOT EXISTS unified_relationships (
    -- Primary identity
    id TEXT PRIMARY KEY,
    source_entity_id TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    type TEXT NOT NULL,
    inverse_type TEXT,
    bidirectional INTEGER DEFAULT 0,
    
    -- Confidence scoring
    confidence REAL DEFAULT 0.5,
    confidence_by_source TEXT,
    
    -- Provenance (JSON array)
    provenance TEXT NOT NULL,
    
    -- Namespace isolation
    namespace TEXT,
    
    -- Metadata
    attributes TEXT,
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Prevent duplicates
    UNIQUE(source_entity_id, target_entity_id, type, namespace)
  )`,

  // Relationship indexes
  `CREATE INDEX IF NOT EXISTS idx_rel_source ON unified_relationships(source_entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rel_target ON unified_relationships(target_entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rel_type ON unified_relationships(type)`,
  `CREATE INDEX IF NOT EXISTS idx_rel_namespace ON unified_relationships(namespace)`,
  `CREATE INDEX IF NOT EXISTS idx_rel_confidence ON unified_relationships(confidence DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_rel_source_type ON unified_relationships(source_entity_id, type)`,
  `CREATE INDEX IF NOT EXISTS idx_rel_target_type ON unified_relationships(target_entity_id, type)`,

  // ============================================
  // OTHER INDEXES
  // ============================================
  `CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(content_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_resorank_computed ON resorank_cache(computed_at)`,
];

// FTS5 triggers - run separately after schema creation
export const FTS_TRIGGERS: string[] = [
  // Insert trigger
  `CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO nodes_fts(node_id, label, content, tags, entity_kind, type)
    VALUES (
      new.id, 
      new.label, 
      COALESCE(new.content, ''),
      COALESCE(json_extract(new.attributes, '$.tags'), ''),
      COALESCE(new.entity_kind, ''),
      new.type
    );
  END`,

  // Update trigger
  `CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
    DELETE FROM nodes_fts WHERE node_id = old.id;
    INSERT INTO nodes_fts(node_id, label, content, tags, entity_kind, type)
    VALUES (
      new.id, 
      new.label, 
      COALESCE(new.content, ''),
      COALESCE(json_extract(new.attributes, '$.tags'), ''),
      COALESCE(new.entity_kind, ''),
      new.type
    );
  END`,

  // Delete trigger
  `CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
    DELETE FROM nodes_fts WHERE node_id = old.id;
  END`,
];

// Validation triggers - data integrity constraints
export const VALIDATION_TRIGGERS: string[] = [
  // Ensure entity nodes have entity_kind
  `CREATE TRIGGER IF NOT EXISTS validate_entity_kind
  BEFORE INSERT ON nodes
  WHEN NEW.is_entity = 1 AND NEW.entity_kind IS NULL
  BEGIN
    SELECT RAISE(ABORT, 'Entity nodes must have entity_kind');
  END`,

  // Prevent self-referential edges
  `CREATE TRIGGER IF NOT EXISTS prevent_self_edges
  BEFORE INSERT ON edges
  WHEN NEW.source = NEW.target
  BEGIN
    SELECT RAISE(ABORT, 'Cannot create edge from node to itself');
  END`,

  // Ensure temporal nodes have temporal data
  `CREATE TRIGGER IF NOT EXISTS validate_temporal
  BEFORE INSERT ON nodes
  WHEN NEW.type = 'TEMPORAL' AND NEW.temporal IS NULL
  BEGIN
    SELECT RAISE(ABORT, 'Temporal nodes must have temporal data');
  END`,
];

// ============================================
// COZODB PERSISTENCE TABLES
// ============================================

export const COZO_SCHEMA_STATEMENTS: string[] = [
  // CozoDB Entities - mirrors the Cozo 'entities' relation
  `CREATE TABLE IF NOT EXISTS cozo_entities (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    normalized TEXT NOT NULL,
    kind TEXT NOT NULL,
    subtype TEXT,
    first_note TEXT,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL
  )`,

  // CozoDB Entity Aliases
  `CREATE TABLE IF NOT EXISTS cozo_entity_aliases (
    entity_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    normalized TEXT NOT NULL,
    PRIMARY KEY (entity_id, normalized),
    FOREIGN KEY (entity_id) REFERENCES cozo_entities(id) ON DELETE CASCADE
  )`,

  // CozoDB Entity Mentions
  `CREATE TABLE IF NOT EXISTS cozo_entity_mentions (
    entity_id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    mention_count INTEGER DEFAULT 0,
    last_seen INTEGER,
    PRIMARY KEY (entity_id, note_id),
    FOREIGN KEY (entity_id) REFERENCES cozo_entities(id) ON DELETE CASCADE
  )`,

  // CozoDB Entity Metadata
  `CREATE TABLE IF NOT EXISTS cozo_entity_metadata (
    entity_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (entity_id, key),
    FOREIGN KEY (entity_id) REFERENCES cozo_entities(id) ON DELETE CASCADE
  )`,

  // CozoDB Relationships
  `CREATE TABLE IF NOT EXISTS cozo_relationships (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL,
    inverse_type TEXT,
    bidirectional INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0.5,
    namespace TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (source_id) REFERENCES cozo_entities(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES cozo_entities(id) ON DELETE CASCADE
  )`,

  // CozoDB Relationship Provenance
  `CREATE TABLE IF NOT EXISTS cozo_relationship_provenance (
    relationship_id TEXT NOT NULL,
    source TEXT NOT NULL,
    origin_id TEXT NOT NULL,
    confidence REAL DEFAULT 0.5,
    timestamp INTEGER NOT NULL,
    context TEXT,
    PRIMARY KEY (relationship_id, source, origin_id),
    FOREIGN KEY (relationship_id) REFERENCES cozo_relationships(id) ON DELETE CASCADE
  )`,

  // CozoDB Relationship Attributes
  `CREATE TABLE IF NOT EXISTS cozo_relationship_attributes (
    relationship_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (relationship_id, key),
    FOREIGN KEY (relationship_id) REFERENCES cozo_relationships(id) ON DELETE CASCADE
  )`,

  // CozoDB Indexes
  `CREATE INDEX IF NOT EXISTS idx_cozo_entities_normalized ON cozo_entities(normalized)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_entities_kind ON cozo_entities(kind)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_aliases_normalized ON cozo_entity_aliases(normalized)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_mentions_entity ON cozo_entity_mentions(entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_mentions_note ON cozo_entity_mentions(note_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_rels_source ON cozo_relationships(source_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_rels_target ON cozo_relationships(target_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_rels_type ON cozo_relationships(type)`,
  `CREATE INDEX IF NOT EXISTS idx_cozo_rels_namespace ON cozo_relationships(namespace)`,
];

// All statements in order
export const ALL_SCHEMA_STATEMENTS: string[] = [
  ...SCHEMA_STATEMENTS,
  ...FTS_TRIGGERS,
  ...VALIDATION_TRIGGERS,
  ...COZO_SCHEMA_STATEMENTS,
];
