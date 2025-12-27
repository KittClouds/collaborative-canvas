import { useState, useEffect } from 'react';
import { ProjectionScope, GraphProjection } from '../lib/graph/projections/types';
import { ProjectionFactory } from '../lib/graph/projections/ProjectionFactory';
import { cozoDb } from '../lib/cozo/db';

export function useGraphProjection(scope: ProjectionScope, ttl = 60000) {
    const [projection, setProjection] = useState<GraphProjection | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let active = true;

        async function load() {
            if (!active) return;
            setLoading(true);
            setError(null);

            try {
                if (!cozoDb.isReady()) {
                    await cozoDb.init();
                }

                const projectionInstance = ProjectionFactory.create(cozoDb, scope);
                const result = await projectionInstance.projectCached(ttl);

                if (active) {
                    setProjection(result);
                }
            } catch (e) {
                if (active) {
                    setError(e instanceof Error ? e : new Error(String(e)));
                    console.error("Graph projection failed:", e);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [scope, ttl]);

    return { projection, loading, error };
}
