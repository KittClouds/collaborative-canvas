/**
 * Field Binding Types
 * 
 * Types for entity-to-entity field binding system.
 * Enables reactive data flow between entities.
 */

// ============================================
// BINDING TYPES
// ============================================

/**
 * Binding type determines how values flow between entities
 */
export type BindingType = 'mirror' | 'inherit' | 'aggregate';

/**
 * Functions for aggregating values across multiple entities
 */
export type AggregationFunction = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'concat';

/**
 * Transform functions that modify values during binding resolution
 */
export type TransformType =
    | 'none'
    | 'multiply'
    | 'add'
    | 'subtract'
    | 'divide'
    | 'round'
    | 'floor'
    | 'ceil'
    | 'uppercase'
    | 'lowercase'
    | 'prefix'
    | 'suffix'
    | 'negate';

/**
 * A field binding connects a source field to a target field
 */
export interface FieldBinding {
    id: string;

    /** The field that receives the bound value */
    sourceEntityId: string;
    sourceFieldName: string;

    /** The field that provides the value */
    targetEntityId: string;
    targetFieldName: string;

    /** How the binding operates */
    bindingType: BindingType;

    /** Optional transformation to apply */
    transform?: Transform;

    /** For aggregate bindings: how to combine values */
    aggregationFn?: AggregationFunction;

    /** For aggregate bindings: filter criteria */
    aggregationFilter?: AggregationFilter;

    /** If true, source field can override the bound value locally */
    allowOverride: boolean;

    /** If false, binding is disabled but not deleted */
    isActive: boolean;

    createdAt: number;
    updatedAt: number;
}

/**
 * Transform definition with type and parameters
 */
export interface Transform {
    type: TransformType;
    params?: Record<string, any>;
}

/**
 * Filter for aggregate bindings
 */
export interface AggregationFilter {
    /** Filter by relationship type in CozoDB */
    relationshipType?: string;

    /** Filter by entity kind */
    entityKind?: string;

    /** Filter by entity-link field name */
    linkFieldName?: string;

    /** Custom filter expression */
    customFilter?: string;
}

/**
 * Metadata attached to a bound attribute
 */
export interface BindingMetadata {
    bindingId: string;
    type: BindingType;
    targetEntityId: string;
    targetFieldName: string;
    transform?: Transform;
    aggregationFn?: AggregationFunction;
    isOverridden: boolean;
    lastSyncedAt: number;
}

/**
 * Node in the binding dependency graph
 */
export interface BindingGraphNode {
    entityId: string;
    fieldName: string;
    key: string; // `${entityId}:${fieldName}`
}

/**
 * Edge in the binding dependency graph
 */
export interface BindingGraphEdge {
    from: BindingGraphNode; // Target (source of truth)
    to: BindingGraphNode;   // Source (receives value)
    binding: FieldBinding;
}

/**
 * Result of resolving a bound value
 */
export interface ResolvedValue {
    value: any;
    source: 'direct' | 'inherited' | 'aggregated' | 'overridden';
    bindingId?: string;
    resolvedAt: number;
}

/**
 * Event emitted when a binding-related change occurs
 */
export interface BindingChangeEvent {
    type: 'created' | 'updated' | 'deleted' | 'propagated';
    bindingId?: string;
    affectedFields: Array<{
        entityId: string;
        fieldName: string;
        oldValue?: any;
        newValue?: any;
    }>;
    timestamp: number;
}

/**
 * Options for creating a binding
 */
export interface CreateBindingOptions {
    sourceEntityId: string;
    sourceFieldName: string;
    targetEntityId: string;
    targetFieldName: string;
    bindingType: BindingType;
    transform?: Transform;
    aggregationFn?: AggregationFunction;
    aggregationFilter?: AggregationFilter;
    allowOverride?: boolean;
}

/**
 * Options for updating a binding
 */
export interface UpdateBindingOptions {
    transform?: Transform;
    aggregationFn?: AggregationFunction;
    aggregationFilter?: AggregationFilter;
    allowOverride?: boolean;
    isActive?: boolean;
}

// ============================================
// TRANSFORM HELPERS
// ============================================

/**
 * Parse a transform string like "multiply:2" into a Transform object
 */
export function parseTransform(transformStr: string): Transform | undefined {
    if (!transformStr) return undefined;

    const [type, ...params] = transformStr.split(':');

    if (!type) return undefined;

    const transformType = type as TransformType;

    if (params.length === 0) {
        return { type: transformType };
    }

    // Parse params based on type
    switch (transformType) {
        case 'multiply':
        case 'add':
        case 'subtract':
        case 'divide':
        case 'round':
            return { type: transformType, params: { value: parseFloat(params[0]) } };
        case 'prefix':
        case 'suffix':
            return { type: transformType, params: { text: params.join(':') } };
        default:
            return { type: transformType };
    }
}

/**
 * Serialize a Transform object to a string for storage
 */
export function serializeTransform(transform: Transform | undefined): string | null {
    if (!transform) return null;

    if (!transform.params) {
        return transform.type;
    }

    const paramValue = transform.params.value ?? transform.params.text;
    return `${transform.type}:${paramValue}`;
}

// ============================================
// GRAPH HELPERS
// ============================================

/**
 * Create a unique key for a field in the binding graph
 */
export function createFieldKey(entityId: string, fieldName: string): string {
    return `${entityId}:${fieldName}`;
}

/**
 * Parse a field key back to entity ID and field name
 */
export function parseFieldKey(key: string): { entityId: string; fieldName: string } {
    const [entityId, ...rest] = key.split(':');
    return { entityId, fieldName: rest.join(':') };
}
