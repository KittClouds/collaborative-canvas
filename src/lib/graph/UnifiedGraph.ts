import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import { generateId } from '@/lib/utils/ids';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';
import { GraphIndexManager } from './GraphIndexManager';
import { getGraphStyles } from './graphStyles';
import type {
  NodeId,
  EdgeId,
  NodeType,
  EdgeType,
  UnifiedNode,
  UnifiedNodeData,
  UnifiedEdge,
  UnifiedEdgeData,
  GraphMetadata,
  GraphStats,
  GraphExport,
  NeighborhoodResult,
  PathResult,
  FolderOptions,
  NoteOptions,
  EntityOptions,
  SearchOptions,
  ExtractionData,
  EntityMention,
  BlueprintData,
  NarrativeMetadata,
  TemporalData,
  EntityKind,
  NarrativeEntityKind,
  CausalityData,
  TemporalRelation,
} from './types';

const GRAPH_VERSION = '1.0.0';

export class UnifiedGraph {
  private cy: Core;
  private indexes: GraphIndexManager;
  private metadata: GraphMetadata;

  constructor() {
    this.cy = cytoscape({
      headless: true,
      style: getGraphStyles(),
    });
    this.indexes = new GraphIndexManager();
    this.metadata = this.createDefaultMetadata();
  }

  private createDefaultMetadata(): GraphMetadata {
    return {
      version: GRAPH_VERSION,
      lastModified: Date.now(),
      stats: this.computeStats(),
    };
  }

  generateNodeId(): NodeId {
    return generateId();
  }

  generateEdgeId(): EdgeId {
    return generateId();
  }

  getInstance(): Core {
    return this.cy;
  }

  addNode(data: Omit<UnifiedNodeData, 'id' | 'createdAt' | 'updatedAt'>): UnifiedNode {
    const now = Date.now();
    const nodeData: UnifiedNodeData = {
      ...data,
      id: this.generateNodeId(),
      createdAt: now,
      updatedAt: now,
    };

    const node: UnifiedNode = {
      group: 'nodes',
      data: nodeData,
      classes: this.getNodeClasses(nodeData),
    };

    this.cy.add(node);
    this.indexes.indexNode(node);
    this.updateLastModified();

    return node;
  }

  addNodes(nodes: Array<Omit<UnifiedNodeData, 'id' | 'createdAt' | 'updatedAt'>>): UnifiedNode[] {
    const now = Date.now();
    const createdNodes: UnifiedNode[] = [];

    this.cy.batch(() => {
      for (const data of nodes) {
        const nodeData: UnifiedNodeData = {
          ...data,
          id: this.generateNodeId(),
          createdAt: now,
          updatedAt: now,
        };

        const node: UnifiedNode = {
          group: 'nodes',
          data: nodeData,
          classes: this.getNodeClasses(nodeData),
        };

        this.cy.add(node);
        this.indexes.indexNode(node);
        createdNodes.push(node);
      }
    });

    this.updateLastModified();
    return createdNodes;
  }

  getNode(id: NodeId): UnifiedNode | null {
    const node = this.cy.getElementById(id);
    if (!node.length) return null;
    return this.cyNodeToUnified(node);
  }

  getNodeData(id: NodeId): UnifiedNodeData | null {
    const node = this.cy.getElementById(id);
    if (!node.length) return null;
    return node.data() as UnifiedNodeData;
  }

  hasNode(id: NodeId): boolean {
    return this.cy.getElementById(id).length > 0;
  }

  updateNode(id: NodeId, data: Partial<UnifiedNodeData>): void {
    const node = this.cy.getElementById(id);
    if (!node.length) return;

    const oldData = node.data() as UnifiedNodeData;
    const newData = { ...oldData, ...data, updatedAt: Date.now() };

    node.data(newData);
    this.indexes.updateNodeIndex(id, oldData, newData);

    const newClasses = this.getNodeClasses(newData);
    node.classes(newClasses.join(' '));

    this.updateLastModified();
  }

  removeNode(id: NodeId): void {
    const node = this.cy.getElementById(id);
    if (!node.length) return;

    const data = node.data() as UnifiedNodeData;
    this.indexes.unindexNode(id, data);
    node.remove();
    this.updateLastModified();
  }

