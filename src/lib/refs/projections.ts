/**
 * RefProjector - Generate views and projections from Refs
 * 
 * Produces timelines, character sheets, relationship maps, etc.
 */

import type {
    Ref,
    EntityRefPayload,
    TripleRefPayload,
    TemporalRefPayload,
    WikilinkRefPayload
} from './types';
import {
    isEntityRef,
    isTripleRef,
    isTemporalRef,
    isWikilinkRef
} from './types';
import type { EntityKind } from '../entities/entityTypes';

// ==================== TIMELINE TYPES ====================

export interface TimelineEvent {
    timestamp: number | null;
    expression: string;
    entities: Array<{ kind: EntityKind; label: string }>;
    description: string;
    sourceNoteId: string;
    position: number;
    isRelative: boolean;
}

// ==================== CHARACTER SHEET TYPES ====================

export interface CharacterSheet {
    id: string;
    name: string;
    kind: EntityKind;
    aliases: string[];
    relationships: CharacterRelationship[];
    appearances: NoteAppearance[];
    traits: string[];
    timeline: TimelineEvent[];
    stats: CharacterStats;
}

export interface CharacterRelationship {
    targetId: string;
    targetLabel: string;
    targetKind: EntityKind;
    predicate: string;
    sourceNoteId: string;
    bidirectional: boolean;
}

export interface NoteAppearance {
    noteId: string;
    mentionCount: number;
    contexts: string[];
}

export interface CharacterStats {
    totalMentions: number;
    uniqueNotes: number;
    relationshipCount: number;
    firstSeen: number;
    lastSeen: number;
}

// ==================== PROJECTOR CLASS ====================

export class RefProjector {
    /**
     * Build a timeline from refs
     */
    buildTimeline(refs: Ref[]): TimelineEvent[] {
        const events: TimelineEvent[] = [];

        // Find temporal refs
        const temporalRefs = refs.filter(isTemporalRef);

        for (const ref of temporalRefs) {
            const payload = ref.payload as TemporalRefPayload;
            const position = ref.positions[0];

            // Find nearby entity refs (within 200 chars)
            const nearbyEntities = this.findNearbyEntities(refs, ref.sourceNoteId, position?.offset || 0, 200);

            events.push({
                timestamp: payload.parsedDate ? new Date(payload.parsedDate).getTime() : null,
                expression: payload.expression || ref.target,
                entities: nearbyEntities.map(e => ({
                    kind: (e.payload as EntityRefPayload).entityKind,
                    label: e.target,
                })),
                description: ref.target,
                sourceNoteId: ref.sourceNoteId,
                position: position?.offset || 0,
                isRelative: payload.type === 'relative',
            });
        }

        // Sort by timestamp (nulls last), then by note position
        return events.sort((a, b) => {
            if (a.timestamp !== null && b.timestamp !== null) {
                return a.timestamp - b.timestamp;
            }
            if (a.timestamp === null && b.timestamp === null) {
                return a.position - b.position;
            }
            return a.timestamp === null ? 1 : -1;
        });
    }

    /**
     * Build a character sheet from a character entity ref
     */
    buildCharacterSheet(characterRef: Ref<EntityRefPayload>, allRefs: Ref[]): CharacterSheet {
        const payload = characterRef.payload;
        const characterLabel = characterRef.target.toLowerCase();

        // Find all relationships where this character is subject or object
        const relationships = this.extractRelationships(characterRef.target, allRefs);

        // Find all notes where this character appears
        const appearances = this.extractAppearances(characterRef.target, payload.aliases || [], allRefs);

        // Extract traits (looking for specific patterns or attributes)
        const traits = this.extractTraits(characterRef, allRefs);

        // Build character-specific timeline
        const timeline = this.buildEntityTimeline(characterRef.target, allRefs);

        // Calculate stats
        const stats: CharacterStats = {
            totalMentions: characterRef.positions.length,
            uniqueNotes: new Set(characterRef.positions.map(p => p.noteId)).size,
            relationshipCount: relationships.length,
            firstSeen: characterRef.createdAt,
            lastSeen: characterRef.lastSeenAt,
        };

        return {
            id: characterRef.id,
            name: characterRef.target,
            kind: payload.entityKind,
            aliases: payload.aliases || [],
            relationships,
            appearances,
            traits,
            timeline,
            stats,
        };
    }

    /**
     * Build a relationship graph structure
     */
    buildRelationshipGraph(refs: Ref[]): {
        nodes: Array<{ id: string; label: string; kind: EntityKind }>;
        edges: Array<{ source: string; target: string; predicate: string }>;
    } {
        const nodes = new Map<string, { id: string; label: string; kind: EntityKind }>();
        const edges: Array<{ source: string; target: string; predicate: string }> = [];

        // Add entity nodes
        for (const ref of refs.filter(isEntityRef)) {
            const payload = ref.payload as EntityRefPayload;
            const key = `${payload.entityKind}:${ref.target.toLowerCase()}`;
            if (!nodes.has(key)) {
                nodes.set(key, {
                    id: key,
                    label: ref.target,
                    kind: payload.entityKind,
                });
            }
        }

        // Add edges from triples
        for (const ref of refs.filter(isTripleRef)) {
            const payload = ref.payload as TripleRefPayload;
            const sourceKey = `${payload.subjectKind}:${payload.subjectLabel.toLowerCase()}`;
            const targetKey = `${payload.objectKind}:${payload.objectLabel.toLowerCase()}`;

            // Ensure nodes exist
            if (!nodes.has(sourceKey)) {
                nodes.set(sourceKey, {
                    id: sourceKey,
                    label: payload.subjectLabel,
                    kind: payload.subjectKind,
                });
            }
            if (!nodes.has(targetKey)) {
                nodes.set(targetKey, {
                    id: targetKey,
                    label: payload.objectLabel,
                    kind: payload.objectKind,
                });
            }

            edges.push({
                source: sourceKey,
                target: targetKey,
                predicate: ref.predicate || '',
            });
        }

        return {
            nodes: Array.from(nodes.values()),
            edges,
        };
    }

