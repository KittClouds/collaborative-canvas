import type { Mutation } from './types';

export type FlushHandler = (mutations: Mutation[]) => Promise<void>;
export type RollbackHandler = (mutations: Mutation[]) => void;

export class WriteBuffer {
  private queue: Mutation[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private flushDelayMs: number;
  private isFlushInProgress = false;
  private onFlush: FlushHandler;
  private onRollback: RollbackHandler;

  constructor(
    onFlush: FlushHandler,
    onRollback: RollbackHandler,
    options?: { flushDelayMs?: number }
  ) {
    this.onFlush = onFlush;
    this.onRollback = onRollback;
    this.flushDelayMs = options?.flushDelayMs ?? 100;
  }

  enqueue(mutation: Mutation): void {
    this.queue.push(mutation);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimeout !== null) return;
    this.flushTimeout = setTimeout(() => this.flush(), this.flushDelayMs);
  }

  private async flush(): Promise<void> {
    this.flushTimeout = null;
    if (this.queue.length === 0) return;
    if (this.isFlushInProgress) {
      this.scheduleFlush();
      return;
    }

    this.isFlushInProgress = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      await this.onFlush(batch);
      batch.forEach(m => {
        m.status = 'committed';
      });
      console.log(`[WriteBuffer] Flushed ${batch.length} mutations`);
    } catch (err) {
      console.error('[WriteBuffer] Flush failed, rolling back:', err);
      batch.forEach(m => {
        m.status = 'failed';
      });
      this.onRollback(batch);
    } finally {
      this.isFlushInProgress = false;
    }
  }

  async flushNow(): Promise<void> {
    if (this.flushTimeout !== null) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await this.flush();
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  hasPending(): boolean {
    return this.queue.length > 0 || this.isFlushInProgress;
  }

  clear(): void {
    this.queue = [];
    if (this.flushTimeout !== null) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }
}