  removeNodes(ids: NodeId[]): void {
    this.cy.batch(() => {
      for (const id of ids) {
        const node = this.cy.getElementById(id);
        if (node.length) {
          const data = node.data() as UnifiedNodeData;
          this.indexes.unindexNode(id, data);
          node.remove();
        }
      }
    });
    this.updateLastModified();
  }

  addEdge(data: Omit<UnifiedEdgeData, 'id' | 'createdAt'>): UnifiedEdge {
    const now = Date.now();
    const edgeData: UnifiedEdgeData = {
      ...data,
      id: this.generateEdgeId(),
      createdAt: now,
    };

    const edge: UnifiedEdge = {
      group: 'edges',
      data: edgeData,
      classes: this.getEdgeClasses(edgeData),
    };

    this.cy.add(edge);
    this.updateLastModified();

    return edge;
  }

  addEdges(edges: Array<Omit<UnifiedEdgeData, 'id' | 'createdAt'>>): UnifiedEdge[] {
    const now = Date.now();
    const createdEdges: UnifiedEdge[] = [];

    this.cy.batch(() => {
      for (const data of edges) {
        const edgeData: UnifiedEdgeData = {
          ...data,
          id: this.generateEdgeId(),
          createdAt: now,
        };

        const edge: UnifiedEdge = {
          group: 'edges',
          data: edgeData,
          classes: this.getEdgeClasses(edgeData),
        };

        this.cy.add(edge);
        createdEdges.push(edge);
      }
    });

    this.updateLastModified();
    return createdEdges;
  }

  getEdge(id: EdgeId): UnifiedEdge | null {
    const edge = this.cy.getElementById(id);
    if (!edge.length || !edge.isEdge()) return null;
    return this.cyEdgeToUnified(edge);
  }

  hasEdge(id: EdgeId): boolean {
    const el = this.cy.getElementById(id);
    return el.length > 0 && el.isEdge();
  }

  getEdgesBetween(sourceId: NodeId, targetId: NodeId): UnifiedEdge[] {
    const source = this.cy.getElementById(sourceId);
    const target = this.cy.getElementById(targetId);
    if (!source.length || !target.length) return [];

    return source.edgesWith(target).map(e => this.cyEdgeToUnified(e));
  }

  updateEdge(id: EdgeId, data: Partial<UnifiedEdgeData>): void {
    const edge = this.cy.getElementById(id);
    if (!edge.length || !edge.isEdge()) return;

    const oldData = edge.data() as UnifiedEdgeData;
    const newData = { ...oldData, ...data, updatedAt: Date.now() };

    edge.data(newData);

    const newClasses = this.getEdgeClasses(newData);
    edge.classes(newClasses.join(' '));

    this.updateLastModified();
  }

  removeEdge(id: EdgeId): void {
    const edge = this.cy.getElementById(id);
    if (edge.length && edge.isEdge()) {
      edge.remove();
      this.updateLastModified();
    }
  }

  createFolder(label: string, parentId?: NodeId, options?: FolderOptions): UnifiedNode {
    const depth = parentId ? this.calculateFolderDepth(parentId) + 1 : 0;

    return this.addNode({
      type: 'FOLDER',
      label,
      parentId: parentId || options?.parentId,
      depth,
      entityKind: options?.entityKind,
      entitySubtype: options?.entitySubtype,
      isTypedRoot: options?.isTypedRoot,
      isSubtypeRoot: options?.isSubtypeRoot,
      color: options?.color,
    });
  }

  getChildNodes(folderId: NodeId, recursive: boolean = false): UnifiedNode[] {
    if (!recursive) {
      const childIds = this.indexes.getByFolder(folderId);
      return childIds.map(id => this.getNode(id)).filter((n): n is UnifiedNode => n !== null);
    }

    const result: UnifiedNode[] = [];
    const queue = [folderId];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const childIds = this.indexes.getByFolder(currentId);
      for (const childId of childIds) {
        const child = this.getNode(childId);
        if (child) {
          result.push(child);
          if (child.data.type === 'FOLDER') {
            queue.push(childId);
          }
        }
      }
    }

