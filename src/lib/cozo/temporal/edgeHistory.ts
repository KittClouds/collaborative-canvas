import { cozoDb } from '../db';

export interface EdgeVersion {
    validAt: Date;
    invalidAt?: Date;
    edgeType: string;
    weight: number;
    pmiScore?: number;
    fact?: string;
    episodeIds: string[]; // Provenance
    changeType: 'created' | 'strengthened' | 'weakened' | 'invalidated';
}

export async function getEdgeHistory(
    entity1Id: string,
    entity2Id: string,
    groupId: string
): Promise<EdgeVersion[]> {
    // Query all edge versions between these two entities
    // Since 'entity_edge' has valid_at/invalid_at (temporal columns), 
    // we might have multiple rows for the same source/target pair IF the schema allows it (historied)
    // OR we have multiple rows with different IDs (e.g. recreating edge)?
    // AND we rely on the temporal operator query `*entity_edge{...} @ $ts` for exact state,
    // BUT to get the *list* of changes, we can query the table directly if it retains history rows,
    // OR query the current table filter by source/target and inspect valid_at/invalid_at.
    // The schema `layer2-edges.ts` defines `valid_at` and `invalid_at`.
    // It seems we might insert NEW rows for updates? Or update existing?
    // If we update existing (increment weight), the `valid_at` might not change unless explicit.
    // Use `layer2-edges.ts` queries as hint: `incrementWeight` updates `weight` in place.
    // If it updates in place, we lose history unless Cozo records it.

    // Assuming Cozo's time travel works, we scan time?
    // Better approach: Query `mentions` co-occurrence to find timestamps where these two interacted,
    // then query the edge state at those times.

    // 1. Find interaction moments (co-occurrences in same episode)
    const momentsQuery = `
    ?[valid_at, episode_id] :=
      *mentions{episode_id, entity_id: $e1},
      *mentions{episode_id, entity_id: $e2},
      *episode{id: episode_id, valid_at},
      group_id == $group_id
    :order valid_at
  `;

    let moments: { validAt: number; episodeId: string }[] = [];
    try {
        const result = await cozoDb.runQuery(momentsQuery, {
            e1: entity1Id,
            e2: entity2Id,
            group_id: groupId
        });
        if (result.ok && result.rows) {
            moments = result.rows.map((r: any[]) => ({
                validAt: r[0] * 1000,
                episodeId: r[1]
            }));
        }
    } catch (err) {
        console.error('Failed to fetch edge history moments', err);
        return [];
    }

    const uniqueTimestamps = Array.from(new Set(moments.map(m => m.validAt))).sort((a, b) => a - b);
    const history: EdgeVersion[] = [];
    let prevWeight = 0;

    for (const ts of uniqueTimestamps) {
        // Query edge state at timestamp
        const query = `
      ?[edge_type, weight, pmi_score, fact, invalid_at] :=
        *entity_edge{source_id, target_id, edge_type, weight, pmi_score, fact, invalid_at} @ $ts,
        ((source_id == $e1 and target_id == $e2) or (source_id == $e2 and target_id == $e1))
    `;

        try {
            const result = await cozoDb.runQuery(query, {
                e1: entity1Id,
                e2: entity2Id,
                ts: ts / 1000
            });

            if (result.ok && result.rows && result.rows.length > 0) {
                const row = result.rows[0];
                const currentWeight = row[1];
                const invalidAt = row[4];

                let changeType: EdgeVersion['changeType'] = 'created';
                if (prevWeight > 0) {
                    if (invalidAt && (invalidAt * 1000) <= ts) {
                        changeType = 'invalidated';
                    } else if (currentWeight > prevWeight) {
                        changeType = 'strengthened';
                    } else if (currentWeight < prevWeight) {
                        changeType = 'weakened';
                    } else {
                        continue; // No change in weight, maybe just checking in
                        // Actually if just checking in, we might skip unless explicit update wanted
                    }
                }

                const episodes = moments.filter(m => Math.abs(m.validAt - ts) < 100).map(m => m.episodeId);

                history.push({
                    validAt: new Date(ts),
                    invalidAt: invalidAt ? new Date(invalidAt * 1000) : undefined,
                    edgeType: row[0],
                    weight: currentWeight,
                    pmiScore: row[2],
                    fact: row[3],
                    episodeIds: episodes,
                    changeType
                });

                prevWeight = currentWeight;
            }
        } catch (e) {
            // ignore
        }
    }

    return history;
}
