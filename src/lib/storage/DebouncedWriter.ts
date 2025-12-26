/**
 * Debounces writes to prevent hammering SQLite/CozoDB
 */

export type WriteOperation<T> = {
    key: string;
    data: T;
    operation: 'upsert' | 'delete';
};

export class DebouncedWriter<T> {
    private pendingWrites = new Map<string, WriteOperation<T>>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly debounceMs: number;
    private readonly executor: (ops: WriteOperation<T>[]) => Promise<void>;

    constructor(
        executor: (ops: WriteOperation<T>[]) => Promise<void>,
        debounceMs = 300
    ) {
        this.executor = executor;
        this.debounceMs = debounceMs;
    }

    /**
     * Schedule a write (debounced)
     */
    write(key: string, data: T, operation: 'upsert' | 'delete' = 'upsert'): void {
        this.pendingWrites.set(key, { key, data, operation });
        this.scheduleFlush();
    }

    /**
     * Force immediate flush
     */
    async flush(): Promise<void> {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.pendingWrites.size === 0) return;

        const ops = Array.from(this.pendingWrites.values());
        this.pendingWrites.clear();

        await this.executor(ops);
    }

    private scheduleFlush(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }

        this.flushTimer = setTimeout(() => {
            void this.flush();
        }, this.debounceMs);
    }
}
