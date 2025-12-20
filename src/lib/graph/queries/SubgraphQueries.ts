import { getGraph } from '@/lib/graph/graphInstance';
import { getTraversalQueries } from './TraversalQueries';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, UnifiedEdge, NodeId, EdgeType } from '@/lib/graph/types';

export interface SubgraphResult {
  nodes: UnifiedNode[];
  edges: UnifiedEdge[];
  nodeCount: number;
  edgeCount: number;
}

export interface EgoNetworkOptions {
  radius?: number;
  includeEdgesBetweenNeighbors?: boolean;
  edgeTypes?: EdgeType[];
}

export class SubgraphQueries {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  getEgoNetwork(centerId: NodeId, options: EgoNetworkOptions = {}): SubgraphResult {
    const radius = options.radius || 1;
    const cy = this.graph.getInstance();
    const traversal = getTraversalQueries();

    const traversalResult = traversal.bfs(centerId, { maxDepth: radius });
    const nodeIds = new Set(traversalResult.nodes.map(n => n.data.id));

    let edges: UnifiedEdge[] = [];

    if (options.includeEdgesBetweenNeighbors) {
      cy.edges().forEach((edge: any) => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();

        if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
          if (!options.edgeTypes || options.edgeTypes.includes(edge.data('type'))) {
            edges.push({ group: 'edges', data: edge.data() });
          }
        }
      });
    } else {
      edges = traversalResult.edges.filter(
        e => !options.edgeTypes || options.edgeTypes.includes(e.data.type)
      );
    }

    return {
      nodes: traversalResult.nodes,
      edges,
      nodeCount: traversalResult.nodes.length,
      edgeCount: edges.length,
    };
  }

  getInducedSubgraph(nodeIds: NodeId[]): SubgraphResult {
    const cy = this.graph.getInstance();
    const nodeIdSet = new Set(nodeIds);
    
    const nodes: UnifiedNode[] = nodeIds
      .map(id => this.graph.getNode(id))
      .filter((n): n is UnifiedNode => n !== null);

    const edges: UnifiedEdge[] = [];

    cy.edges().forEach((edge: any) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();

      if (nodeIdSet.has(sourceId) && nodeIdSet.has(targetId)) {
        edges.push({ group: 'edges', data: edge.data() });
      }
    });

    return {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  }

  getSpanningTree(rootId: NodeId): SubgraphResult {
    const traversal = getTraversalQueries();
    const result = traversal.bfs(rootId);

    return {
      nodes: result.nodes,
      edges: result.edges,
      nodeCount: result.nodes.length,
      edgeCount: result.edges.length,
    };
  }

  getConnectedSubgraph(nodeId: NodeId): SubgraphResult {
    const traversal = getTraversalQueries();
    const result = traversal.bfs(nodeId);

    const cy = this.graph.getInstance();
    const nodeIds = new Set(result.nodes.map(n => n.data.id));
    const edges: UnifiedEdge[] = [];

    cy.edges().forEach((edge: any) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();

      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
        edges.push({ group: 'edges', data: edge.data() });
      }
    });

    return {
      nodes: result.nodes,
      edges,
      nodeCount: result.nodes.length,
      edgeCount: edges.length,
    };
  }

  getSubgraphByEdgeType(edgeTypes: EdgeType[]): SubgraphResult {
    const cy = this.graph.getInstance();
    const nodeIds = new Set<NodeId>();
    const edges: UnifiedEdge[] = [];

    cy.edges().forEach((edge: any) => {
      if (edgeTypes.includes(edge.data('type'))) {
        nodeIds.add(edge.source().id());
        nodeIds.add(edge.target().id());
        edges.push({ group: 'edges', data: edge.data() });
      }
    });

    const nodes: UnifiedNode[] = Array.from(nodeIds)
      .map(id => this.graph.getNode(id))
      .filter((n): n is UnifiedNode => n !== null);

    return {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  }

  getSubgraphByNodeType(nodeTypes: string[]): SubgraphResult {
    const cy = this.graph.getInstance();
    const nodeTypeSet = new Set(nodeTypes);

    const nodes: UnifiedNode[] = cy.nodes()
      .filter((n: any) => nodeTypeSet.has(n.data('type')))
      .map((n: any) => ({ group: 'nodes', data: n.data() } as UnifiedNode))
      .toArray();

    const nodeIds = new Set(nodes.map(n => n.data.id));
    const edges: UnifiedEdge[] = [];

    cy.edges().forEach((edge: any) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();

      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
        edges.push({ group: 'edges', data: edge.data() });
      }
    });

    return {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  }

  getBridgeNodes(): UnifiedNode[] {
    const cy = this.graph.getInstance();
    const bridges: UnifiedNode[] = [];
    const traversal = getTraversalQueries();

    const originalComponents = traversal.getConnectedComponents();

    cy.nodes().forEach((node: any) => {
      const nodeId = node.id();
      
      const tempRemoved = node.remove();
      const newComponents = traversal.getConnectedComponents();
      
      tempRemoved.restore();

      if (newComponents.length > originalComponents.length) {
        bridges.push({ group: 'nodes', data: node.data() });
      }
    });

    return bridges;
  }

  getLeafNodes(): UnifiedNode[] {
    const cy = this.graph.getInstance();

    return cy.nodes()
      .filter((n: any) => n.degree() === 1)
      .map((n: any) => ({ group: 'nodes', data: n.data() } as UnifiedNode))
      .toArray();
  }

  getIsolatedNodes(): UnifiedNode[] {
    const cy = this.graph.getInstance();

    return cy.nodes()
      .filter((n: any) => n.degree() === 0)
      .map((n: any) => ({ group: 'nodes', data: n.data() } as UnifiedNode))
      .toArray();
  }

  cloneSubgraph(subgraph: SubgraphResult): SubgraphResult {
    return {
      nodes: subgraph.nodes.map(n => ({ ...n, data: { ...n.data } })),
      edges: subgraph.edges.map(e => ({ ...e, data: { ...e.data } })),
      nodeCount: subgraph.nodeCount,
      edgeCount: subgraph.edgeCount,
    };
  }

  getSubgraphStats(subgraph: SubgraphResult): {
    density: number;
    avgDegree: number;
    maxDegree: number;
    minDegree: number;
  } {
    const n = subgraph.nodeCount;
    const m = subgraph.edgeCount;

    if (n === 0) {
      return { density: 0, avgDegree: 0, maxDegree: 0, minDegree: 0 };
    }

    const maxPossibleEdges = (n * (n - 1)) / 2;
    const density = maxPossibleEdges > 0 ? m / maxPossibleEdges : 0;

    const degreeMap = new Map<NodeId, number>();
    subgraph.nodes.forEach(n => degreeMap.set(n.data.id, 0));

    subgraph.edges.forEach(e => {
      degreeMap.set(e.data.source, (degreeMap.get(e.data.source) || 0) + 1);
      degreeMap.set(e.data.target, (degreeMap.get(e.data.target) || 0) + 1);
    });

    const degrees = Array.from(degreeMap.values());
    const avgDegree = degrees.reduce((a, b) => a + b, 0) / n;
    const maxDegree = Math.max(...degrees);
    const minDegree = Math.min(...degrees);

    return { density, avgDegree, maxDegree, minDegree };
  }
}

let subgraphQueries: SubgraphQueries | null = null;

export function getSubgraphQueries(): SubgraphQueries {
  if (!subgraphQueries) {
    subgraphQueries = new SubgraphQueries();
  }
  return subgraphQueries;
}