    /**
     * Build link graph for wikilinks
     */
    buildLinkGraph(refs: Ref[]): {
        nodes: Array<{ id: string; exists: boolean }>;
        edges: Array<{ source: string; target: string }>;
    } {
        const nodes = new Map<string, { id: string; exists: boolean }>();
        const edges: Array<{ source: string; target: string }> = [];

        for (const ref of refs.filter(isWikilinkRef)) {
            const payload = ref.payload as WikilinkRefPayload;
            const target = ref.target.toLowerCase();

            if (!nodes.has(target)) {
                nodes.set(target, {
                    id: target,
                    exists: payload.exists,
                });
            }

            edges.push({
                source: ref.sourceNoteId,
                target,
            });

            // Add source note as node
            if (!nodes.has(ref.sourceNoteId)) {
                nodes.set(ref.sourceNoteId, {
                    id: ref.sourceNoteId,
                    exists: true,
                });
            }
        }

        return {
            nodes: Array.from(nodes.values()),
            edges,
        };
    }

    // ==================== PRIVATE HELPERS ====================

    private findNearbyEntities(
        refs: Ref[],
        noteId: string,
        position: number,
        radius: number
    ): Ref<EntityRefPayload>[] {
        return refs
            .filter(isEntityRef)
            .filter(ref => {
                const pos = ref.positions.find(p => p.noteId === noteId);
                if (!pos) return false;
                return Math.abs(pos.offset - position) <= radius;
            }) as Ref<EntityRefPayload>[];
    }

    private extractRelationships(label: string, refs: Ref[]): CharacterRelationship[] {
        const relationships: CharacterRelationship[] = [];
        const labelLower = label.toLowerCase();

        for (const ref of refs.filter(isTripleRef)) {
            const payload = ref.payload as TripleRefPayload;

            // Check if character is subject
            if (payload.subjectLabel.toLowerCase() === labelLower) {
                relationships.push({
                    targetId: payload.objectId,
                    targetLabel: payload.objectLabel,
                    targetKind: payload.objectKind,
                    predicate: ref.predicate || '',
                    sourceNoteId: ref.sourceNoteId,
                    bidirectional: false,
                });
            }

            // Check if character is object
            if (payload.objectLabel.toLowerCase() === labelLower) {
                relationships.push({
                    targetId: payload.subjectId,
                    targetLabel: payload.subjectLabel,
                    targetKind: payload.subjectKind,
                    predicate: `←${ref.predicate || ''}`,
                    sourceNoteId: ref.sourceNoteId,
                    bidirectional: false,
                });
            }
        }

        return relationships;
    }

    private extractAppearances(
        label: string,
        aliases: string[],
        refs: Ref[]
    ): NoteAppearance[] {
        const appearances = new Map<string, NoteAppearance>();
        const patterns = [label.toLowerCase(), ...aliases.map(a => a.toLowerCase())];

        for (const ref of refs.filter(isEntityRef)) {
            if (!patterns.includes(ref.target.toLowerCase())) continue;

            for (const pos of ref.positions) {
                const existing = appearances.get(pos.noteId);
                if (existing) {
                    existing.mentionCount++;
                    if (pos.contextBefore || pos.contextAfter) {
                        existing.contexts.push(`${pos.contextBefore}${ref.target}${pos.contextAfter}`);
                    }
                } else {
                    appearances.set(pos.noteId, {
                        noteId: pos.noteId,
                        mentionCount: 1,
                        contexts: pos.contextBefore || pos.contextAfter
                            ? [`${pos.contextBefore}${ref.target}${pos.contextAfter}`]
                            : [],
                    });
                }
            }
        }

        return Array.from(appearances.values());
    }

    private extractTraits(characterRef: Ref<EntityRefPayload>, allRefs: Ref[]): string[] {
        const traits: string[] = [];

        // Extract from attributes if present
        if (characterRef.attributes) {
            const attrs = characterRef.attributes as Record<string, unknown>;
            if (Array.isArray(attrs.traits)) {
                traits.push(...(attrs.traits as string[]));
            }
        }

        // Look for HAS_TRAIT relationships
        for (const ref of allRefs.filter(isTripleRef)) {
            const payload = ref.payload as TripleRefPayload;
            if (
                payload.subjectLabel.toLowerCase() === characterRef.target.toLowerCase() &&
                ref.predicate === 'HAS_TRAIT'
            ) {
                traits.push(payload.objectLabel);
            }
        }

        return [...new Set(traits)];
    }

    private buildEntityTimeline(label: string, refs: Ref[]): TimelineEvent[] {
        const timeline = this.buildTimeline(refs);

        // Filter to events involving this entity
        return timeline.filter(event =>
            event.entities.some(e => e.label.toLowerCase() === label.toLowerCase())
        );
    }
}

// Singleton instance
export const refProjector = new RefProjector();
