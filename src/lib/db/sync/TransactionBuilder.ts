/**
 * TransactionBuilder - Weapons-Grade Sync Engine Component
 * 
 * Builds and executes atomic SQLite transactions from delta arrays.
 * Handles retry logic with exponential backoff.
 * 
 * Key improvements over BatchWriter:
 * - Single transaction wrapping all operations (atomic)
 * - Field-level patch application
 * - Automatic rollback on failure
 * - Retry with exponential backoff
 */

import type { Delta, DeltaPatch, TransactionResult, SyncEngineConfig } from './types';
import type { SQLiteNodeInput, SQLiteEdgeInput } from '../client/types';
import { DEFAULT_SYNC_ENGINE_CONFIG } from './types';
import { dbClient } from '../client/db-client';

export class TransactionBuilder {
    private config: SyncEngineConfig;

    constructor(config: Partial<SyncEngineConfig> = {}) {
        this.config = { ...DEFAULT_SYNC_ENGINE_CONFIG, ...config };
    }

    /**
     * Execute deltas as a single atomic transaction
     * Delegates to worker for actual transaction execution
     */
    async execute(deltas: Delta[]): Promise<TransactionResult> {
        if (deltas.length === 0) {
            return {
                success: true,
                processedCount: 0,
                insertedNodes: 0,
                updatedNodes: 0,
                deletedNodes: 0,
                insertedEdges: 0,
                updatedEdges: 0,
                deletedEdges: 0,
                errors: [],
                duration: 0
            };
        }

        const startTime = performance.now();
        let lastError: Error | null = null;

        // Retry with exponential backoff
        for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
            try {
                const result = await dbClient.executeTransaction(deltas);
                return result;
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                console.warn(
                    `[TransactionBuilder] Attempt ${attempt + 1}/${this.config.retryAttempts} failed:`,
                    lastError.message
                );

                if (attempt < this.config.retryAttempts - 1) {
                    // Exponential backoff: 100ms, 200ms, 400ms, ...
                    const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
                    await this.sleep(delay);
                }
            }
        }

        // All retries failed
        const duration = performance.now() - startTime;
        return {
            success: false,
            processedCount: 0,
            insertedNodes: 0,
            updatedNodes: 0,
            deletedNodes: 0,
            insertedEdges: 0,
            updatedEdges: 0,
            deletedEdges: 0,
            errors: [{ id: 'transaction', message: lastError?.message ?? 'Unknown error' }],
            duration
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<SyncEngineConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

/**
 * Apply patches to reconstruct updated object
 * Used in worker to apply field-level updates
 */
export function applyPatches<T extends object>(base: T, patches: DeltaPatch[]): T {
    const result = { ...base };

    for (const patch of patches) {
        if (patch.path.length === 0) continue;

        // For now, only support single-level paths (field names)
        // Deep paths would require recursive logic
        const key = patch.path[0] as keyof T;

        switch (patch.op) {
            case 'replace':
            case 'add':
                (result as any)[key] = patch.value;
                break;
            case 'remove':
                delete (result as any)[key];
                break;
        }
    }

    return result;
}

/**
 * Build SQL clauses from patches
 * Returns [setClauses, values] for UPDATE statement
 */
export function buildUpdateFromPatches(
    patches: DeltaPatch[],
    fieldTransformers?: Record<string, (value: unknown) => unknown>
): { setClauses: string[]; values: unknown[] } {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const patch of patches) {
        if (patch.path.length === 0 || patch.op === 'remove') continue;

        const fieldName = patch.path[0] as string;
        let value = patch.value;

        // Apply transformer if provided (e.g., JSON.stringify for complex fields)
        if (fieldTransformers?.[fieldName]) {
            value = fieldTransformers[fieldName](value);
        }

        setClauses.push(`${fieldName} = ?`);
        values.push(value);
    }

    return { setClauses, values };
}
