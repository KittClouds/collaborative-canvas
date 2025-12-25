import { cozoDb } from '@/lib/cozo/db';
import { ENTITY_QUERIES } from '@/lib/cozo/schema/layer2-entities';
import { ENTITY_EDGE_QUERIES } from '@/lib/cozo/schema/layer2-edges';
import { generateId } from '@/lib/utils/ids';
import { WriteBuffer } from './WriteBuffer';
import { GraphProjectionStore } from './GraphProjection';
// NOTE: Layer 1 (Notes/Folders) is now owned by SQLite.
// CozoDB is used exclusively for Graph Metadata.

import {
  extractPlainText,
  computeFolderPath,
  parseEntityRow,
  parseEdgeRow,
} from './converters';
import type {
  SyncNote,
  SyncFolder,
  SyncEntity,
  SyncEdge,
  AppState,
  Mutation,
  CreateNotePayload,
  UpdateNotePayload,
  CreateFolderPayload,
  UpdateFolderPayload,
  UpsertEntityPayload,
  CreateEdgePayload,
  SyncMetrics,
  GraphProjection,
} from './types';

export class SyncEngine {
  private notes: Map<string, SyncNote> = new Map();
  private folders: Map<string, SyncFolder> = new Map();
  private entities: Map<string, SyncEntity> = new Map();
  private edges: Map<string, SyncEdge> = new Map();

  private writeBuffer: WriteBuffer;
  private graphProjection: GraphProjectionStore;
  private subscribers: Set<(state: AppState) => void> = new Set();
  private isHydrated = false;
  private lastSyncAt: number | null = null;

  private metrics: SyncMetrics = {
    flushCount: 0,
    avgFlushTimeMs: 0,
    totalMutations: 0,
    failedMutations: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor() {
    this.writeBuffer = new WriteBuffer(
      (mutations) => this.executeBatch(mutations),
      (mutations) => this.rollbackMutations(mutations),
      { flushDelayMs: 100 }
    );
    this.graphProjection = new GraphProjectionStore();
  }

  async initialize(): Promise<void> {
    if (!cozoDb.isReady()) {
      await cozoDb.init();
    }
    // Hydrate ONLY graph metadata from Cozo. 
    // Notes/Folders must be hydrated from SQLite (placeholder for now).
    await this.hydrateFromCozo();
    this.isHydrated = true;
    this.lastSyncAt = Date.now();
    console.log(`[SyncEngine] Initialized: ${this.entities.size} entities, ${this.edges.size} edges`);
  }

  private async hydrateFromCozo(): Promise<void> {
    const [entitiesResult, edgesResult] = await Promise.all([
      this.queryAllEntities(),
      this.queryAllEdges(),
    ]);

    entitiesResult.forEach(e => this.entities.set(e.id, e));
    edgesResult.forEach(e => this.edges.set(e.id, e));

    this.graphProjection.buildFromCache(
      Array.from(this.entities.values()),
      Array.from(this.edges.values())
    );
  }

  // queryAllNotes and queryAllFolders REMOVED as they are no longer in CozoDB

  private queryAllEntities(): SyncEntity[] {
    try {
      const result = cozoDb.runQuery(ENTITY_QUERIES.getAll);
      if (result.rows) {
        return result.rows.map((row: unknown[]) => parseEntityRow(row));
      }
    } catch (err) {
      console.error('[SyncEngine] Failed to query entities:', err);
    }
    return [];
  }


  private queryAllEdges(): SyncEdge[] {
    try {
      const result = cozoDb.runQuery(`
        ?[id, source_id, target_id, created_at, valid_at, invalid_at,
          group_id, scope_type, edge_type, fact, episode_ids, note_ids,
          weight, confidence] :=
        *entity_edge{id, source_id, target_id, created_at, valid_at, invalid_at,
          group_id, scope_type, edge_type, fact, episode_ids, note_ids,
          weight, confidence}
      `);
      if (result.rows) {
        return result.rows.map((row: unknown[]) => parseEdgeRow(row));
      }
    } catch (err) {
      console.error('[SyncEngine] Failed to query edges:', err);
    }
    return [];
  }

  getState(): AppState {
    return {
      notes: Array.from(this.notes.values()),
      folders: Array.from(this.folders.values()),
      entities: Array.from(this.entities.values()),
      edges: Array.from(this.edges.values()),
      notesById: new Map(this.notes),
      foldersById: new Map(this.folders),
      entitiesById: new Map(this.entities),
      edgesById: new Map(this.edges),
      graphProjection: this.graphProjection.getProjection(),
      isHydrated: this.isHydrated,
      lastSyncAt: this.lastSyncAt,
    };
  }


  getNote(id: string): SyncNote | undefined {
    const note = this.notes.get(id);
    if (note) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    return note;
  }

  getNotes(): SyncNote[] {
    return Array.from(this.notes.values());
  }

  getFolder(id: string): SyncFolder | undefined {
    return this.folders.get(id);
  }

  getFolders(): SyncFolder[] {
    return Array.from(this.folders.values());
  }

  getEntity(id: string): SyncEntity | undefined {
    return this.entities.get(id);
  }

  getEntities(): SyncEntity[] {
    return Array.from(this.entities.values());
  }

  getEdge(id: string): SyncEdge | undefined {
    return this.edges.get(id);
  }

  getEdges(): SyncEdge[] {
    return Array.from(this.edges.values());
  }

  getGraphProjection(): GraphProjection {
    return this.graphProjection.getProjection();
  }

  createNote(payload: CreateNotePayload): SyncNote {
    const now = Date.now();
    const id = payload.id || generateId();
    const content = payload.content || JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    });

