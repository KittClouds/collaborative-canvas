/**
 * Binding Engine
 * 
 * Core engine for managing entity-to-entity field bindings.
 * Handles binding resolution, propagation, and cycle detection.
 */

import { dbClient } from '@/lib/db/client/db-client';
import { generateId } from '@/lib/utils/ids';
import type {
    FieldBinding,
    BindingType,
    BindingGraphNode,
    BindingGraphEdge,
    ResolvedValue,
    BindingChangeEvent,
    CreateBindingOptions,
    UpdateBindingOptions,
    Transform,
    AggregationFunction,
    AggregationFilter,
} from './types';
import { parseTransform, serializeTransform, createFieldKey, parseFieldKey } from './types';
import { applyTransform } from './transforms';
import { applyAggregation } from './aggregations';

// ============================================
// BINDING ENGINE CLASS
// ============================================

export class BindingEngine {
    private static instance: BindingEngine | null = null;

    // In-memory binding graph
    private bindings: Map<string, FieldBinding> = new Map();
    private bindingsByTarget: Map<string, FieldBinding[]> = new Map();
    private bindingsBySource: Map<string, FieldBinding[]> = new Map();

    // Event listeners
    private listeners: Set<(event: BindingChangeEvent) => void> = new Set();

    // Initialization state
    private initialized = false;

    private constructor() { }

