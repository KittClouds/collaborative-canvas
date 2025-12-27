import { atom, type WritableAtom, type SetStateAction } from 'jotai';

export function atomWithDebounce<T>(
    deriveFn: (get: any) => T,
    delayMs: number
) {
    const debouncedAtom = atom<T | null>(null) as unknown as WritableAtom<T | null, [SetStateAction<T | null>], void>;
    let timeoutId: NodeJS.Timeout | null = null;

    return atom(
        (get) => get(debouncedAtom) ?? deriveFn(get), // Fallback to immediate
        (get, set) => {
            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                set(debouncedAtom, deriveFn(get));
            }, delayMs);
        }
    );
}
