import type {
    NodeId,
    EpisodeId,
    Episode,
    EpisodeMetadata,
    NarrativeEntityKind,
    UnifiedNode,
    UnifiedNodeData,
} from '../types';
import { NARRATIVE_HIERARCHY, canContain } from '../types';
import { generateId } from '@/lib/utils/ids';

/**
 * Episode Manager - Maps your narrative nodes to episode structure
 * 
 * Your existing nodes (CHAPTER, SCENE, etc.) are episodes.
 * This manager creates the episode layer without touching your nodes.
 */
export class EpisodeManager {
    private episodes = new Map<EpisodeId, Episode>();
    private nodeToEpisode = new Map<NodeId, EpisodeId>();
    private entityAppearances = new Map<NodeId, Set<EpisodeId>>();

    /**
     * Create episode from existing narrative node
     */
    createEpisodeFromNode(node: UnifiedNode, namespace: string = 'default'): Episode {
        const data = node.data;

        // Verify this is a narrative entity
        if (!data.entityKind || !this.isNarrativeKind(data.entityKind)) {
            throw new Error(`Node ${data.id} is not a narrative entity`);
        }

        const episodeId = generateId();
        const narrativeKind = data.entityKind as NarrativeEntityKind;

        const episode: Episode = {
            id: episodeId,
            name: data.label,
            content: data.content || '',

            // Map to existing node
            node_id: data.id,
            entity_kind: narrativeKind,
            entity_subtype: data.entitySubtype,

            // Hierarchy
            parent_episode_id: undefined, // Set by linking
            child_episode_ids: [],
            hierarchy_level: NARRATIVE_HIERARCHY[narrativeKind],

            // Temporal
            valid_at: this.extractValidAt(data),
            valid_to: data.temporal?.end ? new Date(data.temporal.end.timestamp!) : undefined,
            sequence_number: data.narrativeMetadata?.sequence,

            // Source
            source: this.buildSourceString(narrativeKind, data.label),
            source_description: `${narrativeKind}: ${data.label}`,

            // Participants
            entity_ids: this.extractEntityIds(data),
            primary_entity_ids: this.extractPrimaryEntityIds(data),

            // Namespace
            namespace,

            // Metadata (merge all your metadata types)
            metadata: this.buildMetadata(data),

            created_at: new Date(data.createdAt),
            updated_at: new Date(data.updatedAt),
        };

        this.episodes.set(episodeId, episode);
        this.nodeToEpisode.set(data.id, episodeId);

        return episode;
    }

    /**
     * Bulk create episodes from multiple nodes
     */
    createEpisodesFromNodes(nodes: UnifiedNode[], namespace: string = 'default'): Episode[] {
        const narrativeNodes = nodes.filter(
            n => n.data.entityKind && this.isNarrativeKind(n.data.entityKind)
        );

        return narrativeNodes.map(node => this.createEpisodeFromNode(node, namespace));
    }

    /**
     * Link child episode to parent (Chapter → Scene, etc.)
     */
    linkEpisodes(parentId: EpisodeId, childId: EpisodeId): void {
        const parent = this.episodes.get(parentId);
        const child = this.episodes.get(childId);

        if (!parent || !child) {
            throw new Error('Episode not found');
        }

        // Verify hierarchy rules
        if (!canContain(parent.entity_kind, child.entity_kind)) {
            throw new Error(
                `${parent.entity_kind} cannot contain ${child.entity_kind}`
            );
        }

        child.parent_episode_id = parentId;
        if (!parent.child_episode_ids.includes(childId)) {
            parent.child_episode_ids.push(childId);
        }
    }

    /**
     * Auto-link episodes based on node parent relationships
     */
    autoLinkFromNodeHierarchy(nodes: UnifiedNode[]): void {
        for (const node of nodes) {
            const episodeId = this.nodeToEpisode.get(node.data.id);
            if (!episodeId || !node.data.parentId) continue;

            const parentEpisodeId = this.nodeToEpisode.get(node.data.parentId);
            if (parentEpisodeId) {
                try {
                    this.linkEpisodes(parentEpisodeId, episodeId);
                } catch {
                    // Hierarchy mismatch, skip
                }
            }
        }
    }

