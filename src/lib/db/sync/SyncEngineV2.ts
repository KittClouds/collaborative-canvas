/**
 * SyncEngineV2 - Weapons-Grade Sync Engine Main Orchestrator
 * 
 * Replaces GraphSQLiteSync as the primary sync coordinator.
 * Integrates DeltaCollector, TransactionBuilder, and StreamingCozoSync.
 * 
 * Key improvements:
 * - Single API for all sync operations
 * - Atomic transactions (no partial commits)
 * - Field-level delta tracking
 * - Incremental CozoDB sync
 * - Built-in telemetry
 * - Backward compatibility shim
 */

import type { SQLiteNodeInput, SQLiteEdgeInput } from '../client/types';
import type { Delta, TransactionResult, SyncEngineConfig, SyncTelemetry, DirtyOperation } from './types';
import { DEFAULT_SYNC_ENGINE_CONFIG } from './types';
import { DeltaCollector } from './DeltaCollector';
import { TransactionBuilder } from './TransactionBuilder';
import { streamingCozoSync } from './StreamingCozoSync';
import { syncState } from './SyncState';
import { dbClient } from '../client/db-client';

export class SyncEngineV2 {
    private deltaCollector: DeltaCollector;
    private transactionBuilder: TransactionBuilder;
    private config: SyncEngineConfig;
    private telemetry: SyncTelemetry;
    private isFlushing = false;

    constructor(config: Partial<SyncEngineConfig> = {}) {
        this.config = { ...DEFAULT_SYNC_ENGINE_CONFIG, ...config };
        this.transactionBuilder = new TransactionBuilder(this.config);
        this.deltaCollector = new DeltaCollector(
            (deltas) => this.processDeltaBatch(deltas),
            this.config
        );
        this.telemetry = {
            totalFlushes: 0,
            totalDeltas: 0,
            totalDuration: 0,
            averageFlushDuration: 0,
            lastFlushTime: null,
            errorCount: 0
        };
    }

    // ============================================
    // PUBLIC API - Node Operations
    // ============================================

    /**
     * Track a node insert
     */
    trackNodeInsert(node: SQLiteNodeInput & { id: string }): void {
        if (!dbClient.isReady()) return;

        this.deltaCollector.insert(node.id, 'node', node);
        this.updateSyncState();
    }

    /**
     * Track a node update with changed fields
     */
    trackNodeUpdate(
        id: string,
        changedFields: Record<string, unknown>,
        oldValues?: Record<string, unknown>
    ): void {
        if (!dbClient.isReady()) return;

        this.deltaCollector.update(id, 'node', changedFields, oldValues);
        this.updateSyncState();
    }

    /**
     * Track a node update with full data (backward compatibility)
     */
    trackNodeUpdateFull(id: string, data: SQLiteNodeInput & { id: string }): void {
        if (!dbClient.isReady()) return;

        this.deltaCollector.updateFull(id, 'node', data);
        this.updateSyncState();
    }

    /**
     * Track a node delete
     */
    trackNodeDelete(id: string): void {
        if (!dbClient.isReady()) return;

        this.deltaCollector.delete(id, 'node');
        this.updateSyncState();
    }

    // ============================================
    // PUBLIC API - Edge Operations
    // ============================================

    /**
     * Track an edge insert
     */
    trackEdgeInsert(edge: SQLiteEdgeInput & { id: string }): void {
        if (!dbClient.isReady() || !this.config.enableEdgeSync) return;

        this.deltaCollector.insert(edge.id, 'edge', edge);
        this.updateSyncState();
    }

    /**
     * Track an edge update
     */
    trackEdgeUpdate(
        id: string,
        changedFields: Record<string, unknown>,
        fullData?: SQLiteEdgeInput & { id: string }
    ): void {
        if (!dbClient.isReady() || !this.config.enableEdgeSync) return;

        if (fullData) {
            this.deltaCollector.updateFull(id, 'edge', fullData);
        } else {
            this.deltaCollector.update(id, 'edge', changedFields);
        }
        this.updateSyncState();
    }

    /**
     * Track an edge delete
     */
    trackEdgeDelete(id: string): void {
        if (!dbClient.isReady() || !this.config.enableEdgeSync) return;

        this.deltaCollector.delete(id, 'edge');
        this.updateSyncState();
    }

    // ============================================
    // PUBLIC API - Backward Compatibility
    // ============================================

    /**
     * Backward compatibility: markNodeDirty (matches GraphSQLiteSync API)
     */
    markNodeDirty(
        id: string,
        operation: DirtyOperation,
        data?: SQLiteNodeInput & { id: string },
        changedFields?: string[]
    ): void {
        if (!dbClient.isReady()) return;

        switch (operation) {
            case 'INSERT':
                if (data) this.trackNodeInsert(data);
                break;
            case 'UPDATE':
                if (data) {
                    if (changedFields && changedFields.length > 0) {
                        const changes: Record<string, unknown> = {};
                        for (const field of changedFields) {
                            changes[field] = (data as any)[field];
                        }
                        this.trackNodeUpdate(id, changes);
                    } else {
                        this.trackNodeUpdateFull(id, data);
                    }
                }
                break;
            case 'DELETE':
                this.trackNodeDelete(id);
                break;
        }
    }

