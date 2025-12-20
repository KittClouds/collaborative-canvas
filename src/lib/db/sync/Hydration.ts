import { dbClient } from '../client/db-client';
import type { SQLiteNode, SQLiteEdge } from '../client/types';
import type { HydrationOptions } from './types';
import { DEFAULT_HYDRATION_OPTIONS } from './types';
import { syncState } from './SyncState';

export interface HydrationResult {
  nodes: SQLiteNode[];
  edges: SQLiteEdge[];
  nodesLoaded: number;
  edgesLoaded: number;
}

export class Hydration {
  private options: HydrationOptions;

  constructor(options: Partial<HydrationOptions> = {}) {
    this.options = { ...DEFAULT_HYDRATION_OPTIONS, ...options };
  }

  async hydrate(): Promise<HydrationResult> {
    syncState.setHydrating(true);
    syncState.updateHydrationProgress({ phase: 'critical', nodesLoaded: 0, edgesLoaded: 0 });

    const result: HydrationResult = {
      nodes: [],
      edges: [],
      nodesLoaded: 0,
      edgesLoaded: 0,
    };

    try {
      if (this.options.progressive) {
        await this.hydrateProgressive(result);
      } else {
        await this.hydrateAll(result);
      }

      syncState.updateHydrationProgress({ phase: 'complete' });
      syncState.setHydrated(true);
    } catch (err) {
      console.error('[Hydration] Failed:', err);
      syncState.setSyncError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }

    return result;
  }

  private async hydrateAll(result: HydrationResult): Promise<void> {
    const nodes = await dbClient.getAllNodes();
    const edges = await dbClient.getAllEdges();

    result.nodes = nodes;
    result.edges = edges;
    result.nodesLoaded = nodes.length;
    result.edgesLoaded = edges.length;

    syncState.updateHydrationProgress({
      nodesLoaded: nodes.length,
      edgesLoaded: edges.length,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    });
  }

  private async hydrateProgressive(result: HydrationResult): Promise<void> {
    const totalNodes = await this.getNodeCount();
    const totalEdges = await this.getEdgeCount();

    syncState.updateHydrationProgress({
      totalNodes,
      totalEdges,
    });

    syncState.updateHydrationProgress({ phase: 'critical' });
    const criticalNodes = await this.loadCriticalNodes();
    result.nodes.push(...criticalNodes);
    result.nodesLoaded += criticalNodes.length;

    syncState.updateHydrationProgress({
      nodesLoaded: result.nodesLoaded,
    });

    if (this.options.yieldMs > 0) {
      await this.sleep(this.options.yieldMs);
    }

    syncState.updateHydrationProgress({ phase: 'visible' });
    const visibleNodes = await this.loadVisibleNodes(criticalNodes);
    result.nodes.push(...visibleNodes);
    result.nodesLoaded += visibleNodes.length;

    syncState.updateHydrationProgress({
      nodesLoaded: result.nodesLoaded,
    });

    if (this.options.yieldMs > 0) {
      await this.sleep(this.options.yieldMs);
    }

    syncState.updateHydrationProgress({ phase: 'full' });
    const loadedIds = new Set(result.nodes.map(n => n.id));
    const remainingNodes = await this.loadRemainingNodes(loadedIds);
    result.nodes.push(...remainingNodes);
    result.nodesLoaded += remainingNodes.length;

    const edges = await dbClient.getAllEdges();
    result.edges = edges;
    result.edgesLoaded = edges.length;

    syncState.updateHydrationProgress({
      nodesLoaded: result.nodesLoaded,
      edgesLoaded: result.edgesLoaded,
    });
  }

  private async loadCriticalNodes(): Promise<SQLiteNode[]> {
    const rootNodes = await dbClient.query<SQLiteNode>(
      `SELECT * FROM nodes WHERE parent_id IS NULL ORDER BY updated_at DESC LIMIT ?`,
      [this.options.criticalLimit / 2]
    );

    const recentNodes = await dbClient.query<SQLiteNode>(
      `SELECT * FROM nodes WHERE parent_id IS NOT NULL ORDER BY updated_at DESC LIMIT ?`,
      [this.options.criticalLimit / 2]
    );

    const loadedIds = new Set(rootNodes.map(n => n.id));
    const unique = recentNodes.filter(n => !loadedIds.has(n.id));

    return [...rootNodes, ...unique];
  }

  private async loadVisibleNodes(criticalNodes: SQLiteNode[]): Promise<SQLiteNode[]> {
    const folderIds = criticalNodes
      .filter(n => n.type === 'FOLDER')
      .map(n => n.id);

    if (folderIds.length === 0) {
      return [];
    }

    const placeholders = folderIds.map(() => '?').join(',');
    const childNodes = await dbClient.query<SQLiteNode>(
      `SELECT * FROM nodes WHERE parent_id IN (${placeholders}) ORDER BY sequence, created_at LIMIT ?`,
      [...folderIds, this.options.visibleLimit]
    );

    const loadedIds = new Set(criticalNodes.map(n => n.id));
    return childNodes.filter(n => !loadedIds.has(n.id));
  }

  private async loadRemainingNodes(loadedIds: Set<string>): Promise<SQLiteNode[]> {
    const allNodes = await dbClient.getAllNodes();
    return allNodes.filter(n => !loadedIds.has(n.id));
  }

  private async getNodeCount(): Promise<number> {
    const result = await dbClient.query<{ count: number }>('SELECT COUNT(*) as count FROM nodes');
    return result[0]?.count || 0;
  }

  private async getEdgeCount(): Promise<number> {
    const result = await dbClient.query<{ count: number }>('SELECT COUNT(*) as count FROM edges');
    return result[0]?.count || 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