    /**
     * Record entity appearance in episode
     */
    recordAppearance(entityId: NodeId, episodeId: EpisodeId): void {
        const episode = this.episodes.get(episodeId);
        if (!episode) {
            throw new Error('Episode not found');
        }

        if (!episode.entity_ids.includes(entityId)) {
            episode.entity_ids.push(entityId);
        }

        let appearances = this.entityAppearances.get(entityId);
        if (!appearances) {
            appearances = new Set();
            this.entityAppearances.set(entityId, appearances);
        }
        appearances.add(episodeId);
    }

    /**
     * Record multiple entity appearances
     */
    recordAppearances(entityIds: NodeId[], episodeId: EpisodeId): void {
        for (const entityId of entityIds) {
            this.recordAppearance(entityId, episodeId);
        }
    }

    /**
     * Get all episodes an entity appears in
     */
    getEntityAppearances(entityId: NodeId): Episode[] {
        const episodeIds = this.entityAppearances.get(entityId);
        if (!episodeIds) return [];

        return Array.from(episodeIds)
            .map(id => this.episodes.get(id))
            .filter((e): e is Episode => e !== undefined)
            .sort((a, b) => a.valid_at.getTime() - b.valid_at.getTime());
    }

    /**
     * Get first and last appearance of an entity
     */
    getEntityAppearanceRange(entityId: NodeId): { first?: Episode; last?: Episode } {
        const appearances = this.getEntityAppearances(entityId);
        if (appearances.length === 0) return {};
        return {
            first: appearances[0],
            last: appearances[appearances.length - 1],
        };
    }

    /**
     * Get episode hierarchy (NARRATIVE → ARC → ACT → CHAPTER → SCENE → BEAT)
     */
    getEpisodeHierarchy(episodeId: EpisodeId): Episode[] {
        const episode = this.episodes.get(episodeId);
        if (!episode) return [];

        const hierarchy: Episode[] = [episode];
        let current = episode;

        // Walk up to root
        while (current.parent_episode_id) {
            const parent = this.episodes.get(current.parent_episode_id);
            if (!parent) break;
            hierarchy.unshift(parent);
            current = parent;
        }

        return hierarchy;
    }

    /**
     * Get breadcrumb path for an episode
     */
    getEpisodeBreadcrumb(episodeId: EpisodeId): string {
        const hierarchy = this.getEpisodeHierarchy(episodeId);
        return hierarchy.map(e => e.name).join(' → ');
    }

    /**
     * Get all child episodes (recursive)
     */
    getAllChildren(episodeId: EpisodeId): Episode[] {
        const episode = this.episodes.get(episodeId);
        if (!episode) return [];

        const children: Episode[] = [];

        for (const childId of episode.child_episode_ids) {
            const child = this.episodes.get(childId);
            if (child) {
                children.push(child);
                children.push(...this.getAllChildren(childId));
            }
        }

        return children;
    }

    /**
     * Get direct children only
     */
    getDirectChildren(episodeId: EpisodeId): Episode[] {
        const episode = this.episodes.get(episodeId);
        if (!episode) return [];

        return episode.child_episode_ids
            .map(id => this.episodes.get(id))
            .filter((e): e is Episode => e !== undefined)
            .sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
    }

    /**
     * Get sibling episodes
     */
    getSiblings(episodeId: EpisodeId): Episode[] {
        const episode = this.episodes.get(episodeId);
        if (!episode || !episode.parent_episode_id) return [];

        return this.getDirectChildren(episode.parent_episode_id)
            .filter(e => e.id !== episodeId);
    }

    /**
     * Get episode timeline (sorted by valid_at)
     */
    getTimeline(namespace?: string): Episode[] {
        const episodes = Array.from(this.episodes.values());

        return episodes
            .filter(e => !namespace || e.namespace === namespace)
            .sort((a, b) => a.valid_at.getTime() - b.valid_at.getTime());
    }

    /**
     * Get episodes by type (all SCENE episodes, all CHAPTER episodes, etc.)
     */
    getEpisodesByType(kind: NarrativeEntityKind, namespace?: string): Episode[] {
        return Array.from(this.episodes.values())
            .filter(e => e.entity_kind === kind)
            .filter(e => !namespace || e.namespace === namespace)
            .sort((a, b) => a.valid_at.getTime() - b.valid_at.getTime());
    }

