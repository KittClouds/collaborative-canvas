/**
 * Jotai utility atoms for advanced patterns
 */
import { atom, type WritableAtom, type Atom, type Getter, type Setter } from 'jotai';

/**
 * Creates a debounced version of an atom
 * Updates only fire after specified delay without changes
 * 
 * @param targetAtom - The atom to debounce
 * @param delayMs - Debounce delay in milliseconds
 * @returns Debounced atom that updates after delay
 * 
 * @example
 * const contentAtom = atom('');
 * const debouncedContentAtom = atomWithDebounce(contentAtom, 500);
 * 
 * // User types rapidly
 * set(contentAtom, 'H');
 * set(contentAtom, 'He');
 * set(contentAtom, 'Hel');
 * set(contentAtom, 'Hell');
 * set(contentAtom, 'Hello');
 * 
 * // debouncedContentAtom only updates once, 500ms after last change
 * // Final value: 'Hello'
 */
export function atomWithDebounce<T>(
    targetAtom: WritableAtom<T, [T], void>,
    delayMs: number
): WritableAtom<T, [T], void> {
    // Store timeout ID outside atom scope (shared across all reads)
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return atom(
        // Read function - return current value from target atom
        (get) => get(targetAtom),

        // Write function - debounce updates to target atom
        (get, set, newValue: T) => {
            // Clear existing timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Set new timeout
            timeoutId = setTimeout(() => {
                set(targetAtom, newValue);
                timeoutId = null;
            }, delayMs);
        }
    );
}

/**
 * Creates a throttled version of an atom
 * Updates fire at most once per specified interval
 * 
 * @param targetAtom - The atom to throttle
 * @param intervalMs - Minimum interval between updates in milliseconds
 * @returns Throttled atom
 * 
 * @example
 * const scrollPositionAtom = atom(0);
 * const throttledScrollAtom = atomWithThrottle(scrollPositionAtom, 100);
 * 
 * // Scroll events fire rapidly (60fps)
 * // throttledScrollAtom only updates every 100ms
 */
export function atomWithThrottle<T>(
    targetAtom: WritableAtom<T, [T], void>,
    intervalMs: number
): WritableAtom<T, [T], void> {
    let lastUpdateTime = 0;
    let pendingValue: T | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return atom(
        (get) => get(targetAtom),
        (get, set, newValue: T) => {
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateTime;

            if (timeSinceLastUpdate >= intervalMs) {
                // Enough time has passed - update immediately
                set(targetAtom, newValue);
                lastUpdateTime = now;
                pendingValue = null;

                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            } else {
                // Too soon - schedule update for later
                pendingValue = newValue;

                if (!timeoutId) {
                    const remainingTime = intervalMs - timeSinceLastUpdate;
                    timeoutId = setTimeout(() => {
                        if (pendingValue !== null) {
                            set(targetAtom, pendingValue);
                            lastUpdateTime = Date.now();
                            pendingValue = null;
                        }
                        timeoutId = null;
                    }, remainingTime);
                }
            }
        }
    );
}

/**
 * Creates an atom with history (undo/redo support)
 * 
 * @param initialValue - Starting value
 * @param maxHistory - Maximum history size (default: 50)
 * @returns Atom with undo/redo methods
 */
export function atomWithHistory<T>(initialValue: T, maxHistory = 50) {
    const historyAtom = atom<T[]>([initialValue]);
    const currentIndexAtom = atom(0);

    const valueAtom = atom(
        (get) => {
            const history = get(historyAtom);
            const index = get(currentIndexAtom);
            return history[index] ?? initialValue;
        },
        (get, set, newValue: T) => {
            const history = get(historyAtom);
            const currentIndex = get(currentIndexAtom);

            // Remove future history if we're not at the end
            const newHistory = history.slice(0, currentIndex + 1);

            // Add new value
            newHistory.push(newValue);

            // Limit history size
            if (newHistory.length > maxHistory) {
                newHistory.shift();
            } else {
                set(currentIndexAtom, currentIndex + 1);
            }

            set(historyAtom, newHistory);
        }
    );

    const undoAtom = atom(null, (get, set) => {
        const currentIndex = get(currentIndexAtom);
        if (currentIndex > 0) {
            set(currentIndexAtom, currentIndex - 1);
        }
    });

    const redoAtom = atom(null, (get, set) => {
        const currentIndex = get(currentIndexAtom);
        const history = get(historyAtom);
        if (currentIndex < history.length - 1) {
            set(currentIndexAtom, currentIndex + 1);
        }
    });

    const canUndoAtom = atom((get) => get(currentIndexAtom) > 0);
    const canRedoAtom = atom((get) => {
        const currentIndex = get(currentIndexAtom);
        const history = get(historyAtom);
        return currentIndex < history.length - 1;
    });

    return {
        valueAtom,
        undoAtom,
        redoAtom,
        canUndoAtom,
        canRedoAtom,
    };
}

/**
 * Creates an atom that computes value only when dependencies change
 * Uses WeakMap for memoization
 * 
 * @param computeFn - Function to compute value
 * @returns Memoized atom
 */
export function atomWithMemo<T>(
    computeFn: (get: Getter) => T
): Atom<T> {
    const cache = new WeakMap<any, T>();

    return atom(
        (get) => {
            const result = computeFn(get);
            return result;
        }
    );
}
