import { getGraph } from '@/lib/graph/graphInstance';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, UnifiedEdge, NodeId } from '@/lib/graph/types';

export interface TraversalResult {
  nodes: UnifiedNode[];
  edges: UnifiedEdge[];
  order: NodeId[];
}

export interface PathResult {
  path: UnifiedNode[];
  edges: UnifiedEdge[];
  distance: number;
}

export interface TraversalOptions {
  maxDepth?: number;
  directed?: boolean;
  nodeFilter?: (node: UnifiedNode) => boolean;
  edgeFilter?: (edge: UnifiedEdge) => boolean;
}

export class TraversalQueries {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  bfs(startId: NodeId, options: TraversalOptions = {}): TraversalResult {
    const cy = this.graph.getInstance();
    const visited = new Set<NodeId>();
    const order: NodeId[] = [];
    const nodes: UnifiedNode[] = [];
    const edges: UnifiedEdge[] = [];
    const queue: Array<{ id: NodeId; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift()!;

      if (visited.has(currentId)) continue;
      if (options.maxDepth !== undefined && depth > options.maxDepth) continue;

      visited.add(currentId);
      order.push(currentId);

      const node = this.graph.getNode(currentId);
      if (!node) continue;

      if (options.nodeFilter && !options.nodeFilter(node)) continue;

      nodes.push(node);

      const cyNode = cy.getElementById(currentId);
      const connectedEdges = options.directed
        ? cyNode.outgoers('edge')
        : cyNode.connectedEdges();

      connectedEdges.forEach((edge: any) => {
        const edgeData: UnifiedEdge = { group: 'edges', data: edge.data() };
        
        if (options.edgeFilter && !options.edgeFilter(edgeData)) return;

        const neighborId = edge.source().id() === currentId 
          ? edge.target().id() 
          : edge.source().id();

        if (!visited.has(neighborId)) {
          edges.push(edgeData);
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      });
    }

    return { nodes, edges, order };
  }

  dfs(startId: NodeId, options: TraversalOptions = {}): TraversalResult {
    const cy = this.graph.getInstance();
    const visited = new Set<NodeId>();
    const order: NodeId[] = [];
    const nodes: UnifiedNode[] = [];
    const edges: UnifiedEdge[] = [];

    const visit = (currentId: NodeId, depth: number) => {
      if (visited.has(currentId)) return;
      if (options.maxDepth !== undefined && depth > options.maxDepth) return;

      visited.add(currentId);
      order.push(currentId);

      const node = this.graph.getNode(currentId);
      if (!node) return;

      if (options.nodeFilter && !options.nodeFilter(node)) return;

      nodes.push(node);

      const cyNode = cy.getElementById(currentId);
      const connectedEdges = options.directed
        ? cyNode.outgoers('edge')
        : cyNode.connectedEdges();

      connectedEdges.forEach((edge: any) => {
        const edgeData: UnifiedEdge = { group: 'edges', data: edge.data() };
        
        if (options.edgeFilter && !options.edgeFilter(edgeData)) return;

        const neighborId = edge.source().id() === currentId 
          ? edge.target().id() 
          : edge.source().id();

        if (!visited.has(neighborId)) {
          edges.push(edgeData);
          visit(neighborId, depth + 1);
        }
      });
    };

    visit(startId, 0);

    return { nodes, edges, order };
  }

  shortestPath(
    startId: NodeId,
    endId: NodeId,
    options: TraversalOptions = {}
  ): PathResult | null {
    const cy = this.graph.getInstance();
    const distances = new Map<NodeId, number>();
    const predecessors = new Map<NodeId, { node: NodeId; edge: UnifiedEdge }>();
    const visited = new Set<NodeId>();

    distances.set(startId, 0);
    const queue: NodeId[] = [startId];

    while (queue.length > 0) {
      queue.sort((a, b) => (distances.get(a) || Infinity) - (distances.get(b) || Infinity));
      const currentId = queue.shift()!;

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      if (currentId === endId) break;

      const cyNode = cy.getElementById(currentId);
      const connectedEdges = options.directed
        ? cyNode.outgoers('edge')
        : cyNode.connectedEdges();

      connectedEdges.forEach((edge: any) => {
        const edgeData: UnifiedEdge = { group: 'edges', data: edge.data() };
        
        if (options.edgeFilter && !options.edgeFilter(edgeData)) return;

        const neighborId = edge.source().id() === currentId 
          ? edge.target().id() 
          : edge.source().id();

        if (visited.has(neighborId)) return;

        const weight = edge.data('weight') || 1;
        const newDist = (distances.get(currentId) || 0) + weight;

        if (newDist < (distances.get(neighborId) || Infinity)) {
          distances.set(neighborId, newDist);
          predecessors.set(neighborId, { node: currentId, edge: edgeData });
          queue.push(neighborId);
        }
      });
    }

    if (!distances.has(endId)) return null;

    const path: UnifiedNode[] = [];
    const edges: UnifiedEdge[] = [];
    let current: NodeId | undefined = endId;

    while (current) {
      const node = this.graph.getNode(current);
      if (node) path.unshift(node);

      const pred = predecessors.get(current);
      if (pred) {
        edges.unshift(pred.edge);
        current = pred.node;
      } else {
        break;
      }
    }

    return {
      path,
      edges,
      distance: distances.get(endId) || 0,
    };
  }

