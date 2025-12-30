/**
 * Fact Sheet API
 * 
 * Centralized API for accessing and manipulating entity metadata.
 * Provides a clean interface for all components to interact with fact sheets.
 * 
 * This API can be used:
 * - From React components via the hook wrappers
 * - From non-React code (services, utilities)
 * - For real-time subscription to entity changes
 */

import { dbClient } from '@/lib/db/client/db-client';
import { generateId } from '@/lib/utils/ids';
import type {
    EntityAttribute,
    MetaCard,
    MetaCardField,
    FieldType,
    FieldSchema,
} from '@/atoms/entity-attributes';

// ============================================
// TYPES
// ============================================

export interface FieldUpdate {
    fieldName: string;
    value: any;
    fieldType?: FieldType;
    schemaId?: string;
    cardId?: string;
}

export interface MetaCardCreate {
    name: string;
    color?: string;
    icon?: string;
}

export interface MetaCardUpdate {
    name?: string;
    color?: string;
    icon?: string;
    displayOrder?: number;
    isCollapsed?: boolean;
}

export interface EntitySubscription {
    unsubscribe: () => void;
}

type EntityChangeCallback = (entityId: string, attributes: EntityAttribute[]) => void;
type MetaCardChangeCallback = (entityId: string, cards: MetaCard[]) => void;

// ============================================
// SUBSCRIPTION MANAGER
// ============================================

class SubscriptionManager {
    private entityListeners = new Map<string, Set<EntityChangeCallback>>();
    private cardListeners = new Map<string, Set<MetaCardChangeCallback>>();
    private globalEntityListeners = new Set<EntityChangeCallback>();
    private globalCardListeners = new Set<MetaCardChangeCallback>();

    // Entity subscriptions
    subscribeToEntity(entityId: string, callback: EntityChangeCallback): EntitySubscription {
        if (!this.entityListeners.has(entityId)) {
            this.entityListeners.set(entityId, new Set());
        }
        this.entityListeners.get(entityId)!.add(callback);

        return {
            unsubscribe: () => {
                this.entityListeners.get(entityId)?.delete(callback);
            },
        };
    }

    subscribeToAllEntities(callback: EntityChangeCallback): EntitySubscription {
        this.globalEntityListeners.add(callback);
        return {
            unsubscribe: () => {
                this.globalEntityListeners.delete(callback);
            },
        };
    }

    notifyEntityChange(entityId: string, attributes: EntityAttribute[]): void {
        // Notify entity-specific listeners
        this.entityListeners.get(entityId)?.forEach(cb => cb(entityId, attributes));
        // Notify global listeners
        this.globalEntityListeners.forEach(cb => cb(entityId, attributes));
    }

    // Meta card subscriptions
    subscribeToCards(entityId: string, callback: MetaCardChangeCallback): EntitySubscription {
        if (!this.cardListeners.has(entityId)) {
            this.cardListeners.set(entityId, new Set());
        }
        this.cardListeners.get(entityId)!.add(callback);

        return {
            unsubscribe: () => {
                this.cardListeners.get(entityId)?.delete(callback);
            },
        };
    }

    subscribeToAllCards(callback: MetaCardChangeCallback): EntitySubscription {
        this.globalCardListeners.add(callback);
        return {
            unsubscribe: () => {
                this.globalCardListeners.delete(callback);
            },
        };
    }

    notifyCardChange(entityId: string, cards: MetaCard[]): void {
        this.cardListeners.get(entityId)?.forEach(cb => cb(entityId, cards));
        this.globalCardListeners.forEach(cb => cb(entityId, cards));
    }
}

const subscriptionManager = new SubscriptionManager();

// ============================================
// FACT SHEET API
// ============================================

