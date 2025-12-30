/**
 * Entity Attributes Atoms
 * 
 * First-class fact sheet system - entity-owned attribute storage.
 * Provides reactive state for entity attributes, meta cards, and field schemas.
 */

import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { dbClient } from '@/lib/db/client/db-client';
import { generateId } from '@/lib/utils/ids';

// ============================================
// TYPES
// ============================================

export type FieldType =
    | 'text' | 'number' | 'array' | 'object' | 'boolean'
    | 'slider' | 'counter' | 'toggle' | 'date' | 'color'
    | 'rating' | 'tags' | 'entity-link' | 'rich-text' | 'progress';

export interface EntityAttribute {
    id: string;
    entityId: string;
    fieldName: string;
    fieldType: FieldType;
    value: any;
    schemaId?: string;
    cardId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface MetaCard {
    id: string;
    ownerId: string; // entity_id
    name: string;
    color?: string;
    icon?: string;
    displayOrder: number;
    isCollapsed: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface MetaCardField {
    id: string;
    cardId: string;
    fieldName: string;
    schemaId?: string;
    customSchema?: FieldSchema;
    layoutHint?: 'full' | 'half' | 'third' | 'quarter';
    displayOrder: number;
}

export interface FieldSchema {
    id: string;
    name: string;
    fieldType: FieldType;
    label: string;
    description?: string;
    metadata?: Record<string, any>; // min, max, options, step, etc.
    validation?: ValidationRule[];
    defaultValue?: any;
    isSystem: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
    value?: any;
    message: string;
}

// ============================================
// BASE ATOMS
// ============================================

// Cache for entity attributes (keyed by entityId)
const entityAttributesCache = atom<Map<string, EntityAttribute[]>>(new Map());

// Cache for meta cards (keyed by ownerId)
const metaCardsCache = atom<Map<string, MetaCard[]>>(new Map());

// Field schemas cache
const fieldSchemasAtom = atom<FieldSchema[]>([]);

// Loading state
export const isLoadingAttributesAtom = atom<boolean>(false);

// ============================================
// ENTITY ATTRIBUTES - READ
// ============================================

/**
 * Get all attributes for a specific entity
 */
export const entityAttributesFamily = atomFamily((entityId: string) =>
    atom(async (get) => {
        const cache = get(entityAttributesCache);

        // Return cached if available
        if (cache.has(entityId)) {
            return cache.get(entityId)!;
        }

        // Fetch from database
        try {
            const result = await dbClient.query<any>(
                `SELECT * FROM entity_attributes WHERE entity_id = ? ORDER BY field_name`,
                [entityId]
            );

            const attributes: EntityAttribute[] = (result || []).map((row: any) => ({
                id: row.id,
                entityId: row.entity_id,
                fieldName: row.field_name,
                fieldType: row.field_type as FieldType,
                value: row.value ? JSON.parse(row.value) : null,
                schemaId: row.schema_id,
                cardId: row.card_id,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            }));

            return attributes;
        } catch (error) {
            console.error(`[EntityAttributes] Failed to load attributes for ${entityId}:`, error);
            return [];
        }
    })
);

/**
 * Get a single attribute value by field name
 */
export const getAttributeAtom = atomFamily(
    (params: { entityId: string; fieldName: string }) =>
        atom(async (get) => {
            const attrs = await get(entityAttributesFamily(params.entityId));
            const attr = attrs.find(a => a.fieldName === params.fieldName);
            return attr?.value ?? null;
        })
);

// ============================================
// ENTITY ATTRIBUTES - WRITE
// ============================================

/**
 * Set a single attribute value
 */
export const setAttributeAtom = atom(
    null,
    async (get, set, params: {
        entityId: string;
        fieldName: string;
        value: any;
        fieldType?: FieldType;
        schemaId?: string;
        cardId?: string;
    }) => {
        const { entityId, fieldName, value, fieldType = 'text', schemaId, cardId } = params;
        const timestamp = Date.now();

        // Optimistic update: update cache
        const cache = new Map(get(entityAttributesCache));
        const existing = cache.get(entityId) || [];
        const existingIndex = existing.findIndex(a => a.fieldName === fieldName);

        const newAttribute: EntityAttribute = {
            id: existingIndex >= 0 ? existing[existingIndex].id : generateId(),
            entityId,
            fieldName,
            fieldType,
            value,
            schemaId,
            cardId,
            createdAt: existingIndex >= 0 ? existing[existingIndex].createdAt : timestamp,
            updatedAt: timestamp,
        };

        if (existingIndex >= 0) {
            existing[existingIndex] = newAttribute;
        } else {
            existing.push(newAttribute);
        }
        cache.set(entityId, existing);
        set(entityAttributesCache, cache);

        // Persist to database
        try {
            await dbClient.query(
                `INSERT INTO entity_attributes (id, entity_id, field_name, field_type, value, schema_id, card_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(entity_id, field_name) DO UPDATE SET
                    value = excluded.value,
                    field_type = excluded.field_type,
                    schema_id = excluded.schema_id,
                    card_id = excluded.card_id,
                    updated_at = excluded.updated_at`,
                [
                    newAttribute.id,
                    entityId,
                    fieldName,
                    fieldType,
                    JSON.stringify(value),
                    schemaId || null,
                    cardId || null,
                    newAttribute.createdAt,
                    timestamp,
                ]
            );
        } catch (error) {
            console.error(`[EntityAttributes] Failed to save attribute ${fieldName}:`, error);
            // Rollback cache on error
            if (existingIndex >= 0) {
                // Revert to original
            } else {
                existing.pop();
            }
            cache.set(entityId, existing);
            set(entityAttributesCache, cache);
            throw error;
        }
    }
);

/**
 * Set multiple attributes at once
 */
export const setMultipleAttributesAtom = atom(
    null,
    async (get, set, params: {
        entityId: string;
        attributes: Record<string, any>;
        fieldTypes?: Record<string, FieldType>;
    }) => {
        const { entityId, attributes, fieldTypes = {} } = params;

        for (const [fieldName, value] of Object.entries(attributes)) {
            await set(setAttributeAtom, {
                entityId,
                fieldName,
                value,
                fieldType: fieldTypes[fieldName] || 'text',
            });
        }
    }
);

/**
 * Delete an attribute
 */
export const deleteAttributeAtom = atom(
    null,
    async (get, set, params: { entityId: string; fieldName: string }) => {
        const { entityId, fieldName } = params;

        // Optimistic update
        const cache = new Map(get(entityAttributesCache));
        const existing = cache.get(entityId) || [];
        const filtered = existing.filter(a => a.fieldName !== fieldName);
        cache.set(entityId, filtered);
        set(entityAttributesCache, cache);

        // Persist
        try {
            await dbClient.query(
                `DELETE FROM entity_attributes WHERE entity_id = ? AND field_name = ?`,
                [entityId, fieldName]
            );
        } catch (error) {
            console.error(`[EntityAttributes] Failed to delete attribute ${fieldName}:`, error);
            cache.set(entityId, existing);
            set(entityAttributesCache, cache);
            throw error;
        }
    }
);

// ============================================
// META CARDS - READ
// ============================================

/**
 * Get all meta cards for an entity
 */
export const metaCardsFamily = atomFamily((entityId: string) =>
    atom(async (get) => {
        const cache = get(metaCardsCache);

        if (cache.has(entityId)) {
            return cache.get(entityId)!;
        }

        try {
            const result = await dbClient.query<any>(
                `SELECT * FROM meta_cards WHERE owner_id = ? ORDER BY display_order`,
                [entityId]
            );

            const cards: MetaCard[] = (result || []).map((row: any) => ({
                id: row.id,
                ownerId: row.owner_id,
                name: row.name,
                color: row.color,
                icon: row.icon,
                displayOrder: row.display_order,
                isCollapsed: row.is_collapsed === 1,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            }));

            return cards;
        } catch (error) {
            console.error(`[EntityAttributes] Failed to load meta cards for ${entityId}:`, error);
            return [];
        }
    })
);

// ============================================
// META CARDS - WRITE
// ============================================

/**
 * Create a new meta card
 */
export const createMetaCardAtom = atom(
    null,
    async (get, set, params: {
        ownerId: string;
        name: string;
        color?: string;
        icon?: string;
    }) => {
        const { ownerId, name, color, icon } = params;
        const timestamp = Date.now();
        const id = generateId();

        // Get current cards to determine order
        const existingCards = await get(metaCardsFamily(ownerId));
        const displayOrder = existingCards.length;

        const newCard: MetaCard = {
            id,
            ownerId,
            name,
            color,
            icon,
            displayOrder,
            isCollapsed: false,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        // Optimistic update
        const cache = new Map(get(metaCardsCache));
        cache.set(ownerId, [...existingCards, newCard]);
        set(metaCardsCache, cache);

        // Persist
        try {
            await dbClient.query(
                `INSERT INTO meta_cards (id, owner_id, name, color, icon, display_order, is_collapsed, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, ownerId, name, color || null, icon || null, displayOrder, 0, timestamp, timestamp]
            );

            return newCard;
        } catch (error) {
            console.error(`[EntityAttributes] Failed to create meta card:`, error);
            cache.set(ownerId, existingCards);
            set(metaCardsCache, cache);
            throw error;
        }
    }
);

/**
 * Update a meta card
 */
export const updateMetaCardAtom = atom(
    null,
    async (get, set, params: {
        cardId: string;
        updates: Partial<Pick<MetaCard, 'name' | 'color' | 'icon' | 'displayOrder' | 'isCollapsed'>>;
    }) => {
        const { cardId, updates } = params;
        const timestamp = Date.now();

        // Find the card in cache
        const cache = new Map(get(metaCardsCache));
        let foundOwnerId: string | null = null;
        let cardIndex = -1;
        let existingCards: MetaCard[] = [];

        for (const [ownerId, cards] of cache.entries()) {
            const idx = cards.findIndex(c => c.id === cardId);
            if (idx >= 0) {
                foundOwnerId = ownerId;
                cardIndex = idx;
                existingCards = [...cards];
                break;
            }
        }

        if (!foundOwnerId || cardIndex < 0) {
            console.warn(`[EntityAttributes] Card ${cardId} not found in cache`);
            return;
        }

        // Optimistic update
        const updatedCard = { ...existingCards[cardIndex], ...updates, updatedAt: timestamp };
        existingCards[cardIndex] = updatedCard;
        cache.set(foundOwnerId, existingCards);
        set(metaCardsCache, cache);

        // Persist
        try {
            const setClauses: string[] = ['updated_at = ?'];
            const values: any[] = [timestamp];

            if (updates.name !== undefined) {
                setClauses.push('name = ?');
                values.push(updates.name);
            }
            if (updates.color !== undefined) {
                setClauses.push('color = ?');
                values.push(updates.color);
            }
            if (updates.icon !== undefined) {
                setClauses.push('icon = ?');
                values.push(updates.icon);
            }
            if (updates.displayOrder !== undefined) {
                setClauses.push('display_order = ?');
                values.push(updates.displayOrder);
            }
            if (updates.isCollapsed !== undefined) {
                setClauses.push('is_collapsed = ?');
                values.push(updates.isCollapsed ? 1 : 0);
            }

            values.push(cardId);

            await dbClient.query(
                `UPDATE meta_cards SET ${setClauses.join(', ')} WHERE id = ?`,
                values
            );
        } catch (error) {
            console.error(`[EntityAttributes] Failed to update meta card:`, error);
            throw error;
        }
    }
);

/**
 * Delete a meta card
 */
export const deleteMetaCardAtom = atom(
    null,
    async (get, set, cardId: string) => {
        const cache = new Map(get(metaCardsCache));
        let foundOwnerId: string | null = null;
        let existingCards: MetaCard[] = [];

        for (const [ownerId, cards] of cache.entries()) {
            if (cards.some(c => c.id === cardId)) {
                foundOwnerId = ownerId;
                existingCards = cards;
                break;
            }
        }

        if (!foundOwnerId) {
            console.warn(`[EntityAttributes] Card ${cardId} not found`);
            return;
        }

        // Optimistic update
        cache.set(foundOwnerId, existingCards.filter(c => c.id !== cardId));
        set(metaCardsCache, cache);

        // Persist
        try {
            await dbClient.query(`DELETE FROM meta_cards WHERE id = ?`, [cardId]);
        } catch (error) {
            console.error(`[EntityAttributes] Failed to delete meta card:`, error);
            cache.set(foundOwnerId, existingCards);
            set(metaCardsCache, cache);
            throw error;
        }
    }
);

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Invalidate cache for an entity (force re-fetch)
 */
export const invalidateEntityCacheAtom = atom(
    null,
    (get, set, entityId: string) => {
        const attrCache = new Map(get(entityAttributesCache));
        attrCache.delete(entityId);
        set(entityAttributesCache, attrCache);

        const cardCache = new Map(get(metaCardsCache));
        cardCache.delete(entityId);
        set(metaCardsCache, cardCache);
    }
);

/**
 * Clear all caches
 */
export const clearAllCachesAtom = atom(
    null,
    (get, set) => {
        set(entityAttributesCache, new Map());
        set(metaCardsCache, new Map());
        set(fieldSchemasAtom, []);
    }
);

// ============================================
// CONVENIENCE: GET ALL ATTRIBUTES AS RECORD
// ============================================

/**
 * Get all attributes as a key-value record (for compatibility)
 */
export const entityAttributesRecordFamily = atomFamily((entityId: string) =>
    atom(async (get) => {
        const attrs = await get(entityAttributesFamily(entityId));
        const record: Record<string, any> = {};

        for (const attr of attrs) {
            record[attr.fieldName] = attr.value;
        }

        return record;
    })
);
