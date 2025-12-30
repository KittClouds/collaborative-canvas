/**
 * useUnifiedEntityAttributes Hook
 * 
 * Bridges entity attributes between:
 * - New SQLite entity_attributes table (source of truth)
 * - Legacy note content JSON (for backwards compatibility)
 * 
 * Provides bi-directional sync between Calendar and Notes views.
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEntityAttributes, type EntityAttribute, type MetaCard, type FieldType } from './useEntityAttributes';
import { useJotaiNotes } from './useJotaiNotes';
import type { ParsedEntity, EntityAttributes } from '@/types/factSheetTypes';

export interface UseUnifiedEntityAttributesResult {
    // State
    attributes: EntityAttribute[];
    attributesRecord: Record<string, any>;
    metaCards: MetaCard[];
    isLoading: boolean;

    // Field operations
    getField: (fieldName: string) => any;
    setField: (fieldName: string, value: any, fieldType?: FieldType) => Promise<void>;
    setFields: (fields: Record<string, any>, fieldTypes?: Record<string, FieldType>) => Promise<void>;
    deleteField: (fieldName: string) => Promise<void>;

    // Meta card operations
    createCard: (name: string, color?: string, icon?: string) => Promise<MetaCard>;
    updateCard: (cardId: string, updates: Partial<Pick<MetaCard, 'name' | 'color' | 'icon' | 'isCollapsed'>>) => Promise<void>;
    deleteCard: (cardId: string) => Promise<void>;

    // Legacy compatibility
    syncFromLegacy: () => Promise<void>;
    syncToLegacy: () => Promise<void>;

    // Utility
    refresh: () => void;
}

/**
 * Resolves an entity ID from a ParsedEntity
 * Uses noteId if available, otherwise generates a deterministic ID from kind+label
 */
