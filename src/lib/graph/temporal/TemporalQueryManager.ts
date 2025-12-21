import type {
    NodeId,
    EpisodeId,
    Episode,
    UnifiedNode,
    UnifiedEdge,
    // TemporalData, // Unused in this file currently, but likely useful later
    // TemporalRelation, // Unused in this file currently
} from '../types';
import type { EpisodeManager } from '../episodes/EpisodeManager';

/**
 * Temporal Query Manager
 * 
 * Handles all time-based queries across episodes and entities
 */
export class TemporalQueryManager {
    constructor(
        private episodeManager: EpisodeManager,
        private nodes: Map<NodeId, UnifiedNode>,
        private edges: Map<string, UnifiedEdge>
    ) { }

    /**
     * Get all episodes/entities within a time range
     */
    getTimeRange(
        start: Date,
        end: Date,
        options: TimeRangeOptions = {}
    ): TemporalQueryResult {
        const {
            includeOverlaps = true,
            entityKinds = [],
            episodeTypes = [],
            namespace,
        } = options;

        const episodes = this.episodeManager.getTimeline(namespace);
        const matchingEpisodes: Episode[] = [];
        const matchingEntities = new Set<NodeId>();

        for (const episode of episodes) {
            const episodeStart = episode.valid_at;
            const episodeEnd = episode.valid_to || episodeStart;

            // Check if episode falls within range
            const inRange = includeOverlaps
                ? this.rangesOverlap(start, end, episodeStart, episodeEnd)
                : this.rangeContains(start, end, episodeStart, episodeEnd);

            if (inRange) {
                // Filter by episode type if specified
                if (episodeTypes.length === 0 || episodeTypes.includes(episode.entity_kind)) {
                    matchingEpisodes.push(episode);

                    // Add entities from this episode
                    for (const entityId of episode.entity_ids) {
                        const node = this.nodes.get(entityId);
                        if (node) {
                            // Filter by entity kind if specified
                            if (entityKinds.length === 0 || (node.data.entityKind && entityKinds.includes(node.data.entityKind))) {
                                matchingEntities.add(entityId);
                            }
                        }
                    }
                }
            }
        }

        return {
            episodes: matchingEpisodes,
            entities: Array.from(matchingEntities),
            timeRange: { start, end },
        };
    }

    /**
     * Get events that happened BEFORE a specific episode/entity
     */
    getBefore(
        targetId: NodeId | EpisodeId,
        options: TemporalProximityOptions = {}
    ): TemporalQueryResult {
        const {
            maxDistance,
            directOnly = false,
            entityKinds = [],
            namespace,
        } = options;

        // Get target timestamp
        const targetTime = this.getTimestamp(targetId);
        if (!targetTime) {
            return { episodes: [], entities: [], timeRange: null };
        }

        const episodes = this.episodeManager.getTimeline(namespace);
        const matchingEpisodes: Episode[] = [];
        const matchingEntities = new Set<NodeId>();

        for (const episode of episodes) {
            const episodeTime = episode.valid_to || episode.valid_at;

            // Check if episode is before target
            if (episodeTime < targetTime) {
                // Check distance constraint
                if (maxDistance) {
                    const distance = targetTime.getTime() - episodeTime.getTime();
                    if (distance > maxDistance) continue;
                }

                // Check if directly connected (for directOnly)
                if (directOnly) {
                    // const episodeNode = this.nodes.get(episode.node_id);
                    // if (!episodeNode) continue;

                    const isConnected = this.isDirectlyConnected(episode.node_id, targetId);
                    if (!isConnected) continue;
                }

                matchingEpisodes.push(episode);

                // Add entities
                for (const entityId of episode.entity_ids) {
                    const node = this.nodes.get(entityId);
                    if (node && (entityKinds.length === 0 || (node.data.entityKind && entityKinds.includes(node.data.entityKind)))) {
                        matchingEntities.add(entityId);
                    }
                }
            }
        }

        return {
            episodes: matchingEpisodes.sort((a, b) =>
                b.valid_at.getTime() - a.valid_at.getTime() // Most recent first
            ),
            entities: Array.from(matchingEntities),
            timeRange: { start: new Date(0), end: targetTime },
        };
    }

