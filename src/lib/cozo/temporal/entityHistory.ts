import { cozoDb } from '../db';

export interface EntityVersion {
    validAt: Date;
    name: string;
    summary?: string;
    attributes?: Record<string, any>;
    frequency: number;
    changes: {
        added: string[];    // New fields
        modified: string[]; // Changed fields
        removed: string[];  // Deleted fields
    };
    episodesMentioned: string[]; // Episodes added in this version
}

export async function getEntityHistory(
    entityId: string
): Promise<EntityVersion[]> {
    // Strategy:
    // 1. Find all "meaningful moments" for this entity.
    //    Since 'entity' table might not be fully temporal (keyed by ID only), we use
    //    mentions and episode valid_at times as proxies for when the entity might have changed.
    // 2. Query entity state at those moments using time-travel (@ timestamp).
    // 3. Compute diffs between consecutive states.

    const momentsQuery = `
    ?[valid_at, episode_id] :=
      *mentions{entity_id, episode_id},
      entity_id == $entity_id,
      *episode{id: episode_id, valid_at}
    :order valid_at
  `;

    let moments: { validAt: number; episodeId: string }[] = [];
    try {
        const result = await cozoDb.runQuery(momentsQuery, { entity_id: entityId });
        if (result.ok && result.rows) {
            moments = result.rows.map((r: any[]) => ({
                validAt: r[0] * 1000, // Assuming internal float seconds -> ms
                episodeId: r[1]
            }));
        }
    } catch (err) {
        console.error('Failed to fetch entity history moments', err);
        return [];
    }

    // Deduplicate timestamps (roughly), keep episode mapping
    const uniqueTimestamps = Array.from(new Set(moments.map(m => m.validAt))).sort((a, b) => a - b);

    const history: EntityVersion[] = [];
    let previousState: any = null;

    for (const ts of uniqueTimestamps) {
        // Query entity state at this timestamp
        // Assuming valid_at in entity is created_at
        const query = `
      ?[name, summary, attributes, frequency] :=
        *entity{id, name, summary, attributes, frequency} @ $ts,
        id == $entity_id
    `;

        // Note: Cozo expects seconds for float timestamp usually
        const cozoTs = ts / 1000;

        try {
            const result = await cozoDb.runQuery(query, { entity_id: entityId, ts: cozoTs });
            if (result.ok && result.rows && result.rows.length > 0) {
                const row = result.rows[0];
                const currentState = {
                    name: row[0],
                    summary: row[1],
                    attributes: row[2] as Record<string, any> || {},
                    frequency: row[3]
                };

                const changes = computeDiff(previousState, currentState);

                // Find episodes associated with this exact timestamp (approx)
                const episodes = moments.filter(m => Math.abs(m.validAt - ts) < 100).map(m => m.episodeId);

                history.push({
                    validAt: new Date(ts),
                    name: currentState.name,
                    summary: currentState.summary,
                    attributes: currentState.attributes,
                    frequency: currentState.frequency,
                    changes,
                    episodesMentioned: episodes
                });

                previousState = currentState;
            }
        } catch (err) {
            // Continue if specific timestamp fails
        }
    }

    return history;
}

function computeDiff(prev: any, curr: any): EntityVersion['changes'] {
    const changes: EntityVersion['changes'] = { added: [], modified: [], removed: [] };

    if (!prev) {
        // First version, everything is added
        changes.added = Object.keys(curr.attributes || {});
        if (curr.summary) changes.added.push('summary');
        if (curr.name) changes.added.push('name');
        return changes;
    }

    // Compare attributes
    const prevAttrs = prev.attributes || {};
    const currAttrs = curr.attributes || {};
    const allKeys = new Set([...Object.keys(prevAttrs), ...Object.keys(currAttrs)]);

    for (const key of allKeys) {
        if ((key in currAttrs) && !(key in prevAttrs)) {
            changes.added.push(key);
        } else if (!(key in currAttrs) && (key in prevAttrs)) {
            changes.removed.push(key);
        } else if (JSON.stringify(currAttrs[key]) !== JSON.stringify(prevAttrs[key])) {
            changes.modified.push(key);
        }
    }

    // Core fields
    if (prev.name !== curr.name) changes.modified.push('name');
    if (prev.summary !== curr.summary) changes.modified.push('summary');

    return changes;
}
