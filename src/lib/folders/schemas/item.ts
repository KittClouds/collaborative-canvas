/**
 * Item Folder Schema
 * 
 * Defines the semantic structure for ITEM-type folders:
 * - Owner relationships
 * - Location tracking
 * - Related items (components, sets)
 */

import type { FolderSchema } from '../schemas';

export const ITEM_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'ITEM',
    name: 'Item',
    description: 'An object, artifact, or physical entity',

    allowedSubfolders: [
        // Component items (parts of this item)
        {
            entityKind: 'ITEM',
            subtype: 'COMPONENT',
            label: 'Components',
            icon: 'Puzzle',
            description: 'Parts that make up this item',
            relationship: {
                relationshipType: 'COMPOSED_OF',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'COMPONENT_OF',
                category: 'ownership',
                defaultConfidence: 1.0,
            },
        },

        // Related items (set members)
        {
            entityKind: 'ITEM',
            label: 'Related Items',
            icon: 'Link',
            description: 'Items that belong to the same set or collection',
            relationship: {
                relationshipType: 'RELATED_TO',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                bidirectional: true,
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },

        // Previous owners
        {
            entityKind: 'CHARACTER',
            label: 'Previous Owners',
            icon: 'History',
            description: 'Characters who previously owned this item',
            relationship: {
                relationshipType: 'PREVIOUSLY_OWNED',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'FORMER_OWNER_OF',
                category: 'ownership',
                defaultConfidence: 1.0,
            },
        },

        // Locations where found
        {
            entityKind: 'LOCATION',
            label: 'Known Locations',
            icon: 'MapPin',
            description: 'Locations where this item has been found',
            relationship: {
                relationshipType: 'FOUND_AT',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'LOCATION_OF',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'ITEM',
            label: 'Item Description',
            icon: 'Package',
            relationship: {
                relationshipType: 'DESCRIBES',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'EVENT',
            label: 'Item History',
            icon: 'Calendar',
            relationship: {
                relationshipType: 'HISTORY_OF',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#10b981', // Green - matches ENTITY_COLORS.ITEM
    icon: 'Package',
    propagateKindToChildren: false,

    customAttributes: [
        { name: 'value', type: 'number' },
        { name: 'rarity', type: 'string' },
        { name: 'condition', type: 'string' },
        { name: 'magical', type: 'boolean' },
    ],
};
