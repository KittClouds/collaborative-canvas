/**
 * BacklinkSync - Computed bidirectional link management
 * 
 * Synchronizes:
 * - Wikilinks ([[Target]])
 * - Backlinks (<<Source>>)
 * - Entity References ([KIND|Label])
 * - Cross-document relationships (RelationshipRegistry)
 */

import { entityRegistry } from '@/lib/entities';
import { relationshipRegistry } from '@/lib/relationships';
import type { Note } from '../../../contexts/NotesContext';

export interface ComputedLink {
    noteId: string;
    noteTitle: string;
    linkType: 'wikilink' | 'backlink' | 'entity' | 'relationship';
    context?: string;
    relationshipType?: string;
}

export class BacklinkSync {
    private notes: Note[];

    constructor(notes: Note[] = []) {
        this.notes = notes;
    }

    updateNotes(notes: Note[]): void {
        this.notes = notes;
    }

    /**
     * Compute all incoming references for a note
     */
    computeIncomingLinks(targetNoteId: string): ComputedLink[] {
        const targetNote = this.notes.find(n => n.id === targetNoteId);
        if (!targetNote) return [];

        const incoming: ComputedLink[] = [];

        for (const sourceNote of this.notes) {
            if (sourceNote.id === targetNoteId) continue;

            if (sourceNote.connections) {
                // 1. Check Wikilinks
                if (sourceNote.connections.wikilinks?.includes(targetNote.title)) {
                    incoming.push({
                        noteId: sourceNote.id,
                        noteTitle: sourceNote.title,
                        linkType: 'wikilink'
                    });
                }

                // 2. Check Backlinks (Source note manually linked back to target)
                if (sourceNote.connections.backlinks?.includes(targetNote.title)) {
                    incoming.push({
                        noteId: sourceNote.id,
                        noteTitle: sourceNote.title,
                        linkType: 'backlink'
                    });
                }

                // 3. Check Entity References (If target is an entity note)
                if (targetNote.isEntity && targetNote.entityLabel) {
                    const hasEntityRef = sourceNote.connections.entities?.some(
                        e => e.label === targetNote.entityLabel && e.kind === targetNote.entityKind
                    );
                    if (hasEntityRef) {
                        incoming.push({
                            noteId: sourceNote.id,
                            noteTitle: sourceNote.title,
                            linkType: 'entity'
                        });
                    }
                }
            }
        }

        // 4. Check Graph Relationships
        if (targetNote.isEntity && targetNote.entityLabel) {
            const ent = entityRegistry.findEntity(targetNote.entityLabel);
            if (ent) {
                const rels = relationshipRegistry.getByEntity(ent.id);
                for (const rel of rels) {
                    const otherEntityId = rel.sourceEntityId === ent.id ? rel.targetEntityId : rel.sourceEntityId;
                    const otherEntity = entityRegistry.getEntityById(otherEntityId);

                    if (otherEntity) {
                        const otherNote = this.notes.find(
                            n => n.isEntity && n.entityLabel === otherEntity.label && n.entityKind === otherEntity.kind
                        );
                        if (otherNote) {
                            incoming.push({
                                noteId: otherNote.id,
                                noteTitle: otherNote.title,
                                linkType: 'relationship',
                                relationshipType: rel.type
                            });
                        }
                    }
                }
            }
        }

        // Dedupe
        return Array.from(new Map(incoming.map(l => [`${l.noteId}:${l.linkType}`, l])).values());
    }

    /**
     * Compute all outgoing references for a note
     */
    computeOutgoingLinks(sourceNoteId: string): ComputedLink[] {
        const sourceNote = this.notes.find(n => n.id === sourceNoteId);
        if (!sourceNote || !sourceNote.connections) return [];

        const outgoing: ComputedLink[] = [];

        // 1. Explicit Wikilinks
        for (const title of sourceNote.connections.wikilinks || []) {
            const target = this.notes.find(n => n.title === title);
            outgoing.push({
                noteId: target?.id || 'unknown',
                noteTitle: title,
                linkType: 'wikilink'
            });
        }

        // 2. Entity Links (to entity notes)
        for (const entRef of sourceNote.connections.entities || []) {
            const target = this.notes.find(
                n => n.isEntity && n.entityLabel === entRef.label && n.entityKind === entRef.kind
            );
            if (target) {
                outgoing.push({
                    noteId: target.id,
                    noteTitle: target.title,
                    linkType: 'entity'
                });
            }
        }

        return outgoing;
    }
}
