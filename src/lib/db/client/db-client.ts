import { generateId } from '@/lib/utils/ids';
import type {
  WorkerMessage,
  WorkerResponse,
  WorkerMessageType,
  SQLiteNode,
  SQLiteNodeInput,
  SQLiteEdge,
  SQLiteEdgeInput,
  SQLiteEmbedding,
  NodeType,
  FTSSearchOptions,
  FTSSearchResult,
  ResoRankCacheEntry,
} from './types';
import { float32ToBlob } from './types';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

class DBClient {
  private worker: Worker | null = null;
  private pending: Map<string, PendingRequest> = new Map();
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    console.log('[DBClient] Initializing SQLite worker...');
    const startTime = performance.now();

    this.worker = new Worker(
      new URL('../worker/sqlite-worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, success, data, error } = event.data;
      const pending = this.pending.get(id);
      
      if (pending) {
        this.pending.delete(id);
        if (success) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error ?? 'Unknown worker error'));
        }
      }
    };

    this.worker.onerror = (event) => {
      console.error('[DBClient] Worker error:', event.message);
    };

    await this.send('INIT', null);
    this.isInitialized = true;

    const elapsed = (performance.now() - startTime).toFixed(2);
    console.log(`[DBClient] SQLite ready in ${elapsed}ms`);
  }

  private send<T>(type: WorkerMessageType, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = generateId();
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });

      const message: WorkerMessage = { id, type, payload };
      this.worker.postMessage(message);
    });
  }

  async insertNode(input: SQLiteNodeInput): Promise<SQLiteNode> {
    const id = input.id ?? generateId();
    return this.send<SQLiteNode>('INSERT_NODE', { ...input, id });
  }

  async getNode(id: string): Promise<SQLiteNode | null> {
    return this.send<SQLiteNode | null>('GET_NODE', id);
  }

  async getAllNodes(): Promise<SQLiteNode[]> {
    return this.send<SQLiteNode[]>('GET_ALL_NODES', null);
  }

  async getNodesByType(type: NodeType): Promise<SQLiteNode[]> {
    return this.send<SQLiteNode[]>('GET_NODES_BY_TYPE', type);
  }

  async getNodesByParent(parentId: string): Promise<SQLiteNode[]> {
    return this.send<SQLiteNode[]>('GET_NODES_BY_PARENT', parentId);
  }

  async getNodesByEntityKind(entityKind: string): Promise<SQLiteNode[]> {
    return this.send<SQLiteNode[]>('GET_NODES_BY_ENTITY_KIND', entityKind);
  }

  async updateNode(id: string, updates: Partial<SQLiteNodeInput>): Promise<void> {
    await this.send('UPDATE_NODE', { id, updates });
  }

  async deleteNode(id: string): Promise<void> {
    await this.send('DELETE_NODE', id);
  }

  async batchSync(nodes: SQLiteNodeInput[]): Promise<void> {
    const nodesWithIds = nodes.map(n => ({
      ...n,
      id: n.id ?? generateId(),
    }));
    await this.send('BATCH_SYNC', nodesWithIds);
  }

  async insertEdge(input: SQLiteEdgeInput): Promise<SQLiteEdge> {
    const id = (input as { id?: string }).id ?? generateId();
    return this.send<SQLiteEdge>('INSERT_EDGE', { ...input, id });
  }

  async getEdge(id: string): Promise<SQLiteEdge | null> {
    return this.send<SQLiteEdge | null>('GET_EDGE', id);
  }

  async getAllEdges(): Promise<SQLiteEdge[]> {
    return this.send<SQLiteEdge[]>('GET_ALL_EDGES', null);
  }

  async getEdgesBySource(sourceId: string): Promise<SQLiteEdge[]> {
    return this.send<SQLiteEdge[]>('GET_EDGES_BY_SOURCE', sourceId);
  }

  async getEdgesByTarget(targetId: string): Promise<SQLiteEdge[]> {
    return this.send<SQLiteEdge[]>('GET_EDGES_BY_TARGET', targetId);
  }

  async getEdgesBetween(source: string, target: string): Promise<SQLiteEdge[]> {
    return this.send<SQLiteEdge[]>('GET_EDGES_BETWEEN', { source, target });
  }

  async updateEdge(id: string, updates: Partial<SQLiteEdgeInput>): Promise<void> {
    await this.send('UPDATE_EDGE', { id, updates });
  }

  async deleteEdge(id: string): Promise<void> {
    await this.send('DELETE_EDGE', id);
  }

  async batchInsertEdges(edges: SQLiteEdgeInput[]): Promise<void> {
    const edgesWithIds = edges.map(e => ({
      ...e,
      id: (e as { id?: string }).id ?? generateId(),
    }));
    await this.send('BATCH_INSERT_EDGES', edgesWithIds);
  }

  async ftsSearch(options: FTSSearchOptions): Promise<FTSSearchResult[]> {
    return this.send<FTSSearchResult[]>('FTS_SEARCH', options);
  }

  async getResoRankCache(): Promise<ResoRankCacheEntry[]> {
    return this.send<ResoRankCacheEntry[]>('GET_RESORANK_CACHE', null);
  }

  async setResoRankCache(entries: ResoRankCacheEntry[]): Promise<void> {
    await this.send('SET_RESORANK_CACHE', entries);
  }

  async clearResoRankCache(): Promise<void> {
    await this.send('CLEAR_RESORANK_CACHE', null);
  }

  async saveEmbedding(
    nodeId: string,
    embedding: Float32Array,
    model: 'small' | 'medium',
    text: string,
    contentHash: string
  ): Promise<void> {
    const embeddingBuffer = float32ToBlob(embedding).buffer;
    await this.send('INSERT_EMBEDDING', {
      node_id: nodeId,
      text,
      embedding: embeddingBuffer,
      model,
      content_hash: contentHash,
    });
  }

  async getEmbedding(nodeId: string): Promise<SQLiteEmbedding | null> {
    return this.send<SQLiteEmbedding | null>('GET_EMBEDDING', nodeId);
  }

  async getAllEmbeddings(): Promise<SQLiteEmbedding[]> {
    return this.send<SQLiteEmbedding[]>('GET_ALL_EMBEDDINGS', null);
  }

  async deleteEmbedding(nodeId: string): Promise<void> {
    await this.send('DELETE_EMBEDDING', nodeId);
  }

  async getMeta(key: string): Promise<string | null> {
    return this.send<string | null>('GET_META', key);
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.send('SET_META', { key, value });
  }

  async exec(sql: string): Promise<unknown> {
    return this.send('EXEC', sql);
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.send<T[]>('QUERY', { sql, params });
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
      this.pending.clear();
    }
  }
}

export const dbClient = new DBClient();
