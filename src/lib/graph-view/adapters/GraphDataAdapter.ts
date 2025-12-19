import { syncEvents } from '@/lib/sync/events/SyncEventEmitter';
import type { SyncEventType } from '@/lib/sync/events/types';
import { VaultScopeAdapter } from './VaultScopeAdapter';
import { EntityScopeAdapter } from './EntityScopeAdapter';
import { CoOccurrenceScopeAdapter } from './CoOccurrenceScopeAdapter';
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphScopeType,
  AdapterOptions,
  CoOccurrenceOptions,
  CacheEntry,
  GraphUpdateCallback,
} from '../types';

const CACHE_TTL_MS = 60000;

export class GraphDataAdapter {
  private vaultAdapter: VaultScopeAdapter;
  private entityAdapter: EntityScopeAdapter;
  private coOccurrenceAdapter: CoOccurrenceScopeAdapter;

  private cache: Map<string, CacheEntry> = new Map();
  private updateListeners: Set<GraphUpdateCallback> = new Set();
  private unsubscribers: Array<() => void> = [];

  constructor() {
    this.vaultAdapter = new VaultScopeAdapter();
    this.entityAdapter = new EntityScopeAdapter();
    this.coOccurrenceAdapter = new CoOccurrenceScopeAdapter();

    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    const noteEvents: SyncEventType[] = ['noteCreated', 'noteUpdated', 'noteDeleted'];
    const folderEvents: SyncEventType[] = ['folderCreated', 'folderUpdated', 'folderDeleted', 'folderMoved'];
    const entityEvents: SyncEventType[] = ['entityExtracted', 'entityMerged', 'entityTypeChanged', 'entityDeleted'];
    const extractionEvents: SyncEventType[] = ['extractionCompleted', 'reconciliationCompleted'];
    const blueprintEvents: SyncEventType[] = ['blueprintInstanceCreated', 'blueprintInstanceUpdated'];
    const relationshipEvents: SyncEventType[] = ['relationshipExtracted'];
    const graphEvents: SyncEventType[] = ['graphProjectionRebuilt'];

    for (const eventType of noteEvents) {
      const unsub = syncEvents.on(eventType, () => {
        this.invalidateCache('vault');
        this.invalidateCoOccurrenceCaches();
      });
      this.unsubscribers.push(unsub);
    }

    for (const eventType of folderEvents) {
      const unsub = syncEvents.on(eventType, () => {
        this.invalidateCache('vault');
      });
      this.unsubscribers.push(unsub);
    }

    for (const eventType of entityEvents) {
      const unsub = syncEvents.on(eventType, () => {
        this.invalidateCache('entity');
        this.invalidateCoOccurrenceCaches();
      });
      this.unsubscribers.push(unsub);
    }

    for (const eventType of extractionEvents) {
      const unsub = syncEvents.on(eventType, () => {
        this.invalidateCache('entity');
        this.invalidateCoOccurrenceCaches();
      });
      this.unsubscribers.push(unsub);
    }

    for (const eventType of blueprintEvents) {
      const unsub = syncEvents.on(eventType, () => {
        this.invalidateCache('entity');
      });
      this.unsubscribers.push(unsub);
    }

    for (const eventType of relationshipEvents) {
      const unsub = syncEvents.on(eventType, () => {
        this.invalidateCache('entity');
      });
      this.unsubscribers.push(unsub);
    }

    for (const eventType of graphEvents) {
      const unsub = syncEvents.on(eventType, () => {
        this.invalidateCache('vault');
        this.invalidateCache('entity');
        this.invalidateCoOccurrenceCaches();
      });
      this.unsubscribers.push(unsub);
    }
  }

  async getVaultGraph(options: AdapterOptions = {}): Promise<GraphData> {
    const cacheKey = 'vault';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const data = await this.vaultAdapter.build(options);
    this.setCache(cacheKey, data);
    return data;
  }

  async getEntityGraph(options: AdapterOptions = {}): Promise<GraphData> {
    const cacheKey = 'entity';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const data = await this.entityAdapter.build(options);
    this.setCache(cacheKey, data);
    return data;
  }

