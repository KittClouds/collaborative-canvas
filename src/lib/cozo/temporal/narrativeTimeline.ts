import { cozoDb } from '../db';

export interface TimelineEvent {
    entityId: string;
    name: string;
    entityKind: 'EVENT' | 'SCENE';
    timestamp: Date;           // Resolved from temporal_point or note date
    timestampSource: 'explicit' | 'note_date' | 'inferred';
    displayText: string;       // From temporal_point.display_text
    mentionCount: number;
    participants: string[];    // Entity names
    noteId: string;
}

export async function getNarrativeTimeline(
    groupId: string,
    options?: {
        entityKinds?: string[];  // Default: ['EVENT', 'SCENE']
        startDate?: Date;
        endDate?: Date;
    }
): Promise<TimelineEvent[]> {
    const kinds = options?.entityKinds || ['EVENT', 'SCENE'];
    const kindFilter = JSON.stringify(kinds);

    // Strategy:
    // 1. Get all entities of target kinds in group.
    // 2. Join with temporal_point (optional).
    // 3. Join with canonical note (to get note date as fallback).
    // 4. Join with participants.

    // Note: Cozo Datalog `left join` is implicit if we use optional vars or separate queries.
    // Easier to fetch core data then enrich. 
    // However, for sorting/filtering, single query is better.

    // Combined query:
    // We want entities of specific kinds. 
    // We want their temporal points if any.
    // We want their canonical note date.

    const query = `
    ?[id, name, entity_kind, frequency, note_id, note_created, 
      tp_timestamp, tp_display, tp_source, participants] :=
      
      *entity{id, name, entity_kind, frequency, canonical_note_id: note_id, group_id, participants},
      group_id == $group_id,
      entity_kind in $kinds,
      
      *note{id: note_id, created_at: note_created},
      
      # Optional temporal point - explicit left join not fully supported in simple syntax,
      # but we can query it and merge in code, or use 'default' values if Cozo supports it.
      # Cozo's idiomatic way for optional: separate rules or 'or' branches.
      # For simplicity in this "implementation" phase, we'll fetch entities and then enrich with parallel queries
      # or try a comprehensive query if possible.
      # Let's try fetching entity+note basics first, then temporal points.
      true
  `;

    // Actually, let's just fetch all relevant entities and their data.
    // We need to support "timeline" which implies ordering.

    const entityQuery = `
    ?[id, name, entity_kind, frequency, note_id, note_created, participants] :=
      *entity{id, name, entity_kind, frequency, canonical_note_id: note_id, group_id, participants},
      group_id == $group_id,
      entity_kind in $kinds,
      *note{id: note_id, created_at: note_created}
  `;

    let events: any[] = [];
    try {
        const res = await cozoDb.runQuery(entityQuery, { group_id: groupId, kinds });
        if (res.ok && res.rows) {
            events = res.rows.map((r: any[]) => ({
                id: r[0],
                name: r[1],
                entityKind: r[2],
                frequency: r[3],
                noteId: r[4],
                noteCreated: r[5] * 1000, // s to ms
                participantsIds: r[6] as string[]
            }));
        }
    } catch (err) {
        console.error('Timeline entity fetch failed', err);
        return [];
    }

    if (events.length === 0) return [];

    // Fetch temporal points for these entities
    const entityIds = events.map(e => e.id);
    const tpQuery = `
    ?[entity_id, timestamp, display_text, source] :=
      *temporal_point{entity_id, timestamp, display_text, source},
      entity_id in $ids
  `;

    const tpMap = new Map<string, { timestamp?: number; display?: string; source?: string }>();
    try {
        const res = await cozoDb.runQuery(tpQuery, { ids: entityIds });
        if (res.ok && res.rows) {
            res.rows.forEach((r: any[]) => {
                tpMap.set(r[0], {
                    timestamp: r[1] ? r[1] * 1000 : undefined,
                    display: r[2],
                    source: r[3]
                });
            });
        }
    } catch (e) {
        console.warn('Timeline temporal points fetch failed', e);
    }

    // Resolve Names for Participants (optimistic, could be another query or cache)
    // For now, let's just use IDs or fetch names if needed. 
    // The entities table has names. We scan all entities to map ID->Name? expensive.
    // We can fetch names for all participant IDs collected.
    const allParticipantIds = new Set<string>();
    events.forEach(e => e.participantsIds.forEach((p: string) => allParticipantIds.add(p)));

    const namesMap = new Map<string, string>();
    if (allParticipantIds.size > 0) {
        const nameQuery = `
      ?[id, name] := *entity{id, name}, id in $ids
    `;
        try {
            const res = await cozoDb.runQuery(nameQuery, { ids: Array.from(allParticipantIds) });
            if (res.ok && res.rows) {
                res.rows.forEach((r: any[]) => namesMap.set(r[0], r[1]));
            }
        } catch (e) { }
    }

    // Assemble Timeline
    const timeline: TimelineEvent[] = events.map(e => {
        const tp = tpMap.get(e.id);
        let timestamp = new Date(e.noteCreated);
        let source: TimelineEvent['timestampSource'] = 'note_date';
        let displayText = e.name; // accurate enough fallback? Or use note title? content?

        if (tp && tp.timestamp) {
            timestamp = new Date(tp.timestamp);
            source = 'explicit';
        }

        if (tp && tp.display) {
            displayText = tp.display;
        }

        const participants = e.participantsIds.map((id: string) => namesMap.get(id) || id);

        return {
            entityId: e.id,
            name: e.name,
            entityKind: e.entityKind,
            timestamp,
            timestampSource: source,
            displayText,
            mentionCount: e.frequency,
            participants,
            noteId: e.noteId
        };
    });

    // Filter by date range if provided
    const filtered = timeline.filter(t => {
        if (options?.startDate && t.timestamp < options.startDate) return false;
        if (options?.endDate && t.timestamp > options.endDate) return false;
        return true;
    });

    // Sort
    filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return filtered;
}
