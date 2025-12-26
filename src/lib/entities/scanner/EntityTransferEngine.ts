/**
 * EntityTransferEngine - Document-to-Document entity propagation
 * 
 * Suggests entities for a note based on:
 * - Folder sibling entities (shared context)
 * - Explicit wikilink/backlink targets (direct connectivity)
 * - Graph relationships (semantic connectivity via RelationshipRegistry)
 */

import { entityRegistry, RegisteredEntity } from '@/lib/entities';
import { relationshipRegistry } from '@/lib/relationships';
import type { Note } from '../../../contexts/NotesContext';

export interface EntitySuggestion {
    entity: RegisteredEntity;
    confidence: number;
    reason: string;
}

export class EntityTransferEngine {
    private notes: Note[];

    constructor(notes: Note[] = []) {
        this.notes = notes;
    }

    /**
     * Update current notes state
     */
    updateNotes(notes: Note[]): void {
        this.notes = notes;
    }

    /**
     * Suggest entities for a given note
     */
    suggestEntitiesForNote(noteId: string): EntitySuggestion[] {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return [];

        const suggestionsMap = new Map<string, EntitySuggestion>();

        // STRATEGY 1: Folder Sibling notes (Shared parent context)
        if (note.folderId) {
            const siblings = this.notes.filter(n => n.folderId === note.folderId && n.id !== noteId);
            const siblingFreq = new Map<string, number>();

            for (const sibling of siblings) {
                if (sibling.connections?.entities) {
                    for (const entRef of sibling.connections.entities) {
                        const entity = entityRegistry.findEntity(entRef.label);
                        if (entity) {
                            siblingFreq.set(entity.id, (siblingFreq.get(entity.id) || 0) + 1);
                        }
                    }
                }
            }

            for (const [entityId, count] of siblingFreq) {
                const entity = entityRegistry.getEntityById(entityId);
                if (entity) {
                    const confidence = Math.min(count / (siblings.length || 1), 1.0);
                    this.addOrUpdateSuggestion(suggestionsMap, {
                        entity,
                        confidence: confidence * 0.8, // Strategy weight
                        reason: `Mentioned in ${count} sibling notes in this folder.`
                    });
                }
            }
        }

        // STRATEGY 2: Direct Links (Wikilinks/Backlinks)
        if (note.connections) {
            const linkedNoteTitles = new Set([
                ...(note.connections.wikilinks || []),
                ...(note.connections.backlinks || [])
            ]);

            for (const title of linkedNoteTitles) {
                const linkedNote = this.notes.find(n => n.title === title);
                if (linkedNote?.connections?.entities) {
                    for (const entRef of linkedNote.connections.entities) {
                        const entity = entityRegistry.findEntity(entRef.label);
                        if (entity) {
                            this.addOrUpdateSuggestion(suggestionsMap, {
                                entity,
                                confidence: 0.7,
                                reason: `Mentioned in linked note: "${title}".`
                            });
                        }
                    }
                }
            }
        }

        // STRATEGY 3: Graph Relationships (RelationshipRegistry)
        // If current note is an entity note, find related entities
        if (note.isEntity && note.entityLabel) {
            const currentEntity = entityRegistry.findEntity(note.entityLabel);
            if (currentEntity) {
                const relationships = relationshipRegistry.getByEntity(currentEntity.id);
                for (const rel of relationships) {
                    const targetId = rel.sourceEntityId === currentEntity.id ? rel.targetEntityId : rel.sourceEntityId;
                    const relatedEntity = entityRegistry.getEntityById(targetId);
                    if (relatedEntity) {
                        this.addOrUpdateSuggestion(suggestionsMap, {
                            entity: relatedEntity,
                            confidence: rel.confidence * 0.6,
                            reason: `Semantically related via "${rel.type}" relationship.`
                        });
                    }
                }
            }
        }

        return Array.from(suggestionsMap.values()).sort((a, b) => b.confidence - a.confidence);
    }

    private addOrUpdateSuggestion(map: Map<string, EntitySuggestion>, suggestion: EntitySuggestion): void {
        const existing = map.get(suggestion.entity.id);
        if (existing) {
            // Combine confidence (simple probabilistic OR)
            existing.confidence = 1 - (1 - existing.confidence) * (1 - suggestion.confidence);
            existing.reason += ` + ${suggestion.reason}`;
        } else {
            map.set(suggestion.entity.id, { ...suggestion });
        }
    }
}
