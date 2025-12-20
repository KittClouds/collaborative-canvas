import type { EntityKind, NarrativeEntityKind } from '@/lib/entities/entityTypes';
import type { TemporalPoint, DurationUnit, TimeOfDay } from '@/types/temporal';

export type NodeId = string;
export type EdgeId = string;

export type NodeType = 
  | 'NOTE'
  | 'FOLDER'
  | 'ENTITY'
  | 'BLUEPRINT'
  | 'TEMPORAL';

export type EdgeType =
  | 'CONTAINS'
  | 'PARENT_OF'
  | 'BACKLINK'
  | 'MENTIONS'
  | 'REFERENCES'
  | 'KNOWS'
  | 'LOCATED_IN'
  | 'OWNS'
  | 'MEMBER_OF'
  | 'RELATED_TO'
  | 'DERIVED_FROM'
  | 'CO_OCCURS'
  | 'CAUSED_BY'
  | 'LEADS_TO'
  | 'INSTANCE_OF'
  | 'CONFORMS_TO'
  | 'BEFORE'
  | 'DURING'
  | 'AFTER'
  | string;

export type ExtractionMethod = 'regex' | 'ner' | 'llm' | 'manual';

export interface EntityMention {
  noteId: NodeId;
  charPosition: number;
  sentenceIndex?: number;
  context: string;
}

export interface ExtractionData {
  method: ExtractionMethod;
  confidence: number;
  mentions: EntityMention[];
  frequency: number;
}

export interface TemporalData {
  type: 'point' | 'span';
  start: TemporalPoint;
  end?: TemporalPoint;
  duration?: {
    value: number;
    unit: DurationUnit;
  };
  confidence: number;
  source: 'parsed' | 'manual' | 'inferred';
  locked: boolean;
}

export type NarrativeStatus = 'planning' | 'drafting' | 'complete' | 'revision';
export type StakesLevel = 'low' | 'medium' | 'high' | 'critical';

export interface NarrativeMetadata {
  status?: NarrativeStatus;
  purpose?: string;
  theme?: string;
  stakes?: StakesLevel;
  emotionalTone?: string;
  wordCount?: number;
  targetWordCount?: number;
  sequence?: number;
}

export interface SceneMetadata {
  location: string;
  secondaryLocations?: string[];
  povCharacterId?: NodeId;
  participants: NodeId[];
  sceneType: 'setup' | 'conflict' | 'revelation' | 'transition' | 'climax' | 'resolution';
  conflict?: string;
  sensoryDetails?: string;
  timeOfDay?: TimeOfDay;
}

export interface EventMetadata {
  eventType: 'plot' | 'historical' | 'personal' | 'world' | 'background';
  scope: 'personal' | 'local' | 'regional' | 'global' | 'cosmic';
  participants: NodeId[];
  impact: 'minor' | 'moderate' | 'major' | 'catastrophic';
  visibility: 'secret' | 'private' | 'public' | 'legendary';
  description?: string;
  causeEventId?: NodeId;
  consequenceEventIds?: NodeId[];
}

export interface BlueprintFieldTemplate {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'entity-ref';
  required: boolean;
  defaultValue?: string;
  description?: string;
  options?: string[];
}

export interface BlueprintData {
  templates: BlueprintFieldTemplate[];
  description?: string;
  entityKind?: EntityKind;
}

export interface UnifiedNodeData {
  id: NodeId;
  type: NodeType;
  label: string;
  
  entityKind?: EntityKind;
  entitySubtype?: string;
  isEntity?: boolean;
  
  parentId?: NodeId;
  depth?: number;
  isTypedRoot?: boolean;
  isSubtypeRoot?: boolean;
  inheritedKind?: EntityKind;
  inheritedSubtype?: string;
  
  content?: string;
  tags?: string[];
  isPinned?: boolean;
  favorite?: boolean;
  
  sourceNoteId?: NodeId;
  blueprintId?: NodeId;
  
  temporal?: TemporalData;
  
  narrativeMetadata?: NarrativeMetadata;
  sceneMetadata?: SceneMetadata;
  eventMetadata?: EventMetadata;
  
  blueprintData?: BlueprintData;
  
  attributes?: Record<string, unknown>;
  
  extraction?: ExtractionData;
  
  createdAt: number;
  updatedAt: number;
  
  color?: string;
  size?: number;
  shape?: string;
  
  vectorId?: string;
  embeddingVersion?: string;
}