    /**
     * Backward compatibility: markEdgeDirty (matches GraphSQLiteSync API)
     */
    markEdgeDirty(
        id: string,
        operation: DirtyOperation,
        data?: SQLiteEdgeInput & { id: string },
        changedFields?: string[]
    ): void {
        if (!dbClient.isReady() || !this.config.enableEdgeSync) return;

        switch (operation) {
            case 'INSERT':
                if (data) this.trackEdgeInsert(data);
                break;
            case 'UPDATE':
                if (data) {
                    this.trackEdgeUpdate(id, {}, data);
                }
                break;
            case 'DELETE':
                this.trackEdgeDelete(id);
                break;
        }
    }

    // ============================================
    // PUBLIC API - Flush Control
    // ============================================

    /**
     * Force an immediate flush of all pending deltas
     */
    async forceFlush(): Promise<TransactionResult | null> {
        if (this.isFlushing) {
            return null;
        }

        await this.deltaCollector.flush();
        return null; // Result is handled internally
    }

    /**
     * Check if there are pending changes
     */
    hasPendingChanges(): boolean {
        return this.deltaCollector.hasPendingChanges();
    }

    /**
     * Get count of pending deltas
     */
    getPendingCount(): number {
        return this.deltaCollector.getPendingCount();
    }

    // ============================================
    // PUBLIC API - Configuration & Telemetry
    // ============================================

    /**
     * Update configuration
     */
    setConfig(config: Partial<SyncEngineConfig>): void {
        this.config = { ...this.config, ...config };
        this.deltaCollector.setConfig(this.config);
        this.transactionBuilder.setConfig(this.config);
        streamingCozoSync.setEnabled(this.config.enableCozoSync);
    }

    /**
     * Get telemetry data
     */
    getTelemetry(): SyncTelemetry {
        return { ...this.telemetry };
    }

    /**
     * Reset telemetry
     */
    resetTelemetry(): void {
        this.telemetry = {
            totalFlushes: 0,
            totalDeltas: 0,
            totalDuration: 0,
            averageFlushDuration: 0,
            lastFlushTime: null,
            errorCount: 0
        };
    }

    // ============================================
    // INTERNAL - Delta Processing
    // ============================================

    /**
     * Process a batch of deltas (called by DeltaCollector)
     */
    private async processDeltaBatch(deltas: Delta[]): Promise<void> {
        if (this.isFlushing || deltas.length === 0) return;

        this.isFlushing = true;
        syncState.setSyncing(true);

        try {
            // Execute atomic transaction
            const result = await this.transactionBuilder.execute(deltas);

            // Update telemetry
            this.telemetry.totalFlushes++;
            this.telemetry.totalDeltas += deltas.length;
            this.telemetry.totalDuration += result.duration;
            this.telemetry.averageFlushDuration =
                this.telemetry.totalDuration / this.telemetry.totalFlushes;
            this.telemetry.lastFlushTime = Date.now();

            if (result.success) {
                // Sync to CozoDB if enabled
                if (this.config.enableCozoSync) {
                    try {
                        await streamingCozoSync.syncDeltas(deltas);
                    } catch (cozoErr) {
                        console.error('[SyncEngineV2] CozoDB sync failed:', cozoErr);
                        // Don't fail the overall sync - SQLite is the source of truth
                    }
                }

                syncState.setSyncComplete();

                const total = result.insertedNodes + result.updatedNodes + result.deletedNodes +
                    result.insertedEdges + result.updatedEdges + result.deletedEdges;

                if (total > 0) {
                    console.log(
                        `[SyncEngineV2] Flushed ${deltas.length} deltas in ${result.duration.toFixed(2)}ms: ` +
                        `${result.insertedNodes}+${result.updatedNodes}-${result.deletedNodes} nodes, ` +
                        `${result.insertedEdges}+${result.updatedEdges}-${result.deletedEdges} edges`
                    );
                }
            } else {
                this.telemetry.errorCount++;
                syncState.setSyncError(new Error(result.errors[0]?.message ?? 'Transaction failed'));
                console.error('[SyncEngineV2] Transaction failed:', result.errors);
            }
        } catch (err) {
            this.telemetry.errorCount++;
            syncState.setSyncError(err instanceof Error ? err : new Error(String(err)));
            console.error('[SyncEngineV2] Flush failed:', err);
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Update sync state with current pending counts
     */
    private updateSyncState(): void {
        const nodeDeltas = this.deltaCollector.getPendingDeltas().filter(d => d.type === 'node');
        const edgeDeltas = this.deltaCollector.getPendingDeltas().filter(d => d.type === 'edge');
        syncState.setDirtyCounts(nodeDeltas.length, edgeDeltas.length);
    }
}

// Singleton instance
export const syncEngineV2 = new SyncEngineV2();

// Re-export for convenience
export { streamingCozoSync } from './StreamingCozoSync';
export { DeltaCollector } from './DeltaCollector';
export { TransactionBuilder } from './TransactionBuilder';
