import { describe, it, expect, vi } from 'vitest';
import { scannerEventBus } from '../core/ScannerEventBus';
import type { PatternMatchEvent } from '../types';

describe('ScannerEventBus', () => {
    it('should emit and receive events', () => {
        const handler = vi.fn();
        const unsubscribe = scannerEventBus.on('pattern-matched', handler);

        const event: PatternMatchEvent = {
            kind: 'entity',
            fullMatch: '[TEST|Entity]',
            position: 0,
            length: 13,
            captures: {},
            patternId: 'test-pattern',
            noteId: 'test-note',
            timestamp: Date.now(),
        };

        scannerEventBus.emit('pattern-matched', event);
        expect(handler).toHaveBeenCalledWith(event);
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        scannerEventBus.emit('pattern-matched', event);
        expect(handler).toHaveBeenCalledTimes(1); // Should not increase
    });

    it('should handle errors in listeners gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const handler = () => { throw new Error('Test Error'); };
        const unsubscribe = scannerEventBus.on('test-event', handler);

        expect(() => scannerEventBus.emit('test-event', {})).not.toThrow();
        expect(consoleSpy).toHaveBeenCalled();

        unsubscribe();
        consoleSpy.mockRestore();
    });
});