function resolveEntityId(entity: ParsedEntity | null | undefined): string | null {
    if (!entity) return null;

    // If entity has a noteId, use that
    if (entity.noteId) {
        return entity.noteId;
    }

    // Otherwise, create a deterministic ID from kind+label
    // This allows entities without notes to have persistent attributes
    return `entity:${entity.kind}:${entity.label}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
}

/**
 * Hook for unified entity attribute management with bi-directional sync
 * 
 * @param entity - The parsed entity to manage attributes for
 * @returns Object with attribute state and mutation functions
 * 
 * @example
 * ```tsx
 * const { attributesRecord, setField, metaCards } = useUnifiedEntityAttributes(selectedEntity);
 * 
 * // Read a field
 * const age = attributesRecord.age;
 * 
 * // Write a field - syncs to both SQLite and note content
 * await setField('age', 25, 'number');
 * ```
 */
export function useUnifiedEntityAttributes(entity: ParsedEntity | null | undefined): UseUnifiedEntityAttributesResult {
    const entityId = resolveEntityId(entity);

    // Use the base entity attributes hook
    const baseHook = useEntityAttributes(entityId);

    // Get note access for legacy sync
    const { state: { notes }, updateNoteContent } = useJotaiNotes();

    // Find the associated note (if any)
    const associatedNote = useMemo(() => {
        if (!entity) return null;

        return notes.find(n =>
            (entity.noteId && n.id === entity.noteId) ||
            (n.isEntity && n.entityKind === entity.kind && n.entityLabel === entity.label)
        ) || null;
    }, [entity, notes]);

    // Sync attributes TO legacy note content
    const syncToLegacy = useCallback(async () => {
        if (!entity || !associatedNote) return;

        try {
            const content = associatedNote.content ? JSON.parse(associatedNote.content) : {};

            if (!content.entityAttributes) {
                content.entityAttributes = {};
            }

            const entityKey = `${entity.kind}|${entity.label}`;
            content.entityAttributes[entityKey] = {
                ...content.entityAttributes[entityKey],
                ...baseHook.attributesRecord,
            };

            await updateNoteContent(associatedNote.id, JSON.stringify(content));
        } catch (err) {
            console.error('[UnifiedEntityAttributes] Failed to sync to legacy:', err);
        }
    }, [entity, associatedNote, baseHook.attributesRecord, updateNoteContent]);

    // Sync attributes FROM legacy note content
    const syncFromLegacy = useCallback(async () => {
        if (!entity || !associatedNote) return;

        try {
            const content = associatedNote.content ? JSON.parse(associatedNote.content) : {};
            const entityKey = `${entity.kind}|${entity.label}`;
            const legacyAttrs = content.entityAttributes?.[entityKey] || {};

            // Only sync non-empty legacy attributes not already in new store
            const currentFields = new Set(baseHook.attributes.map(a => a.fieldName));

            for (const [fieldName, value] of Object.entries(legacyAttrs)) {
                if (!currentFields.has(fieldName) && value !== undefined && value !== null) {
                    // Infer field type from value
                    let fieldType: FieldType = 'text';
                    if (typeof value === 'number') fieldType = 'number';
                    else if (typeof value === 'boolean') fieldType = 'toggle';
                    else if (Array.isArray(value)) fieldType = 'array';
                    else if (typeof value === 'object') fieldType = 'object';

                    await baseHook.setField(fieldName, value, fieldType);
                }
            }
        } catch (err) {
            console.error('[UnifiedEntityAttributes] Failed to sync from legacy:', err);
        }
    }, [entity, associatedNote, baseHook.attributes, baseHook.setField]);

    // Auto-sync from legacy on first load (if new store is empty)
    useEffect(() => {
        if (entity && associatedNote && baseHook.attributes.length === 0) {
            syncFromLegacy();
        }
    }, [entity?.label, associatedNote?.id]); // Intentionally limited deps

    // Enhanced setField that also syncs to legacy
    const setFieldWithSync = useCallback(async (
        fieldName: string,
        value: any,
        fieldType: FieldType = 'text'
    ): Promise<void> => {
        // Update new store
        await baseHook.setField(fieldName, value, fieldType);

        // Also update legacy note content for backwards compatibility
        if (entity && associatedNote) {
            try {
                const content = associatedNote.content ? JSON.parse(associatedNote.content) : {};

                if (!content.entityAttributes) {
                    content.entityAttributes = {};
                }

                const entityKey = `${entity.kind}|${entity.label}`;
                if (!content.entityAttributes[entityKey]) {
                    content.entityAttributes[entityKey] = {};
                }
                content.entityAttributes[entityKey][fieldName] = value;

                await updateNoteContent(associatedNote.id, JSON.stringify(content));
            } catch (err) {
                console.error('[UnifiedEntityAttributes] Failed to sync field to legacy:', err);
            }
        }
    }, [baseHook.setField, entity, associatedNote, updateNoteContent]);

    // Enhanced setFields that also syncs to legacy
    const setFieldsWithSync = useCallback(async (
        fields: Record<string, any>,
        fieldTypes?: Record<string, FieldType>
    ): Promise<void> => {
        // Update new store
        await baseHook.setFields(fields, fieldTypes);

        // Also update legacy note content
        if (entity && associatedNote) {
            try {
                const content = associatedNote.content ? JSON.parse(associatedNote.content) : {};

                if (!content.entityAttributes) {
                    content.entityAttributes = {};
                }

                const entityKey = `${entity.kind}|${entity.label}`;
                content.entityAttributes[entityKey] = {
                    ...content.entityAttributes[entityKey],
                    ...fields,
                };

                await updateNoteContent(associatedNote.id, JSON.stringify(content));
            } catch (err) {
                console.error('[UnifiedEntityAttributes] Failed to sync fields to legacy:', err);
            }
        }
    }, [baseHook.setFields, entity, associatedNote, updateNoteContent]);

    return useMemo(() => ({
        // State
        attributes: baseHook.attributes,
        attributesRecord: baseHook.attributesRecord,
        metaCards: baseHook.metaCards,
        isLoading: baseHook.isLoading,

        // Field operations (with sync)
        getField: baseHook.getField,
        setField: setFieldWithSync,
        setFields: setFieldsWithSync,
        deleteField: baseHook.deleteField,

        // Meta card operations
        createCard: baseHook.createCard,
        updateCard: baseHook.updateCard,
        deleteCard: baseHook.deleteCard,

        // Legacy compatibility
        syncFromLegacy,
        syncToLegacy,

        // Utility
        refresh: baseHook.refresh,
    }), [
        baseHook,
        setFieldWithSync,
        setFieldsWithSync,
        syncFromLegacy,
        syncToLegacy,
    ]);
}

// Re-export types
export type { EntityAttribute, MetaCard, FieldType };
