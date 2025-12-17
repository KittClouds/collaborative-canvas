/**
 * Timeline Query Engine
 * Handles context-aware querying of narrative entities for timeline visualization.
 */

import { addMonths, addWeeks, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { EntityKind, NarrativeEntityKind, ENTITY_KINDS } from '@/lib/entities/entityTypes';
import { NarrativeEntity } from '@/types/narrativeEntities';

export type TimelineContextType =
    | 'MASTER'
    | 'ENTITY'
    | 'NARRATIVE'
    | 'TEMPORAL'
    | 'CUSTOM';

export interface TimelineQuery {
    // Context
    contextType: TimelineContextType;
    contextId?: string;
    contextKind?: EntityKind;

    // Filters
    includeKinds: EntityKind[];
    relatedToEntityId?: string;
    dateRange?: {
        start: Date | null;
        end: Date | null;
    };
    statusFilter?: string[];
    importanceFilter?: string[];

    // Sorting & Grouping
    sortBy: 'temporal' | 'narrative' | 'importance' | 'creation';
    groupBy: 'none' | 'date' | 'act' | 'chapter' | 'location' | 'character';

    // View options
    showCausalChains?: boolean;
}

export interface TimelineItem {
    entity: NarrativeEntity; // or simplified entity wrapper
    id: string;
    date?: Date;
    groupKey?: string;
    sortValue: number | string;
}

export class TimelineQueryEngine {
    /**
     * Generates a default query based on the current context (active note/entity)
     */
    static fromContext(kind?: EntityKind, id?: string): TimelineQuery {
        if (!kind || !id) {
            // MASTER VIEW: Show all major narrative beats and events
            return {
                contextType: 'MASTER',
                includeKinds: ['SCENE', 'EVENT', 'ARC', 'ACT'],
                sortBy: 'temporal',
                groupBy: 'date',
            };
        }

        if (kind === 'CHARACTER' || kind === 'NPC' || kind === 'LOCATION' || kind === 'FACTION' || kind === 'ITEM') {
            // ENTITY VIEW: Show scenes and events related to this entity
            return {
                contextType: 'ENTITY',
                contextId: id,
                contextKind: kind,
                includeKinds: ['SCENE', 'EVENT'],
                relatedToEntityId: id,
                sortBy: 'temporal',
                groupBy: 'none',
            };
        }

        if (kind === 'ARC' || kind === 'ACT' || kind === 'CHAPTER') {
            // NARRATIVE STRUCTURE VIEW: Show hierarchical children
            return {
                contextType: 'NARRATIVE',
                contextId: id,
                contextKind: kind,
                includeKinds: ['ACT', 'CHAPTER', 'SCENE', 'BEAT', 'EVENT'],
                sortBy: 'narrative',
                groupBy: kind === 'ARC' ? 'act' : (kind === 'ACT' ? 'chapter' : 'none'),
            };
        }

        if (kind === 'SCENE') {
            // SCENE VIEW: Show beats and internal events
            return {
                contextType: 'NARRATIVE',
                contextId: id,
                contextKind: kind,
                includeKinds: ['BEAT', 'EVENT'],
                sortBy: 'temporal',
                groupBy: 'none',
            };
        }

        if (kind === 'EVENT') {
            // EVENT VIEW: Show causal chains (triggers/consequences)
            return {
                contextType: 'TEMPORAL',
                contextId: id,
                contextKind: kind,
                includeKinds: ['EVENT', 'SCENE'],
                sortBy: 'temporal',
                groupBy: 'none',
                showCausalChains: true,
            };
        }

        // Fallback
        return {
            contextType: 'CUSTOM',
            includeKinds: ['SCENE', 'EVENT'],
            sortBy: 'temporal',
            groupBy: 'none',
        };
    }

    /**
     * Executes the query against a list of entities
     * In a real app, this might query the database. Here we filter in-memory lists.
     */
    static execute(query: TimelineQuery, allEntities: any[]): TimelineItem[] {
        // 1. filter by kinds
        let results = allEntities.filter(e => query.includeKinds.includes(e.kind));

        // 2. filter by relationship
        if (query.relatedToEntityId) {
            // Check if entity has a link to the context ID
            results = results.filter(e => {
                const entity = e as any; // Safe cast for property access across union

                // Direct link
                if (entity.linkedEntityIds?.includes(query.relatedToEntityId)) return true;
                // Participants list
                if (entity.sceneMetadata?.participants?.includes(query.relatedToEntityId)) return true;
                if (entity.eventMetadata?.participants?.includes(query.relatedToEntityId)) return true;

                // Check if the context entity is a parent/child (hierarchy)
                if (entity.parentArcId === query.relatedToEntityId ||
                    entity.parentActId === query.relatedToEntityId ||
                    entity.parentChapterId === query.relatedToEntityId ||
                    entity.parentSceneId === query.relatedToEntityId) return true;

                return false;
            });

            // If querying for hierarchy context (e.g. Arc), we specifically want children
            if (query.contextType === 'NARRATIVE' && query.contextId) {
                results = results.filter(e => {
                    const entity = e as any;
                    return entity.parentArcId === query.contextId ||
                        entity.parentActId === query.contextId ||
                        entity.parentChapterId === query.contextId ||
                        entity.parentSceneId === query.contextId;
                });
            }
        }

        // 3. Filter by date range (if applicable)
        if (query.dateRange && query.dateRange.start && query.dateRange.end) {
            results = results.filter(e => {
                const date = e.temporal?.start?.timestamp;
                if (!date) return false;
                return isWithinInterval(new Date(date), {
                    start: query.dateRange!.start!,
                    end: query.dateRange!.end!
                });
            });
        }

        // 4. Map to TimelineItem
        let items: TimelineItem[] = results.map(e => {
            const entity = e as any;
            const date = entity.temporal?.start?.timestamp ? new Date(entity.temporal.start.timestamp) : undefined;

            // Determine sort value
            let sortValue: number | string = 0;
            if (query.sortBy === 'temporal') {
                sortValue = date ? date.getTime() : (entity.temporal?.start?.sequence || 0);
            } else if (query.sortBy === 'narrative') {
                sortValue = entity.sequence || 0;
            } else if (query.sortBy === 'importance') {
                // rough heuristic map
                const importanceMap: Record<string, number> = { 'critical': 4, 'major': 3, 'minor': 2, 'background': 1 };
                const impact = entity.eventMetadata?.impact || entity.sceneMetadata?.stakes || 'minor';
                sortValue = importanceMap[impact] || 0;
            } else {
                // Fallback to creation or other
                sortValue = entity.createdAt ? new Date(entity.createdAt).getTime() : 0;
            }

            // Determine group key
            let groupKey = '';
            if (query.groupBy === 'date') {
                groupKey = date ? date.toLocaleDateString() : 'Undated';
            } else if (query.groupBy === 'act') {
                groupKey = entity.parentActId || 'Unassigned';
            } else if (query.groupBy === 'chapter') {
                groupKey = entity.parentChapterId || 'Unassigned';
            }

            return {
                entity: entity,
                id: entity.id,
                date,
                groupKey,
                sortValue
            };
        });

        // 5. Sort
        items.sort((a, b) => {
            if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') {
                return query.sortBy === 'importance' ? b.sortValue - a.sortValue : a.sortValue - b.sortValue;
            }
            return String(a.sortValue).localeCompare(String(b.sortValue));
        });

        return items;
    }
}
