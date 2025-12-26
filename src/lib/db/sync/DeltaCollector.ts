/**
 * DeltaCollector - Weapons-Grade Sync Engine Component
 * 
 * Replaces DirtyTracker with field-level Immer-style patch tracking.
 * Collects changes and debounces them into batched flushes.
 * 
 * Key improvements over DirtyTracker:
 * - Field-level diffs instead of full object tracking
 * - Version counters for CRDT support
 * - Configurable debounce with max threshold
 * - Coalesces INSERT→UPDATE→DELETE sequences
 */

import type { SQLiteNodeInput, SQLiteEdgeInput } from '../client/types';
import type { Delta, DeltaPatch, DirtyOperation, SyncEngineConfig } from './types';
import { DEFAULT_SYNC_ENGINE_CONFIG } from './types';

export class DeltaCollector {
    private deltas = new Map<string, Delta>();
    private versionCounters = new Map<string, number>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
    private lastChangeTime = 0;
    private config: SyncEngineConfig;

    constructor(
        private onFlush: (deltas: Delta[]) => Promise<void>,
        config: Partial<SyncEngineConfig> = {}
    ) {
        this.config = { ...DEFAULT_SYNC_ENGINE_CONFIG, ...config };
    }

    /**
     * Track an INSERT operation (full object)
     */
    insert(
        id: string,
        type: 'node' | 'edge',
        data: SQLiteNodeInput | SQLiteEdgeInput
    ): void {
        const version = this.incrementVersion(id);

        // If we already have a delta for this id and it's a DELETE, this INSERT resurrects it
        const existing = this.deltas.get(id);
        if (existing?.operation === 'DELETE') {
            // DELETE→INSERT = UPDATE (the item was deleted and recreated)
            this.deltas.set(id, {
                id,
                type,
                operation: 'UPDATE',
                fullData: data,
                timestamp: Date.now(),
                version
            });
        } else {
            this.deltas.set(id, {
                id,
                type,
                operation: 'INSERT',
                fullData: data,
                timestamp: Date.now(),
                version
            });
        }

        this.scheduleFlush();
    }

    /**
     * Track an UPDATE operation with field-level patches
     */
    update(
        id: string,
        type: 'node' | 'edge',
        changedFields: Record<string, unknown>,
        oldValues?: Record<string, unknown>
    ): void {
        if (Object.keys(changedFields).length === 0) {
            return; // No actual changes
        }

        const version = this.incrementVersion(id);
        const existing = this.deltas.get(id);

        // Generate patches from changed fields
        const patches: DeltaPatch[] = Object.entries(changedFields).map(([key, value]) => ({
            op: 'replace' as const,
            path: [key],
            value
        }));

        if (existing) {
            // Coalesce with existing delta
            if (existing.operation === 'INSERT') {
                // INSERT→UPDATE = INSERT with merged data
                const mergedData = { ...(existing.fullData as object), ...changedFields };
                this.deltas.set(id, {
                    ...existing,
                    fullData: mergedData,
                    timestamp: Date.now(),
                    version
                });
            } else if (existing.operation === 'UPDATE') {
                // UPDATE→UPDATE = UPDATE with merged patches
                const existingPatches = existing.patches || [];
                // Merge patches, newer values overwrite older ones for same path
                const patchMap = new Map<string, DeltaPatch>();
                for (const p of existingPatches) {
                    patchMap.set(p.path.join('.'), p);
                }
                for (const p of patches) {
                    patchMap.set(p.path.join('.'), p);
                }
                this.deltas.set(id, {
                    ...existing,
                    patches: Array.from(patchMap.values()),
                    timestamp: Date.now(),
                    version
                });
            } else if (existing.operation === 'DELETE') {
                // DELETE→UPDATE is invalid, ignore
                console.warn(`[DeltaCollector] Ignoring UPDATE on deleted entity ${id}`);
                return;
            }
        } else {
            this.deltas.set(id, {
                id,
                type,
                operation: 'UPDATE',
                patches,
                timestamp: Date.now(),
                version
            });
        }

        this.scheduleFlush();
    }

