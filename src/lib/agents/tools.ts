import { z } from 'zod';
import { tool } from 'ai';
import { search } from '@/lib/search/searchOrchestrator';
import { getEntityStore, getTemporalStore } from '@/lib/storage/index';
import { getGraph } from '@/lib/graph';

// 1. Vector Search Tool
export const searchVectorTool = tool({
  description: 'Search for notes using semantic vector search. Use this for concept-based or meaning-based queries.',
  parameters: z.object({
    query: z.string().describe('The search query string'),
    maxResults: z.number().optional().describe('Maximum number of results to return (default: 10)'),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const results = await search({
        query,
        maxResults: maxResults || 10,
        enableGraphExpansion: true,
      });

      return {
        success: true,
        results: results.results.map(r => ({
          title: r.noteTitle,
          snippet: r.snippet,
          score: r.score,
          noteId: r.noteId
        })),
        metadata: results.metadata
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
} as any);

// 2. Graph Search Tool (Neighbors)
export const searchGraphTool = tool({
  description: 'Find entities connected to a specific entity in the knowledge graph. Useful for finding related characters or concepts.',
  parameters: z.object({
    entityId: z.string().describe('The ID of the entity to explore'),
    maxHops: z.number().optional().describe('Maximum number of hops to traverse (default: 2)'),
    groupId: z.string().optional().describe('Scope/Group ID for the graph (default: "global")'),
  }),
  execute: async ({ entityId, maxHops }) => {
    try {
      const graph = getGraph();
      const neighborhood = graph.getNeighborhood(entityId, maxHops || 2);
      
      const neighbors = neighborhood.nodes.map(n => ({
        id: n.data.id,
        name: n.data.label,
        type: n.data.entityKind || n.data.type,
      }));
      
      return { success: true, neighbors, count: neighbors.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
} as any);

// 3. FTS (Full Text Search)
export const searchFtsTool = tool({
  description: 'Search for notes using exact keyword matching. Use this when looking for specific names or terms.',
  parameters: z.object({
    query: z.string().describe('The keyword(s) to search for'),
    maxResults: z.number().optional().describe('Maximum number of results (default: 10)'),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const results = await search({
        query,
        maxResults: maxResults || 10,
        enableGraphExpansion: false,
      });

      return {
        success: true,
        results: results.results.map(r => ({
          title: r.noteTitle,
          snippet: r.snippet,
          score: r.score,
          noteId: r.noteId
        }))
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
} as any);

// 4. Get Entity Details
export const getEntityTool = tool({
  description: 'Get detailed information about a specific entity, including its type and metadata.',
  parameters: z.object({
    name: z.string().describe('The name of the entity to look up'),
  }),
  execute: async ({ name }) => {
    try {
      const entityStore = getEntityStore();
      const entity = await entityStore.findEntityByNameOnly(name, 'global');

      if (!entity) {
        return { success: false, error: 'Entity not found' };
      }

      return {
        success: true,
        entity: {
          id: entity.id,
          name: entity.name,
          type: entity.entity_kind,
          metadata: entity.attributes
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
} as any);

// 5. Find Path
export const findPathTool = tool({
  description: 'Find the shortest path between two entities in the knowledge graph.',
  parameters: z.object({
    fromEntityId: z.string().describe('Starting entity ID'),
    toEntityId: z.string().describe('Target entity ID'),
    groupId: z.string().optional().describe('Scope/Group ID (default: "global")'),
  }),
  execute: async ({ fromEntityId, toEntityId }) => {
    try {
      const graph = getGraph();
      const pathResult = graph.findPath(fromEntityId, toEntityId);

      if (!pathResult) {
        return { success: false, error: 'No path found' };
      }

      const pathNodes = pathResult.path.map(nodeId => {
        const node = graph.getNode(nodeId);
        return {
          id: nodeId,
          name: node?.data.label || nodeId,
          type: node?.data.entityKind || node?.data.type,
        };
      });

      return { 
        success: true, 
        path: pathNodes,
        length: pathResult.length
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
} as any);

// 6. Get History
export const getHistoryTool = tool({
  description: 'Get the historical evolution of an entity over time based on graph snapshots.',
  parameters: z.object({
    entityId: z.string().describe('The entity ID to analyze'),
  }),
  execute: async ({ entityId }) => {
    try {
      const temporalStore = getTemporalStore();
      const history = await temporalStore.getEntityHistory(entityId);
      return { success: true, history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
} as any);

// 7. Analyze Communities
export const analyzeCommunitiesTool = tool({
  description: 'Detect communities or clusters of related entities within a scope.',
  parameters: z.object({
    groupId: z.string().optional().describe('Scope/Group ID (default: "global")'),
  }),
  execute: async () => {
    try {
      const graph = getGraph();
      const communityMap = graph.detectCommunities();
      
      const communityGroups = new Map<string, string[]>();
      communityMap.forEach((communityId, nodeId) => {
        if (!communityGroups.has(communityId)) {
          communityGroups.set(communityId, []);
        }
        communityGroups.get(communityId)!.push(nodeId);
      });

      const communities = Array.from(communityGroups.entries()).map(([id, members]) => ({
        id,
        members,
        size: members.length,
      }));

      return { success: true, communities, count: communities.length };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
} as any);

// 8. Query Analysis Tool - Intent Classification for MetaSearch
export const analyzeQueryTool = tool({
  description: 'Analyze a user query to determine the optimal search strategy. Returns classified intent and recommended search modalities.',
  parameters: z.object({
    query: z.string().describe('The user query to analyze'),
  }),
  execute: async ({ query }) => {
    const patterns = {
      exactLookup: /^(who|what) is (\w+)/i,
      relationship: /(related|connection|relationship|link) (between|with)/i,
      temporal: /(changed|evolved|history|over time|timeline)/i,
      semantic: /(theme|concept|similar|like|about|meaning)/i,
      community: /(group|cluster|communit|categor)/i,
      exploratory: /(everything|all|tell me|explain)/i
    };

    type StrategyType = 'fts' | 'entity' | 'path' | 'graph' | 'history' | 'vector' | 'community';
    const strategies: { type: StrategyType; priority: number; reason: string }[] = [];

    if (patterns.exactLookup.test(query)) {
      strategies.push({ type: 'fts', priority: 1, reason: 'Exact entity lookup' });
      strategies.push({ type: 'entity', priority: 2, reason: 'Get full entity details' });
    }

    if (patterns.relationship.test(query)) {
      strategies.push({ type: 'path', priority: 1, reason: 'Find relationship path' });
      strategies.push({ type: 'graph', priority: 2, reason: 'Explore connections' });
    }

    if (patterns.temporal.test(query)) {
      strategies.push({ type: 'history', priority: 1, reason: 'Track evolution' });
      strategies.push({ type: 'vector', priority: 2, reason: 'Find related snapshots' });
    }

    if (patterns.semantic.test(query)) {
      strategies.push({ type: 'vector', priority: 1, reason: 'Semantic similarity' });
      strategies.push({ type: 'graph', priority: 2, reason: 'Expand context' });
    }

    if (patterns.community.test(query)) {
      strategies.push({ type: 'community', priority: 1, reason: 'Detect clusters' });
    }

    if (strategies.length === 0) {
      strategies.push(
        { type: 'vector', priority: 1, reason: 'Semantic search' },
        { type: 'fts', priority: 2, reason: 'Keyword backup' },
        { type: 'graph', priority: 3, reason: 'Context expansion' }
      );
    }

    const sortedStrategies = strategies.sort((a, b) => a.priority - b.priority);

    return {
      success: true,
      strategies: sortedStrategies,
      primaryStrategy: sortedStrategies[0]?.type || 'vector',
      needsMultiModal: strategies.length > 1,
      queryType: patterns.exactLookup.test(query) ? 'exact' :
        patterns.relationship.test(query) ? 'relationship' :
          patterns.temporal.test(query) ? 'temporal' :
            patterns.semantic.test(query) ? 'semantic' :
              patterns.community.test(query) ? 'community' : 'exploratory'
    };
  },
} as any);

// 9. Result Re-ranking Tool - Merges and ranks results from multiple modalities
export const rerankResultsTool = tool({
  description: 'Re-rank and merge results from multiple search modalities. Deduplicates and boosts items found in multiple sources.',
  parameters: z.object({
    vectorResults: z.array(z.any()).optional().describe('Results from vector search'),
    ftsResults: z.array(z.any()).optional().describe('Results from full-text search'),
    graphResults: z.array(z.any()).optional().describe('Results from graph traversal'),
    temporalResults: z.array(z.any()).optional().describe('Results from temporal queries'),
  }),
  execute: async ({ vectorResults = [], ftsResults = [], graphResults = [], temporalResults = [] }) => {
    const sources = [
      { source: 'vector', items: vectorResults },
      { source: 'fts', items: ftsResults },
      { source: 'graph', items: graphResults },
      { source: 'temporal', items: temporalResults },
    ].filter(s => s.items && s.items.length > 0);

    const seen = new Map<string, any>();
    const merged: any[] = [];

    for (const { source, items } of sources) {
      for (const item of items) {
        const key = item.noteId || item.entityId || item.id || JSON.stringify(item);

        if (!seen.has(key)) {
          seen.set(key, {
            ...item,
            sources: [source],
            combinedScore: item.score || 1.0
          });
          merged.push(seen.get(key));
        } else {
          const existing = seen.get(key);
          existing.sources.push(source);
          existing.combinedScore += (item.score || 1.0) * 0.5;
        }
      }
    }

    const ranked = merged.sort((a, b) => b.combinedScore - a.combinedScore);

    return {
      success: true,
      results: ranked,
      totalCount: ranked.length,
      sourceBreakdown: sources.map(s => ({ source: s.source, count: s.items.length }))
    };
  },
} as any);

// 10. Graph Expansion Decision Tool
export const shouldExpandGraphTool = tool({
  description: 'Determine if graph expansion would improve search results. Recommends expansion when results are sparse or query involves relationships.',
  parameters: z.object({
    initialResultCount: z.number().describe('Number of results from initial search'),
    query: z.string().describe('The original query'),
    hasEntityResults: z.boolean().optional().describe('Whether any results are entities'),
  }),
  execute: async ({ initialResultCount, query, hasEntityResults = false }) => {
    const relationshipPattern = /connect|related|link|between|with|and/i;
    const isRelationshipQuery = relationshipPattern.test(query);
    const hasSpareResults = initialResultCount < 3;

    const shouldExpand =
      hasSpareResults ||
      isRelationshipQuery ||
      hasEntityResults;

    let reason = '';
    if (hasSpareResults) {
      reason = 'Few initial results found, graph can provide more context';
    } else if (isRelationshipQuery) {
      reason = 'Query involves relationships, graph can reveal connections';
    } else if (hasEntityResults) {
      reason = 'Entity results can be expanded with related items';
    } else {
      reason = 'Sufficient results, graph expansion not necessary';
    }

    return {
      success: true,
      shouldExpand,
      reason,
      confidence: shouldExpand ? (hasSpareResults ? 0.9 : 0.7) : 0.3
    };
  },
} as any);

export const tools = {
  searchVector: searchVectorTool,
  searchGraph: searchGraphTool,
  searchFts: searchFtsTool,
  getEntity: getEntityTool,
  findPath: findPathTool,
  getHistory: getHistoryTool,
  analyzeCommunities: analyzeCommunitiesTool,
  analyzeQuery: analyzeQueryTool,
  rerankResults: rerankResultsTool,
  shouldExpandGraph: shouldExpandGraphTool,
};
