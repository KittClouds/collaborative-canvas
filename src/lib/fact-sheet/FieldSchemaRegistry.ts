/**
 * Field Schema Registry
 * 
 * Central registry for field type definitions.
 * Provides system-defined schemas and allows user-created custom schemas.
 */

import type { FieldType } from '@/atoms/entity-attributes';

// ============================================
// SYSTEM FIELD SCHEMAS
// ============================================

export interface FieldSchemaDefinition {
    id: string;
    name: string;
    fieldType: FieldType;
    label: string;
    description?: string;
    metadata?: Record<string, any>;
    defaultValue?: any;
    isSystem: boolean;
}

/**
 * Pre-defined system schemas for common use cases
 */
export const SYSTEM_FIELD_SCHEMAS: FieldSchemaDefinition[] = [
    // Basic types
    {
        id: 'sys:text',
        name: 'Text',
        fieldType: 'text',
        label: 'Text Field',
        description: 'Simple text input',
        isSystem: true,
    },
    {
        id: 'sys:number',
        name: 'Number',
        fieldType: 'number',
        label: 'Number Field',
        description: 'Numeric value',
        isSystem: true,
    },
    {
        id: 'sys:toggle',
        name: 'Toggle',
        fieldType: 'toggle',
        label: 'On/Off Toggle',
        description: 'Boolean switch',
        defaultValue: false,
        isSystem: true,
    },

    // Sliders & Counters
    {
        id: 'sys:slider-percent',
        name: 'Percentage Slider',
        fieldType: 'slider',
        label: 'Percentage',
        description: '0-100% slider',
        metadata: { min: 0, max: 100, step: 1, showValue: true },
        defaultValue: 50,
        isSystem: true,
    },
    {
        id: 'sys:slider-10scale',
        name: '1-10 Scale',
        fieldType: 'slider',
        label: 'Scale (1-10)',
        description: 'Rating scale from 1 to 10',
        metadata: { min: 1, max: 10, step: 1, showValue: true },
        defaultValue: 5,
        isSystem: true,
    },
    {
        id: 'sys:counter',
        name: 'Counter',
        fieldType: 'counter',
        label: 'Counter',
        description: 'Incrementable counter',
        metadata: { min: 0, showButtons: true },
        defaultValue: 0,
        isSystem: true,
    },

    // Ratings
    {
        id: 'sys:rating-5star',
        name: '5-Star Rating',
        fieldType: 'rating',
        label: 'Rating',
        description: 'Star rating (1-5)',
        metadata: { maxRating: 5, icon: 'star', allowHalf: false },
        defaultValue: 0,
        isSystem: true,
    },
    {
        id: 'sys:rating-10star',
        name: '10-Star Rating',
        fieldType: 'rating',
        label: 'Rating',
        description: 'Star rating (1-10)',
        metadata: { maxRating: 10, icon: 'star', allowHalf: true },
        defaultValue: 0,
        isSystem: true,
    },
    {
        id: 'sys:threat-level',
        name: 'Threat Level',
        fieldType: 'rating',
        label: 'Threat Level',
        description: 'Danger rating (1-5)',
        metadata: { maxRating: 5, icon: 'flame', color: '#ef4444' },
        defaultValue: 1,
        isSystem: true,
    },

    // Dates
    {
        id: 'sys:date',
        name: 'Date',
        fieldType: 'date',
        label: 'Date',
        description: 'Calendar date',
        isSystem: true,
    },
    {
        id: 'sys:birth-date',
        name: 'Birth Date',
        fieldType: 'date',
        label: 'Birth Date',
        description: 'Character birth date',
        isSystem: true,
    },
    {
        id: 'sys:death-date',
        name: 'Death Date',
        fieldType: 'date',
        label: 'Death Date',
        description: 'Character death date',
        isSystem: true,
    },

    // Colors
    {
        id: 'sys:color',
        name: 'Color',
        fieldType: 'color',
        label: 'Color',
        description: 'Color picker',
        metadata: { allowCustom: true },
        isSystem: true,
    },
    {
        id: 'sys:faction-color',
        name: 'Faction Color',
        fieldType: 'color',
        label: 'Faction Color',
        description: 'Representative color for a faction',
        metadata: { allowCustom: true },
        isSystem: true,
    },

    // Tags
    {
        id: 'sys:tags',
        name: 'Tags',
        fieldType: 'tags',
        label: 'Tags',
        description: 'Multiple tags',
        metadata: { allowCustom: true },
        defaultValue: [],
        isSystem: true,
    },
    {
        id: 'sys:traits',
        name: 'Traits',
        fieldType: 'tags',
        label: 'Traits',
        description: 'Character traits',
        metadata: {
            allowCustom: true,
            suggestions: ['Brave', 'Cunning', 'Loyal', 'Ambitious', 'Wise', 'Stubborn', 'Kind', 'Ruthless']
        },
        defaultValue: [],
        isSystem: true,
    },
    {
        id: 'sys:abilities',
        name: 'Abilities',
        fieldType: 'tags',
        label: 'Abilities',
        description: 'Character abilities or skills',
        metadata: { allowCustom: true },
        defaultValue: [],
        isSystem: true,
    },

    // Rich Text
    {
        id: 'sys:rich-text',
        name: 'Rich Text',
        fieldType: 'rich-text',
        label: 'Rich Text',
        description: 'Formatted text with basic styling',
        metadata: { toolbar: ['bold', 'italic', 'underline', 'list'] },
        isSystem: true,
    },
    {
        id: 'sys:description',
        name: 'Description',
        fieldType: 'rich-text',
        label: 'Description',
        description: 'Detailed description',
        metadata: { toolbar: ['bold', 'italic'], minHeight: 100 },
        isSystem: true,
    },
    {
        id: 'sys:notes',
        name: 'Notes',
        fieldType: 'rich-text',
        label: 'Notes',
        description: 'Private notes',
        metadata: { toolbar: ['bold', 'italic', 'list'], minHeight: 60 },
        isSystem: true,
    },

    // Entity Links
    {
        id: 'sys:entity-link',
        name: 'Entity Link',
        fieldType: 'entity-link',
        label: 'Linked Entity',
        description: 'Reference to another entity',
        isSystem: true,
    },
    {
        id: 'sys:character-link',
        name: 'Character Link',
        fieldType: 'entity-link',
        label: 'Linked Character',
        description: 'Reference to a character',
        metadata: { allowedKinds: ['CHARACTER', 'NPC'] },
        isSystem: true,
    },
    {
        id: 'sys:location-link',
        name: 'Location Link',
        fieldType: 'entity-link',
        label: 'Linked Location',
        description: 'Reference to a location',
        metadata: { allowedKinds: ['LOCATION'] },
        isSystem: true,
    },
];