  allShortestPaths(startId: NodeId, options: TraversalOptions = {}): Map<NodeId, PathResult> {
    const results = new Map<NodeId, PathResult>();
    const cy = this.graph.getInstance();

    cy.nodes().forEach((node: any) => {
      const targetId = node.id();
      if (targetId === startId) return;

      const path = this.shortestPath(startId, targetId, options);
      if (path) {
        results.set(targetId, path);
      }
    });

    return results;
  }

  getConnectedComponents(): NodeId[][] {
    const cy = this.graph.getInstance();
    const visited = new Set<NodeId>();
    const components: NodeId[][] = [];

    cy.nodes().forEach((node: any) => {
      const nodeId = node.id();
      if (visited.has(nodeId)) return;

      const component: NodeId[] = [];
      const queue = [nodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;

        visited.add(current);
        component.push(current);

        cy.getElementById(current).neighborhood('node').forEach((neighbor: any) => {
          if (!visited.has(neighbor.id())) {
            queue.push(neighbor.id());
          }
        });
      }

      components.push(component);
    });

    return components;
  }

  isConnected(nodeId1: NodeId, nodeId2: NodeId): boolean {
    const path = this.shortestPath(nodeId1, nodeId2, { directed: false });
    return path !== null;
  }

  getNeighborsAtDistance(nodeId: NodeId, distance: number): UnifiedNode[] {
    const result = this.bfs(nodeId, { maxDepth: distance });
    
    return result.nodes.filter(node => {
      const path = this.shortestPath(nodeId, node.data.id, { directed: false });
      return path && path.distance === distance;
    });
  }

  getReachableNodes(startId: NodeId, maxDistance?: number): UnifiedNode[] {
    const result = this.bfs(startId, { maxDepth: maxDistance });
    return result.nodes;
  }

  findCycles(maxLength: number = 10): NodeId[][] {
    const cy = this.graph.getInstance();
    const cycles: NodeId[][] = [];
    const visited = new Set<string>();

    cy.nodes().forEach((startNode: any) => {
      const startId = startNode.id();
      
      const findCyclesFromNode = (
        currentId: NodeId,
        path: NodeId[],
        depth: number
      ) => {
        if (depth > maxLength) return;

        const cyNode = cy.getElementById(currentId);
        cyNode.outgoers('edge').forEach((edge: any) => {
          const neighborId = edge.target().id();

          if (neighborId === startId && path.length >= 2) {
            const cyclePath = [...path, startId];
            const cycleKey = [...cyclePath].sort().join('-');
            
            if (!visited.has(cycleKey)) {
              visited.add(cycleKey);
              cycles.push(cyclePath);
            }
          } else if (!path.includes(neighborId)) {
            findCyclesFromNode(neighborId, [...path, neighborId], depth + 1);
          }
        });
      };

      findCyclesFromNode(startId, [startId], 0);
    });

    return cycles;
  }

  getEccentricity(nodeId: NodeId): number {
    const paths = this.allShortestPaths(nodeId, { directed: false });
    let maxDistance = 0;

    paths.forEach(path => {
      maxDistance = Math.max(maxDistance, path.distance);
    });

    return maxDistance;
  }

  getGraphDiameter(): number {
    const cy = this.graph.getInstance();
    let diameter = 0;

    cy.nodes().forEach((node: any) => {
      const eccentricity = this.getEccentricity(node.id());
      diameter = Math.max(diameter, eccentricity);
    });

    return diameter;
  }

  getGraphRadius(): number {
    const cy = this.graph.getInstance();
    let radius = Infinity;

    cy.nodes().forEach((node: any) => {
      const eccentricity = this.getEccentricity(node.id());
      radius = Math.min(radius, eccentricity);
    });

    return radius === Infinity ? 0 : radius;
  }
}

let traversalQueries: TraversalQueries | null = null;

export function getTraversalQueries(): TraversalQueries {
  if (!traversalQueries) {
    traversalQueries = new TraversalQueries();
  }
  return traversalQueries;
}
