
import { computePageRank } from './pagerank';
import { detectCommunitiesLouvain } from './communityDetection';
import { findShortestPath, findEntitiesWithinHops } from './pathfinding';
import { findStronglyConnectedComponents } from './componentAnalysis';

export async function verifyAlgorithmFoundation() {
    console.log('>>> VERIFYING GRAPH ALGORITHMS FOUNDATION <<<');

    const groupId = 'vault:global';

    // Check 1: PageRank
    try {
        console.log('Computing PageRank...');
        const pageRank = await computePageRank({ groupId });
        console.log('PageRank top entity:', pageRank.length > 0 ? pageRank[0].name : 'None');
    } catch (e) {
        console.error('PageRank verification failed', e);
    }

    // Check 2: Louvain
    try {
        console.log('Detecting Communities...');
        const communities = await detectCommunitiesLouvain({ groupId });
        console.log('Communities found:', communities.length);
        if (communities.length > 0) {
            console.log('Top community size:', communities[0].size);
        }
    } catch (e) {
        console.error('Louvain verification failed', e);
    }

    // Check 3: Pathfinding
    // Need two entities. Let's pick from PageRank results if available.
    try {
        const pageRank = await computePageRank({ groupId });
        if (pageRank.length >= 2) {
            const from = pageRank[0].entityId;
            const to = pageRank[1].entityId;
            console.log(`Finding path from ${pageRank[0].name} to ${pageRank[1].name}...`);
            const path = await findShortestPath({ groupId, fromEntityId: from, toEntityId: to });
            console.log('Path found:', path ? path.narrative : 'No path');

            console.log(`Finding neighbors of ${pageRank[0].name} (2 hops)...`);
            const neighbors = await findEntitiesWithinHops(from, 2, groupId);
            console.log('Neighbors count:', neighbors.length);
        } else {
            console.log('Skipping pathfinding check (not enough entities)');
        }
    } catch (e) {
        console.error('Pathfinding verification failed', e);
    }

    // Check 4: SCC
    try {
        console.log('Finding SCCs...');
        const sccs = await findStronglyConnectedComponents(groupId);
        console.log('SCCs found:', sccs.length);
    } catch (e) {
        console.error('SCC verification failed', e);
    }

    console.log('>>> ALGORITHM VERIFICATION COMPLETE <<<');
}