    /**
     * Track an UPDATE with full data (for backward compatibility)
     */
    updateFull(
        id: string,
        type: 'node' | 'edge',
        data: SQLiteNodeInput | SQLiteEdgeInput
    ): void {
        const version = this.incrementVersion(id);
        const existing = this.deltas.get(id);

        if (existing?.operation === 'INSERT') {
            // INSERT→UPDATE = INSERT with new data
            this.deltas.set(id, {
                ...existing,
                fullData: data,
                timestamp: Date.now(),
                version
            });
        } else if (existing?.operation === 'DELETE') {
            // DELETE→UPDATE is invalid, ignore
            console.warn(`[DeltaCollector] Ignoring UPDATE on deleted entity ${id}`);
            return;
        } else {
            this.deltas.set(id, {
                id,
                type,
                operation: 'UPDATE',
                fullData: data,
                timestamp: Date.now(),
                version
            });
        }

        this.scheduleFlush();
    }

    /**
     * Track a DELETE operation
     */
    delete(id: string, type: 'node' | 'edge'): void {
        const version = this.incrementVersion(id);
        const existing = this.deltas.get(id);

        if (existing?.operation === 'INSERT') {
            // INSERT→DELETE = no-op (item never persisted)
            this.deltas.delete(id);
        } else {
            this.deltas.set(id, {
                id,
                type,
                operation: 'DELETE',
                timestamp: Date.now(),
                version
            });
        }

        this.scheduleFlush();
    }

    /**
     * Force immediate flush
     */
    async flush(): Promise<void> {
        this.clearTimers();

        if (this.deltas.size === 0) return;

        const deltasArray = Array.from(this.deltas.values());
        this.deltas.clear();

        try {
            await this.onFlush(deltasArray);
        } catch (err) {
            console.error('[DeltaCollector] Flush failed, re-queuing deltas:', err);
            // On failure, re-queue deltas for retry
            for (const delta of deltasArray) {
                if (!this.deltas.has(delta.id)) {
                    this.deltas.set(delta.id, delta);
                }
            }
            this.scheduleFlush();
        }
    }

    /**
     * Schedule a batched flush
     */
    private scheduleFlush(): void {
        this.lastChangeTime = Date.now();

        // Immediate flush if we hit max deltas
        if (this.deltas.size >= this.config.maxDeltasBeforeFlush) {
            void this.flush();
            return;
        }

        // Clear existing debounce timer
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }

        // Set debounce timer
        this.flushTimer = setTimeout(() => {
            void this.flush();
        }, this.config.debounceMs);

        // Set max wait timer if not already set
        if (!this.maxWaitTimer) {
            this.maxWaitTimer = setTimeout(() => {
                this.maxWaitTimer = null;
                void this.flush();
            }, this.config.maxWaitMs);
        }
    }

    /**
     * Clear all timers
     */
    private clearTimers(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.maxWaitTimer) {
            clearTimeout(this.maxWaitTimer);
            this.maxWaitTimer = null;
        }
    }

    /**
     * Increment version counter for entity (vector clock)
     */
    private incrementVersion(id: string): number {
        const current = this.versionCounters.get(id) ?? 0;
        const next = current + 1;
        this.versionCounters.set(id, next);
        return next;
    }

    /**
     * Get current delta count (for monitoring)
     */
    getPendingCount(): number {
        return this.deltas.size;
    }

    /**
     * Check if there are pending changes
     */
    hasPendingChanges(): boolean {
        return this.deltas.size > 0;
    }

    /**
     * Get pending deltas (for debugging)
     */
    getPendingDeltas(): Delta[] {
        return Array.from(this.deltas.values());
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<SyncEngineConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Clear all pending deltas (use with caution)
     */
    clear(): void {
        this.clearTimers();
        this.deltas.clear();
    }

    /**
     * Get version for an entity (for CRDT conflict resolution)
     */
    getVersion(id: string): number {
        return this.versionCounters.get(id) ?? 0;
    }
}
