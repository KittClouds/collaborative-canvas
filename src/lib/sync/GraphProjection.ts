import { ENTITY_COLORS } from '@/lib/entities/entityTypes';
import { nodeMerger } from './graph/NodeMerger';
import { edgeWeighter } from './graph/EdgeWeighter';
import { centralityFilter } from './graph/CentralityFilter';
import { syncEvents } from './events/SyncEventEmitter';
import type {
  SyncNote,
  SyncFolder,
  SyncEntity,
  SyncEdge,
  GraphNode,
  GraphEdge,
  GraphProjection,
  GraphNodeType,
  CentralityScores,
  CentralityConfig,
} from './types';
import { DEFAULT_CENTRALITY_CONFIG } from './types';

export class GraphProjectionStore {
  private projection: GraphProjection;
  private rebuildScheduled = false;
  private rebuildTimeout: ReturnType<typeof setTimeout> | null = null;
  private confidenceThreshold: number = DEFAULT_CENTRALITY_CONFIG.confidenceThreshold;

  constructor() {
    this.projection = this.createEmptyProjection();
  }

  private createEmptyProjection(): GraphProjection {
    return {
      nodes: [],
      edges: [],
      nodeById: new Map(),
      adjacencyList: new Map(),
      nodesByKind: new Map(),
      nodesByType: new Map(),
      nodesByFolder: new Map(),
      centrality: new Map(),
      communities: new Map(),
      lastUpdated: 0,
      isDirty: false,
      confidenceThreshold: this.confidenceThreshold,
    };
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    centralityFilter.setThreshold(this.confidenceThreshold);
    this.projection.confidenceThreshold = this.confidenceThreshold;
    this.scheduleFullRebuild();
  }

  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  buildFromCache(
    entities: SyncEntity[],
    edges: SyncEdge[],
    notes: SyncNote[] = [],
    folders: SyncFolder[] = []
  ): void {
    const startTime = Date.now();

    const allNodes: GraphNode[] = [];
    const nodeById = new Map<string, GraphNode>();
    const adjacencyList = new Map<string, Set<string>>();
    const nodesByKind = new Map<string, GraphNode[]>();
    const nodesByType = new Map<GraphNodeType, GraphNode[]>();
    const nodesByFolder = new Map<string, GraphNode[]>();

    for (const note of notes) {
      const node = this.createNoteNode(note);
      allNodes.push(node);
      nodeById.set(node.id, node);
      adjacencyList.set(node.id, new Set());
      this.addToTypeIndex(nodesByType, 'note', node);
      if (note.folderId) {
        this.addToFolderIndex(nodesByFolder, note.folderId, node);
      }
    }

    for (const folder of folders) {
      const node = this.createFolderNode(folder);
      allNodes.push(node);
      nodeById.set(node.id, node);
      adjacencyList.set(node.id, new Set());
      this.addToTypeIndex(nodesByType, 'folder', node);
    }

    const entityNodes = nodeMerger.mergeAll(entities);
    for (const node of entityNodes) {
      allNodes.push(node);
      nodeById.set(node.id, node);
      adjacencyList.set(node.id, new Set());

      this.addToKindIndex(nodesByKind, node.kind, node);
      this.addToTypeIndex(nodesByType, node.nodeType, node);
    }

    const graphEdges = edgeWeighter.processEdges(edges, this.confidenceThreshold);
    for (const edge of graphEdges) {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
        continue;
      }
      adjacencyList.get(edge.source)?.add(edge.target);
      adjacencyList.get(edge.target)?.add(edge.source);
    }

    const validEdges = graphEdges.filter(
      e => nodeById.has(e.source) && nodeById.has(e.target)
    );

    const { nodes: highConfNodes, edges: highConfEdges } = centralityFilter.filterHighConfidenceSubgraph(
      allNodes,
      validEdges,
      this.confidenceThreshold
    );

    const highConfAdjacency = new Map<string, Set<string>>();
    for (const node of highConfNodes) {
      highConfAdjacency.set(node.id, new Set());
    }
    for (const edge of highConfEdges) {
      highConfAdjacency.get(edge.source)?.add(edge.target);
      highConfAdjacency.get(edge.target)?.add(edge.source);
    }

