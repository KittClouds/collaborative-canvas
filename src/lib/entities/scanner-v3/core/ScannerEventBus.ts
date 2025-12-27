/**
 * Event bus for communication between Highlighter and Scanner
 * Zero dependencies, pure event emitter
 */
export class ScannerEventBus {
    private listeners: Map<string, Set<Function>> = new Map();

    on(event: string, handler: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(handler);
        };
    }

    emit(event: string, payload: any): void {
        const handlers = this.listeners.get(event);
        if (!handlers) return;

        handlers.forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                console.error(`[ScannerEventBus] Error in ${event} handler:`, error);
            }
        });
    }

    clear(): void {
        this.listeners.clear();
    }
}

// Singleton instance
export const scannerEventBus = new ScannerEventBus();
