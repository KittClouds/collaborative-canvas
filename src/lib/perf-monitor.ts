import { atom } from 'jotai';

export const perfMetricsAtom = atom<Record<string, number>>({});

/**
 * Wrap a function with performance tracking.
 * Logs execution time if it exceeds 5ms.
 */
export function withPerfTracking<T>(
    name: string,
    fn: () => T
): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (duration > 5) { // Log slow operations
        console.warn(`[Perf] ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
}
