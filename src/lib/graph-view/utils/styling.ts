import { ENTITY_COLORS, type EntityKind } from '@/lib/entities/entityTypes';
import type { GraphNodeType, GraphEdgeType, GraphNodeVisual, GraphEdgeVisual } from '../types';

const DEFAULT_NODE_COLOR = '#6b7280';
const DEFAULT_FOLDER_COLOR = '#6366f1';
const DEFAULT_NOTE_COLOR = '#8b5cf6';
const DEFAULT_CONCEPT_COLOR = '#06b6d4';
const DEFAULT_BLUEPRINT_COLOR = '#a855f7';

const EDGE_COLORS: Record<GraphEdgeType, string> = {
  backlink: '#94a3b8',
  wikilink: '#60a5fa',
  contains: '#d1d5db',
  relationship: '#f59e0b',
  cooccurrence: '#10b981',
};

export function getNodeColor(entityKind?: string, nodeType?: GraphNodeType): string {
  if (entityKind && entityKind in ENTITY_COLORS) {
    return ENTITY_COLORS[entityKind as EntityKind];
  }

  switch (nodeType) {
    case 'folder':
      return DEFAULT_FOLDER_COLOR;
    case 'note':
      return DEFAULT_NOTE_COLOR;
    case 'concept':
      return DEFAULT_CONCEPT_COLOR;
    case 'blueprint':
      return DEFAULT_BLUEPRINT_COLOR;
    case 'entity':
      return DEFAULT_NODE_COLOR;
    default:
      return DEFAULT_NODE_COLOR;
  }
}

export function getNodeSize(frequency: number = 1, centrality?: number): number {
  const baseSize = 8;
  const frequencyContribution = Math.log(frequency + 1) * 4;
  const centralityContribution = centrality ? centrality * 10 : 0;
  return Math.min(baseSize + frequencyContribution + centralityContribution, 40);
}

export function getNodeShape(
  nodeType: GraphNodeType,
  source?: string
): 'circle' | 'square' | 'diamond' | 'triangle' {
  switch (nodeType) {
    case 'folder':
      return 'square';
    case 'blueprint':
      return 'diamond';
    case 'concept':
      return 'triangle';
    case 'note':
    case 'entity':
    default:
      return 'circle';
  }
}

export function getNodeOpacity(confidence: number = 1.0): number {
  return Math.max(0.4, Math.min(1.0, confidence));
}

export function getEdgeColor(edgeType: GraphEdgeType): string {
  return EDGE_COLORS[edgeType] || '#94a3b8';
}

export function getEdgeWidth(weight: number = 1): number {
  return Math.min(1 + Math.log(weight + 1) * 0.8, 6);
}

export function buildNodeVisual(
  nodeType: GraphNodeType,
  entityKind?: string,
  frequency?: number,
  centrality?: number,
  confidence?: number
): GraphNodeVisual {
  return {
    color: getNodeColor(entityKind, nodeType),
    size: getNodeSize(frequency, centrality),
    shape: getNodeShape(nodeType),
    opacity: getNodeOpacity(confidence),
  };
}

export function buildEdgeVisual(
  edgeType: GraphEdgeType,
  weight?: number,
  confidence?: number
): GraphEdgeVisual {
  return {
    color: getEdgeColor(edgeType),
    width: getEdgeWidth(weight),
    opacity: confidence !== undefined ? getNodeOpacity(confidence) : 1.0,
    dashed: edgeType === 'cooccurrence',
  };
}