    /**
     * Get events that happened AFTER a specific episode/entity
     */
    getAfter(
        targetId: NodeId | EpisodeId,
        options: TemporalProximityOptions = {}
    ): TemporalQueryResult {
        const {
            maxDistance,
            directOnly = false,
            entityKinds = [],
            namespace,
        } = options;

        const targetTime = this.getTimestamp(targetId);
        if (!targetTime) {
            return { episodes: [], entities: [], timeRange: null };
        }

        const episodes = this.episodeManager.getTimeline(namespace);
        const matchingEpisodes: Episode[] = [];
        const matchingEntities = new Set<NodeId>();

        for (const episode of episodes) {
            const episodeTime = episode.valid_at;

            if (episodeTime > targetTime) {
                if (maxDistance) {
                    const distance = episodeTime.getTime() - targetTime.getTime();
                    if (distance > maxDistance) continue;
                }

                if (directOnly) {
                    const isConnected = this.isDirectlyConnected(episode.node_id, targetId);
                    if (!isConnected) continue;
                }

                matchingEpisodes.push(episode);

                for (const entityId of episode.entity_ids) {
                    const node = this.nodes.get(entityId);
                    if (node && (entityKinds.length === 0 || (node.data.entityKind && entityKinds.includes(node.data.entityKind)))) {
                        matchingEntities.add(entityId);
                    }
                }
            }
        }

        return {
            episodes: matchingEpisodes.sort((a, b) =>
                a.valid_at.getTime() - b.valid_at.getTime() // Chronological
            ),
            entities: Array.from(matchingEntities),
            timeRange: { start: targetTime, end: new Date(Date.now()) },
        };
    }

    /**
     * Get events happening DURING a specific episode
     */
    getDuring(
        episodeId: EpisodeId,
        options: DuringOptions = {}
    ): TemporalQueryResult {
        const { includeNested = true, entityKinds = [] } = options;

        const episode = this.episodeManager.getEpisode(episodeId);
        if (!episode) {
            return { episodes: [], entities: [], timeRange: null };
        }

        const matchingEpisodes: Episode[] = [episode];
        const matchingEntities = new Set<NodeId>();

        // Add direct entities
        for (const entityId of episode.entity_ids) {
            const node = this.nodes.get(entityId);
            if (node && (entityKinds.length === 0 || (node.data.entityKind && entityKinds.includes(node.data.entityKind)))) {
                matchingEntities.add(entityId);
            }
        }

        // Include nested episodes (e.g., scenes within a chapter)
        if (includeNested) {
            const children = this.episodeManager.getAllChildren(episodeId);
            matchingEpisodes.push(...children);

            for (const childEpisode of children) {
                for (const entityId of childEpisode.entity_ids) {
                    const node = this.nodes.get(entityId);
                    if (node && (entityKinds.length === 0 || (node.data.entityKind && entityKinds.includes(node.data.entityKind)))) {
                        matchingEntities.add(entityId);
                    }
                }
            }
        }

        return {
            episodes: matchingEpisodes,
            entities: Array.from(matchingEntities),
            timeRange: {
                start: episode.valid_at,
                end: episode.valid_to || episode.valid_at,
            },
        };
    }

    /**
     * Get entity's timeline (all episodes they appear in)
     */
    getEntityTimeline(
        entityId: NodeId,
        options: EntityTimelineOptions = {}
    ): EntityTimeline {
        const { includeRelatedEvents = false } = options;

        const appearances = this.episodeManager.getEntityAppearances(entityId);

        const timeline: EntityTimeline = {
            entity_id: entityId,
            first_appearance: appearances[0],
            last_appearance: appearances[appearances.length - 1],
            total_appearances: appearances.length,
            episodes: appearances,
            gaps: [],
        };

        // Calculate gaps between appearances
        for (let i = 0; i < appearances.length - 1; i++) {
            const current = appearances[i];
            const next = appearances[i + 1];

            const currentEnd = current.valid_to || current.valid_at;
            const gapDuration = next.valid_at.getTime() - currentEnd.getTime();

            if (gapDuration > 0) {
                timeline.gaps.push({
                    start: currentEnd,
                    end: next.valid_at,
                    duration_ms: gapDuration,
                });
            }
        }

        // Include related events (connected entities' episodes)
        if (includeRelatedEvents) {
            const relatedEntities = this.getRelatedEntities(entityId);
            const relatedEpisodes = new Set<EpisodeId>();

            for (const relatedId of relatedEntities) {
                const relatedAppearances = this.episodeManager.getEntityAppearances(relatedId);
                for (const episode of relatedAppearances) {
                    relatedEpisodes.add(episode.id);
                }
            }

            timeline.related_episodes = Array.from(relatedEpisodes)
                .map(id => this.episodeManager.getEpisode(id))
                .filter((e): e is Episode => e !== undefined)
                .sort((a, b) => a.valid_at.getTime() - b.valid_at.getTime());
        }

        return timeline;
    }