    const centrality = this.computeCentrality(highConfNodes, highConfAdjacency);

    this.projection = {
      nodes: allNodes,
      edges: validEdges,
      nodeById,
      adjacencyList,
      nodesByKind,
      nodesByType,
      nodesByFolder,
      centrality,
      communities: new Map(),
      lastUpdated: Date.now(),
      isDirty: false,
      confidenceThreshold: this.confidenceThreshold,
    };

    syncEvents.emit('graphProjectionRebuilt', {
      nodeCount: allNodes.length,
      edgeCount: validEdges.length,
      highConfidenceNodes: highConfNodes.length,
      highConfidenceEdges: highConfEdges.length,
    }, 'GraphProjectionStore');

    console.log(`[GraphProjection] Built: ${allNodes.length} nodes (${highConfNodes.length} high-conf), ${validEdges.length} edges in ${Date.now() - startTime}ms`);
  }

  private createNoteNode(note: SyncNote): GraphNode {
    return {
      id: note.id,
      label: note.title,
      nodeType: 'note',
      kind: 'NOTE',
      subtype: note.entityKind || null,
      frequency: 1,
      noteIds: [note.id],
      size: 12,
      color: '#3b82f6',
      confidence: 1.0,
      provenance: ['system'],
      isCanonical: true,
    };
  }

  private createFolderNode(folder: SyncFolder): GraphNode {
    return {
      id: folder.id,
      label: folder.name,
      nodeType: 'folder',
      kind: 'FOLDER',
      subtype: folder.entityKind || null,
      frequency: 1,
      noteIds: [],
      size: 14,
      color: folder.color || '#6b7280',
      confidence: 1.0,
      provenance: ['system'],
      parentId: folder.parentId || undefined,
      isCanonical: true,
    };
  }

  private addToKindIndex(index: Map<string, GraphNode[]>, kind: string, node: GraphNode): void {
    if (!index.has(kind)) {
      index.set(kind, []);
    }
    index.get(kind)!.push(node);
  }

  private addToTypeIndex(index: Map<GraphNodeType, GraphNode[]>, type: GraphNodeType, node: GraphNode): void {
    if (!index.has(type)) {
      index.set(type, []);
    }
    index.get(type)!.push(node);
  }

  private addToFolderIndex(index: Map<string, GraphNode[]>, folderId: string, node: GraphNode): void {
    if (!index.has(folderId)) {
      index.set(folderId, []);
    }
    index.get(folderId)!.push(node);
  }

  onEntityChange(entity: SyncEntity, changeType: 'add' | 'update' | 'delete'): void {
    if (changeType === 'delete') {
      this.projection.nodeById.delete(entity.id);
      this.projection.adjacencyList.delete(entity.id);
      this.projection.nodes = this.projection.nodes.filter(n => n.id !== entity.id);

      const kindList = this.projection.nodesByKind.get(entity.entityKind);
      if (kindList) {
        this.projection.nodesByKind.set(
          entity.entityKind,
          kindList.filter(n => n.id !== entity.id)
        );
      }
    } else {
      const color = (ENTITY_COLORS as Record<string, string>)[entity.entityKind] || '#6b7280';
      const size = Math.min(10 + Math.log(entity.frequency + 1) * 5, 30);
      const nodeType: GraphNodeType = entity.blueprintTypeId ? 'blueprint_entity' : 
        (entity.source === 'concept' ? 'concept' : 'extracted_entity');

      const node: GraphNode = {
        id: entity.id,
        label: entity.name,
        nodeType,
        kind: entity.entityKind,
        subtype: entity.entitySubtype,
        frequency: entity.frequency,
        noteIds: entity.canonicalNoteId ? [entity.canonicalNoteId] : [],
        size,
        color,
        confidence: entity.confidence,
        provenance: entity.provenanceData.map(p => p.source),
        alternateTypes: entity.alternateTypes.length > 0 ? entity.alternateTypes : undefined,
        blueprintTypeId: entity.blueprintTypeId || undefined,
        blueprintFields: entity.blueprintFields || undefined,
        isCanonical: entity.source === 'blueprint' || entity.source === 'manual',
      };

      const existing = this.projection.nodeById.get(entity.id);
      if (existing) {
        const idx = this.projection.nodes.indexOf(existing);
        if (idx >= 0) {
          this.projection.nodes[idx] = node;
        }
      } else {
        this.projection.nodes.push(node);
        this.projection.adjacencyList.set(entity.id, new Set());
      }

      this.projection.nodeById.set(entity.id, node);

      if (changeType === 'add' || !existing) {
        const kindList = this.projection.nodesByKind.get(entity.entityKind) || [];
        kindList.push(node);
        this.projection.nodesByKind.set(entity.entityKind, kindList);
      }
    }

    this.projection.isDirty = true;
    this.scheduleFullRebuild();
  }

  onEdgeChange(edge: SyncEdge, changeType: 'add' | 'delete'): void {
    if (changeType === 'delete') {
      this.projection.edges = this.projection.edges.filter(e => e.id !== edge.id);
      this.updateAdjacencyList(edge, false);
    } else {
      if (!this.projection.nodeById.has(edge.sourceId) || !this.projection.nodeById.has(edge.targetId)) {
        return;
      }

      const graphEdge = edgeWeighter.toGraphEdge(edge, this.confidenceThreshold);

      const existingIdx = this.projection.edges.findIndex(e => e.id === edge.id);
      if (existingIdx >= 0) {
        this.projection.edges[existingIdx] = graphEdge;
      } else {
        this.projection.edges.push(graphEdge);
        this.updateAdjacencyList(edge, true);
      }
    }

    this.projection.isDirty = true;
    this.scheduleFullRebuild();
  }

  private updateAdjacencyList(edge: SyncEdge, add: boolean): void {
    const sourceSet = this.projection.adjacencyList.get(edge.sourceId);
    const targetSet = this.projection.adjacencyList.get(edge.targetId);

    if (add) {
      sourceSet?.add(edge.targetId);
      targetSet?.add(edge.sourceId);
    } else {
      sourceSet?.delete(edge.targetId);
      targetSet?.delete(edge.sourceId);
    }
  }

  scheduleFullRebuild(): void {
    if (this.rebuildScheduled) return;
    this.rebuildScheduled = true;

    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout);
    }

    this.rebuildTimeout = setTimeout(() => {
      this.rebuildScheduled = false;
      this.rebuildTimeout = null;
      this.recomputeAnalytics();
    }, 500);
  }

  private recomputeAnalytics(): void {
    const { nodes: highConfNodes, edges: highConfEdges } = centralityFilter.filterHighConfidenceSubgraph(
      this.projection.nodes,
      this.projection.edges,
      this.confidenceThreshold
    );

    const highConfAdjacency = new Map<string, Set<string>>();
    for (const node of highConfNodes) {
      highConfAdjacency.set(node.id, new Set());
    }
    for (const edge of highConfEdges) {
      highConfAdjacency.get(edge.source)?.add(edge.target);
      highConfAdjacency.get(edge.target)?.add(edge.source);
    }

    const centrality = this.computeCentrality(highConfNodes, highConfAdjacency);
    this.projection.centrality = centrality;
    this.projection.lastUpdated = Date.now();
    this.projection.isDirty = false;
  }

  private computeCentrality(
    nodes: GraphNode[],
    adjacencyList: Map<string, Set<string>>
  ): Map<string, CentralityScores> {
    const centrality = new Map<string, CentralityScores>();
    const n = nodes.length;

    if (n === 0) return centrality;

    const maxDegree = Math.max(1, n - 1);

    for (const node of nodes) {
      const neighbors = adjacencyList.get(node.id);
      const degree = neighbors ? neighbors.size : 0;

      centrality.set(node.id, {
        degree: degree / maxDegree,
        betweenness: 0,
        closeness: 0,
      });
    }

    if (n <= 100) {
      const betweenness = this.computeBetweennessCentrality(nodes, adjacencyList);
      const closeness = this.computeClosenessCentrality(nodes, adjacencyList);

      for (const node of nodes) {
        const scores = centrality.get(node.id)!;
        scores.betweenness = betweenness.get(node.id) || 0;
        scores.closeness = closeness.get(node.id) || 0;
      }
    }

    return centrality;
  }

  private computeBetweennessCentrality(
    nodes: GraphNode[],
    adjacencyList: Map<string, Set<string>>
  ): Map<string, number> {
    const centrality = new Map<string, number>();
    const n = nodes.length;

    for (const node of nodes) {
      centrality.set(node.id, 0);
    }

    for (const source of nodes) {
      const { predecessors } = this.bfs(source.id, adjacencyList);

      for (const target of nodes) {
        if (source.id === target.id) continue;

        let current = target.id;
        while (predecessors.has(current) && predecessors.get(current) !== source.id) {
          const pred = predecessors.get(current)!;
          centrality.set(pred, (centrality.get(pred) || 0) + 1);
          current = pred;
        }
      }
    }

    const normFactor = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;
    for (const node of nodes) {
      centrality.set(node.id, (centrality.get(node.id) || 0) / normFactor);
    }

    return centrality;
  }

  private computeClosenessCentrality(
    nodes: GraphNode[],
    adjacencyList: Map<string, Set<string>>
  ): Map<string, number> {
    const centrality = new Map<string, number>();
    const n = nodes.length;

    for (const node of nodes) {
      const { distances } = this.bfs(node.id, adjacencyList);

      let totalDist = 0;
      let reachable = 0;

      for (const [id, dist] of distances) {
        if (id !== node.id && dist < Infinity) {
          totalDist += dist;
          reachable++;
        }
      }

      const closeness = reachable > 0 ? reachable / totalDist : 0;
      centrality.set(node.id, closeness * (reachable / (n - 1)));
    }

    return centrality;
  }

  private bfs(
    startId: string,
    adjacencyList: Map<string, Set<string>>
  ): { distances: Map<string, number>; predecessors: Map<string, string> } {
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string>();
    const queue: string[] = [startId];

    distances.set(startId, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = distances.get(current)!;
      const neighbors = adjacencyList.get(current);

      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!distances.has(neighbor)) {
            distances.set(neighbor, currentDist + 1);
            predecessors.set(neighbor, current);
            queue.push(neighbor);
          }
        }
      }
    }

    return { distances, predecessors };
  }

  getProjection(): GraphProjection {
    return this.projection;
  }

  getHighConfidenceSubgraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return centralityFilter.filterHighConfidenceSubgraph(
      this.projection.nodes,
      this.projection.edges,
      this.confidenceThreshold
    );
  }

  getNeighbors(entityId: string): GraphNode[] {
    const neighborIds = this.projection.adjacencyList.get(entityId);
    if (!neighborIds) return [];

    const neighbors: GraphNode[] = [];
    for (const id of neighborIds) {
      const node = this.projection.nodeById.get(id);
      if (node) neighbors.push(node);
    }
    return neighbors;
  }

  getSubgraph(entityIds: string[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const idSet = new Set(entityIds);
    const nodes = entityIds
      .map(id => this.projection.nodeById.get(id))
      .filter((n): n is GraphNode => n !== undefined);

    const edges = this.projection.edges.filter(
      e => idSet.has(e.source) && idSet.has(e.target)
    );

    return { nodes, edges };
  }

  getNodesByKind(kind: string): GraphNode[] {
    return this.projection.nodesByKind.get(kind) || [];
  }

  getNodesByType(type: GraphNodeType): GraphNode[] {
    return this.projection.nodesByType.get(type) || [];
  }

  getCentrality(entityId: string): CentralityScores | undefined {
    return this.projection.centrality.get(entityId);
  }

  getConnectedSubgraph(seedNodeId: string, maxDepth: number = 2): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return centralityFilter.getConnectedSubgraph(
      this.projection.nodes,
      this.projection.edges,
      seedNodeId,
      maxDepth
    );
  }
}
