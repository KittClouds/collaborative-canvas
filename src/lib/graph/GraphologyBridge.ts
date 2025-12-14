import Graph from 'graphology';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';
import type { 
  GraphEntity, 
  GraphRelationship, 
  EntityNodeAttributes, 
  RelationshipEdgeAttributes,
  AnalyticsResults,
  CentralityScores,
  GraphStatistics,
  CytoscapeGraph,
  CytoscapeNode,
  CytoscapeEdge
} from './types';

/**
 * Bridge between domain objects and Graphology library
 * Provides graph construction, analytics, and export functionality
 */
export class GraphologyBridge {
  /**
   * Build graphology graph from domain objects
   */
  static buildGraph(
    entities: GraphEntity[],
    relationships: GraphRelationship[]
  ): Graph<EntityNodeAttributes, RelationshipEdgeAttributes> {
    const g = new Graph<EntityNodeAttributes, RelationshipEdgeAttributes>({
      type: 'undirected',
      multi: false
    });

    // Add nodes
    entities.forEach(entity => {
      const color = ENTITY_COLORS[entity.kind as keyof typeof ENTITY_COLORS] || '#6b7280';
      const size = Math.min(10 + Math.log(entity.frequency + 1) * 5, 30);

      g.addNode(entity.id, {
        label: entity.label,
        kind: entity.kind,
        subtype: entity.subtype,
        frequency: entity.frequency,
        noteIds: entity.noteIds,
        size,
        color
      });
    });

    // Add edges
    relationships.forEach(rel => {
      if (g.hasNode(rel.sourceId) && g.hasNode(rel.targetId)) {
        try {
          g.addEdge(rel.sourceId, rel.targetId, {
            type: rel.type,
            weight: rel.weight,
            noteIds: rel.noteIds,
            confidence: rel.confidence,
            pmi: rel.metadata?.pmi,
            width: Math.min(1 + Math.log(rel.weight + 1), 5)
          });
        } catch (e) {
          // Edge might already exist in undirected graph
          console.debug('Edge already exists:', rel.id);
        }
      }
    });

    return g;
  }

  /**
   * Compute all analytics (centrality + communities)
   */
  static computeAnalytics(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>
  ): AnalyticsResults {
    const nodeCount = g.order;
    const edgeCount = g.size;

    // Handle empty or single-node graphs
    if (nodeCount === 0) {
      return {
        centrality: {},
        communities: {},
        statistics: {
          nodeCount: 0,
          edgeCount: 0,
          density: 0,
          averageDegree: 0
        }
      };
    }

    // Compute degree centrality manually (simple and always available)
    const degreeCentrality: Record<string, number> = {};
    const maxDegree = Math.max(1, nodeCount - 1);
    
    g.forEachNode(nodeId => {
      const degree = g.degree(nodeId);
      degreeCentrality[nodeId] = degree / maxDegree;
    });

    // Compute betweenness centrality (simplified approximation for performance)
    const betweennessCentrality = this.computeBetweennessCentrality(g);

    // Compute closeness centrality (simplified)
    const closenessCentrality = this.computeClosenessCentrality(g);

    // Community detection using label propagation (simple algorithm)
    const communities = this.detectCommunities(g);

    // Build centrality results
    const centralityResults: Record<string, CentralityScores> = {};
    g.forEachNode(nodeId => {
      centralityResults[nodeId] = {
        degree: degreeCentrality[nodeId] || 0,
        betweenness: betweennessCentrality[nodeId] || 0,
        closeness: closenessCentrality[nodeId] || 0
      };
    });

    // Graph statistics
    const density = nodeCount > 1 
      ? (2 * edgeCount) / (nodeCount * (nodeCount - 1))
      : 0;
    
    const stats: GraphStatistics = {
      nodeCount,
      edgeCount,
      density,
      averageDegree: nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0
    };

    return {
      centrality: centralityResults,
      communities,
      statistics: stats
    };
  }

  /**
   * Simple betweenness centrality approximation
   */
  private static computeBetweennessCentrality(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>
  ): Record<string, number> {
    const centrality: Record<string, number> = {};
    g.forEachNode(nodeId => centrality[nodeId] = 0);

    // For each pair of nodes, find shortest path and count intermediaries
    const nodes = g.nodes();
    
    // Only compute for small graphs (O(n^3) complexity)
    if (nodes.length > 100) {
      // Return degree-based approximation for large graphs
      g.forEachNode(nodeId => {
        centrality[nodeId] = g.degree(nodeId) / Math.max(1, nodes.length - 1);
      });
      return centrality;
    }

    for (const source of nodes) {
      const { distances, predecessors } = this.bfs(g, source);
      
      for (const target of nodes) {
        if (source === target) continue;
        
        // Backtrack from target to source
        let current = target;
        while (predecessors[current] && predecessors[current] !== source) {
          centrality[predecessors[current]]++;
          current = predecessors[current];
        }
      }
    }

    // Normalize
    const n = nodes.length;
    const normFactor = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;
    
    for (const nodeId of nodes) {
      centrality[nodeId] = centrality[nodeId] / normFactor;
    }

    return centrality;
  }

  /**
   * Simple closeness centrality
   */
  private static computeClosenessCentrality(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>
  ): Record<string, number> {
    const centrality: Record<string, number> = {};
    const nodes = g.nodes();
    const n = nodes.length;

    for (const nodeId of nodes) {
      const { distances } = this.bfs(g, nodeId);
      
      let totalDistance = 0;
      let reachable = 0;
      
      for (const targetId of nodes) {
        if (distances[targetId] !== Infinity && distances[targetId] > 0) {
          totalDistance += distances[targetId];
          reachable++;
        }
      }

      // Closeness = (n-1) / sum of distances
      centrality[nodeId] = reachable > 0 
        ? (reachable / (n - 1)) * (reachable / totalDistance)
        : 0;
    }

    return centrality;
  }

