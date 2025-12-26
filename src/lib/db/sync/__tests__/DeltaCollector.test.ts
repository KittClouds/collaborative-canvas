/**
 * SyncEngineV2 Test Suite
 * 
 * Validates the weapons-grade sync engine:
 * - DeltaCollector field-level patching
 * - Operation coalescing (INSERT→UPDATE, INSERT→DELETE, etc.)
 * - Version tracking (vector clock foundation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeltaCollector } from '../DeltaCollector';
import type { Delta } from '../types';

describe('DeltaCollector', () => {
    let collector: DeltaCollector;
    let flushedDeltas: Delta[] = [];
    let flushPromise: Promise<void>;
    let resolveFlush: () => void;

    beforeEach(() => {
        flushedDeltas = [];
        flushPromise = new Promise(resolve => {
            resolveFlush = resolve;
        });

        collector = new DeltaCollector(
            async (deltas) => {
                flushedDeltas = deltas;
                resolveFlush();
            },
            { debounceMs: 10, maxWaitMs: 50, maxDeltasBeforeFlush: 5 }
        );
    });

    afterEach(() => {
        collector.clear();
    });

    describe('Insert operations', () => {
        it('should track node inserts with full data', async () => {
            collector.insert('node-1', 'node', {
                type: 'NOTE',
                label: 'Test Note',
                content: 'Hello world'
            });

            expect(collector.getPendingCount()).toBe(1);

            await collector.flush();

            expect(flushedDeltas).toHaveLength(1);
            expect(flushedDeltas[0].id).toBe('node-1');
            expect(flushedDeltas[0].operation).toBe('INSERT');
            expect(flushedDeltas[0].fullData).toMatchObject({
                type: 'NOTE',
                label: 'Test Note'
            });
        });

        it('should increment version on each operation', async () => {
            collector.insert('node-1', 'node', { type: 'NOTE', label: 'V1' });
            collector.update('node-1', 'node', { label: 'V2' });

            await collector.flush();

            expect(flushedDeltas[0].version).toBe(2); // INSERT=1, UPDATE=2
        });
    });

    describe('Update operations', () => {
        it('should track field-level updates as patches', async () => {
            collector.update('node-1', 'node', { label: 'Updated' });

            await collector.flush();

            expect(flushedDeltas).toHaveLength(1);
            expect(flushedDeltas[0].operation).toBe('UPDATE');
            expect(flushedDeltas[0].patches).toEqual([
                { op: 'replace', path: ['label'], value: 'Updated' }
            ]);
        });

        it('should merge multiple patches for same entity', async () => {
            collector.update('node-1', 'node', { label: 'Updated' });
            collector.update('node-1', 'node', { content: 'New content' });

            await collector.flush();

            expect(flushedDeltas).toHaveLength(1);
            expect(flushedDeltas[0].patches).toHaveLength(2);
        });
    });

    describe('Delete operations', () => {
        it('should track deletes', async () => {
            collector.delete('node-1', 'node');

            await collector.flush();

            expect(flushedDeltas).toHaveLength(1);
            expect(flushedDeltas[0].operation).toBe('DELETE');
        });
    });

    describe('Operation coalescing', () => {
        it('should coalesce INSERT→UPDATE into INSERT with merged data', async () => {
            collector.insert('node-1', 'node', { type: 'NOTE', label: 'Original' });
            collector.update('node-1', 'node', { content: 'Added content' });

            await collector.flush();

            expect(flushedDeltas).toHaveLength(1);
            expect(flushedDeltas[0].operation).toBe('INSERT');
            expect(flushedDeltas[0].fullData).toMatchObject({
                label: 'Original',
                content: 'Added content'
            });
        });

        it('should coalesce INSERT→DELETE into no-op', async () => {
            collector.insert('node-1', 'node', { type: 'NOTE', label: 'Ephemeral' });
            collector.delete('node-1', 'node');

            expect(collector.getPendingCount()).toBe(0);
        });

        it('should handle DELETE→INSERT as resurrection (UPDATE)', async () => {
            // First, we need an existing entity
            collector.delete('node-1', 'node');
            collector.insert('node-1', 'node', { type: 'NOTE', label: 'Resurrected' });

            await collector.flush();

            expect(flushedDeltas).toHaveLength(1);
            expect(flushedDeltas[0].operation).toBe('UPDATE');
        });
    });

    describe('Flush behavior', () => {
        it('should flush immediately when hitting maxDeltasBeforeFlush', async () => {
            // Config has maxDeltasBeforeFlush = 5
            for (let i = 0; i < 5; i++) {
                collector.insert(`node-${i}`, 'node', { type: 'NOTE', label: `Note ${i}` });
            }

            // Wait a tick for the immediate flush
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(flushedDeltas).toHaveLength(5);
        });

        it('should debounce flushes', async () => {
            vi.useFakeTimers();

            collector.insert('node-1', 'node', { type: 'NOTE', label: 'Test' });
            collector.insert('node-2', 'node', { type: 'NOTE', label: 'Test 2' });

            expect(flushedDeltas).toHaveLength(0); // Not flushed yet

            await vi.advanceTimersByTimeAsync(15); // debounceMs = 10

            expect(flushedDeltas).toHaveLength(2); // Now flushed

            vi.useRealTimers();
        });
    });

    describe('Version tracking (CRDT foundation)', () => {
        it('should maintain separate version counters per entity', async () => {
            collector.insert('node-1', 'node', { type: 'NOTE', label: 'A' });
            collector.insert('node-2', 'node', { type: 'NOTE', label: 'B' });
            collector.update('node-1', 'node', { label: 'A updated' });

            expect(collector.getVersion('node-1')).toBe(2);
            expect(collector.getVersion('node-2')).toBe(1);
        });
    });
});
