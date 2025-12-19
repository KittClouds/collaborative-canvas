export type GraphNodeType = 'note' | 'folder' | 'entity' | 'concept' | 'blueprint';

export type GraphEdgeType = 'backlink' | 'wikilink' | 'contains' | 'relationship' | 'cooccurrence';

export type GraphScopeType = 'vault' | 'entity' | 'cooccurrence';

export interface GraphNodeVisual {
  color: string;
  size: number;
  shape?: 'circle' | 'square' | 'diamond' | 'triangle';
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
}

export interface GraphNodeMetadata {
  entityKind?: string;
  entitySubtype?: string;
  confidence?: number;
  blueprintId?: string;
  blueprintTypeId?: string;
  isTyped?: boolean;
  isCanonical?: boolean;
  frequency?: number;
  extractionMethod?: string;
  createdAt?: number;
  updatedAt?: number;
  noteIds?: string[];
  folderId?: string;
  parentId?: string;
  path?: string;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  scope: GraphScopeType;
  metadata: GraphNodeMetadata;
  visual: GraphNodeVisual;
}

export interface GraphEdgeVisual {
  color: string;
  width: number;
  dashed?: boolean;
  opacity?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  scope: GraphScopeType;
  weight?: number;
  confidence?: number;
  label?: string;
  metadata?: Record<string, unknown>;
  visual: GraphEdgeVisual;
}

export interface GraphDataMetadata {
  nodeCount: number;
  edgeCount: number;
  focusNodeId?: string;
  scopeId?: string;
  builtAt: number;
  stale?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  scope: GraphScopeType;
  metadata: GraphDataMetadata;
}

export interface AdapterOptions {
  includeOrphans?: boolean;
  minConfidence?: number;
  maxNodes?: number;
  entityKinds?: string[];
}

export interface CoOccurrenceOptions extends AdapterOptions {
  windowSize?: number;
  minWeight?: number;
  calculatePMI?: boolean;
}

export interface CacheEntry {
  data: GraphData;
  builtAt: number;
  stale: boolean;
}

export type GraphUpdateCallback = (scope: GraphScopeType, scopeId?: string) => void;