export const FactSheetAPI = {
    // ==========================================
    // FIELD OPERATIONS
    // ==========================================

    /**
     * Get a single field value for an entity
     */
    async getField(entityId: string, fieldName: string): Promise<any> {
        try {
            const result = await dbClient.query<any>(
                `SELECT value FROM entity_attributes WHERE entity_id = ? AND field_name = ?`,
                [entityId, fieldName]
            );

            if (result.length > 0 && result[0].value) {
                return JSON.parse(result[0].value);
            }
            return null;
        } catch (error) {
            console.error(`[FactSheetAPI] getField failed:`, error);
            return null;
        }
    },

    /**
     * Get all fields for an entity as a key-value record
     */
    async getAllFields(entityId: string): Promise<Record<string, any>> {
        try {
            const result = await dbClient.query<any>(
                `SELECT field_name, value FROM entity_attributes WHERE entity_id = ?`,
                [entityId]
            );

            const record: Record<string, any> = {};
            for (const row of result) {
                if (row.value) {
                    record[row.field_name] = JSON.parse(row.value);
                }
            }
            return record;
        } catch (error) {
            console.error(`[FactSheetAPI] getAllFields failed:`, error);
            return {};
        }
    },

    /**
     * Get all attribute objects for an entity
     */
    async getAttributes(entityId: string): Promise<EntityAttribute[]> {
        try {
            const result = await dbClient.query<any>(
                `SELECT * FROM entity_attributes WHERE entity_id = ? ORDER BY field_name`,
                [entityId]
            );

            return (result || []).map((row: any) => ({
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
        } catch (error) {
            console.error(`[FactSheetAPI] getAttributes failed:`, error);
            return [];
        }
    },

    /**
     * Set a single field value
     */
    async setField(
        entityId: string,
        fieldName: string,
        value: any,
        options?: {
            fieldType?: FieldType;
            schemaId?: string;
            cardId?: string;
        }
    ): Promise<void> {
        const { fieldType = 'text', schemaId, cardId } = options || {};
        const timestamp = Date.now();
        const id = generateId();

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
                    id,
                    entityId,
                    fieldName,
                    fieldType,
                    JSON.stringify(value),
                    schemaId || null,
                    cardId || null,
                    timestamp,
                    timestamp,
                ]
            );

            // Notify subscribers
            const attributes = await this.getAttributes(entityId);
            subscriptionManager.notifyEntityChange(entityId, attributes);
        } catch (error) {
            console.error(`[FactSheetAPI] setField failed:`, error);
            throw error;
        }
    },

    /**
     * Set multiple fields at once
     */
    async setMultipleFields(
        entityId: string,
        updates: FieldUpdate[]
    ): Promise<void> {
        for (const update of updates) {
            await this.setField(entityId, update.fieldName, update.value, {
                fieldType: update.fieldType,
                schemaId: update.schemaId,
                cardId: update.cardId,
            });
        }
    },

    /**
     * Delete a field
     */
    async deleteField(entityId: string, fieldName: string): Promise<void> {
        try {
            await dbClient.query(
                `DELETE FROM entity_attributes WHERE entity_id = ? AND field_name = ?`,
                [entityId, fieldName]
            );

            // Notify subscribers
            const attributes = await this.getAttributes(entityId);
            subscriptionManager.notifyEntityChange(entityId, attributes);
        } catch (error) {
            console.error(`[FactSheetAPI] deleteField failed:`, error);
            throw error;
        }
    },

    /**
     * Delete all fields for an entity
     */
    async deleteAllFields(entityId: string): Promise<void> {
        try {
            await dbClient.query(
                `DELETE FROM entity_attributes WHERE entity_id = ?`,
                [entityId]
            );

            subscriptionManager.notifyEntityChange(entityId, []);
        } catch (error) {
            console.error(`[FactSheetAPI] deleteAllFields failed:`, error);
            throw error;
        }
    },

    // ==========================================
    // META CARD OPERATIONS
    // ==========================================

    /**
     * Get all meta cards for an entity
     */
    async getMetaCards(entityId: string): Promise<MetaCard[]> {
        try {
            const result = await dbClient.query<any>(
                `SELECT * FROM meta_cards WHERE owner_id = ? ORDER BY display_order`,
                [entityId]
            );

            return (result || []).map((row: any) => ({
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
        } catch (error) {
            console.error(`[FactSheetAPI] getMetaCards failed:`, error);
            return [];
        }
    },

    /**
     * Create a new meta card
     */
    async createMetaCard(entityId: string, data: MetaCardCreate): Promise<MetaCard> {
        const timestamp = Date.now();
        const id = generateId();

        // Get current cards to determine order
        const existingCards = await this.getMetaCards(entityId);
        const displayOrder = existingCards.length;

        const newCard: MetaCard = {
            id,
            ownerId: entityId,
            name: data.name,
            color: data.color,
            icon: data.icon,
            displayOrder,
            isCollapsed: false,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        try {
            await dbClient.query(
                `INSERT INTO meta_cards (id, owner_id, name, color, icon, display_order, is_collapsed, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, entityId, data.name, data.color || null, data.icon || null, displayOrder, 0, timestamp, timestamp]
            );

            // Notify subscribers
            const cards = await this.getMetaCards(entityId);
            subscriptionManager.notifyCardChange(entityId, cards);

            return newCard;
        } catch (error) {
            console.error(`[FactSheetAPI] createMetaCard failed:`, error);
            throw error;
        }
    },

    /**
     * Update a meta card
     */
    async updateMetaCard(cardId: string, updates: MetaCardUpdate): Promise<void> {
        const timestamp = Date.now();

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

            // Get owner_id to notify subscribers
            const cardResult = await dbClient.query<any>(
                `SELECT owner_id FROM meta_cards WHERE id = ?`,
                [cardId]
            );

            if (cardResult.length > 0) {
                const entityId = cardResult[0].owner_id;
                const cards = await this.getMetaCards(entityId);
                subscriptionManager.notifyCardChange(entityId, cards);
            }
        } catch (error) {
            console.error(`[FactSheetAPI] updateMetaCard failed:`, error);
            throw error;
        }
    },

    /**
     * Delete a meta card
     */
    async deleteMetaCard(cardId: string): Promise<void> {
        try {
            // Get owner_id before deleting
            const cardResult = await dbClient.query<any>(
                `SELECT owner_id FROM meta_cards WHERE id = ?`,
                [cardId]
            );

            const entityId = cardResult.length > 0 ? cardResult[0].owner_id : null;

            await dbClient.query(`DELETE FROM meta_cards WHERE id = ?`, [cardId]);

            // Notify subscribers
            if (entityId) {
                const cards = await this.getMetaCards(entityId);
                subscriptionManager.notifyCardChange(entityId, cards);
            }
        } catch (error) {
            console.error(`[FactSheetAPI] deleteMetaCard failed:`, error);
            throw error;
        }
    },

    /**
     * Reorder meta cards
     */
    async reorderMetaCards(entityId: string, cardIds: string[]): Promise<void> {
        try {
            for (let i = 0; i < cardIds.length; i++) {
                await dbClient.query(
                    `UPDATE meta_cards SET display_order = ?, updated_at = ? WHERE id = ?`,
                    [i, Date.now(), cardIds[i]]
                );
            }

            // Notify subscribers
            const cards = await this.getMetaCards(entityId);
            subscriptionManager.notifyCardChange(entityId, cards);
        } catch (error) {
            console.error(`[FactSheetAPI] reorderMetaCards failed:`, error);
            throw error;
        }
    },

    // ==========================================
    // SUBSCRIPTION OPERATIONS
    // ==========================================

    /**
     * Subscribe to attribute changes for a specific entity
     */
    subscribeToEntity(entityId: string, callback: EntityChangeCallback): EntitySubscription {
        return subscriptionManager.subscribeToEntity(entityId, callback);
    },

    /**
     * Subscribe to attribute changes for all entities
     */
    subscribeToAllEntities(callback: EntityChangeCallback): EntitySubscription {
        return subscriptionManager.subscribeToAllEntities(callback);
    },

    /**
     * Subscribe to meta card changes for a specific entity
     */
    subscribeToCards(entityId: string, callback: MetaCardChangeCallback): EntitySubscription {
        return subscriptionManager.subscribeToCards(entityId, callback);
    },

    /**
     * Subscribe to meta card changes for all entities
     */
    subscribeToAllCards(callback: MetaCardChangeCallback): EntitySubscription {
        return subscriptionManager.subscribeToAllCards(callback);
    },

    // ==========================================
    // BULK OPERATIONS
    // ==========================================

    /**
     * Copy all attributes from one entity to another
     */
    async copyAttributes(sourceEntityId: string, targetEntityId: string): Promise<void> {
        const attrs = await this.getAttributes(sourceEntityId);

        for (const attr of attrs) {
            await this.setField(targetEntityId, attr.fieldName, attr.value, {
                fieldType: attr.fieldType,
                schemaId: attr.schemaId,
            });
        }
    },

    /**
     * Copy all meta cards from one entity to another
     */
    async copyMetaCards(sourceEntityId: string, targetEntityId: string): Promise<void> {
        const cards = await this.getMetaCards(sourceEntityId);

        for (const card of cards) {
            await this.createMetaCard(targetEntityId, {
                name: card.name,
                color: card.color,
                icon: card.icon,
            });
        }
    },

    // ==========================================
    // SEARCH & QUERY
    // ==========================================

    /**
     * Find entities by field value
     */
    async findEntitiesByField(fieldName: string, value: any): Promise<string[]> {
        try {
            const result = await dbClient.query<any>(
                `SELECT DISTINCT entity_id FROM entity_attributes WHERE field_name = ? AND value = ?`,
                [fieldName, JSON.stringify(value)]
            );

            return result.map((row: any) => row.entity_id);
        } catch (error) {
            console.error(`[FactSheetAPI] findEntitiesByField failed:`, error);
            return [];
        }
    },

    /**
     * Get entities with a specific field type
     */
    async findEntitiesByFieldType(fieldType: FieldType): Promise<string[]> {
        try {
            const result = await dbClient.query<any>(
                `SELECT DISTINCT entity_id FROM entity_attributes WHERE field_type = ?`,
                [fieldType]
            );

            return result.map((row: any) => row.entity_id);
        } catch (error) {
            console.error(`[FactSheetAPI] findEntitiesByFieldType failed:`, error);
            return [];
        }
    },

    /**
     * Get all unique field names used across all entities
     */
    async getAllFieldNames(): Promise<string[]> {
        try {
            const result = await dbClient.query<any>(
                `SELECT DISTINCT field_name FROM entity_attributes ORDER BY field_name`
            );

            return result.map((row: any) => row.field_name);
        } catch (error) {
            console.error(`[FactSheetAPI] getAllFieldNames failed:`, error);
            return [];
        }
    },
};

// Export types
export type { EntityAttribute, MetaCard, MetaCardField, FieldType, FieldSchema };
