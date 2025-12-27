/**
 * Performance monitoring for note switching
 * Helps track migration improvements
 */

interface PerfMark {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
}

const marks = new Map<string, PerfMark>();

/**
 * Start timing an operation
 */
export function perfStart(name: string): void {
    marks.set(name, {
        name,
        startTime: performance.now(),
    });
}

/**
 * End timing an operation and log result
 */
export function perfEnd(name: string): number | null {
    const mark = marks.get(name);
    if (!mark) {
        console.warn(`[Perf] No mark found for "${name}"`);
        return null;
    }

    const endTime = performance.now();
    const duration = endTime - mark.startTime;

    mark.endTime = endTime;
    mark.duration = duration;

    console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`);

    marks.delete(name);
    return duration;
}

/**
 * Wrap a function to measure its execution time
 */
export function perfWrap<T extends (...args: any[]) => any>(
    name: string,
    fn: T
): T {
    return ((...args: any[]) => {
        perfStart(name);
        const result = fn(...args);

        if (result instanceof Promise) {
            return result.finally(() => perfEnd(name));
        }

        perfEnd(name);
        return result;
    }) as T;
}

/**
 * Hook to measure component render time
 */
import { useEffect, useRef } from 'react';

export function usePerfRender(componentName: string) {
    const renderCount = useRef(0);
    const renderStart = useRef(performance.now());

    useEffect(() => {
        const renderTime = performance.now() - renderStart.current;
        renderCount.current++;

        console.log(
            `[Perf] ${componentName} render #${renderCount.current}: ${renderTime.toFixed(2)}ms`
        );

        renderStart.current = performance.now();
    });
}
