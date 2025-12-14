import type { Attributes } from 'graphology-types';

// ============= EXTRACTION OUTPUT (What extractors produce) =============

export type ExtractionMethod = 'regex' | 'llm' | 'manual';

/**
 * A single mention of an entity within a document
 */
export interface EntityMention {
  noteId: string;
  charPosition: number;
  sentenceIndex?: number;
  context: string;
}

/**
 * Standardized entity extracted by ANY extraction method
 */
export interface ExtractedEntity {
  kind: string;
  label: string;
  subtype?: string;
  confidence: number; // 0.0-1.0 (regex=1.0, LLM varies)
  extractionMethod: ExtractionMethod;
  positions: EntityMention[];
  attributes?: Record<string, any>;
}

/**
 * Standardized relationship extracted by ANY method
 */
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
  metadata?: Record<string, any>;
}

/**
 * Output from any extraction run
 */
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

// ============= GRAPH DOMAIN OBJECTS (After deduplication/merging) =============

/**
 * Merged entity (possibly from multiple extraction runs)
 */
export interface GraphEntity {
  id: string; // canonical ID: "CHARACTER:Jon_Snow"
  kind: string;
  label: string;
  subtype?: string;
  frequency: number;
  noteIds: string[];
  mentions: EntityMention[];
  extractionMethods: ExtractionMethod[];
  attributes: Record<string, any>;
  confidence: number;
}

/**
 * Merged relationship
 */
export interface GraphRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  confidence: number;
  noteIds: string[];
  extractionMethods: ExtractionMethod[];
  metadata?: Record<string, any>;
}

// ============= GRAPH SCOPE =============

export type GraphScope = 'note' | 'folder' | 'vault';

export interface ScopeIdentifier {
  scope: GraphScope;
  id: string;
}

// ============= GRAPHOLOGY TYPES =============

export interface EntityNodeAttributes extends Attributes {
  label: string;
  kind: string;
  subtype?: string;
  frequency: number;
  noteIds: string[];
  degreeCentrality?: number;
  betweennessCentrality?: number;
  closenessCentrality?: number;
  communityId?: string;
  size?: number;
  color?: string;
}

export interface RelationshipEdgeAttributes extends Attributes {
  type: string;
  weight: number;
  noteIds: string[];
  confidence?: number;
  pmi?: number;
  width?: number;
  color?: string;
}

// ============= CYTOSCAPE EXPORT =============

export interface CytoscapeGraph {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

export interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    type: string;
    size: number;
    color: string;
    frequency?: number;
    centrality?: number;
    [key: string]: any;
  };
}

export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label?: string;
    weight: number;
    width: number;
    color?: string;
    [key: string]: any;
  };
}

// ============= ANALYTICS RESULTS =============

export interface CentralityScores {
  degree: number;
  betweenness: number;
  closeness: number;
}

export interface GraphStatistics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
}

export interface AnalyticsResults {
  centrality: Record<string, CentralityScores>;
  communities: Record<string, string>;
  statistics: GraphStatistics;
}
