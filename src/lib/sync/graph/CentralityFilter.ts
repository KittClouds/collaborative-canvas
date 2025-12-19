import type { GraphNode, GraphEdge, GraphNodeType, CentralityConfig } from '../types';
import { DEFAULT_CENTRALITY_CONFIG } from '../types';

export class CentralityFilter {
  private config: CentralityConfig = { ...DEFAULT_CENTRALITY_CONFIG };

  setConfig(config: Partial<CentralityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CentralityConfig {
    return { ...this.config };
  }

  getDefaultThreshold(): number {
    return DEFAULT_CENTRALITY_CONFIG.confidenceThreshold;
  }

  setThreshold(threshold: number): void {
    this.config.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  filterHighConfidenceSubgraph(
    nodes: GraphNode[],
    edges: GraphEdge[],
    threshold?: number
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const effectiveThreshold = threshold ?? this.config.confidenceThreshold;

    const filteredNodes = nodes.filter(node => {
      if (node.confidence < effectiveThreshold) return false;

      if (!this.config.includeExtractedEntities && node.nodeType === 'extracted_entity') {
        return false;
      }

      if (!this.config.includeConcepts && node.nodeType === 'concept') {
        return false;
      }

      return true;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));

    const filteredEdges = edges.filter(edge => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        return false;
      }

      if (edge.confidence < effectiveThreshold) {
        return false;
      }

      if (this.config.minEdgeWeight > 0 && edge.weight < this.config.minEdgeWeight) {
        return false;
      }

      return true;
    });

    return { nodes: filteredNodes, edges: filteredEdges };
  }

  filterByNodeType(
    nodes: GraphNode[],
    edges: GraphEdge[],
    types: GraphNodeType[]
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const typeSet = new Set(types);
    const filteredNodes = nodes.filter(n => typeSet.has(n.nodeType));
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    return { nodes: filteredNodes, edges: filteredEdges };
  }

  filterCanonicalOnly(
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const filteredNodes = nodes.filter(n => n.isCanonical === true);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    return { nodes: filteredNodes, edges: filteredEdges };
  }

  getConnectedSubgraph(
    nodes: GraphNode[],
    edges: GraphEdge[],
    seedNodeId: string,
    maxDepth: number = 2
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjacency = new Map<string, Set<string>>();

    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    }

    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: seedNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      if (depth < maxDepth) {
        const neighbors = adjacency.get(id) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push({ id: neighbor, depth: depth + 1 });
          }
        }
      }
    }

    const resultNodes = nodes.filter(n => visited.has(n.id));
    const resultEdges = edges.filter(e => visited.has(e.source) && visited.has(e.target));

    return { nodes: resultNodes, edges: resultEdges };
  }
}

export const centralityFilter = new CentralityFilter();
