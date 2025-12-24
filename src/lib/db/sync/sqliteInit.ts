import { getGraph } from '@/lib/graph/graphInstance';
import { dbClient } from '@/lib/db/client/db-client';
import { graphSQLiteSync } from '@/lib/db/sync/GraphSQLiteSync';
import { Hydration } from '@/lib/db/sync/Hydration';
import { syncState } from '@/lib/db/sync/SyncState';
import type { SQLiteNode, SQLiteEdge, SQLiteNodeInput } from '@/lib/db/client/types';
import { parseJson } from '@/lib/db/client/types';
import type { UnifiedNode, UnifiedNodeData, UnifiedEdgeData, NodeType, EdgeType } from '@/lib/graph/types';
import { RelationshipStoreImpl } from '@/lib/storage/impl/RelationshipStoreImpl';
import { relationshipDBAdapter } from '@/lib/storage/impl/RelationshipDBAdapter';
import { setRelationshipStore, initializeRelationshipSystem } from '@/lib/relationships/startup';

export interface SQLiteInitResult {
  nodesLoaded: number;
  edgesLoaded: number;
  embeddingsLoaded: number;
  relationshipsLoaded: number;
}

export async function initializeSQLiteAndHydrate(): Promise<SQLiteInitResult> {
  await dbClient.init();

  const hydration = new Hydration({ progressive: true });
  const result = await hydration.hydrate();
  
  const embeddings = await dbClient.getAllEmbeddings();

  if (result.nodes.length > 0 || result.edges.length > 0) {
    const graph = getGraph();
    hydrateGraphFromSQLite(graph, result.nodes, result.edges);
  }

  const relationshipStore = new RelationshipStoreImpl(relationshipDBAdapter);
  setRelationshipStore(relationshipStore);
  const relResult = await initializeRelationshipSystem();

  return {
    nodesLoaded: result.nodesLoaded,
    edgesLoaded: result.edgesLoaded,
    embeddingsLoaded: embeddings.length,
    relationshipsLoaded: relResult.loaded,
  };
}

function hydrateGraphFromSQLite(
  graph: ReturnType<typeof getGraph>,
  nodes: SQLiteNode[],
  edges: SQLiteEdge[]
): void {
  const rootNodes = nodes.filter(n => !n.parent_id);
  const childNodes = nodes.filter(n => n.parent_id);

  for (const node of rootNodes) {
    addNodeToGraph(graph, node);
  }

  for (const node of childNodes) {
    addNodeToGraph(graph, node);
  }

  for (const edge of edges) {
    addEdgeToGraph(graph, edge);
  }
}

function addNodeToGraph(
  graph: ReturnType<typeof getGraph>,
  node: SQLiteNode
): void {
  if (graph.hasNode(node.id)) {
    return;
  }

  const nodeData: Omit<UnifiedNodeData, 'id' | 'createdAt' | 'updatedAt'> = {
    type: node.type as NodeType,
    label: node.label,
    content: node.content ?? undefined,
    parentId: node.parent_id ?? undefined,
    depth: node.depth,
    entityKind: node.entity_kind ?? undefined,
    entitySubtype: node.entity_subtype ?? undefined,
    isEntity: node.is_entity === 1,
    sourceNoteId: node.source_note_id ?? undefined,
    blueprintId: node.blueprint_id ?? undefined,
    isPinned: node.is_pinned === 1,
    favorite: node.favorite === 1,
    color: node.color ?? undefined,
    inheritedKind: node.inherited_kind ?? undefined,
    inheritedSubtype: node.inherited_subtype ?? undefined,
    isTypedRoot: node.is_typed_root === 1,
    isSubtypeRoot: node.is_subtype_root === 1,
    attributes: parseJson(node.attributes) ?? undefined,
    extraction: parseJson(node.extraction) ?? undefined,
    temporal: parseJson(node.temporal) ?? undefined,
    narrativeMetadata: parseJson(node.narrative_metadata) ?? undefined,
    sceneMetadata: parseJson(node.scene_metadata) ?? undefined,
    eventMetadata: parseJson(node.event_metadata) ?? undefined,
    blueprintData: parseJson(node.blueprint_data) ?? undefined,
  };

  graph.addNode(nodeData);
}

function addEdgeToGraph(
  graph: ReturnType<typeof getGraph>,
  edge: SQLiteEdge
): void {
  if (graph.hasEdge(edge.id)) {
    return;
  }

  if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
    return;
  }

  const edgeData: Omit<UnifiedEdgeData, 'id' | 'createdAt'> = {
    source: edge.source,
    target: edge.target,
    type: edge.type as EdgeType,
    weight: edge.weight,
    context: edge.context ?? undefined,
    bidirectional: edge.bidirectional === 1,
    temporalRelation: parseJson(edge.temporal_relation) ?? undefined,
    causality: parseJson(edge.causality) ?? undefined,
    noteIds: parseJson(edge.note_ids) ?? undefined,
    extractionMethod: edge.extraction_method as UnifiedEdgeData['extractionMethod'] ?? undefined,
    properties: parseJson(edge.properties) ?? undefined,
  };

  graph.addEdge(edgeData);
}

export function convertNodeToSQLite(node: UnifiedNode): SQLiteNodeInput & { id: string } {
  return {
    id: node.data.id,
    type: node.data.type,
    label: node.data.label,
    content: node.data.content ?? null,
    parent_id: node.data.parentId ?? null,
    depth: node.data.depth ?? 0,
    entity_kind: node.data.entityKind ?? null,
    entity_subtype: node.data.entitySubtype ?? null,
    is_entity: node.data.isEntity ?? false,
    source_note_id: node.data.sourceNoteId ?? null,
    blueprint_id: node.data.blueprintId ?? null,
    sequence: node.data.narrativeMetadata?.sequence ?? null,
    color: node.data.color ?? null,
    is_pinned: node.data.isPinned ?? false,
    favorite: node.data.favorite ?? false,
    attributes: node.data.attributes ?? null,
    extraction: node.data.extraction ?? null,
    temporal: node.data.temporal ?? null,
    narrative_metadata: node.data.narrativeMetadata ?? null,
    scene_metadata: node.data.sceneMetadata ?? null,
    event_metadata: node.data.eventMetadata ?? null,
    blueprint_data: node.data.blueprintData ?? null,
    inherited_kind: node.data.inheritedKind ?? null,
    inherited_subtype: node.data.inheritedSubtype ?? null,
    is_typed_root: node.data.isTypedRoot ?? false,
    is_subtype_root: node.data.isSubtypeRoot ?? false,
  };
}

export function syncNodeToSQLite(node: UnifiedNode): void {
  const sqliteNode = convertNodeToSQLite(node);
  graphSQLiteSync.syncNodeCreate(sqliteNode);
}

export function markNodeDirty(node: UnifiedNode, changedFields?: string[]): void {
  const sqliteNode = convertNodeToSQLite(node);
  graphSQLiteSync.markNodeDirty(node.data.id, 'UPDATE', sqliteNode, changedFields);
}

export function syncNodeDelete(nodeId: string): void {
  graphSQLiteSync.syncNodeDelete(nodeId);
}

export async function flushPendingSync(): Promise<void> {
  await graphSQLiteSync.forceFlush();
}

export function hasPendingChanges(): boolean {
  return graphSQLiteSync.hasPendingChanges();
}

export function getSyncState() {
  return syncState;
}