    const note: SyncNote = {
      id,
      title: payload.title || 'Untitled Note',
      content,
      contentText: extractPlainText(content),
      folderId: payload.folderId ?? null,
      createdAt: now,
      updatedAt: now,
      entityKind: payload.entityKind ?? null,
      entitySubtype: payload.entitySubtype ?? null,
      entityLabel: payload.entityLabel ?? null,
      isCanonicalEntity: payload.isCanonicalEntity ?? false,
      isPinned: payload.isPinned ?? false,
      isFavorite: payload.isFavorite ?? false,
      tags: payload.tags ?? [],
    };

    this.notes.set(id, note);

    // DECOUPLED: Notes are no longer stored in CozoDB.
    // TODO: Integrate with SQLite backbone here.

    this.notifySubscribers();
    // syncEvents.emit('noteCreated', { id: note.id, title: note.title }, 'SyncEngine');

    return note;
  }


  updateNote(id: string, patch: Partial<Omit<SyncNote, 'id' | 'createdAt'>>): void {
    const existing = this.notes.get(id);
    if (!existing) {
      console.warn(`[SyncEngine] Note ${id} not found for update`);
      return;
    }

    const updated: SyncNote = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };

    if (patch.content !== undefined && patch.contentText === undefined) {
      updated.contentText = extractPlainText(patch.content);
    }

    this.notes.set(id, updated);

    // DECOUPLED: Notes are no longer stored in CozoDB.

    this.notifySubscribers();
    // syncEvents.emit('noteUpdated', { id, title: updated.title }, 'SyncEngine');
  }


  deleteNote(id: string): void {
    if (!this.notes.has(id)) {
      console.warn(`[SyncEngine] Note ${id} not found for delete`);
      return;
    }

    this.notes.delete(id);

    // DECOUPLED: Notes are no longer stored in CozoDB.

    this.notifySubscribers();
    // syncEvents.emit('noteDeleted', { id }, 'SyncEngine');
  }


  createFolder(payload: CreateFolderPayload): SyncFolder {
    const now = Date.now();
    const id = payload.id || generateId();

    const tempFolder = {
      name: payload.name,
      parentId: payload.parentId ?? null,
    };
    const path = computeFolderPath(tempFolder, Array.from(this.folders.values()));

    const folder: SyncFolder = {
      id,
      name: payload.name,
      path,
      parentId: payload.parentId ?? null,
      createdAt: now,
      color: payload.color ?? null,
      entityKind: payload.entityKind ?? null,
      entitySubtype: payload.entitySubtype ?? null,
      entityLabel: payload.entityLabel ?? null,
      isTypedRoot: payload.isTypedRoot ?? false,
      isSubtypeRoot: payload.isSubtypeRoot ?? false,
      inheritedKind: payload.inheritedKind ?? null,
      inheritedSubtype: payload.inheritedSubtype ?? null,
    };

    this.folders.set(id, folder);

    // DECOUPLED: Folders are no longer stored in CozoDB.

    this.notifySubscribers();
    // syncEvents.emit('folderCreated', { id: folder.id, name: folder.name }, 'SyncEngine');

    return folder;
  }


  updateFolder(id: string, patch: Partial<Omit<SyncFolder, 'id' | 'createdAt'>>): void {
    const existing = this.folders.get(id);
    if (!existing) {
      console.warn(`[SyncEngine] Folder ${id} not found for update`);
      return;
    }

    const updated: SyncFolder = {
      ...existing,
      ...patch,
    };

    if (patch.name !== undefined || patch.parentId !== undefined) {
      updated.path = computeFolderPath(updated, Array.from(this.folders.values()));
    }

    this.folders.set(id, updated);

    // DECOUPLED: Folders are no longer stored in CozoDB.

    this.notifySubscribers();
    // syncEvents.emit('folderUpdated', { id, name: updated.name }, 'SyncEngine');
  }


  deleteFolder(id: string): void {
    if (!this.folders.has(id)) {
      console.warn(`[SyncEngine] Folder ${id} not found for delete`);
      return;
    }

    this.folders.delete(id);
    this.notes.forEach((note, noteId) => {
      if (note.folderId === id) {
        this.notes.set(noteId, { ...note, folderId: null });
      }
    });
    this.folders.delete(id);

    // DECOUPLED: Folders are no longer stored in CozoDB.

    this.notifySubscribers();
    // syncEvents.emit('folderDeleted', { id }, 'SyncEngine');
  }

  upsertEntity(payload: UpsertEntityPayload): SyncEntity {
    const now = Date.now();
    const id = payload.id || generateId();
    const isUpdate = this.entities.has(id);

    const entity: SyncEntity = {
      id,
      name: payload.name,
      normalizedName: payload.name.toLowerCase().trim(),
      entityKind: payload.entityKind,
      entitySubtype: payload.entitySubtype ?? null,
      groupId: payload.groupId,
      scopeType: payload.scopeType,
      frequency: payload.frequency ?? 1,
      canonicalNoteId: payload.canonicalNoteId ?? null,
      aliases: payload.aliases ?? [],
      summary: payload.summary ?? null,
      createdAt: now,
      extractionMethod: payload.extractionMethod ?? 'regex',
      source: payload.source ?? 'manual',
      confidence: payload.confidence ?? 1.0,
      blueprintTypeId: payload.blueprintTypeId ?? null,
      blueprintVersionId: payload.blueprintVersionId ?? null,
      blueprintFields: payload.blueprintFields ?? null,
      provenanceData: payload.provenanceData ?? [],
      alternateTypes: payload.alternateTypes ?? [],
    };

    this.entities.set(id, entity);
    this.graphProjection.onEntityChange(entity, isUpdate ? 'update' : 'add');

    const mutation: Mutation<SyncEntity> = {
      id: generateId(),
      type: 'UPSERT_ENTITY',
      payload: entity,
      timestamp: now,
      status: 'pending',
    };
    this.writeBuffer.enqueue(mutation);
    this.metrics.totalMutations++;
    this.notifySubscribers();

    return entity;
  }

  findEntityByNormalizedName(name: string): SyncEntity | undefined {
    const normalized = name.toLowerCase().trim();
    for (const entity of this.entities.values()) {
      if (entity.normalizedName === normalized) {
        return entity;
      }
    }
    return undefined;
  }

  getEntitiesBySource(source: SyncEntity['source']): SyncEntity[] {
    return Array.from(this.entities.values()).filter(e => e.source === source);
  }

  deleteEntity(id: string): void {
    const entity = this.entities.get(id);
    if (!entity) {
      console.warn(`[SyncEngine] Entity ${id} not found for delete`);
      return;
    }

    this.entities.delete(id);
    this.graphProjection.onEntityChange(entity, 'delete');

    this.edges.forEach((edge, edgeId) => {
      if (edge.sourceId === id || edge.targetId === id) {
        this.edges.delete(edgeId);
        this.graphProjection.onEdgeChange(edge, 'delete');
      }
    });

    const mutation: Mutation<string> = {
      id: generateId(),
      type: 'DELETE_ENTITY',
      payload: id,
      timestamp: Date.now(),
      status: 'pending',
    };
    this.writeBuffer.enqueue(mutation);
    this.metrics.totalMutations++;
    this.notifySubscribers();
  }

  createEdge(payload: CreateEdgePayload): SyncEdge {
    const now = Date.now();
    const id = payload.id || generateId();

    const edge: SyncEdge = {
      id,
      sourceId: payload.sourceId,
      targetId: payload.targetId,
      edgeType: payload.edgeType,
      weight: payload.weight ?? 1,
      groupId: payload.groupId,
      scopeType: payload.scopeType,
      createdAt: now,
      validAt: now,
      invalidAt: null,
      confidence: payload.confidence ?? 1,
      fact: payload.fact ?? null,
      episodeIds: payload.episodeIds ?? [],
      noteIds: payload.noteIds ?? [],
    };

    this.edges.set(id, edge);
    this.graphProjection.onEdgeChange(edge, 'add');

    const mutation: Mutation<SyncEdge> = {
      id: generateId(),
      type: 'CREATE_EDGE',
      payload: edge,
      timestamp: now,
      status: 'pending',
    };
    this.writeBuffer.enqueue(mutation);
    this.metrics.totalMutations++;
    this.notifySubscribers();

    return edge;
  }

  deleteEdge(id: string): void {
    const edge = this.edges.get(id);
    if (!edge) {
      console.warn(`[SyncEngine] Edge ${id} not found for delete`);
      return;
    }

    this.edges.delete(id);
    this.graphProjection.onEdgeChange(edge, 'delete');

    const mutation: Mutation<string> = {
      id: generateId(),
      type: 'DELETE_EDGE',
      payload: id,
      timestamp: Date.now(),
      status: 'pending',
    };
    this.writeBuffer.enqueue(mutation);
    this.metrics.totalMutations++;
    this.notifySubscribers();
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    const state = this.getState();
    this.subscribers.forEach(listener => {
      try {
        listener(state);
      } catch (err) {
        console.error('[SyncEngine] Subscriber error:', err);
      }
    });
  }

  private async executeBatch(mutations: Mutation[]): Promise<void> {
    const startTime = Date.now();

    // executeBatch now only processes graph metadata (entities, edges).
    // Note/Folder mutations are handled by SQLite backbone (external).
    const entityUpserts = mutations.filter(m => m.type === 'UPSERT_ENTITY');
    const entityDeletes = mutations.filter(m => m.type === 'DELETE_ENTITY');
    const edgeCreates = mutations.filter(m => m.type === 'CREATE_EDGE');
    const edgeDeletes = mutations.filter(m => m.type === 'DELETE_EDGE');

    for (const m of entityUpserts) {
      const entity = m.payload as SyncEntity;
      this.executeEntityUpsert(entity);
    }

    for (const m of entityDeletes) {
      const id = m.payload as string;
      this.executeEntityDelete(id);
    }

    for (const m of edgeCreates) {
      const edge = m.payload as SyncEdge;
      this.executeEdgeUpsert(edge);
    }

    for (const m of edgeDeletes) {
      const id = m.payload as string;
      this.executeEdgeDelete(id);
    }

    const elapsed = Date.now() - startTime;
    this.metrics.flushCount++;
    this.metrics.avgFlushTimeMs =
      (this.metrics.avgFlushTimeMs * (this.metrics.flushCount - 1) + elapsed) /
      this.metrics.flushCount;
    this.lastSyncAt = Date.now();
  }



  private executeEntityUpsert(entity: SyncEntity): void {
    try {
      cozoDb.runQuery(ENTITY_QUERIES.upsert, {
        id: entity.id,
        name: entity.name,
        normalized_name: entity.normalizedName || entity.name.toLowerCase().trim(),
        entity_kind: entity.entityKind,
        entity_subtype: entity.entitySubtype,
        group_id: entity.groupId,
        scope_type: entity.scopeType,
        created_at: entity.createdAt,
        extraction_method: entity.extractionMethod,
        summary: entity.summary,
        aliases: entity.aliases,
        canonical_note_id: entity.canonicalNoteId,
        frequency: entity.frequency,
        degree_centrality: null,
        betweenness_centrality: null,
        closeness_centrality: null,
        community_id: null,
        attributes: null,
        temporal_span: null,
        participants: [],
        source: entity.source || 'manual',
        confidence: entity.confidence ?? 1.0,
        blueprint_type_id: entity.blueprintTypeId,
        blueprint_version_id: entity.blueprintVersionId,
        blueprint_fields: entity.blueprintFields,
        provenance_data: entity.provenanceData || [],
        alternate_types: entity.alternateTypes || [],
      });
    } catch (err) {
      console.error('[SyncEngine] Failed to upsert entity:', err);
      throw err;
    }
  }


  private executeEntityDelete(id: string): void {
    try {
      cozoDb.runQuery(`
        ?[id] <- [[$id]]
        :rm entity { id }
      `, { id });
    } catch (err) {
      console.error('[SyncEngine] Failed to delete entity:', err);
      throw err;
    }
  }

  private executeEdgeUpsert(edge: SyncEdge): void {
    try {
      cozoDb.runQuery(ENTITY_EDGE_QUERIES.upsert, {
        id: edge.id,
        source_id: edge.sourceId,
        target_id: edge.targetId,
        created_at: edge.createdAt,
        valid_at: edge.validAt,
        invalid_at: edge.invalidAt,
        group_id: edge.groupId,
        scope_type: edge.scopeType,
        edge_type: edge.edgeType,
        fact: edge.fact,
        episode_ids: edge.episodeIds,
        note_ids: edge.noteIds,
        weight: edge.weight,
        pmi_score: null,
        confidence: edge.confidence,
        extraction_methods: ['manual'],
      });
    } catch (err) {
      console.error('[SyncEngine] Failed to upsert edge:', err);
      throw err;
    }
  }

  private executeEdgeDelete(id: string): void {
    try {
      cozoDb.runQuery(ENTITY_EDGE_QUERIES.delete, { id });
    } catch (err) {
      console.error('[SyncEngine] Failed to delete edge:', err);
      throw err;
    }
  }

  private rollbackMutations(mutations: Mutation[]): void {
    console.warn(`[SyncEngine] Rolling back ${mutations.length} mutations`);
    this.metrics.failedMutations += mutations.length;
    this.hydrateFromCozo().then(() => {
      this.notifySubscribers();
    });
  }

  async flushNow(): Promise<void> {
    await this.writeBuffer.flushNow();
  }

  hasPendingWrites(): boolean {
    return this.writeBuffer.hasPending();
  }

  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  isReady(): boolean {
    return this.isHydrated;
  }
}

export const syncEngine = new SyncEngine();