    return result;
  }

  moveToFolder(nodeId: NodeId, folderId: NodeId): void {
    const node = this.getNodeData(nodeId);
    if (!node) return;

    const oldParentId = node.parentId;
    const newDepth = folderId ? this.calculateFolderDepth(folderId) + 1 : 0;

    this.updateNode(nodeId, {
      parentId: folderId,
      depth: newDepth,
    });
  }

  getFolderPath(folderId: NodeId): UnifiedNode[] {
    const path: UnifiedNode[] = [];
    let currentId: NodeId | undefined = folderId;

    while (currentId) {
      const folder = this.getNode(currentId);
      if (!folder) break;
      path.unshift(folder);
      currentId = folder.data.parentId;
    }

    return path;
  }

  createNote(label: string, content: string, folderId?: NodeId, options?: NoteOptions): UnifiedNode {
    const parentId = folderId || options?.parentId;
    const depth = parentId ? this.calculateFolderDepth(parentId) + 1 : 0;

    const inheritedKind = parentId ? this.getInheritedEntityKind(parentId) : undefined;
    const inheritedSubtype = parentId ? this.getInheritedEntitySubtype(parentId) : undefined;

    return this.addNode({
      type: 'NOTE',
      label,
      content,
      parentId,
      depth,
      entityKind: options?.entityKind || inheritedKind,
      entitySubtype: options?.entitySubtype || inheritedSubtype,
      inheritedKind,
      inheritedSubtype,
      blueprintId: options?.blueprintId,
      tags: options?.tags || [],
      isEntity: options?.isEntity,
      attributes: options?.attributes,
    });
  }

  updateNoteContent(noteId: NodeId, content: string): void {
    this.updateNode(noteId, { content });
  }

  getNotesInFolder(folderId: NodeId, recursive: boolean = false): UnifiedNode[] {
    const children = this.getChildNodes(folderId, recursive);
    return children.filter(n => n.data.type === 'NOTE');
  }

  createEntity(label: string, kind: EntityKind, options?: EntityOptions): UnifiedNode {
    const color = ENTITY_COLORS[kind] || '#6b7280';

    return this.addNode({
      type: 'ENTITY',
      label,
      entityKind: kind,
      entitySubtype: options?.entitySubtype,
      isEntity: true,
      sourceNoteId: options?.sourceNoteId,
      blueprintId: options?.blueprintId,
      attributes: options?.attributes,
      extraction: options?.extraction,
      temporal: options?.temporal,
      narrativeMetadata: options?.narrativeMetadata,
      sceneMetadata: options?.sceneMetadata,
      eventMetadata: options?.eventMetadata,
      color,
    });
  }

  getEntitiesByKind(kind: EntityKind): UnifiedNode[] {
    const ids = this.indexes.getByKind(kind);
    return ids.map(id => this.getNode(id)).filter((n): n is UnifiedNode => n !== null);
  }

  getEntitiesMentionedInNote(noteId: NodeId): UnifiedNode[] {
    const entityIds = this.indexes.getBySourceNote(noteId);
    return entityIds.map(id => this.getNode(id)).filter((n): n is UnifiedNode => n !== null);
  }

  findEntityByLabel(label: string, kind?: EntityKind): UnifiedNode | null {
    const ids = this.indexes.getByLabel(label);

    for (const id of ids) {
      const node = this.getNode(id);
      if (node && node.data.type === 'ENTITY') {
        if (!kind || node.data.entityKind === kind) {
          return node;
        }
      }
    }

    return null;
  }

  mergeEntities(sourceId: NodeId, targetId: NodeId): UnifiedNode {
    const source = this.getNodeData(sourceId);
    const target = this.getNodeData(targetId);

    if (!source || !target) {
      throw new Error('Both entities must exist for merge');
    }

    const sourceEdges = this.cy.getElementById(sourceId).connectedEdges();

    this.cy.batch(() => {
      sourceEdges.forEach(edge => {
        const edgeData = edge.data() as UnifiedEdgeData;
        const newSource = edgeData.source === sourceId ? targetId : edgeData.source;
        const newTarget = edgeData.target === sourceId ? targetId : edgeData.target;

        if (newSource !== newTarget) {
          this.addEdge({
            ...edgeData,
            source: newSource,
            target: newTarget,
          });
        }
      });
    });

    if (source.extraction && target.extraction) {
      const mergedMentions = [...target.extraction.mentions, ...source.extraction.mentions];
      this.updateNode(targetId, {
        extraction: {
          ...target.extraction,
          mentions: mergedMentions,
          frequency: target.extraction.frequency + source.extraction.frequency,
        },
      });
    }

    this.removeNode(sourceId);

    return this.getNode(targetId)!;
  }

  addExtractedEntity(
    label: string,
    kind: EntityKind,
    extraction: ExtractionData,
    sourceNoteId: NodeId
  ): UnifiedNode {
    const existing = this.findEntityByLabel(label, kind);

    if (existing) {
      const existingExtraction = existing.data.extraction;
      if (existingExtraction) {
        const mergedMentions = [...existingExtraction.mentions, ...extraction.mentions];
        this.updateNode(existing.data.id, {
          extraction: {
            method: extraction.method,
            confidence: (existingExtraction.confidence + extraction.confidence) / 2,
            mentions: mergedMentions,
            frequency: existingExtraction.frequency + extraction.frequency,
          },
        });
      }
      return this.getNode(existing.data.id)!;
    }

    return this.createEntity(label, kind, {
      sourceNoteId,
      extraction,
    });
  }

  addMention(entityId: NodeId, mention: EntityMention): void {
    const node = this.getNodeData(entityId);
    if (!node || !node.extraction) return;

    const mentions = [...node.extraction.mentions, mention];
    this.updateNode(entityId, {
      extraction: {
        ...node.extraction,
        mentions,
        frequency: node.extraction.frequency + 1,
      },
    });
  }

  getExtractionsByMethod(method: ExtractionData['method']): UnifiedNode[] {
    const entityIds = this.indexes.getByType('ENTITY');
    return entityIds
      .map(id => this.getNode(id))
      .filter((n): n is UnifiedNode => n !== null && n.data.extraction?.method === method);
  }

  createNarrativeNode(
    label: string,
    kind: NarrativeEntityKind,
    parentId?: NodeId,
    metadata?: NarrativeMetadata
  ): UnifiedNode {
    const sequence = parentId ? this.getNextNarrativeSequence(parentId) : 0;

    const node = this.createEntity(label, kind, {
      narrativeMetadata: {
        ...metadata,
        sequence,
      },
    });

    if (parentId) {
      this.addEdge({
        source: parentId,
        target: node.data.id,
        type: 'PARENT_OF',
        weight: 1,
      });
    }

    return node;
  }

  getNarrativeHierarchy(rootId?: NodeId): UnifiedNode[] {
    const narrativeKinds: EntityKind[] = ['NARRATIVE', 'ARC', 'ACT', 'CHAPTER', 'SCENE', 'BEAT', 'EVENT'];

    if (!rootId) {
      return this.cy.nodes()
        .filter(n => narrativeKinds.includes(n.data('entityKind')))
        .map(n => this.cyNodeToUnified(n as NodeSingular))
        .sort((a, b) => (a.data.narrativeMetadata?.sequence || 0) - (b.data.narrativeMetadata?.sequence || 0));
    }

    const result: UnifiedNode[] = [];
    const queue: NodeId[] = [rootId];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = this.getNode(currentId);
      if (node) {
        result.push(node);

        const children = this.cy.getElementById(currentId)
          .outgoers('edge[type = "PARENT_OF"]')
          .targets()
          .map(n => n.id());

        queue.push(...children);
      }
    }

    return result.sort((a, b) => (a.data.narrativeMetadata?.sequence || 0) - (b.data.narrativeMetadata?.sequence || 0));
  }

  getNarrativeChildren(parentId: NodeId): UnifiedNode[] {
    return this.cy.getElementById(parentId)
      .outgoers('edge[type = "PARENT_OF"]')
      .targets()
      .map(n => this.cyNodeToUnified(n))
      .sort((a, b) => (a.data.narrativeMetadata?.sequence || 0) - (b.data.narrativeMetadata?.sequence || 0));
  }

  reorderNarrativeSequence(parentId: NodeId, orderedChildIds: NodeId[]): void {
    this.cy.batch(() => {
      orderedChildIds.forEach((childId, index) => {
        const node = this.getNodeData(childId);
        if (node?.narrativeMetadata) {
          this.updateNode(childId, {
            narrativeMetadata: {
              ...node.narrativeMetadata,
              sequence: index,
            },
          });
        }
      });
    });
  }

  createBlueprint(label: string, data: BlueprintData): UnifiedNode {
    return this.addNode({
      type: 'BLUEPRINT',
      label,
      blueprintData: data,
      entityKind: data.entityKind,
    });
  }

  getInstancesOfBlueprint(blueprintId: NodeId): UnifiedNode[] {
    const ids = this.indexes.getByBlueprint(blueprintId);
    return ids.map(id => this.getNode(id)).filter((n): n is UnifiedNode => n !== null);
  }

  createFromBlueprint(blueprintId: NodeId, label: string, attributes: Record<string, unknown>): UnifiedNode {
    const blueprint = this.getNodeData(blueprintId);
    if (!blueprint || blueprint.type !== 'BLUEPRINT') {
      throw new Error('Blueprint not found');
    }

    const node = this.addNode({
      type: blueprint.blueprintData?.entityKind ? 'ENTITY' : 'NOTE',
      label,
      blueprintId,
      entityKind: blueprint.blueprintData?.entityKind,
      attributes,
      isEntity: !!blueprint.blueprintData?.entityKind,
    });

    this.addEdge({
      source: node.data.id,
      target: blueprintId,
      type: 'INSTANCE_OF',
    });

    return node;
  }

  createBacklink(sourceNoteId: NodeId, targetNoteId: NodeId): UnifiedEdge {
    return this.addEdge({
      source: sourceNoteId,
      target: targetNoteId,
      type: 'BACKLINK',
      bidirectional: true,
    });
  }

  createMentionEdge(noteId: NodeId, entityId: NodeId, context: string): UnifiedEdge {
    return this.addEdge({
      source: noteId,
      target: entityId,
      type: 'MENTIONS',
      context,
      noteIds: [noteId],
    });
  }

  createCoOccurrence(entityA: NodeId, entityB: NodeId, weight: number, noteIds: NodeId[]): UnifiedEdge {
    const existing = this.getEdgesBetween(entityA, entityB)
      .find(e => e.data.type === 'CO_OCCURS');

    if (existing) {
      const existingNoteIds = existing.data.noteIds || [];
      const mergedNoteIds = [...new Set([...existingNoteIds, ...noteIds])];
      this.updateEdge(existing.data.id, {
        weight: (existing.data.weight || 0) + weight,
        noteIds: mergedNoteIds,
      });
      return this.getEdge(existing.data.id)!;
    }

    return this.addEdge({
      source: entityA,
      target: entityB,
      type: 'CO_OCCURS',
      weight,
      noteIds,
    });
  }

  createRelationship(
    sourceId: NodeId,
    targetId: NodeId,
    type: EdgeType,
    properties?: Record<string, unknown>
  ): UnifiedEdge {
    return this.addEdge({
      source: sourceId,
      target: targetId,
      type,
      properties,
    });
  }

  createTemporalEdge(
    sourceId: NodeId,
    targetId: NodeId,
    relation: TemporalRelation
  ): UnifiedEdge {
    return this.addEdge({
      source: sourceId,
      target: targetId,
      type: relation.relationType.toUpperCase() as EdgeType,
      temporalRelation: relation,
    });
  }

  createCausalEdge(
    causeId: NodeId,
    effectId: NodeId,
    causality: CausalityData
  ): UnifiedEdge {
    return this.addEdge({
      source: causeId,
      target: effectId,
      type: 'CAUSED_BY',
      causality,
    });
  }

  getNodesByType(type: NodeType): UnifiedNode[] {
    const ids = this.indexes.getByType(type);
    return ids.map(id => this.getNode(id)).filter((n): n is UnifiedNode => n !== null);
  }

  getNeighborhood(nodeId: NodeId, depth: number = 1): NeighborhoodResult {
    const node = this.cy.getElementById(nodeId);
    if (!node.length) return { nodes: [], edges: [] };

    const visited = new Set<string>([nodeId]);
    const resultNodes: UnifiedNode[] = [this.cyNodeToUnified(node)];
    const resultEdges: UnifiedEdge[] = [];
    const queue: Array<{ id: string; dist: number }> = [{ id: nodeId, dist: 0 }];

    while (queue.length > 0) {
      const { id: currentId, dist } = queue.shift()!;

      if (dist < depth) {
        const current = this.cy.getElementById(currentId);

        current.connectedEdges().forEach(edge => {
          resultEdges.push(this.cyEdgeToUnified(edge));

          const neighbor = edge.source().id() === currentId ? edge.target() : edge.source();
          const neighborId = neighbor.id();

          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            resultNodes.push(this.cyNodeToUnified(neighbor));
            queue.push({ id: neighborId, dist: dist + 1 });
          }
        });
      }
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  findPath(sourceId: NodeId, targetId: NodeId): PathResult | null {
    const source = this.cy.getElementById(sourceId);
    const target = this.cy.getElementById(targetId);

    if (!source.length || !target.length) return null;

    const distances: Map<string, number> = new Map();
    const predecessors: Map<string, { node: string; edge: string }> = new Map();

    this.cy.nodes().forEach(n => { distances.set(n.id(), Infinity); });
    distances.set(sourceId, 0);

    const queue = [sourceId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === targetId) break;

      this.cy.getElementById(current).connectedEdges().forEach(edge => {
        const neighbor = edge.source().id() === current ? edge.target() : edge.source();
        const neighborId = neighbor.id();
        const newDist = distances.get(current)! + 1;

        if (newDist < distances.get(neighborId)!) {
          distances.set(neighborId, newDist);
          predecessors.set(neighborId, { node: current, edge: edge.id() });
          queue.push(neighborId);
        }
      });
    }

    if (distances.get(targetId) === Infinity) return null;

    const path: NodeId[] = [];
    const edges: EdgeId[] = [];
    let current = targetId;

    while (current) {
      path.unshift(current);
      const pred = predecessors.get(current);
      if (pred) {
        edges.unshift(pred.edge);
        current = pred.node;
      } else {
        break;
      }
    }

    return { path, edges, length: path.length - 1 };
  }

  getConnectedComponents(): NodeId[][] {
    const visited = new Set<string>();
    const components: NodeId[][] = [];

    this.cy.nodes().forEach(node => {
      const nodeId = node.id();
      if (visited.has(nodeId)) return;

      const component: NodeId[] = [];
      const queue = [nodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;

        visited.add(current);
        component.push(current);

        this.cy.getElementById(current).neighborhood('node').forEach(neighbor => {
          if (!visited.has(neighbor.id())) {
            queue.push(neighbor.id());
          }
        });
      }

      components.push(component);
    });

    return components;
  }

  searchByLabel(query: string, options?: SearchOptions): UnifiedNode[] {
    const ids = this.indexes.searchByLabel(query, options?.fuzzy);

    let nodes = ids.map(id => this.getNode(id)).filter((n): n is UnifiedNode => n !== null);

    if (options?.nodeTypes?.length) {
      nodes = nodes.filter(n => options.nodeTypes!.includes(n.data.type));
    }

    if (options?.entityKinds?.length) {
      nodes = nodes.filter(n => n.data.entityKind && options.entityKinds!.includes(n.data.entityKind));
    }

    if (options?.limit) {
      nodes = nodes.slice(0, options.limit);
    }

    return nodes;
  }

  filterNodes(predicate: (node: UnifiedNode) => boolean): UnifiedNode[] {
    return this.cy.nodes()
      .map(n => this.cyNodeToUnified(n))
      .filter(predicate);
  }

  computeDegrees(): Map<NodeId, number> {
    const degrees = new Map<NodeId, number>();
    this.cy.nodes().forEach(node => {
      degrees.set(node.id(), node.degree(false));
    });
    return degrees;
  }

  computeBetweenness(): Map<NodeId, number> {
    const centrality = new Map<NodeId, number>();
    const nodes = this.cy.nodes();

    nodes.forEach(node => { centrality.set(node.id(), 0); });

    if (nodes.length > 100) {
      nodes.forEach(node => {
        centrality.set(node.id(), node.degree(false) / Math.max(1, nodes.length - 1));
      });
      return centrality;
    }

    nodes.forEach(source => {
      const distances = new Map<string, number>();
      const predecessors = new Map<string, string[]>();

      nodes.forEach(n => {
        distances.set(n.id(), Infinity);
        predecessors.set(n.id(), []);
      });

      distances.set(source.id(), 0);
      const queue = [source.id()];

      while (queue.length > 0) {
        const current = queue.shift()!;

        this.cy.getElementById(current).neighborhood('node').forEach(neighbor => {
          const neighborId = neighbor.id();
          const newDist = distances.get(current)! + 1;

          if (newDist < distances.get(neighborId)!) {
            distances.set(neighborId, newDist);
            predecessors.set(neighborId, [current]);
            queue.push(neighborId);
          } else if (newDist === distances.get(neighborId)!) {
            predecessors.get(neighborId)!.push(current);
          }
        });
      }

      nodes.forEach(target => {
        if (source.id() === target.id()) return;

        let current = target.id();
        const path: string[] = [];

        while (predecessors.get(current)?.length) {
          const preds = predecessors.get(current)!;
          if (preds[0] === source.id()) break;
          current = preds[0];
          path.push(current);
        }

        path.forEach(nodeId => {
          centrality.set(nodeId, (centrality.get(nodeId) || 0) + 1);
        });
      });
    });

    const n = nodes.length;
    const normFactor = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;

    centrality.forEach((value, key) => {
      centrality.set(key, value / normFactor);
    });

    return centrality;
  }

  computeCloseness(): Map<NodeId, number> {
    const centrality = new Map<NodeId, number>();
    const nodes = this.cy.nodes();
    const n = nodes.length;

    nodes.forEach(node => {
      const distances = new Map<string, number>();
      nodes.forEach(n => { distances.set(n.id(), Infinity); });
      distances.set(node.id(), 0);

      const queue = [node.id()];

      while (queue.length > 0) {
        const current = queue.shift()!;

        this.cy.getElementById(current).neighborhood('node').forEach(neighbor => {
          const neighborId = neighbor.id();
          if (distances.get(neighborId) === Infinity) {
            distances.set(neighborId, distances.get(current)! + 1);
            queue.push(neighborId);
          }
        });
      }

      let totalDistance = 0;
      let reachable = 0;

      distances.forEach((dist, id) => {
        if (dist !== Infinity && dist > 0) {
          totalDistance += dist;
          reachable++;
        }
      });

      const closeness = reachable > 0
        ? (reachable / (n - 1)) * (reachable / totalDistance)
        : 0;

      centrality.set(node.id(), closeness);
    });

    return centrality;
  }

  detectCommunities(): Map<NodeId, string> {
    const communities = new Map<NodeId, string>();
    const visited = new Set<string>();
    let communityId = 0;

    this.cy.nodes().forEach(node => {
      const nodeId = node.id();
      if (visited.has(nodeId)) return;

      const queue = [nodeId];
      const currentCommunity = `community_${communityId}`;

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;

        visited.add(current);
        communities.set(current, currentCommunity);

        this.cy.getElementById(current).neighborhood('node').forEach(neighbor => {
          if (!visited.has(neighbor.id())) {
            queue.push(neighbor.id());
          }
        });
      }

      communityId++;
    });

    return communities;
  }

  toJSON(): GraphExport {
    const nodes: UnifiedNode[] = this.cy.nodes().map(n => this.cyNodeToUnified(n));
    const edges: UnifiedEdge[] = this.cy.edges().map(e => this.cyEdgeToUnified(e));

    return {
      format: 'unified-cytoscape',
      version: '1.0.0',
      timestamp: Date.now(),
      elements: { nodes, edges },
      metadata: {
        ...this.metadata,
        stats: this.computeStats(),
      },
    };
  }

  fromJSON(data: GraphExport): void {
    this.clear();

    this.cy.batch(() => {
      for (const node of data.elements.nodes) {
        this.cy.add(node);
        this.indexes.indexNode(node);
      }

      for (const edge of data.elements.edges) {
        this.cy.add(edge);
      }
    });

    this.metadata = data.metadata;
    this.updateLastModified();
  }

  exportSubgraph(nodeIds: NodeId[]): GraphExport {
    const nodeSet = new Set(nodeIds);

    const nodes: UnifiedNode[] = nodeIds
      .map(id => this.getNode(id))
      .filter((n): n is UnifiedNode => n !== null);

    const edges: UnifiedEdge[] = this.cy.edges()
      .filter(e => nodeSet.has(e.source().id()) && nodeSet.has(e.target().id()))
      .map(e => this.cyEdgeToUnified(e as EdgeSingular));

    return {
      format: 'unified-cytoscape',
      version: '1.0.0',
      timestamp: Date.now(),
      elements: { nodes, edges },
      metadata: {
        version: GRAPH_VERSION,
        lastModified: Date.now(),
        stats: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          noteCount: nodes.filter(n => n.data.type === 'NOTE').length,
          folderCount: nodes.filter(n => n.data.type === 'FOLDER').length,
          entityCount: nodes.filter(n => n.data.type === 'ENTITY').length,
          blueprintCount: nodes.filter(n => n.data.type === 'BLUEPRINT').length,
          temporalCount: nodes.filter(n => n.data.type === 'TEMPORAL').length,
          episodeCount: nodes.filter(n => n.data.type === 'COMMUNITY' || n.data.episode_id).length, // Estimate
          communityCount: nodes.filter(n => n.data.type === 'COMMUNITY' || n.data.community_id).length,
          extractionCounts: { regex: 0, ner: 0, llm: 0, manual: 0 },
        },
      },
    };
  }

  getStats(): GraphStats {
    return this.computeStats();
  }

  getMetadata(): GraphMetadata {
    return {
      ...this.metadata,
      stats: this.computeStats(),
    };
  }

  clear(): void {
    this.cy.elements().remove();
    this.indexes.clear();
    this.metadata = this.createDefaultMetadata();
  }

  destroy(): void {
    this.cy.destroy();
  }

  private computeStats(): GraphStats {
    const indexStats = this.indexes.getStats();

    let regexCount = 0;
    let nerCount = 0;
    let llmCount = 0;
    let manualCount = 0;

    this.cy.nodes('[type = "ENTITY"]').forEach(node => {
      const extraction = node.data('extraction') as ExtractionData | undefined;
      if (extraction) {
        switch (extraction.method) {
          case 'regex': regexCount++; break;
          case 'ner': nerCount++; break;
          case 'llm': llmCount++; break;
          case 'manual': manualCount++; break;
        }
      }
    });

    return {
      nodeCount: this.cy.nodes().length,
      edgeCount: this.cy.edges().length,
      noteCount: indexStats.typeCount.NOTE,
      folderCount: indexStats.typeCount.FOLDER,
      entityCount: indexStats.typeCount.ENTITY,
      blueprintCount: indexStats.typeCount.BLUEPRINT,
      temporalCount: indexStats.typeCount.TEMPORAL,
      episodeCount: this.cy.nodes('[type = "COMMUNITY"]').length, // Chapters/Scenes are entities too but this is a reasonable start
      communityCount: this.cy.nodes('[type = "COMMUNITY"]').length,
      extractionCounts: {
        regex: regexCount,
        ner: nerCount,
        llm: llmCount,
        manual: manualCount,
      },
    };
  }

  private updateLastModified(): void {
    this.metadata.lastModified = Date.now();
  }

  private calculateFolderDepth(folderId: NodeId): number {
    let depth = 0;
    let currentId: NodeId | undefined = folderId;

    while (currentId) {
      const node = this.getNodeData(currentId);
      if (!node) break;
      depth++;
      currentId = node.parentId;
    }

    return depth;
  }

  private getInheritedEntityKind(parentId: NodeId): EntityKind | undefined {
    const path = this.getFolderPath(parentId);
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].data.entityKind) {
        return path[i].data.entityKind;
      }
    }
    return undefined;
  }

  private getInheritedEntitySubtype(parentId: NodeId): string | undefined {
    const path = this.getFolderPath(parentId);
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].data.entitySubtype) {
        return path[i].data.entitySubtype;
      }
    }
    return undefined;
  }

  private getNextNarrativeSequence(parentId: NodeId): number {
    const children = this.getNarrativeChildren(parentId);
    if (children.length === 0) return 0;

    const maxSequence = Math.max(
      ...children.map(c => c.data.narrativeMetadata?.sequence || 0)
    );
    return maxSequence + 1;
  }

  private getNodeClasses(data: UnifiedNodeData): string[] {
    const classes: string[] = [data.type.toLowerCase()];

    if (data.entityKind) {
      classes.push(`kind-${data.entityKind.toLowerCase()}`);
    }

    if (data.isEntity) {
      classes.push('entity');
    }

    if (data.isPinned) {
      classes.push('pinned');
    }

    if (data.favorite) {
      classes.push('favorite');
    }

    return classes;
  }

  private getEdgeClasses(data: UnifiedEdgeData): string[] {
    const classes: string[] = [`type-${data.type.toLowerCase()}`];

    if (data.bidirectional) {
      classes.push('bidirectional');
    }

    if (data.extractionMethod) {
      classes.push(`method-${data.extractionMethod}`);
    }

    return classes;
  }

  private cyNodeToUnified(node: NodeSingular): UnifiedNode {
    return {
      group: 'nodes',
      data: node.data() as UnifiedNodeData,
      position: node.position(),
      classes: node.classes(),
    };
  }

  private cyEdgeToUnified(edge: EdgeSingular): UnifiedEdge {
    return {
      group: 'edges',
      data: edge.data() as UnifiedEdgeData,
      classes: edge.classes(),
    };
  }
}
