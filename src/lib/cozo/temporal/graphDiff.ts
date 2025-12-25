import { getGraphSnapshot, GraphSnapshot } from './snapshotQueries';

export interface GraphDiff {
    dateA: Date;
    dateB: Date;
    entities: {
        added: Array<{ id: string; name: string; entityKind: string }>;
        removed: Array<{ id: string; name: string; entityKind: string }>;
        modified: Array<{
            id: string;
            name: string;
            changes: Record<string, { before: any; after: any }>;
            entityKind: string;
        }>;
    };
    edges: {
        added: Array<{ sourceId: string; targetId: string; weight: number }>;
        removed: Array<{ sourceId: string; targetId: string }>;
        modified: Array<{
            sourceId: string;
            targetId: string;
            weightChange: number; // Delta
            previousWeight: number;
            newWeight: number;
        }>;
    };
    summary: {
        totalChanges: number;
        entitiesAffected: number;
        edgesAffected: number;
        entitiesAdded: number;
        entitiesRemoved: number;
        entitiesModified: number;
        edgesAdded: number;
        edgesRemoved: number;
        edgesModified: number;
    };
}

export async function compareGraphStates(
    groupId: string,
    dateA: Date,
    dateB: Date
): Promise<GraphDiff> {
    // 1. Fetch snapshots
    const [snapshotA, snapshotB] = await Promise.all([
        getGraphSnapshot({
            groupId,
            timestamp: dateA,
            scope: 'vault', // Defaulting to vault for generic diff, or should we accept scope?
            // Ideally should accept scope. For now forcing vault/group context.
            includeEdges: true
        }),
        getGraphSnapshot({
            groupId,
            timestamp: dateB,
            scope: 'vault',
            includeEdges: true
        })
    ]);

    return computeDiff(snapshotA, snapshotB);
}

function computeDiff(snapA: GraphSnapshot, snapB: GraphSnapshot): GraphDiff {
    const diff: GraphDiff = {
        dateA: snapA.timestamp,
        dateB: snapB.timestamp,
        entities: { added: [], removed: [], modified: [] },
        edges: { added: [], removed: [], modified: [] },
        summary: {
            totalChanges: 0,
            entitiesAffected: 0,
            edgesAffected: 0,
            entitiesAdded: 0,
            entitiesRemoved: 0,
            entitiesModified: 0,
            edgesAdded: 0,
            edgesRemoved: 0,
            edgesModified: 0
        }
    };

    // --- Entities ---
    const entitiesA = new Map(snapA.entities.map(e => [e.id, e]));
    const entitiesB = new Map(snapB.entities.map(e => [e.id, e]));

    // Check Added (in B not A)
    for (const [id, entity] of entitiesB) {
        if (!entitiesA.has(id)) {
            diff.entities.added.push({ id, name: entity.name, entityKind: entity.entityKind });
        } else {
            // Check Modified
            const prev = entitiesA.get(id)!;
            // In snapshot, we only have id, name, kind, validAt, frequency. 
            // We don't have full attributes in snapshot currently (to save bandwidth).
            // So we can only diff what's in the snapshot.
            // If we want detailed attribute diffs, snapshot needs to include them or we fetch on demand.
            // For now, diffing name/kind/frequency.
            const changes: Record<string, { before: any; after: any }> = {};

            if (prev.name !== entity.name) {
                changes.name = { before: prev.name, after: entity.name };
            }
            if (prev.entityKind !== entity.entityKind) {
                changes.entityKind = { before: prev.entityKind, after: entity.entityKind };
            }
            if (prev.frequency !== entity.frequency) {
                changes.frequency = { before: prev.frequency, after: entity.frequency };
            }

            if (Object.keys(changes).length > 0) {
                diff.entities.modified.push({
                    id,
                    name: entity.name,
                    entityKind: entity.entityKind,
                    changes
                });
            }
        }
    }

    // Check Removed (in A not B)
    for (const [id, entity] of entitiesA) {
        if (!entitiesB.has(id)) {
            diff.entities.removed.push({ id, name: entity.name, entityKind: entity.entityKind });
        }
    }

    // --- Edges ---
    // Key: source--target
    const getEdgeKey = (e: { sourceId: string; targetId: string }) => `${e.sourceId}--${e.targetId}`;

    const edgesA = new Map(snapA.edges.map(e => [getEdgeKey(e), e]));
    const edgesB = new Map(snapB.edges.map(e => [getEdgeKey(e), e]));

    // Added
    for (const [key, edge] of edgesB) {
        if (!edgesA.has(key)) {
            diff.edges.added.push({ sourceId: edge.sourceId, targetId: edge.targetId, weight: edge.weight });
        } else {
            // Modified
            const prev = edgesA.get(key)!;
            if (prev.weight !== edge.weight) {
                diff.edges.modified.push({
                    sourceId: edge.sourceId,
                    targetId: edge.targetId,
                    weightChange: edge.weight - prev.weight,
                    previousWeight: prev.weight,
                    newWeight: edge.weight
                });
            }
        }
    }

    // Removed
    for (const [key, edge] of edgesA) {
        if (!edgesB.has(key)) {
            diff.edges.removed.push({ sourceId: edge.sourceId, targetId: edge.targetId });
        }
    }

    // Summarize
    diff.summary.entitiesAdded = diff.entities.added.length;
    diff.summary.entitiesRemoved = diff.entities.removed.length;
    diff.summary.entitiesModified = diff.entities.modified.length;
    diff.summary.entitiesAffected = diff.summary.entitiesAdded + diff.summary.entitiesRemoved + diff.summary.entitiesModified;

    diff.summary.edgesAdded = diff.edges.added.length;
    diff.summary.edgesRemoved = diff.edges.removed.length;
    diff.summary.edgesModified = diff.edges.modified.length;
    diff.summary.edgesAffected = diff.summary.edgesAdded + diff.summary.edgesRemoved + diff.summary.edgesModified;

    diff.summary.totalChanges = diff.summary.entitiesAffected + diff.summary.edgesAffected;

    return diff;
}
