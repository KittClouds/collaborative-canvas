import { entityRegistry } from '@/lib/cozo/graph/adapters';
import { EntityKind } from '../entityTypes';

export interface PendingUpdate {
    label: string;
    kind: EntityKind;
    noteIds: Set<string>;
    metadata?: any;
}

export class IncrementalIndexer {
    private pendingUpdates: Map<string, PendingUpdate> = new Map();
    private flushTimer: NodeJS.Timeout | null = null;

    /**
     * Queue entity update (does NOT write immediately)
     */
    queueEntityUpdate(
        label: string,
        kind: EntityKind,
        noteId: string,
        metadata?: any
    ): void {
        const key = `${kind}:${label}`;

        if (!this.pendingUpdates.has(key)) {
            this.pendingUpdates.set(key, {
                label,
                kind,
                noteIds: new Set([noteId]),
                metadata,
            });
        } else {
            this.pendingUpdates.get(key)!.noteIds.add(noteId);
        }

        // Debounced flush (100ms)
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => this.flush(), 100);
    }

    /**
     * Flush all pending updates to entity registry
     */
    flush(): void {
        if (this.pendingUpdates.size === 0) return;

        const updates = Array.from(this.pendingUpdates.values());

        // Batch write (single registry lock equivalent)
        // We need to implement batchRegister in entityRegistry
        entityRegistry.batchRegister(updates);

        // Clear queue
        this.pendingUpdates.clear();

        // console.log(`[IncrementalIndexer] Flushed ${updates.length} entity updates`);
    }
}

export const incrementalIndexer = new IncrementalIndexer();