    /**
     * Get root episodes (no parent)
     */
    getRootEpisodes(namespace?: string): Episode[] {
        return Array.from(this.episodes.values())
            .filter(e => !e.parent_episode_id)
            .filter(e => !namespace || e.namespace === namespace)
            .sort((a, b) => a.valid_at.getTime() - b.valid_at.getTime());
    }

    /**
     * Get episodes containing a specific entity
     */
    getEpisodesWithEntity(entityId: NodeId): Episode[] {
        return Array.from(this.episodes.values())
            .filter(e => e.entity_ids.includes(entityId))
            .sort((a, b) => a.valid_at.getTime() - b.valid_at.getTime());
    }

    /**
     * Get episodes where multiple entities co-occur
     */
    getEpisodesWithEntities(entityIds: NodeId[], requireAll: boolean = true): Episode[] {
        return Array.from(this.episodes.values())
            .filter(e => {
                if (requireAll) {
                    return entityIds.every(id => e.entity_ids.includes(id));
                }
                return entityIds.some(id => e.entity_ids.includes(id));
            })
            .sort((a, b) => a.valid_at.getTime() - b.valid_at.getTime());
    }

    /**
     * Get episode statistics
     */
    getStats(namespace?: string): {
        total: number;
        byKind: Record<NarrativeEntityKind, number>;
        byStatus: Record<string, number>;
        entityAppearances: number;
    } {
        const episodes = namespace
            ? Array.from(this.episodes.values()).filter(e => e.namespace === namespace)
            : Array.from(this.episodes.values());

        const byKind = {} as Record<NarrativeEntityKind, number>;
        const byStatus = {} as Record<string, number>;

        for (const episode of episodes) {
            byKind[episode.entity_kind] = (byKind[episode.entity_kind] || 0) + 1;
            const status = episode.metadata.status || 'unknown';
            byStatus[status] = (byStatus[status] || 0) + 1;
        }

        return {
            total: episodes.length,
            byKind,
            byStatus,
            entityAppearances: this.entityAppearances.size,
        };
    }

    /**
     * Update episode metadata
     */
    updateEpisode(episodeId: EpisodeId, updates: Partial<Episode>): Episode | undefined {
        const episode = this.episodes.get(episodeId);
        if (!episode) return undefined;

        const updated: Episode = {
            ...episode,
            ...updates,
            id: episode.id, // Prevent ID change
            node_id: episode.node_id, // Prevent node reference change
            updated_at: new Date(),
        };

        this.episodes.set(episodeId, updated);
        return updated;
    }

    /**
     * Delete episode and update references
     */
    deleteEpisode(episodeId: EpisodeId): boolean {
        const episode = this.episodes.get(episodeId);
        if (!episode) return false;

        // Remove from parent's child list
        if (episode.parent_episode_id) {
            const parent = this.episodes.get(episode.parent_episode_id);
            if (parent) {
                parent.child_episode_ids = parent.child_episode_ids.filter(id => id !== episodeId);
            }
        }

        // Orphan children (they become root episodes)
        for (const childId of episode.child_episode_ids) {
            const child = this.episodes.get(childId);
            if (child) {
                child.parent_episode_id = undefined;
            }
        }

        // Remove from entity appearances
        for (const entityId of episode.entity_ids) {
            const appearances = this.entityAppearances.get(entityId);
            if (appearances) {
                appearances.delete(episodeId);
            }
        }

        // Remove mappings
        this.nodeToEpisode.delete(episode.node_id);
        this.episodes.delete(episodeId);

        return true;
    }

    // ===== PRIVATE HELPERS =====

    private isNarrativeKind(kind: string): kind is NarrativeEntityKind {
        return kind in NARRATIVE_HIERARCHY;
    }

    private extractValidAt(data: UnifiedNodeData): Date {
        if (data.temporal?.start?.timestamp) {
            return new Date(data.temporal.start.timestamp);
        }
        return new Date(data.createdAt);
    }

    private extractEntityIds(data: UnifiedNodeData): NodeId[] {
        const ids: NodeId[] = [];

        // From SceneMetadata
        if (data.sceneMetadata) {
            ids.push(...data.sceneMetadata.participants);
            if (data.sceneMetadata.povCharacterId) {
                ids.push(data.sceneMetadata.povCharacterId);
            }
        }

        // From EventMetadata
        if (data.eventMetadata) {
            ids.push(...data.eventMetadata.participants);
        }

        return [...new Set(ids)]; // Dedupe
    }