    /**
     * Find temporal sequences (causal chains)
     */
    findSequence(
        startId: NodeId | EpisodeId,
        endId: NodeId | EpisodeId,
        options: SequenceOptions = {}
    ): TemporalSequence | null {
        const { maxHops = 10, requireCausal = false } = options;

        const startTime = this.getTimestamp(startId);
        const endTime = this.getTimestamp(endId);

        if (!startTime || !endTime || startTime >= endTime) {
            return null;
        }

        // BFS to find shortest temporal path
        const queue: SequencePath[] = [{
            nodes: [startId],
            episodes: [],
            current_time: startTime,
        }];

        const visited = new Set<string>([startId]);

        while (queue.length > 0) {
            const path = queue.shift()!;
            const currentId = path.nodes[path.nodes.length - 1];

            if (currentId === endId) {
                return {
                    start_id: startId,
                    end_id: endId,
                    sequence: path.nodes,
                    episodes: path.episodes,
                    total_duration_ms: endTime.getTime() - startTime.getTime(),
                };
            }

            if (path.nodes.length >= maxHops) continue;

            // Get next nodes (temporally after current)
            const nextNodes = this.getTemporalSuccessors(currentId, path.current_time, requireCausal);

            for (const nextId of nextNodes) {
                if (visited.has(nextId)) continue;
                visited.add(nextId);

                const nextTime = this.getTimestamp(nextId);
                if (!nextTime || nextTime > endTime) continue;

                // Find episode containing transition
                const episode = this.findEpisodeBetween(path.current_time, nextTime);

                queue.push({
                    nodes: [...path.nodes, nextId],
                    episodes: episode ? [...path.episodes, episode] : path.episodes,
                    current_time: nextTime,
                });
            }
        }

        return null; // No sequence found
    }

    /**
     * Get entities that co-occur temporally (appear in same episodes)
     */
    getCoOccurring(
        entityId: NodeId,
        options: CoOccurrenceOptions = {}
    ): CoOccurrenceResult[] {
        const { minOverlap = 1, entityKinds = [] } = options;

        const appearances = this.episodeManager.getEntityAppearances(entityId);
        const coOccurrences = new Map<NodeId, CoOccurrenceResult>();

        for (const episode of appearances) {
            for (const otherId of episode.entity_ids) {
                if (otherId === entityId) continue;

                const node = this.nodes.get(otherId);
                if (!node) continue;
                if (entityKinds.length > 0 && !(node.data.entityKind && entityKinds.includes(node.data.entityKind))) continue;

                let result = coOccurrences.get(otherId);
                if (!result) {
                    result = {
                        entity_id: otherId,
                        shared_episodes: [],
                        overlap_count: 0,
                    };
                    coOccurrences.set(otherId, result);
                }

                result.shared_episodes.push(episode);
                result.overlap_count++;
            }
        }

        return Array.from(coOccurrences.values())
            .filter(r => r.overlap_count >= minOverlap)
            .sort((a, b) => b.overlap_count - a.overlap_count);
    }

    // ===== PRIVATE HELPERS =====

    private getTimestamp(id: NodeId | EpisodeId): Date | null {
        // Try as episode
        const episode = this.episodeManager.getEpisode(id as EpisodeId);
        if (episode) return episode.valid_at;

        // Try as node
        const node = this.nodes.get(id as NodeId);
        if (!node) return null;

        // Check if node has temporal data
        if (node.data.temporal?.start?.timestamp) {
            return new Date(node.data.temporal.start.timestamp);
        }

        // Check if node IS an episode
        const episodeForNode = this.episodeManager.getEpisodeByNodeId(id as NodeId);
        if (episodeForNode) return episodeForNode.valid_at;

        return null;
    }

