type EventCallback<T = unknown> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);

    return () => this.off(event, callback);
  }

  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  emit<T = unknown>(event: string, payload: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(payload));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