    private extractPrimaryEntityIds(data: UnifiedNodeData): NodeId[] {
        const ids: NodeId[] = [];

        if (data.sceneMetadata?.povCharacterId) {
            ids.push(data.sceneMetadata.povCharacterId);
        }

        return ids;
    }

    private buildSourceString(kind: NarrativeEntityKind, label: string): string {
        switch (kind) {
            case 'NARRATIVE': return `Story: ${label}`;
            case 'TIMELINE': return `Timeline: ${label}`;
            case 'ARC': return `Arc: ${label}`;
            case 'ACT': return `Act: ${label}`;
            case 'CHAPTER': return `Chapter: ${label}`;
            case 'SCENE': return `Scene: ${label}`;
            case 'BEAT': return `Beat: ${label}`;
            case 'EVENT': return `Event: ${label}`;
            default: return label;
        }
    }

    private buildMetadata(data: UnifiedNodeData): EpisodeMetadata {
        const metadata: EpisodeMetadata = {
            tags: data.tags,
        };

        // Merge NarrativeMetadata
        if (data.narrativeMetadata) {
            metadata.status = data.narrativeMetadata.status;
            metadata.purpose = data.narrativeMetadata.purpose;
            metadata.theme = data.narrativeMetadata.theme;
            metadata.stakes = data.narrativeMetadata.stakes;
            metadata.emotional_tone = data.narrativeMetadata.emotionalTone;
            metadata.word_count = data.narrativeMetadata.wordCount;
            metadata.target_word_count = data.narrativeMetadata.targetWordCount;
        }

        // Merge SceneMetadata
        if (data.sceneMetadata) {
            metadata.scene_type = data.sceneMetadata.sceneType;
            metadata.conflict = data.sceneMetadata.conflict;
            metadata.sensory_details = data.sceneMetadata.sensoryDetails;
            metadata.time_of_day = data.sceneMetadata.timeOfDay;
            metadata.participant_ids = data.sceneMetadata.participants;
            metadata.pov_character_id = data.sceneMetadata.povCharacterId;
        }

        // Merge EventMetadata
        if (data.eventMetadata) {
            metadata.event_type = data.eventMetadata.eventType;
            metadata.scope = data.eventMetadata.scope;
            metadata.impact = data.eventMetadata.impact;
            metadata.visibility = data.eventMetadata.visibility;
            metadata.cause_event_id = data.eventMetadata.causeEventId;
            metadata.consequence_event_ids = data.eventMetadata.consequenceEventIds;
        }

        return metadata;
    }

    // ===== PUBLIC GETTERS =====

    getEpisode(id: EpisodeId): Episode | undefined {
        return this.episodes.get(id);
    }

    getEpisodeByNodeId(nodeId: NodeId): Episode | undefined {
        const episodeId = this.nodeToEpisode.get(nodeId);
        return episodeId ? this.episodes.get(episodeId) : undefined;
    }

    getAllEpisodes(): Episode[] {
        return Array.from(this.episodes.values());
    }

    hasEpisode(id: EpisodeId): boolean {
        return this.episodes.has(id);
    }

    getEpisodeCount(): number {
        return this.episodes.size;
    }

    /**
     * Export all episodes as serializable array
     */
    export(): Episode[] {
        return Array.from(this.episodes.values());
    }

    /**
     * Import episodes from serialized array
     */
    import(episodes: Episode[]): void {
        for (const episode of episodes) {
            this.episodes.set(episode.id, episode);
            this.nodeToEpisode.set(episode.node_id, episode.id);

            // Rebuild entity appearances
            for (const entityId of episode.entity_ids) {
                let appearances = this.entityAppearances.get(entityId);
                if (!appearances) {
                    appearances = new Set();
                    this.entityAppearances.set(entityId, appearances);
                }
                appearances.add(episode.id);
            }
        }
    }

    /**
     * Clear all episodes
     */
    clear(): void {
        this.episodes.clear();
        this.nodeToEpisode.clear();
        this.entityAppearances.clear();
    }
}
