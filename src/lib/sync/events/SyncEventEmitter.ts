import type { SyncEventType, SyncEvent } from './types';

type EventCallback<T> = (event: SyncEvent<T>) => void;

export class SyncEventEmitter {
  private listeners: Map<SyncEventType, Set<EventCallback<unknown>>> = new Map();
  private allListeners: Set<EventCallback<unknown>> = new Set();

  on<T>(type: SyncEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback as EventCallback<unknown>);

    return () => {
      this.listeners.get(type)?.delete(callback as EventCallback<unknown>);
    };
  }

  onAll(callback: EventCallback<unknown>): () => void {
    this.allListeners.add(callback);
    return () => this.allListeners.delete(callback);
  }

  emit<T>(type: SyncEventType, payload: T, source: string): void {
    const event: SyncEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      source,
    };

    this.listeners.get(type)?.forEach(cb => {
      try {
        cb(event);
      } catch (err) {
        console.error(`[SyncEventEmitter] Error in ${type} listener:`, err);
      }
    });

    this.allListeners.forEach(cb => {
      try {
        cb(event);
      } catch (err) {
        console.error(`[SyncEventEmitter] Error in global listener:`, err);
      }
    });
  }

  off(type: SyncEventType, callback: EventCallback<unknown>): void {
    this.listeners.get(type)?.delete(callback);
  }

  once<T>(type: SyncEventType, callback: EventCallback<T>): () => void {
    const wrapper = (event: SyncEvent<T>) => {
      this.off(type, wrapper as EventCallback<unknown>);
      callback(event);
    };
    return this.on(type, wrapper);
  }

  clear(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }

  listenerCount(type?: SyncEventType): number {
    if (type) {
      return this.listeners.get(type)?.size || 0;
    }
    let count = this.allListeners.size;
    this.listeners.forEach(set => {
      count += set.size;
    });
    return count;
  }
}

export const syncEvents = new SyncEventEmitter();
