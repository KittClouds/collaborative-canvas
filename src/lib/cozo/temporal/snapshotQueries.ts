import { cozoDb } from '../db';
import { TEMPORAL_PATTERNS } from './queryPatterns';
import { temporalCache } from './cacheManager';

export interface SnapshotOptions {
    groupId: string;
    timestamp: Date;
    scope: 'note' | 'folder' | 'vault';
    includeEdges: boolean;
    minWeight?: number;
}

export interface GraphSnapshot {
    timestamp: Date;
    entities: Array<{
        id: string;
        name: string;
        entityKind: string;
        validAt: Date;
        frequency: number;
    }>;
    edges: Array<{
        sourceId: string;
        targetId: string;
        weight: number;
        validAt: Date;
        invalidAt?: Date;
    }>;
    metadata: {
        entityCount: number;
        edgeCount: number;
        queryTime: number; // in ms
        scopeWarning?: string;
    };
}

async function computeGraphSnapshot(
    options: SnapshotOptions
): Promise<GraphSnapshot> {
    const startTime = performance.now();

    // Cozo uses float/int (ms based on app convention)
    const queryParams = {
        group_id: options.groupId,
        timestamp: options.timestamp.getTime(),
        start_date: options.timestamp.getTime(),
    };

    let entities: GraphSnapshot['entities'] = [];
    let edges: GraphSnapshot['edges'] = [];

    // 1. Query Entities
    try {
        const entityResult = await cozoDb.runQuery(TEMPORAL_PATTERNS.entitiesAtTimestamp, queryParams);
        if (entityResult.ok && entityResult.rows) {
            entities = entityResult.rows.map((row: any[]) => ({
                id: row[0],
                name: row[1],
                entityKind: row[2],
                validAt: new Date(row[3]),
                frequency: row[4],
            }));
        }
    } catch (err) {
        console.error('Snapshot entity query failed', err);
    }

    // 2. Query Edges
    if (options.includeEdges) {
        try {
            const edgeResult = await cozoDb.runQuery(TEMPORAL_PATTERNS.activeEdgesAtTimestamp, queryParams);
            if (edgeResult.ok && edgeResult.rows) {
                // ... map rows ...
                const rawEdges = edgeResult.rows.map((row: any[]) => ({
                    id: row[0],
                    sourceId: row[1],
                    targetId: row[2],
                    weight: row[3],
                    validAt: new Date(row[4]),
                    invalidAt: row[5] ? new Date(row[5]) : undefined,
                }));

                edges = rawEdges;
                if (options.minWeight) {
                    edges = edges.filter(e => e.weight >= options.minWeight!);
                }
            }
        } catch (err) {
            console.error('Snapshot edge query failed', err);
        }
    }

    const duration = performance.now() - startTime;

    let scopeWarning: string | undefined;
    if (options.scope === 'vault' && entities.length > 5000) {
        scopeWarning = "Large result set, performance may be impacted.";
    }

    return {
        timestamp: options.timestamp,
        entities,
        edges: edges.map(e => ({
            sourceId: e.sourceId,
            targetId: e.targetId,
            weight: e.weight,
            validAt: e.validAt,
            invalidAt: e.invalidAt
        })),
        metadata: {
            entityCount: entities.length,
            edgeCount: edges.length,
            queryTime: Math.round(duration),
            scopeWarning
        }
    };
}

export async function getGraphSnapshot(
    options: SnapshotOptions
): Promise<GraphSnapshot> {
    const key = `snapshot:${options.groupId}:${options.timestamp.getTime()}:${options.includeEdges}`;
    return temporalCache.getOrCompute(key, () => computeGraphSnapshot(options));
}
