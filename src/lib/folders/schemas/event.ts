/**
 * Event Folder Schema
 * 
 * Defines the semantic structure for EVENT-type folders:
 * - Participants (characters involved)
 * - Location where event occurred
 * - Related events (cause/effect chains)
 * - Items involved in the event
 */

import type { FolderSchema } from '../schemas';

export const EVENT_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'EVENT',
    name: 'Event',
    description: 'A significant occurrence or happening in your world',

    allowedSubfolders: [
        // Participants - characters who participated
        {
            entityKind: 'CHARACTER',
            label: 'Participants',
            icon: 'Users',
            description: 'Characters who participated in this event',
            relationship: {
                relationshipType: 'PARTICIPATED_IN',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'INVOLVES',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // Witnesses - characters who witnessed but didn't participate
        {
            entityKind: 'CHARACTER',
            label: 'Witnesses',
            icon: 'Eye',
            description: 'Characters who witnessed this event',
            relationship: {
                relationshipType: 'WITNESSED',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'WITNESSED_BY',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // Event location
        {
            entityKind: 'LOCATION',
            label: 'Event Location',
            icon: 'MapPin',
            description: 'Where this event took place',
            relationship: {
                relationshipType: 'OCCURRED_AT',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'SITE_OF',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },

        // Caused by (preceding events)
        {
            entityKind: 'EVENT',
            label: 'Causes',
            icon: 'ArrowLeft',
            description: 'Events that caused this event',
            relationship: {
                relationshipType: 'CAUSED_BY',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'CAUSED',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // Results (subsequent events)
        {
            entityKind: 'EVENT',
            label: 'Consequences',
            icon: 'ArrowRight',
            description: 'Events that resulted from this event',
            relationship: {
                relationshipType: 'RESULTED_IN',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'RESULT_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // Items involved
        {
            entityKind: 'ITEM',
            label: 'Items Involved',
            icon: 'Package',
            description: 'Items that played a role in this event',
            relationship: {
                relationshipType: 'INVOLVES',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'INVOLVED_IN',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'EVENT',
            label: 'Event Description',
            icon: 'Calendar',
            relationship: {
                relationshipType: 'DESCRIBES',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'SCENE',
            label: 'Scene',
            icon: 'Film',
            relationship: {
                relationshipType: 'DEPICTS',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#06b6d4', // Cyan - matches ENTITY_COLORS.EVENT
    icon: 'Calendar',
    propagateKindToChildren: false,

    customAttributes: [
        { name: 'date', type: 'date' },
        { name: 'duration', type: 'string' },
        { name: 'significance', type: 'string' },
        { name: 'historical', type: 'boolean' },
    ],
};
