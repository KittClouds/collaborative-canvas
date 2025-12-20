import { UnifiedGraph } from './UnifiedGraph';
import type { GraphExport } from './types';

let graphInstance: UnifiedGraph | null = null;

export function getGraph(): UnifiedGraph {
  if (!graphInstance) {
    graphInstance = new UnifiedGraph();
  }
  return graphInstance;
}

export function resetGraph(): void {
  if (graphInstance) {
    graphInstance.destroy();
    graphInstance = null;
  }
}

export function initializeGraph(data?: GraphExport): UnifiedGraph {
  const graph = getGraph();
  if (data) {
    graph.fromJSON(data);
  }
  return graph;
}

export function hasGraphInstance(): boolean {
  return graphInstance !== null;
}
