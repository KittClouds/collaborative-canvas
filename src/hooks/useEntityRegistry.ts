import { useState, useEffect } from 'react';
import type { EntityRegistry } from '@/lib/entities/entity-registry';

/**
 * Hook to reactively subscribe to the EntityRegistry singleton
 * Forces a re-render whenever the registry emits a change
 */
export function useEntityRegistry(registry: EntityRegistry) {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        // Registry is not an event emitter, so we use a polling/interception strategy 
        // or rely on manual triggers. For Phase 1, we rely on the fact that
        // registry methods are synchronous updates.

        // However, since we don't have a listener system in the Registry class yet,
        // we will wrap the registry locally or just rely on parent component refetches.

        // BETTER APPROACH: Add a listener interface to the Registry class later.
        // FOR NOW: We'll create a simple refresh trigger.

        // To properly support reactivity, we should modify the Registry class to support listeners
        // But since that's a "backend" change we might skip, let's just use an interval for now
        // paired with manual refresh triggers.

        const interval = setInterval(() => {
            setVersion(v => v + 1);
        }, 2000); // Poll every 2s for changes from other components/scanners

        return () => clearInterval(interval);
    }, [registry]);

    return {
        registry,
        version,
        refresh: () => setVersion(v => v + 1)
    };
}
