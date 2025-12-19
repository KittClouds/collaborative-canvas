import type { SyncEdge, GraphEdge, EdgeSourceType, EDGE_CONFIDENCE_WEIGHTS } from '../types';
import { EDGE_CONFIDENCE_WEIGHTS as WEIGHTS } from '../types';

const EDGE_TYPE_TO_SOURCE: Record<string, EdgeSourceType> = {
  WIKILINK: 'wikilink',
  MENTIONS: 'wikilink',
  CO_OCCURRENCE: 'cooccurrence',
  COOCCURRENCE: 'cooccurrence',
  co_occurrence: 'cooccurrence',
  RELATED_TO: 'semantic',
  SIMILAR_TO: 'semantic',
  MEMBER_OF: 'blueprint_relation',
  BELONGS_TO: 'blueprint_relation',
  LOCATED_IN: 'blueprint_relation',
  PARTICIPATES_IN: 'blueprint_relation',
  APPEARS_IN: 'blueprint_relation',
  TEMPORAL: 'temporal',
  BEFORE: 'temporal',
  AFTER: 'temporal',
  DURING: 'temporal',
  SPATIAL: 'spatial',
  NEAR: 'spatial',
  CONTAINS: 'spatial',
  LLM_EXTRACTED: 'llm_extraction',
  NER_COOCCURRENCE: 'ner_cooccurrence',
};

export class EdgeWeighter {
  classifyEdgeSource(edge: SyncEdge): EdgeSourceType {
    const mapped = EDGE_TYPE_TO_SOURCE[edge.edgeType.toUpperCase()];
    if (mapped) return mapped;

    if (edge.edgeType.toLowerCase().includes('wiki')) return 'wikilink';
    if (edge.edgeType.toLowerCase().includes('occur')) return 'cooccurrence';
    if (edge.edgeType.toLowerCase().includes('llm')) return 'llm_extraction';
    if (edge.edgeType.toLowerCase().includes('ner')) return 'ner_cooccurrence';
    if (edge.edgeType.toLowerCase().includes('time') || edge.edgeType.toLowerCase().includes('temporal')) return 'temporal';
    if (edge.edgeType.toLowerCase().includes('space') || edge.edgeType.toLowerCase().includes('spatial')) return 'spatial';

    return 'cooccurrence';
  }

  calculateEdgeConfidence(edge: SyncEdge): number {
    if (edge.confidence !== undefined && edge.confidence > 0) {
      return edge.confidence;
    }

    const edgeSource = this.classifyEdgeSource(edge);
    const baseConfidence = WEIGHTS[edgeSource] ?? 0.5;

    const weightBonus = Math.min(edge.weight / 10, 0.1);

    return Math.min(1, baseConfidence + weightBonus);
  }

  calculateVisualWeight(edge: SyncEdge, confidence: number): number {
    const baseWidth = 1;
    const maxWidth = 6;

    const weightFactor = Math.log(edge.weight + 1);
    const confidenceFactor = confidence;

    return Math.min(maxWidth, baseWidth + weightFactor * confidenceFactor * 2);
  }

  isHighConfidence(confidence: number, threshold: number): boolean {
    return confidence >= threshold;
  }

  toGraphEdge(edge: SyncEdge, threshold: number = 0.5): GraphEdge {
    const edgeSource = this.classifyEdgeSource(edge);
    const confidence = this.calculateEdgeConfidence(edge);
    const width = this.calculateVisualWeight(edge, confidence);

    return {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: edge.edgeType,
      weight: edge.weight,
      width,
      edgeSource,
      confidence,
      isHighConfidence: this.isHighConfidence(confidence, threshold),
    };
  }

  processEdges(edges: SyncEdge[], threshold: number = 0.5): GraphEdge[] {
    return edges.map(edge => this.toGraphEdge(edge, threshold));
  }

  filterHighConfidenceEdges(edges: GraphEdge[]): GraphEdge[] {
    return edges.filter(e => e.isHighConfidence);
  }

  getEdgesBySource(edges: GraphEdge[], source: EdgeSourceType): GraphEdge[] {
    return edges.filter(e => e.edgeSource === source);
  }
}

export const edgeWeighter = new EdgeWeighter();
