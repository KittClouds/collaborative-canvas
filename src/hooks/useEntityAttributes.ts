/**
 * useEntityAttributes Hook
 * 
 * React hook for reading and writing entity attributes.
 * Provides a clean API for fact sheet components to interact with entity-owned storage.
 */

import { useCallback, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useAtomCallback } from 'jotai/utils';
import {
    entityAttributesFamily,
    entityAttributesRecordFamily,
    metaCardsFamily,
    setAttributeAtom,
    setMultipleAttributesAtom,
    deleteAttributeAtom,
    createMetaCardAtom,
    updateMetaCardAtom,
    deleteMetaCardAtom,
    invalidateEntityCacheAtom,
    type EntityAttribute,
    type MetaCard,
    type FieldType,
} from '@/atoms/entity-attributes';

export interface UseEntityAttributesResult {
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

    // Utility
    refresh: () => void;
}

/**
 * Hook for managing entity attributes
 * 
 * @param entityId - The entity ID to manage attributes for
 * @returns Object with attribute state and mutation functions
 * 
 * @example
 * ```tsx
 * const { attributes, setField, metaCards, createCard } = useEntityAttributes(entity.id);
 * 
 * // Read a field
 * const age = attributes.find(a => a.fieldName === 'age')?.value;
 * 
 * // Write a field
 * await setField('age', 25, 'number');
 * 
 * // Create a custom card
 * await createCard('Combat Stats', '#ef4444', 'Sword');
 * ```
 */
export function useEntityAttributes(entityId: string | null | undefined): UseEntityAttributesResult {
    // Read atoms - these are async atoms that suspend
    const attributesAtom = entityId ? entityAttributesFamily(entityId) : null;
    const recordAtom = entityId ? entityAttributesRecordFamily(entityId) : null;
    const cardsAtom = entityId ? metaCardsFamily(entityId) : null;

    // Use suspense-compatible reads (will return empty while loading)
    const attributes = useAtomValue(attributesAtom ?? emptyArrayAtom) as EntityAttribute[];
    const attributesRecord = useAtomValue(recordAtom ?? emptyRecordAtom) as Record<string, any>;
    const metaCards = useAtomValue(cardsAtom ?? emptyArrayAtom) as MetaCard[];

    // Write atoms
    const setAttributeFn = useSetAtom(setAttributeAtom);
    const setMultipleAttributesFn = useSetAtom(setMultipleAttributesAtom);
    const deleteAttributeFn = useSetAtom(deleteAttributeAtom);
    const createMetaCardFn = useSetAtom(createMetaCardAtom);
    const updateMetaCardFn = useSetAtom(updateMetaCardAtom);
    const deleteMetaCardFn = useSetAtom(deleteMetaCardAtom);
    const invalidateCacheFn = useSetAtom(invalidateEntityCacheAtom);

    // Field operations
    const getField = useCallback((fieldName: string): any => {
        return attributesRecord[fieldName] ?? null;
    }, [attributesRecord]);

    const setField = useCallback(async (
        fieldName: string,
        value: any,
        fieldType: FieldType = 'text'
    ): Promise<void> => {
        if (!entityId) {
            console.warn('[useEntityAttributes] Cannot setField: no entityId');
            return;
        }

        await setAttributeFn({
            entityId,
            fieldName,
            value,
            fieldType,
        });
    }, [entityId, setAttributeFn]);

    const setFields = useCallback(async (
        fields: Record<string, any>,
        fieldTypes?: Record<string, FieldType>
    ): Promise<void> => {
        if (!entityId) {
            console.warn('[useEntityAttributes] Cannot setFields: no entityId');
            return;
        }

        await setMultipleAttributesFn({
            entityId,
            attributes: fields,
            fieldTypes,
        });
    }, [entityId, setMultipleAttributesFn]);

    const deleteField = useCallback(async (fieldName: string): Promise<void> => {
        if (!entityId) {
            console.warn('[useEntityAttributes] Cannot deleteField: no entityId');
            return;
        }

        await deleteAttributeFn({ entityId, fieldName });
    }, [entityId, deleteAttributeFn]);

    // Meta card operations
    const createCard = useCallback(async (
        name: string,
        color?: string,
        icon?: string
    ): Promise<MetaCard> => {
        if (!entityId) {
            throw new Error('[useEntityAttributes] Cannot createCard: no entityId');
        }

        return await createMetaCardFn({
            ownerId: entityId,
            name,
            color,
            icon,
        });
    }, [entityId, createMetaCardFn]);

    const updateCard = useCallback(async (
        cardId: string,
        updates: Partial<Pick<MetaCard, 'name' | 'color' | 'icon' | 'isCollapsed'>>
    ): Promise<void> => {
        await updateMetaCardFn({ cardId, updates });
    }, [updateMetaCardFn]);

    const deleteCard = useCallback(async (cardId: string): Promise<void> => {
        await deleteMetaCardFn(cardId);
    }, [deleteMetaCardFn]);

    // Utility
    const refresh = useCallback(() => {
        if (entityId) {
            invalidateCacheFn(entityId);
        }
    }, [entityId, invalidateCacheFn]);

    return useMemo(() => ({
        // State
        attributes,
        attributesRecord,
        metaCards,
        isLoading: false, // Suspense handles loading state

        // Field operations
        getField,
        setField,
        setFields,
        deleteField,

        // Meta card operations
        createCard,
        updateCard,
        deleteCard,

        // Utility
        refresh,
    }), [
        attributes,
        attributesRecord,
        metaCards,
        getField,
        setField,
        setFields,
        deleteField,
        createCard,
        updateCard,
        deleteCard,
        refresh,
    ]);
}

// Empty atom helpers for null entityId case
import { atom } from 'jotai';
const emptyArrayAtom = atom<any[]>([]);
const emptyRecordAtom = atom<Record<string, any>>({});

// Re-export types
export type { EntityAttribute, MetaCard, FieldType };