    private rangesOverlap(
        start1: Date,
        end1: Date,
        start2: Date,
        end2: Date
    ): boolean {
        return start1 <= end2 && start2 <= end1;
    }

    private rangeContains(
        rangeStart: Date,
        rangeEnd: Date,
        pointStart: Date,
        pointEnd: Date
    ): boolean {
        return rangeStart <= pointStart && pointEnd <= rangeEnd;
    }

    private isDirectlyConnected(nodeId1: NodeId, nodeId2: NodeId): boolean {
        // Check if there's a direct edge between nodes
        for (const edge of this.edges.values()) {
            if (
                (edge.data.source === nodeId1 && edge.data.target === nodeId2) ||
                (edge.data.source === nodeId2 && edge.data.target === nodeId1)
            ) {
                return true;
            }
        }
        return false;
    }

    private getRelatedEntities(entityId: NodeId): NodeId[] {
        const related = new Set<NodeId>();

        for (const edge of this.edges.values()) {
            if (edge.data.source === entityId) {
                related.add(edge.data.target);
            } else if (edge.data.target === entityId) {
                related.add(edge.data.source);
            }
        }

        return Array.from(related);
    }

    private getTemporalSuccessors(
        nodeId: NodeId,
        currentTime: Date,
        requireCausal: boolean
    ): NodeId[] {
        const successors: NodeId[] = [];

        for (const edge of this.edges.values()) {
            if (edge.data.source !== nodeId) continue;

            const targetTime = this.getTimestamp(edge.data.target);
            if (!targetTime || targetTime <= currentTime) continue;

            // Check causal relationship if required
            if (requireCausal) {
                const isCausal = ['CAUSED_BY', 'LEADS_TO', 'ENABLES'].includes(edge.data.type);
                if (!isCausal) continue;
            }

            successors.push(edge.data.target);
        }

        return successors;
    }

    private findEpisodeBetween(start: Date, end: Date): Episode | null {
        const episodes = this.episodeManager.getTimeline();

        for (const episode of episodes) {
            const episodeStart = episode.valid_at;
            const episodeEnd = episode.valid_to || episodeStart;

            if (this.rangesOverlap(start, end, episodeStart, episodeEnd)) {
                return episode;
            }
        }

        return null;
    }
}

// ===== TYPES =====

export interface TimeRangeOptions {
    includeOverlaps?: boolean;
    entityKinds?: string[];
    episodeTypes?: string[];
    namespace?: string;
}

export interface TemporalProximityOptions {
    maxDistance?: number; // milliseconds
    directOnly?: boolean;
    entityKinds?: string[];
    namespace?: string;
}

export interface DuringOptions {
    includeNested?: boolean;
    entityKinds?: string[];
}

export interface EntityTimelineOptions {
    includeRelatedEvents?: boolean;
}

export interface SequenceOptions {
    maxHops?: number;
    requireCausal?: boolean;
}

export interface CoOccurrenceOptions {
    minOverlap?: number;
    entityKinds?: string[];
}

export interface TemporalQueryResult {
    episodes: Episode[];
    entities: NodeId[];
    timeRange: { start: Date; end: Date } | null;
}

export interface EntityTimeline {
    entity_id: NodeId;
    first_appearance?: Episode;
    last_appearance?: Episode;
    total_appearances: number;
    episodes: Episode[];
    gaps: TemporalGap[];
    related_episodes?: Episode[];
}

export interface TemporalGap {
    start: Date;
    end: Date;
    duration_ms: number;
}

export interface TemporalSequence {
    start_id: NodeId | EpisodeId;
    end_id: NodeId | EpisodeId;
    sequence: (NodeId | EpisodeId)[];
    episodes: Episode[];
    total_duration_ms: number;
}

interface SequencePath {
    nodes: (NodeId | EpisodeId)[];
    episodes: Episode[];
    current_time: Date;
}

export interface CoOccurrenceResult {
    entity_id: NodeId;
    shared_episodes: Episode[];
    overlap_count: number;
}
