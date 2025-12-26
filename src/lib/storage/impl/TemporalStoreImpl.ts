// Removed: UnifiedGraph imports
import type {
  ITemporalStore,
  GraphSnapshot,
  HistoryEntry,
} from '../interfaces';

export class TemporalStoreImpl implements ITemporalStore {
  private history: Map<string, HistoryEntry[]> = new Map();

  constructor() {
    // this.graph = getGraph();
  }

  async getSnapshot(groupId: string, timestamp: number): Promise<GraphSnapshot> {
    return {
      entities: [],
      edges: [],
      timestamp,
    };
  }

  async getEntityHistory(entityId: string): Promise<HistoryEntry[]> {
    const entries = this.history.get(`entity:${entityId}`) || [];
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getEdgeHistory(sourceId: string, targetId: string): Promise<HistoryEntry[]> {
    const key = `edge:${sourceId}:${targetId}`;
    const entries = this.history.get(key) || [];
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  recordChange(entityId: string, action: 'create' | 'update' | 'delete', data: unknown): void {
    const key = `entity:${entityId}`;
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }

    this.history.get(key)!.push({
      timestamp: Date.now(),
      action,
      data,
    });
  }

  recordEdgeChange(sourceId: string, targetId: string, action: 'create' | 'update' | 'delete', data: unknown): void {
    const key = `edge:${sourceId}:${targetId}`;
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }

    this.history.get(key)!.push({
      timestamp: Date.now(),
      action,
      data,
    });
  }

  clear(): void {
    this.history.clear();
  }
}

let temporalStoreInstance: TemporalStoreImpl | null = null;

export function getTemporalStoreImpl(): TemporalStoreImpl {
  if (!temporalStoreInstance) {
    temporalStoreInstance = new TemporalStoreImpl();
  }
  return temporalStoreInstance;
}

export function resetTemporalStore(): void {
  temporalStoreInstance = null;
}
