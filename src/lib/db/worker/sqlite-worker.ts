import { initializeSQLite, getDatabase } from './init';
import type { 
  WorkerMessage, 
  WorkerResponse, 
  SQLiteNode, 
  SQLiteNodeInput,
  SQLiteEdge,
  SQLiteEdgeInput,
  SQLiteEmbedding,
  FTSSearchOptions,
  FTSSearchResult,
  ResoRankCacheEntry,
  NodeType,
} from '../client/types';
import { EMBEDDING_MODELS, serializeJson } from '../client/types';

let isInitialized = false;

function respond(id: string, response: Omit<WorkerResponse, 'id'>): void {
  self.postMessage({ id, ...response } as WorkerResponse);
}

async function handleInit(): Promise<void> {
  if (isInitialized) {
    return;
  }
  await initializeSQLite();
  isInitialized = true;
}

// ============================================
// NODE OPERATIONS
// ============================================

function handleInsertNode(payload: SQLiteNodeInput & { id: string }): SQLiteNode {
  const db = getDatabase();
  const now = Date.now();

  db.exec({
    sql: `INSERT INTO nodes (
      id, type, label, content, parent_id, depth,
      entity_kind, entity_subtype, is_entity, source_note_id,
      blueprint_id, sequence, color, is_pinned, favorite,
      created_at, updated_at,
      attributes, extraction, temporal, narrative_metadata,
      scene_metadata, event_metadata, blueprint_data,
      inherited_kind, inherited_subtype, is_typed_root, is_subtype_root
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bind: [
      payload.id,
      payload.type,
      payload.label,
      payload.content ?? null,
      payload.parent_id ?? null,
      payload.depth ?? 0,
      payload.entity_kind ?? null,
      payload.entity_subtype ?? null,
      payload.is_entity ? 1 : 0,
      payload.source_note_id ?? null,
      payload.blueprint_id ?? null,
      payload.sequence ?? null,
      payload.color ?? null,
      payload.is_pinned ? 1 : 0,
      payload.favorite ? 1 : 0,
      now,
      now,
      serializeJson(payload.attributes),
      serializeJson(payload.extraction),
      serializeJson(payload.temporal),
      serializeJson(payload.narrative_metadata),
      serializeJson(payload.scene_metadata),
      serializeJson(payload.event_metadata),
      serializeJson(payload.blueprint_data),
      payload.inherited_kind ?? null,
      payload.inherited_subtype ?? null,
      payload.is_typed_root ? 1 : 0,
      payload.is_subtype_root ? 1 : 0,
    ],
  });

  return handleGetNode(payload.id)!;
}

function handleGetNode(id: string): SQLiteNode | null {
  const db = getDatabase();
  const rows = db.exec({
    sql: 'SELECT * FROM nodes WHERE id = ?',
    bind: [id],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteNode[];

  return rows.length > 0 ? rows[0] : null;
}

function handleGetAllNodes(): SQLiteNode[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM nodes ORDER BY created_at',
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteNode[];
}

function handleGetNodesByType(type: NodeType): SQLiteNode[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM nodes WHERE type = ? ORDER BY created_at',
    bind: [type],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteNode[];
}

function handleGetNodesByParent(parentId: string): SQLiteNode[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM nodes WHERE parent_id = ? ORDER BY sequence, created_at',
    bind: [parentId],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteNode[];
}

function handleGetNodesByEntityKind(entityKind: string): SQLiteNode[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM nodes WHERE entity_kind = ? ORDER BY label',
    bind: [entityKind],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteNode[];
}

function handleUpdateNode(payload: { id: string; updates: Partial<SQLiteNodeInput> }): void {
  const db = getDatabase();
  const { id, updates } = payload;
  const now = Date.now();

  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  const fieldMap: Record<string, unknown> = {
    type: updates.type,
    label: updates.label,
    content: updates.content,
    parent_id: updates.parent_id,
    depth: updates.depth,
    entity_kind: updates.entity_kind,
    entity_subtype: updates.entity_subtype,
    is_entity: updates.is_entity !== undefined ? (updates.is_entity ? 1 : 0) : undefined,
    source_note_id: updates.source_note_id,
    blueprint_id: updates.blueprint_id,
    sequence: updates.sequence,
    color: updates.color,
    is_pinned: updates.is_pinned !== undefined ? (updates.is_pinned ? 1 : 0) : undefined,
    favorite: updates.favorite !== undefined ? (updates.favorite ? 1 : 0) : undefined,
    attributes: updates.attributes !== undefined ? serializeJson(updates.attributes) : undefined,
    extraction: updates.extraction !== undefined ? serializeJson(updates.extraction) : undefined,
    temporal: updates.temporal !== undefined ? serializeJson(updates.temporal) : undefined,
    narrative_metadata: updates.narrative_metadata !== undefined ? serializeJson(updates.narrative_metadata) : undefined,
    scene_metadata: updates.scene_metadata !== undefined ? serializeJson(updates.scene_metadata) : undefined,
    event_metadata: updates.event_metadata !== undefined ? serializeJson(updates.event_metadata) : undefined,
    blueprint_data: updates.blueprint_data !== undefined ? serializeJson(updates.blueprint_data) : undefined,
    inherited_kind: updates.inherited_kind,
    inherited_subtype: updates.inherited_subtype,
    is_typed_root: updates.is_typed_root !== undefined ? (updates.is_typed_root ? 1 : 0) : undefined,
    is_subtype_root: updates.is_subtype_root !== undefined ? (updates.is_subtype_root ? 1 : 0) : undefined,
  };

  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(value);
    }
  }

  values.push(id);

  db.exec({
    sql: `UPDATE nodes SET ${setClauses.join(', ')} WHERE id = ?`,
    bind: values,
  });
}

function handleDeleteNode(id: string): void {
  const db = getDatabase();
  db.exec({
    sql: 'DELETE FROM nodes WHERE id = ?',
    bind: [id],
  });
}

function handleBatchSync(nodes: Array<SQLiteNodeInput & { id: string }>): void {
  const db = getDatabase();
  const now = Date.now();

  db.exec('BEGIN TRANSACTION');
  try {
    for (const node of nodes) {
      const existing = handleGetNode(node.id);
      if (existing) {
        handleUpdateNode({ id: node.id, updates: node });
      } else {
        handleInsertNode(node);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ============================================
// EDGE OPERATIONS
// ============================================

function handleInsertEdge(payload: SQLiteEdgeInput & { id: string }): SQLiteEdge {
  const db = getDatabase();
  const now = Date.now();

  db.exec({
    sql: `INSERT INTO edges (
      id, source, target, type, weight, context, bidirectional,
      temporal_relation, causality, note_ids, extraction_method,
      created_at, properties
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    bind: [
      payload.id,
      payload.source,
      payload.target,
      payload.type,
      payload.weight ?? 1.0,
      payload.context ?? null,
      payload.bidirectional ? 1 : 0,
      serializeJson(payload.temporal_relation),
      serializeJson(payload.causality),
      serializeJson(payload.note_ids),
      payload.extraction_method ?? null,
      now,
      serializeJson(payload.properties),
    ],
  });

  return handleGetEdge(payload.id)!;
}

function handleGetEdge(id: string): SQLiteEdge | null {
  const db = getDatabase();
  const rows = db.exec({
    sql: 'SELECT * FROM edges WHERE id = ?',
    bind: [id],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteEdge[];

  return rows.length > 0 ? rows[0] : null;
}

function handleGetEdgesBySource(sourceId: string): SQLiteEdge[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM edges WHERE source = ?',
    bind: [sourceId],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteEdge[];
}

function handleGetEdgesByTarget(targetId: string): SQLiteEdge[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM edges WHERE target = ?',
    bind: [targetId],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteEdge[];
}

function handleGetEdgesBetween(payload: { source: string; target: string }): SQLiteEdge[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM edges WHERE (source = ? AND target = ?) OR (source = ? AND target = ?)',
    bind: [payload.source, payload.target, payload.target, payload.source],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteEdge[];
}

function handleGetAllEdges(): SQLiteEdge[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM edges ORDER BY created_at',
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteEdge[];
}

function handleUpdateEdge(payload: { id: string; updates: Partial<SQLiteEdgeInput> }): void {
  const db = getDatabase();
  const { id, updates } = payload;

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.weight !== undefined) {
    setClauses.push('weight = ?');
    values.push(updates.weight);
  }
  if (updates.context !== undefined) {
    setClauses.push('context = ?');
    values.push(updates.context);
  }
  if (updates.bidirectional !== undefined) {
    setClauses.push('bidirectional = ?');
    values.push(updates.bidirectional ? 1 : 0);
  }
  if (updates.temporal_relation !== undefined) {
    setClauses.push('temporal_relation = ?');
    values.push(serializeJson(updates.temporal_relation));
  }
  if (updates.causality !== undefined) {
    setClauses.push('causality = ?');
    values.push(serializeJson(updates.causality));
  }
  if (updates.note_ids !== undefined) {
    setClauses.push('note_ids = ?');
    values.push(serializeJson(updates.note_ids));
  }
  if (updates.properties !== undefined) {
    setClauses.push('properties = ?');
    values.push(serializeJson(updates.properties));
  }

  if (setClauses.length === 0) return;

  values.push(id);

  db.exec({
    sql: `UPDATE edges SET ${setClauses.join(', ')} WHERE id = ?`,
    bind: values,
  });
}

function handleDeleteEdge(id: string): void {
  const db = getDatabase();
  db.exec({
    sql: 'DELETE FROM edges WHERE id = ?',
    bind: [id],
  });
}

function handleBatchInsertEdges(edges: Array<SQLiteEdgeInput & { id: string }>): void {
  const db = getDatabase();

  db.exec('BEGIN TRANSACTION');
  try {
    for (const edge of edges) {
      try {
        handleInsertEdge(edge);
      } catch (err) {
        // Skip duplicate edges (UNIQUE constraint)
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (!errorMsg.includes('UNIQUE constraint')) {
          throw err;
        }
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ============================================
// EMBEDDING OPERATIONS
// ============================================

function handleInsertEmbedding(payload: {
  node_id: string;
  text: string;
  embedding: ArrayBuffer;
  model: 'small' | 'medium';
  content_hash: string;
}): void {
  const db = getDatabase();
  const now = Date.now();
  const embeddingBlob = new Uint8Array(payload.embedding);

  const existing = db.exec({
    sql: 'SELECT node_id FROM embeddings WHERE node_id = ?',
    bind: [payload.node_id],
    returnValue: 'resultRows',
  });

  if (existing && existing.length > 0) {
    const column = payload.model === 'small' ? 'embedding_small' : 'embedding_medium';
    const modelColumn = payload.model === 'small' ? 'model_small' : 'model_medium';
    const modelName = EMBEDDING_MODELS[payload.model];

    db.exec({
      sql: `UPDATE embeddings SET ${column} = ?, ${modelColumn} = ?, text = ?, content_hash = ?, updated_at = ? WHERE node_id = ?`,
      bind: [embeddingBlob, modelName, payload.text, payload.content_hash, now, payload.node_id],
    });
  } else {
    const smallEmb = payload.model === 'small' ? embeddingBlob : null;
    const mediumEmb = payload.model === 'medium' ? embeddingBlob : null;
    const smallModel = payload.model === 'small' ? EMBEDDING_MODELS.small : null;
    const mediumModel = payload.model === 'medium' ? EMBEDDING_MODELS.medium : null;

    db.exec({
      sql: `INSERT INTO embeddings (node_id, text, embedding_small, embedding_medium, model_small, model_medium, content_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bind: [payload.node_id, payload.text, smallEmb, mediumEmb, smallModel, mediumModel, payload.content_hash, now, now],
    });
  }
}

function handleGetEmbedding(nodeId: string): SQLiteEmbedding | null {
  const db = getDatabase();
  const rows = db.exec({
    sql: 'SELECT * FROM embeddings WHERE node_id = ?',
    bind: [nodeId],
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteEmbedding[];

  return rows.length > 0 ? rows[0] : null;
}

function handleGetAllEmbeddings(): SQLiteEmbedding[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM embeddings',
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as SQLiteEmbedding[];
}

function handleDeleteEmbedding(nodeId: string): void {
  const db = getDatabase();
  db.exec({
    sql: 'DELETE FROM embeddings WHERE node_id = ?',
    bind: [nodeId],
  });
}

// ============================================
// FTS OPERATIONS
// ============================================

function handleFTSSearch(options: FTSSearchOptions): FTSSearchResult[] {
  const db = getDatabase();
  
  let sql = `
    SELECT node_id, label, content, rank
    FROM nodes_fts
    WHERE nodes_fts MATCH ?
  `;
  const params: unknown[] = [options.query];

  if (options.type) {
    sql += ' AND type = ?';
    params.push(options.type);
  }
  if (options.entity_kind) {
    sql += ' AND entity_kind = ?';
    params.push(options.entity_kind);
  }

  sql += ' ORDER BY rank';

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.exec({
    sql,
    bind: params,
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as FTSSearchResult[];
}

// ============================================
// METADATA OPERATIONS
// ============================================

function handleGetMeta(key: string): string | null {
  const db = getDatabase();
  const rows = db.exec({
    sql: 'SELECT value FROM metadata WHERE key = ?',
    bind: [key],
    returnValue: 'resultRows',
  });

  if (rows && rows.length > 0) {
    return rows[0][0] as string;
  }
  return null;
}

function handleSetMeta(payload: { key: string; value: string }): void {
  const db = getDatabase();
  const now = Date.now();
  db.exec({
    sql: 'INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES (?, ?, ?)',
    bind: [payload.key, payload.value, now],
  });
}

// ============================================
// RESORANK CACHE OPERATIONS
// ============================================

function handleGetResoRankCache(): ResoRankCacheEntry[] {
  const db = getDatabase();
  return db.exec({
    sql: 'SELECT * FROM resorank_cache',
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as ResoRankCacheEntry[];
}

function handleSetResoRankCache(entries: ResoRankCacheEntry[]): void {
  const db = getDatabase();
  const now = Date.now();

  db.exec('BEGIN TRANSACTION');
  try {
    db.exec('DELETE FROM resorank_cache');
    for (const entry of entries) {
      db.exec({
        sql: 'INSERT INTO resorank_cache (term, doc_frequency, idf, computed_at) VALUES (?, ?, ?, ?)',
        bind: [entry.term, entry.doc_frequency, entry.idf, now],
      });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function handleClearResoRankCache(): void {
  const db = getDatabase();
  db.exec('DELETE FROM resorank_cache');
}

// ============================================
// GENERIC OPERATIONS
// ============================================

function handleExec(sql: string): unknown {
  const db = getDatabase();
  return db.exec({
    sql,
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

function handleQuery(payload: { sql: string; params?: unknown[] }): unknown {
  const db = getDatabase();
  return db.exec({
    sql: payload.sql,
    bind: payload.params,
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

// ============================================
// MESSAGE HANDLER
// ============================================

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    let result: unknown;

    switch (type) {
      case 'INIT':
        await handleInit();
        result = { initialized: true };
        break;

      // Node operations
      case 'INSERT_NODE':
        result = handleInsertNode(payload as SQLiteNodeInput & { id: string });
        break;
      case 'GET_NODE':
        result = handleGetNode(payload as string);
        break;
      case 'GET_ALL_NODES':
        result = handleGetAllNodes();
        break;
      case 'GET_NODES_BY_TYPE':
        result = handleGetNodesByType(payload as NodeType);
        break;
      case 'GET_NODES_BY_PARENT':
        result = handleGetNodesByParent(payload as string);
        break;
      case 'GET_NODES_BY_ENTITY_KIND':
        result = handleGetNodesByEntityKind(payload as string);
        break;
      case 'UPDATE_NODE':
        handleUpdateNode(payload as { id: string; updates: Partial<SQLiteNodeInput> });
        result = { updated: true };
        break;
      case 'DELETE_NODE':
        handleDeleteNode(payload as string);
        result = { deleted: true };
        break;
      case 'BATCH_SYNC':
        handleBatchSync(payload as Array<SQLiteNodeInput & { id: string }>);
        result = { synced: true };
        break;

      // Edge operations
      case 'INSERT_EDGE':
        result = handleInsertEdge(payload as SQLiteEdgeInput & { id: string });
        break;
      case 'GET_EDGE':
        result = handleGetEdge(payload as string);
        break;
      case 'GET_EDGES_BY_SOURCE':
        result = handleGetEdgesBySource(payload as string);
        break;
      case 'GET_EDGES_BY_TARGET':
        result = handleGetEdgesByTarget(payload as string);
        break;
      case 'GET_EDGES_BETWEEN':
        result = handleGetEdgesBetween(payload as { source: string; target: string });
        break;
      case 'GET_ALL_EDGES':
        result = handleGetAllEdges();
        break;
      case 'UPDATE_EDGE':
        handleUpdateEdge(payload as { id: string; updates: Partial<SQLiteEdgeInput> });
        result = { updated: true };
        break;
      case 'DELETE_EDGE':
        handleDeleteEdge(payload as string);
        result = { deleted: true };
        break;
      case 'BATCH_INSERT_EDGES':
        handleBatchInsertEdges(payload as Array<SQLiteEdgeInput & { id: string }>);
        result = { inserted: true };
        break;

      // Embedding operations
      case 'INSERT_EMBEDDING':
        handleInsertEmbedding(payload as Parameters<typeof handleInsertEmbedding>[0]);
        result = { saved: true };
        break;
      case 'GET_EMBEDDING':
        result = handleGetEmbedding(payload as string);
        break;
      case 'GET_ALL_EMBEDDINGS':
        result = handleGetAllEmbeddings();
        break;
      case 'DELETE_EMBEDDING':
        handleDeleteEmbedding(payload as string);
        result = { deleted: true };
        break;

      // FTS operations
      case 'FTS_SEARCH':
        result = handleFTSSearch(payload as FTSSearchOptions);
        break;

      // Metadata operations
      case 'GET_META':
        result = handleGetMeta(payload as string);
        break;
      case 'SET_META':
        handleSetMeta(payload as { key: string; value: string });
        result = { saved: true };
        break;

      // ResoRank cache operations
      case 'GET_RESORANK_CACHE':
        result = handleGetResoRankCache();
        break;
      case 'SET_RESORANK_CACHE':
        handleSetResoRankCache(payload as ResoRankCacheEntry[]);
        result = { saved: true };
        break;
      case 'CLEAR_RESORANK_CACHE':
        handleClearResoRankCache();
        result = { cleared: true };
        break;

      // Generic operations
      case 'EXEC':
        result = handleExec(payload as string);
        break;
      case 'QUERY':
        result = handleQuery(payload as { sql: string; params?: unknown[] });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    respond(id, { success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SQLite Worker] Error handling ${type}:`, message);
    respond(id, { success: false, error: message });
  }
};

console.log('[SQLite Worker] Worker ready');
