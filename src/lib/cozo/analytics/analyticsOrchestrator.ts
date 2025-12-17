import { calculateDegreeCentrality, countTriangles } from './nativeMetrics';
import { computeCentralityMetrics } from './centralityMetrics';
import { detectCommunities } from './communityDetection';

export interface AnalyticsPipelineOptions {
  groupId: string;
  runDegree?: boolean;
  runTriangles?: boolean;
  runCentrality?: boolean;
  centralityMetrics?: ('betweenness' | 'closeness' | 'pagerank')[];
  runCommunities?: boolean;
}

export interface AnalyticsPipelineResult {
  groupId: string;
  timestamp: Date;
  metrics: {
    degree?: boolean;
    triangles?: boolean;
    centrality?: boolean;
    communities?: boolean;
  };
  stats?: {
    nodesProcessed?: number;
    communitiesFound?: number;
    modularity?: number;
  };
}

export async function runAnalyticsPipeline(
  options: AnalyticsPipelineOptions
): Promise<AnalyticsPipelineResult> {
  console.log(`Starting analytics pipeline for group ${options.groupId}`);
  const result: AnalyticsPipelineResult = {
    groupId: options.groupId,
    timestamp: new Date(),
    metrics: {},
    stats: {}
  };

  // 1. Native Metrics
  if (options.runDegree !== false) { // default true
    console.log('Calculating degree centrality...');
    await calculateDegreeCentrality({ groupId: options.groupId });
    result.metrics.degree = true;
  }

  if (options.runTriangles) {
    console.log('Counting triangles...');
    await countTriangles({ groupId: options.groupId });
    result.metrics.triangles = true;
  }

  // 2. Graphology Metrics
  if (options.runCentrality) {
    console.log('Computing centrality metrics...');
    await computeCentralityMetrics({
      groupId: options.groupId,
      metrics: options.centralityMetrics || ['betweenness', 'closeness']
    });
    result.metrics.centrality = true;
  }

  // 3. Community Detection
  if (options.runCommunities) {
    console.log('Detecting communities...');
    const commResult = await detectCommunities({ groupId: options.groupId });
    result.metrics.communities = true;
    result.stats!.communitiesFound = commResult.communities;
    result.stats!.modularity = commResult.modularity;
  }

  // Update Graph Stats (optional, but good practice)
  // We could update a 'graph_stats' table with 'computedAt'
  
  console.log('Analytics pipeline completed.');
  return result;
}