    static getInstance(): BindingEngine {
        if (!BindingEngine.instance) {
            BindingEngine.instance = new BindingEngine();
        }
        return BindingEngine.instance;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize the binding engine and load all bindings from database
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Ensure table exists
            await this.ensureTable();

            // Load all bindings
            await this.loadAllBindings();

            this.initialized = true;
            console.log(`[BindingEngine] Initialized with ${this.bindings.size} bindings`);
        } catch (error) {
            console.error('[BindingEngine] Failed to initialize:', error);
            throw error;
        }
    }

    private async ensureTable(): Promise<void> {
        await dbClient.query(`
      CREATE TABLE IF NOT EXISTS field_bindings (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        source_field_name TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        target_field_name TEXT NOT NULL,
        binding_type TEXT NOT NULL CHECK (binding_type IN ('mirror', 'inherit', 'aggregate')),
        transform TEXT,
        aggregation_fn TEXT,
        aggregation_filter TEXT,
        allow_override INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(source_entity_id, source_field_name, target_entity_id, target_field_name)
      )
    `);

        // Create indexes for efficient lookups
        await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_bindings_target 
      ON field_bindings(target_entity_id, target_field_name)
    `);

        await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_bindings_source 
      ON field_bindings(source_entity_id, source_field_name)
    `);
    }

    private async loadAllBindings(): Promise<void> {
        const rows = await dbClient.query<any>(`SELECT * FROM field_bindings WHERE is_active = 1`);

        this.bindings.clear();
        this.bindingsByTarget.clear();
        this.bindingsBySource.clear();

        for (const row of rows || []) {
            const binding = this.rowToBinding(row);
            this.indexBinding(binding);
        }
    }

    private rowToBinding(row: any): FieldBinding {
        return {
            id: row.id,
            sourceEntityId: row.source_entity_id,
            sourceFieldName: row.source_field_name,
            targetEntityId: row.target_entity_id,
            targetFieldName: row.target_field_name,
            bindingType: row.binding_type as BindingType,
            transform: row.transform ? parseTransform(row.transform) : undefined,
            aggregationFn: row.aggregation_fn as AggregationFunction | undefined,
            aggregationFilter: row.aggregation_filter ? JSON.parse(row.aggregation_filter) : undefined,
            allowOverride: row.allow_override === 1,
            isActive: row.is_active === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    private indexBinding(binding: FieldBinding): void {
        this.bindings.set(binding.id, binding);

        // Index by target
        const targetKey = createFieldKey(binding.targetEntityId, binding.targetFieldName);
        const targetBindings = this.bindingsByTarget.get(targetKey) || [];
        targetBindings.push(binding);
        this.bindingsByTarget.set(targetKey, targetBindings);

        // Index by source
        const sourceKey = createFieldKey(binding.sourceEntityId, binding.sourceFieldName);
        const sourceBindings = this.bindingsBySource.get(sourceKey) || [];
        sourceBindings.push(binding);
        this.bindingsBySource.set(sourceKey, sourceBindings);
    }

    private removeBindingFromIndex(binding: FieldBinding): void {
        this.bindings.delete(binding.id);

        // Remove from target index
        const targetKey = createFieldKey(binding.targetEntityId, binding.targetFieldName);
        const targetBindings = this.bindingsByTarget.get(targetKey) || [];
        this.bindingsByTarget.set(targetKey, targetBindings.filter(b => b.id !== binding.id));

        // Remove from source index
        const sourceKey = createFieldKey(binding.sourceEntityId, binding.sourceFieldName);
        const sourceBindings = this.bindingsBySource.get(sourceKey) || [];
        this.bindingsBySource.set(sourceKey, sourceBindings.filter(b => b.id !== binding.id));
    }

    // ============================================
    // CRUD OPERATIONS
    // ============================================

    /**
     * Create a new field binding
     */
    async createBinding(options: CreateBindingOptions): Promise<FieldBinding> {
        const {
            sourceEntityId,
            sourceFieldName,
            targetEntityId,
            targetFieldName,
            bindingType,
            transform,
            aggregationFn,
            aggregationFilter,
            allowOverride = false,
        } = options;

        // Validate: no self-binding
        if (sourceEntityId === targetEntityId && sourceFieldName === targetFieldName) {
            throw new Error('Cannot bind a field to itself');
        }

        // Validate: check for cycles
        if (this.wouldCreateCycle(sourceEntityId, sourceFieldName, targetEntityId, targetFieldName)) {
            throw new Error('Cannot create binding: would create a circular dependency');
        }

        const timestamp = Date.now();
        const binding: FieldBinding = {
            id: generateId(),
            sourceEntityId,
            sourceFieldName,
            targetEntityId,
            targetFieldName,
            bindingType,
            transform,
            aggregationFn,
            aggregationFilter,
            allowOverride,
            isActive: true,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        // Persist to database
        await dbClient.query(
            `INSERT INTO field_bindings (
        id, source_entity_id, source_field_name, target_entity_id, target_field_name,
        binding_type, transform, aggregation_fn, aggregation_filter, allow_override, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                binding.id,
                sourceEntityId,
                sourceFieldName,
                targetEntityId,
                targetFieldName,
                bindingType,
                serializeTransform(transform),
                aggregationFn || null,
                aggregationFilter ? JSON.stringify(aggregationFilter) : null,
                allowOverride ? 1 : 0,
                1,
                timestamp,
                timestamp,
            ]
        );

        // Add to in-memory index
        this.indexBinding(binding);

        // Emit event
        this.emit({
            type: 'created',
            bindingId: binding.id,
            affectedFields: [{ entityId: sourceEntityId, fieldName: sourceFieldName }],
            timestamp,
        });

        return binding;
    }

    /**
     * Update an existing binding
     */
    async updateBinding(bindingId: string, updates: UpdateBindingOptions): Promise<FieldBinding | null> {
        const existing = this.bindings.get(bindingId);
        if (!existing) return null;

        const timestamp = Date.now();
        const updated: FieldBinding = {
            ...existing,
            ...updates,
            transform: updates.transform !== undefined ? updates.transform : existing.transform,
            updatedAt: timestamp,
        };

        // Build update query
        const setClauses: string[] = ['updated_at = ?'];
        const values: any[] = [timestamp];

        if (updates.transform !== undefined) {
            setClauses.push('transform = ?');
            values.push(serializeTransform(updates.transform));
        }
        if (updates.aggregationFn !== undefined) {
            setClauses.push('aggregation_fn = ?');
            values.push(updates.aggregationFn);
        }
        if (updates.aggregationFilter !== undefined) {
            setClauses.push('aggregation_filter = ?');
            values.push(JSON.stringify(updates.aggregationFilter));
        }
        if (updates.allowOverride !== undefined) {
            setClauses.push('allow_override = ?');
            values.push(updates.allowOverride ? 1 : 0);
        }
        if (updates.isActive !== undefined) {
            setClauses.push('is_active = ?');
            values.push(updates.isActive ? 1 : 0);
        }

        values.push(bindingId);

        await dbClient.query(
            `UPDATE field_bindings SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );

        // Update in-memory
        this.removeBindingFromIndex(existing);
        this.indexBinding(updated);

        // Emit event
        this.emit({
            type: 'updated',
            bindingId,
            affectedFields: [{ entityId: updated.sourceEntityId, fieldName: updated.sourceFieldName }],
            timestamp,
        });

        return updated;
    }

    /**
     * Delete a binding
     */
    async deleteBinding(bindingId: string): Promise<boolean> {
        const existing = this.bindings.get(bindingId);
        if (!existing) return false;

        await dbClient.query(`DELETE FROM field_bindings WHERE id = ?`, [bindingId]);

        this.removeBindingFromIndex(existing);

        // Emit event
        this.emit({
            type: 'deleted',
            bindingId,
            affectedFields: [{ entityId: existing.sourceEntityId, fieldName: existing.sourceFieldName }],
            timestamp: Date.now(),
        });

        return true;
    }

    /**
     * Get a binding by ID
     */
    getBinding(bindingId: string): FieldBinding | undefined {
        return this.bindings.get(bindingId);
    }

    /**
     * Get all bindings for a source field
     */
    getBindingsForSource(entityId: string, fieldName: string): FieldBinding[] {
        const key = createFieldKey(entityId, fieldName);
        return this.bindingsBySource.get(key) || [];
    }

    /**
     * Get all bindings pointing to a target field
     */
    getBindingsForTarget(entityId: string, fieldName: string): FieldBinding[] {
        const key = createFieldKey(entityId, fieldName);
        return this.bindingsByTarget.get(key) || [];
    }

    /**
     * Get all bindings for an entity
     */
    getBindingsForEntity(entityId: string): FieldBinding[] {
        return Array.from(this.bindings.values()).filter(
            b => b.sourceEntityId === entityId || b.targetEntityId === entityId
        );
    }

    // ============================================
    // VALUE RESOLUTION
    // ============================================

    /**
     * Resolve the value of a bound field
     */
    async resolveValue(
        entityId: string,
        fieldName: string,
        getFieldValue: (entityId: string, fieldName: string) => Promise<any>,
        overrideValue?: any
    ): Promise<ResolvedValue> {
        const bindings = this.getBindingsForSource(entityId, fieldName);

        // No bindings: return direct value
        if (bindings.length === 0) {
            const value = await getFieldValue(entityId, fieldName);
            return {
                value,
                source: 'direct',
                resolvedAt: Date.now(),
            };
        }

        // Check for override
        const binding = bindings[0]; // Currently support single binding per source field
        if (binding.allowOverride && overrideValue !== undefined) {
            return {
                value: overrideValue,
                source: 'overridden',
                bindingId: binding.id,
                resolvedAt: Date.now(),
            };
        }

        // Resolve based on binding type
        switch (binding.bindingType) {
            case 'inherit':
            case 'mirror': {
                const targetValue = await getFieldValue(binding.targetEntityId, binding.targetFieldName);
                const transformedValue = applyTransform(targetValue, binding.transform);
                return {
                    value: transformedValue,
                    source: 'inherited',
                    bindingId: binding.id,
                    resolvedAt: Date.now(),
                };
            }

            case 'aggregate': {
                // For aggregates, we need to get values from multiple entities
                const values = await this.getAggregateValues(
                    binding,
                    getFieldValue
                );
                const aggregatedValue = applyAggregation(values, binding.aggregationFn!);
                const transformedValue = applyTransform(aggregatedValue, binding.transform);
                return {
                    value: transformedValue,
                    source: 'aggregated',
                    bindingId: binding.id,
                    resolvedAt: Date.now(),
                };
            }

            default:
                const value = await getFieldValue(entityId, fieldName);
                return {
                    value,
                    source: 'direct',
                    resolvedAt: Date.now(),
                };
        }
    }

    private async getAggregateValues(
        binding: FieldBinding,
        getFieldValue: (entityId: string, fieldName: string) => Promise<any>
    ): Promise<any[]> {
        const filter = binding.aggregationFilter;
        let entityIds: string[] = [];

        if (filter?.relationshipType) {
            // Query CozoDB for related entities
            // TODO: Integrate with CozoDB for relationship queries
            console.warn('[BindingEngine] CozoDB relationship queries not yet implemented');
        } else if (filter?.linkFieldName) {
            // Get entity IDs from an entity-link field
            const linkValue = await getFieldValue(binding.sourceEntityId, filter.linkFieldName);
            if (Array.isArray(linkValue)) {
                entityIds = linkValue;
            } else if (typeof linkValue === 'string') {
                entityIds = [linkValue];
            }
        } else {
            // No filter: use target entity only
            entityIds = [binding.targetEntityId];
        }

        // Get values from all matched entities
        const values: any[] = [];
        for (const id of entityIds) {
            const value = await getFieldValue(id, binding.targetFieldName);
            if (value !== null && value !== undefined) {
                values.push(value);
            }
        }

        return values;
    }

    // ============================================
    // PROPAGATION
    // ============================================

    /**
     * Notify the engine that a field value has changed.
     * This triggers propagation to all dependent bindings.
     */
    async notifyChange(
        entityId: string,
        fieldName: string,
        newValue: any,
        setFieldValue: (entityId: string, fieldName: string, value: any) => Promise<void>,
        getFieldValue: (entityId: string, fieldName: string) => Promise<any>
    ): Promise<string[]> {
        const affectedEntityIds: string[] = [];
        const targetKey = createFieldKey(entityId, fieldName);
        const dependentBindings = this.bindingsByTarget.get(targetKey) || [];

        if (dependentBindings.length === 0) {
            return affectedEntityIds;
        }

        // Propagate to all dependent fields
        for (const binding of dependentBindings) {
            if (!binding.isActive) continue;

            // Skip if override is enabled and field has overridden value
            // TODO: Track override state in entity_attributes

            // Resolve the new value
            let resolvedValue: any;

            switch (binding.bindingType) {
                case 'inherit':
                case 'mirror':
                    resolvedValue = applyTransform(newValue, binding.transform);
                    break;

                case 'aggregate':
                    // Re-aggregate all values
                    const values = await this.getAggregateValues(binding, getFieldValue);
                    resolvedValue = applyAggregation(values, binding.aggregationFn!);
                    resolvedValue = applyTransform(resolvedValue, binding.transform);
                    break;

                default:
                    continue;
            }

            // Update the dependent field
            await setFieldValue(binding.sourceEntityId, binding.sourceFieldName, resolvedValue);
            affectedEntityIds.push(binding.sourceEntityId);

            // Mirror bindings propagate back
            if (binding.bindingType === 'mirror') {
                // Prevent infinite loop by not propagating back to the original
                // (already handled by the fact that we're only following target→source direction)
            }
        }

        // Emit event
        if (affectedEntityIds.length > 0) {
            this.emit({
                type: 'propagated',
                affectedFields: affectedEntityIds.map(id => ({
                    entityId: id,
                    fieldName: '', // TODO: Track actual field names
                    newValue,
                })),
                timestamp: Date.now(),
            });
        }

        return affectedEntityIds;
    }

    // ============================================
    // CYCLE DETECTION
    // ============================================

    /**
     * Check if adding a new binding would create a cycle
     */
    wouldCreateCycle(
        sourceEntityId: string,
        sourceFieldName: string,
        targetEntityId: string,
        targetFieldName: string
    ): boolean {
        // DFS from target field to see if we can reach source field
        const visited = new Set<string>();
        const sourceKey = createFieldKey(sourceEntityId, sourceFieldName);

        const dfs = (entityId: string, fieldName: string): boolean => {
            const key = createFieldKey(entityId, fieldName);
            if (key === sourceKey) return true;
            if (visited.has(key)) return false;

            visited.add(key);

            // Check bindings where this field is the source (i.e., depends on something)
            const bindings = this.getBindingsForSource(entityId, fieldName);
            for (const binding of bindings) {
                if (dfs(binding.targetEntityId, binding.targetFieldName)) {
                    return true;
                }
            }

            return false;
        };

        return dfs(targetEntityId, targetFieldName);
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    /**
     * Subscribe to binding events
     */
    subscribe(callback: (event: BindingChangeEvent) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private emit(event: BindingChangeEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('[BindingEngine] Error in event listener:', error);
            }
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    /**
     * Get all bindings as a list
     */
    getAllBindings(): FieldBinding[] {
        return Array.from(this.bindings.values());
    }

    /**
     * Clear all bindings (for testing)
     */
    async clearAll(): Promise<void> {
        await dbClient.query(`DELETE FROM field_bindings`);
        this.bindings.clear();
        this.bindingsByTarget.clear();
        this.bindingsBySource.clear();
    }

    /**
     * Check if field has any bindings
     */
    hasBindings(entityId: string, fieldName: string): boolean {
        const key = createFieldKey(entityId, fieldName);
        const asSource = this.bindingsBySource.get(key);
        const asTarget = this.bindingsByTarget.get(key);
        return (asSource && asSource.length > 0) || (asTarget && asTarget.length > 0);
    }
}

// Export singleton instance
export const bindingEngine = BindingEngine.getInstance();