// ============================================
// REGISTRY CLASS
// ============================================

class FieldSchemaRegistryImpl {
    private schemas: Map<string, FieldSchemaDefinition> = new Map();

    constructor() {
        // Register system schemas
        for (const schema of SYSTEM_FIELD_SCHEMAS) {
            this.schemas.set(schema.id, schema);
        }
    }

    /**
     * Get a schema by ID
     */
    get(id: string): FieldSchemaDefinition | undefined {
        return this.schemas.get(id);
    }

    /**
     * Get all schemas
     */
    getAll(): FieldSchemaDefinition[] {
        return Array.from(this.schemas.values());
    }

    /**
     * Get schemas by field type
     */
    getByType(fieldType: FieldType): FieldSchemaDefinition[] {
        return this.getAll().filter(s => s.fieldType === fieldType);
    }

    /**
     * Get system schemas only
     */
    getSystemSchemas(): FieldSchemaDefinition[] {
        return this.getAll().filter(s => s.isSystem);
    }

    /**
     * Get user-created schemas only
     */
    getUserSchemas(): FieldSchemaDefinition[] {
        return this.getAll().filter(s => !s.isSystem);
    }

    /**
     * Register a new schema
     */
    register(schema: FieldSchemaDefinition): void {
        if (schema.id.startsWith('sys:') && !schema.isSystem) {
            throw new Error('User schemas cannot start with "sys:"');
        }
        this.schemas.set(schema.id, schema);
    }

    /**
     * Unregister a schema (user schemas only)
     */
    unregister(id: string): boolean {
        const schema = this.schemas.get(id);
        if (schema?.isSystem) {
            console.warn('Cannot unregister system schema:', id);
            return false;
        }
        return this.schemas.delete(id);
    }

    /**
     * Check if a schema exists
     */
    has(id: string): boolean {
        return this.schemas.has(id);
    }
}

export const FieldSchemaRegistry = new FieldSchemaRegistryImpl();