  /**
   * BFS for shortest paths
   */
  private static bfs(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>,
    source: string
  ): { distances: Record<string, number>; predecessors: Record<string, string> } {
    const distances: Record<string, number> = {};
    const predecessors: Record<string, string> = {};
    
    g.forEachNode(nodeId => {
      distances[nodeId] = Infinity;
    });
    
    distances[source] = 0;
    const queue = [source];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      g.forEachNeighbor(current, neighbor => {
        if (distances[neighbor] === Infinity) {
          distances[neighbor] = distances[current] + 1;
          predecessors[neighbor] = current;
          queue.push(neighbor);
        }
      });
    }
    
    return { distances, predecessors };
  }

  /**
   * Simple community detection using connected components and modularity
   */
  private static detectCommunities(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>
  ): Record<string, string> {
    const communities: Record<string, string> = {};
    const visited = new Set<string>();
    let communityId = 0;

    g.forEachNode(nodeId => {
      if (visited.has(nodeId)) return;

      // BFS to find connected component
      const queue = [nodeId];
      const currentCommunity = `community_${communityId}`;
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        
        visited.add(current);
        communities[current] = currentCommunity;
        
        g.forEachNeighbor(current, neighbor => {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }
      
      communityId++;
    });

    return communities;
  }

  /**
   * Apply analytics results back to entities (for storage/export)
   */
  static enrichEntities(
    entities: GraphEntity[],
    analytics: AnalyticsResults
  ): void {
    entities.forEach(entity => {
      const scores = analytics.centrality[entity.id];
      const communityId = analytics.communities[entity.id];

      if (scores) {
        entity.attributes.degreeCentrality = scores.degree;
        entity.attributes.betweennessCentrality = scores.betweenness;
        entity.attributes.closenessCentrality = scores.closeness;
      }

      if (communityId) {
        entity.attributes.communityId = communityId;
      }
    });
  }

  /**
   * Filter graph by minimum frequency
   */
  static filterByFrequency(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>,
    minFrequency: number
  ): Graph<EntityNodeAttributes, RelationshipEdgeAttributes> {
    const filtered = g.copy();
    const toRemove: string[] = [];

    filtered.forEachNode((node, attrs) => {
      if (attrs.frequency < minFrequency) {
        toRemove.push(node);
      }
    });

    toRemove.forEach(node => filtered.dropNode(node));
    return filtered;
  }

  /**
   * Extract ego network (k-hop neighborhood of focal entity)
   */
  static getEgoNetwork(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>,
    entityId: string,
    depth: number = 1
  ): Graph<EntityNodeAttributes, RelationshipEdgeAttributes> {
    const ego = new Graph<EntityNodeAttributes, RelationshipEdgeAttributes>({
      type: 'undirected',
      multi: false
    });

    if (!g.hasNode(entityId)) return ego;

    // BFS to find all nodes within depth hops
    const visited = new Set<string>([entityId]);
    const queue: Array<{ id: string; dist: number }> = [{ id: entityId, dist: 0 }];

    while (queue.length > 0) {
      const { id: currentId, dist } = queue.shift()!;

      // Add node to ego graph
      if (!ego.hasNode(currentId)) {
        ego.addNode(currentId, g.getNodeAttributes(currentId));
      }

      if (dist < depth) {
        g.forEachNeighbor(currentId, neighborId => {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push({ id: neighborId, dist: dist + 1 });
          }
        });
      }
    }

    // Add edges between nodes in ego graph
    ego.forEachNode(nodeA => {
      g.forEachNeighbor(nodeA, nodeB => {
        if (ego.hasNode(nodeB) && !ego.hasEdge(nodeA, nodeB)) {
          const edgeKey = g.edge(nodeA, nodeB);
          if (edgeKey) {
            try {
              ego.addEdge(nodeA, nodeB, g.getEdgeAttributes(edgeKey));
            } catch {
              // Edge might already exist
            }
          }
        }
      });
    });

    return ego;
  }

  /**
   * Export graph to Cytoscape format for visualization
   */
  static toCytoscape(
    g: Graph<EntityNodeAttributes, RelationshipEdgeAttributes>
  ): CytoscapeGraph {
    const nodes: CytoscapeNode[] = [];
    const edges: CytoscapeEdge[] = [];

    g.forEachNode((nodeId, attrs) => {
      nodes.push({
        data: {
          id: nodeId,
          label: attrs.label,
          type: attrs.kind,
          size: attrs.size || 10,
          color: attrs.color || '#6b7280',
          frequency: attrs.frequency,
          centrality: attrs.degreeCentrality
        }
      });
    });

    g.forEachEdge((edgeId, attrs, source, target) => {
      edges.push({
        data: {
          id: edgeId,
          source,
          target,
          label: attrs.type,
          weight: attrs.weight,
          width: attrs.width || 1,
          color: attrs.color
        }
      });
    });

    return { nodes, edges };
  }

  /**
   * Get top entities by centrality score
   */
  static getTopEntities(
    entities: GraphEntity[],
    analytics: AnalyticsResults,
    metric: 'degree' | 'betweenness' | 'closeness' = 'degree',
    limit: number = 10
  ): GraphEntity[] {
    return [...entities]
      .sort((a, b) => {
        const scoreA = analytics.centrality[a.id]?.[metric] ?? 0;
        const scoreB = analytics.centrality[b.id]?.[metric] ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }
}
