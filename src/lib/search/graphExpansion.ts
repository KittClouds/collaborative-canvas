// import { getGraph } from '@/lib/graph/graphInstance';
// import { getTraversalQueries } from '@/lib/graph/queries/TraversalQueries';
import type { VectorSearchResult } from './vectorSearch';

export interface GraphExpansionOptions {
  maxHops: number;
  maxExpanded: number;
  minCooccurrence: number;
}

export interface ExpandedResult extends VectorSearchResult {
  expansionReason?: string;
  graphDistance?: number;
  connectedEntities?: string[];
}

export async function expandResultsViaGraph(
  vectorResults: VectorSearchResult[],
  options: GraphExpansionOptions
): Promise<ExpandedResult[]> {
  console.warn('expandResultsViaGraph: UnifiedGraph is removed. This is a stub.');
  return vectorResults.map(r => ({ ...r, graphDistance: 0 }));
}
