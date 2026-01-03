/**
 * atomFamily - Memoized atom factory
 * 
 * Replaces the deprecated jotai/utils atomFamily.
 * Creates atoms on-demand keyed by parameter.
 */

export function atomFamily<Param, AtomType>(createAtom: (param: Param) => AtomType) {
    const cache = new Map<string, AtomType>();
    return (param: Param): AtomType => {
        const key = typeof param === 'string' ? param : JSON.stringify(param);
        if (!cache.has(key)) {
            cache.set(key, createAtom(param));
        }
        return cache.get(key)!;
    };
}
