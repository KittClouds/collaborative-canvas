
// Verification Script for Phase 6 Week 1 Tasks
// To run this, you would need to import it in a component or script that has access to initialized cozoDb.

import { getGraphSnapshot } from './snapshotQueries';
import { traceEntityProvenance } from './provenanceTracing';
import { getEntityHistory } from './entityHistory';
import { getEdgeHistory } from './edgeHistory';
import { compareGraphStates } from './graphDiff';
import { getNarrativeTimeline } from './narrativeTimeline';
import { TEMPORAL_PATTERNS } from './queryPatterns';
import { cozoDb } from '../db';

export async function verifyTemporalFoundation() {
    console.log('>>> VERIFYING TEMPORAL FOUNDATION <<<');

    // Check 1: Query Patterns
    console.log('Patterns defined:', Object.keys(TEMPORAL_PATTERNS));

    let entityId: string | undefined;

    // Check 2: Snapshot
    try {
        const now = new Date();
        const snapshot = await getGraphSnapshot({
            groupId: 'vault:global',
            timestamp: now,
            scope: 'vault',
            includeEdges: true
        });
        console.log('Snapshot result (Current):', {
            entities: snapshot.entities.length,
            edges: snapshot.edges.length,
            metadata: snapshot.metadata
        });
        if (snapshot.entities.length > 0) {
            entityId = snapshot.entities[0].id;
        }
    } catch (err) {
        console.error('Snapshot verification failed:', err);
    }

    // Check 3: Provenance
    if (entityId) {
        try {
            console.log(`Checking provenance for entity: ${entityId}`);
            const prov = await traceEntityProvenance(entityId);
            console.log('Provenance count:', prov.length);
        } catch (err) {
            console.error('Provenance verification failed:', err);
        }

        // Check 4: Entity History
        try {
            console.log('Checking entity history...');
            const history = await getEntityHistory(entityId);
            console.log('History versions:', history.length); // Fixed: history is Array
        } catch (err) {
            console.error('Entity History verification failed:', err);
        }
    }

    // Check 5: Diff / Timeline
    try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 86400000);

        console.log('Checking Graph Diff (Yesterday vs Now)...');
        const diff = await compareGraphStates('vault:global', yesterday, now);
        console.log('Diff Summary:', diff.summary);

        console.log('Checking Narrative Timeline...');
        const timeline = await getNarrativeTimeline('vault:global');
        console.log('Timeline events:', timeline.length);
    } catch (err) {
        console.error('Diff/Timeline verification failed:', err);
    }

    console.log('>>> VERIFICATION COMPLETE (Check logs) <<<');
}