  async getCoOccurrenceGraph(
    noteId: string,
    options: CoOccurrenceOptions = {}
  ): Promise<GraphData> {
    const cacheKey = `cooccurrence:${noteId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const data = await this.coOccurrenceAdapter.build(noteId, options);
    this.setCache(cacheKey, data);
    return data;
  }

  async searchNodes(
    query: string,
    scopes: GraphScopeType[] = ['vault', 'entity', 'cooccurrence']
  ): Promise<GraphNode[]> {
    const results: GraphNode[] = [];
    const normalizedQuery = query.toLowerCase();

    if (scopes.includes('vault')) {
      const vaultGraph = await this.getVaultGraph();
      const matches = vaultGraph.nodes.filter(n =>
        n.label.toLowerCase().includes(normalizedQuery)
      );
      results.push(...matches);
    }

    if (scopes.includes('entity')) {
      const entityGraph = await this.getEntityGraph();
      const matches = entityGraph.nodes.filter(n =>
        n.label.toLowerCase().includes(normalizedQuery)
      );
      results.push(...matches);
    }

    const seen = new Set<string>();
    return results.filter(node => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
  }

  async updateNode(scope: GraphScopeType, nodeId: string): Promise<GraphNode | null> {
    switch (scope) {
      case 'vault':
        const noteNode = await this.vaultAdapter.updateNote(nodeId);
        if (noteNode) return noteNode;
        return this.vaultAdapter.updateFolder(nodeId);

      case 'entity':
        return this.entityAdapter.updateEntity(nodeId);

      case 'cooccurrence':
        return null;

      default:
        return null;
    }
  }

  async updateEdgesForNode(scope: GraphScopeType, nodeId: string): Promise<GraphEdge[]> {
    switch (scope) {
      case 'vault':
        return this.vaultAdapter.getLinksForNote(nodeId);

      case 'entity':
        return this.entityAdapter.getRelationshipsForEntity(nodeId);

      case 'cooccurrence':
        return [];

      default:
        return [];
    }
  }

  invalidateCache(scope?: GraphScopeType, scopeId?: string): void {
    if (!scope) {
      this.cache.clear();
      this.emitUpdate('vault');
      this.emitUpdate('entity');
      this.emitUpdate('cooccurrence');
      return;
    }

    if (scope === 'cooccurrence' && scopeId) {
      const key = `cooccurrence:${scopeId}`;
      this.cache.delete(key);
      this.emitUpdate('cooccurrence', scopeId);
      return;
    }

    if (scope === 'cooccurrence') {
      this.invalidateCoOccurrenceCaches();
      return;
    }

    this.cache.delete(scope);
    this.emitUpdate(scope);
  }

  private invalidateCoOccurrenceCaches(): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith('cooccurrence:')) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    this.emitUpdate('cooccurrence');
  }

  getCacheStatus(): Array<{ scope: string; stale: boolean; builtAt: number }> {
    const status: Array<{ scope: string; stale: boolean; builtAt: number }> = [];

    for (const [key, entry] of this.cache) {
      const isStale = Date.now() - entry.builtAt > CACHE_TTL_MS;
      status.push({
        scope: key,
        stale: isStale || entry.stale,
        builtAt: entry.builtAt,
      });
    }

    return status;
  }

  on(event: 'graphUpdated', callback: GraphUpdateCallback): () => void {
    if (event === 'graphUpdated') {
      this.updateListeners.add(callback);
      return () => this.updateListeners.delete(callback);
    }
    return () => {};
  }

  private emitUpdate(scope: GraphScopeType, scopeId?: string): void {
    for (const callback of this.updateListeners) {
      try {
        callback(scope, scopeId);
      } catch (err) {
        console.error('[GraphDataAdapter] Error in update listener:', err);
      }
    }
  }

  private getFromCache(key: string): GraphData | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.builtAt > CACHE_TTL_MS;
    if (isExpired || entry.stale) {
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: GraphData): void {
    this.cache.set(key, {
      data,
      builtAt: Date.now(),
      stale: false,
    });
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.updateListeners.clear();
    this.cache.clear();
  }
}
