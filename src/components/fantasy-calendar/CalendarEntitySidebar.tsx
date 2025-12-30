import React, { useMemo, useCallback } from 'react';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import { FactSheetContainer } from '@/components/fact-sheets/FactSheetContainer';
import { EntitySelectionProvider } from '@/contexts/EntitySelectionContext';
import { parseNoteConnectionsFromDocument } from '@/lib/entities/documentScanner';
import type { ParsedEntity, EntityAttributes } from '@/types/factSheetTypes';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { toast } from 'sonner';

export function CalendarEntitySidebar() {
    const { state: { notes }, updateNoteContent } = useJotaiNotes();

    // Gather ALL entities from the store:
    // 1. Entity Notes (notes with isEntity flag)
    // 2. Inline entities from note content (for full parity with Notes sidebar)
    const entityNotes = useMemo(() => {
        const allEntities: ParsedEntity[] = [];
        const seen = new Set<string>(); // Dedup by "KIND|label"

        // 1. Entity Notes (notes marked as entities)
        for (const note of notes) {
            if (note.isEntity && note.entityKind && note.entityLabel) {
                const key = `${note.entityKind}|${note.entityLabel}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allEntities.push({
                        kind: note.entityKind as EntityKind,
                        subtype: note.entitySubtype,
                        label: note.entityLabel,
                        noteId: note.id,
                        attributes: (() => {
                            try {
                                if (!note.content) return {};
                                const content = JSON.parse(note.content);
                                const attrKey = `${note.entityKind}|${note.entityLabel}`;
                                return content.entityAttributes?.[attrKey] || {};
                            } catch {
                                return {};
                            }
                        })(),
                    });
                }
            }

            // 2. Parse inline entities from note content
            if (note.content) {
                try {
                    const parsed = JSON.parse(note.content);
                    const connections = parseNoteConnectionsFromDocument(parsed);

                    for (const entity of connections.entities) {
                        const key = `${entity.kind}|${entity.label}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            allEntities.push({
                                kind: entity.kind as EntityKind,
                                subtype: entity.subtype,
                                label: entity.label,
                                // No noteId for inline entities - they live in the content
                                attributes: entity.attributes || {},
                            });
                        }
                    }
                } catch {
                    // Invalid JSON, skip
                }
            }
        }

        return allEntities;
    }, [notes]);


    // 2. Handle updates from the sidebar
    const handleEntityUpdate = useCallback(async (entity: ParsedEntity, attributes: EntityAttributes) => {
        // Find the note that owns this entity
        // If the entity has a noteId, use that.
        const targetNote = notes.find(n =>
            (entity.noteId && n.id === entity.noteId) ||
            (n.isEntity && n.entityKind === entity.kind && n.entityLabel === entity.label)
        );

        if (!targetNote) {
            toast.error(`Could not find source note for ${entity.label}`);
            return;
        }

        try {
            const content = targetNote.content ? JSON.parse(targetNote.content) : {};

            if (!content.entityAttributes) {
                content.entityAttributes = {};
            }

            const entityKey = `${entity.kind}|${entity.label}`;
            // Merge updates
            content.entityAttributes[entityKey] = {
                ...content.entityAttributes[entityKey],
                ...attributes
            };

            await updateNoteContent(targetNote.id, JSON.stringify(content));
            // toast.success(`Updated ${entity.label}`); // Optional: too noisy?
        } catch (err) {
            console.error("Failed to update entity attributes", err);
            toast.error("Failed to save changes");
        }
    }, [notes, updateNoteContent]);

    // 3. Render the container wrapped in its own selection provider
    // allowing it to manage "Selected Entity" state independently of the Notes page.
    return (
        <EntitySelectionProvider>
            <div className="h-full border-l border-border bg-sidebar w-[380px] flex flex-col overflow-hidden transition-all">
                <FactSheetContainer
                    externalEntities={entityNotes}
                    onEntityUpdate={handleEntityUpdate}
                />
            </div>
        </EntitySelectionProvider>
    );
}