export interface UnifiedNode {
  group: 'nodes';
  data: UnifiedNodeData;
  position?: { x: number; y: number };
  classes?: string[];
}

export interface TemporalRelation {
  relationType: 'before' | 'after' | 'during' | 'overlaps';
  gap?: {
    value: number;
    unit: DurationUnit;
  };
}

export interface CausalityData {
  strength: 'weak' | 'moderate' | 'strong' | 'definite';
  description?: string;
}

export interface UnifiedEdgeData {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  type: EdgeType;
  
  weight?: number;
  confidence?: number;
  bidirectional?: boolean;
  
  extractionMethod?: ExtractionMethod;
  context?: string;
  noteIds?: NodeId[];
  
  temporalRelation?: TemporalRelation;
  
  causality?: CausalityData;
  
  properties?: Record<string, unknown>;
  
  createdAt: number;
  updatedAt?: number;
  
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface UnifiedEdge {
  group: 'edges';
  data: UnifiedEdgeData;
  classes?: string[];
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  noteCount: number;
  folderCount: number;
  entityCount: number;
  blueprintCount: number;
  temporalCount: number;
  extractionCounts: {
    regex: number;
    ner: number;
    llm: number;
    manual: number;
  };
}

export interface GraphMetadata {
  version: string;
  lastModified: number;
  stats: GraphStats;
}

export interface GraphViewState {
  selectedNodeId: NodeId | null;
  expandedFolderIds: NodeId[];
  pinnedNodeIds: NodeId[];
  viewMode: 'tree' | 'graph' | 'timeline' | 'table';
  filters: {
    nodeTypes: NodeType[];
    entityKinds: EntityKind[];
    dateRange?: { start: number; end: number };
    searchQuery?: string;
  };
}

export interface GraphExport {
  format: 'unified-cytoscape';
  version: '1.0.0';
  timestamp: number;
  elements: {
    nodes: UnifiedNode[];
    edges: UnifiedEdge[];
  };
  metadata: GraphMetadata;
  state?: GraphViewState;
}

export interface NeighborhoodResult {
  nodes: UnifiedNode[];
  edges: UnifiedEdge[];
}

export interface PathResult {
  path: NodeId[];
  edges: EdgeId[];
  length: number;
}

export interface FolderOptions {
  parentId?: NodeId;
  entityKind?: EntityKind;
  entitySubtype?: string;
  isTypedRoot?: boolean;
  isSubtypeRoot?: boolean;
  color?: string;
}

export interface NoteOptions {
  parentId?: NodeId;
  entityKind?: EntityKind;
  entitySubtype?: string;
  blueprintId?: NodeId;
  tags?: string[];
  isEntity?: boolean;
  attributes?: Record<string, unknown>;
}

export interface EntityOptions {
  entitySubtype?: string;
  sourceNoteId?: NodeId;
  blueprintId?: NodeId;
  attributes?: Record<string, unknown>;
  extraction?: ExtractionData;
  temporal?: TemporalData;
  narrativeMetadata?: NarrativeMetadata;
  sceneMetadata?: SceneMetadata;
  eventMetadata?: EventMetadata;
}

export interface SearchOptions {
  fuzzy?: boolean;
  nodeTypes?: NodeType[];
  entityKinds?: EntityKind[];
  limit?: number;
}

export interface ExtractedEntity {
  kind: string;
  label: string;
  subtype?: string;
  confidence: number;
  extractionMethod: ExtractionMethod;
  positions: EntityMention[];
  attributes?: Record<string, unknown>;
}

export interface ExtractedRelationship {
  sourceLabel: string;
  sourceKind: string;
  targetLabel: string;
  targetKind: string;
  relationshipType: string;
  weight: number;
  confidence: number;
  extractionMethod: ExtractionMethod;
  noteIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  metadata: {
    noteId: string;
    extractionMethod: ExtractionMethod;
    timestamp: string;
    processingTime?: number;
  };
}

export interface GraphEntity {
  id: string;
  kind: string;
  label: string;
  subtype?: string;
  frequency: number;
  noteIds: string[];
  mentions: EntityMention[];
  extractionMethods: ExtractionMethod[];
  attributes: Record<string, unknown>;
  confidence: number;
}

export interface GraphRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  confidence: number;
  noteIds: string[];
  extractionMethods: ExtractionMethod[];
  metadata?: Record<string, unknown>;
}

export { EntityKind, NarrativeEntityKind };
