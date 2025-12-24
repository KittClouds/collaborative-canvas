/**
 * Location Folder Schema
 * 
 * Defines the semantic structure for LOCATION-type folders:
 * - Sub-locations (districts, rooms) with CONTAINS relationship
 * - Residents (characters who live there)
 * - Landmarks and notable features
 * - Events that occurred at this location
 */

import type { FolderSchema } from '../schemas';

export const LOCATION_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'LOCATION',
    name: 'Location',
    description: 'A place, region, or spatial entity in your world',

    allowedSubfolders: [
        // Sub-locations (districts, areas, rooms) - hierarchical containment
        {
            entityKind: 'LOCATION',
            subtype: 'DISTRICT',
            label: 'Districts/Areas',
            icon: 'Map',
            description: 'Smaller regions within this location',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'LOCATED_IN',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },

        // Buildings within the location
        {
            entityKind: 'LOCATION',
            subtype: 'BUILDING',
            label: 'Buildings',
            icon: 'Home',
            description: 'Buildings and structures at this location',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'LOCATED_IN',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },

        // Residents - characters who live here
        {
            entityKind: 'CHARACTER',
            label: 'Residents',
            icon: 'Users',
            description: 'Characters who reside at this location',
            relationship: {
                relationshipType: 'RESIDES_IN',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'HOME_TO',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },

        // NPCs at this location
        {
            entityKind: 'NPC',
            label: 'NPCs',
            icon: 'UserCircle',
            description: 'Non-player characters found at this location',
            relationship: {
                relationshipType: 'FOUND_AT',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'HAS_NPC',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },

        // Landmarks - notable features
        {
            entityKind: 'ITEM',
            subtype: 'LANDMARK',
            label: 'Landmarks',
            icon: 'Landmark',
            description: 'Notable landmarks and features',
            relationship: {
                relationshipType: 'HAS_LANDMARK',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'LANDMARK_IN',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },

        // Items found at location
        {
            entityKind: 'ITEM',
            label: 'Items',
            icon: 'Package',
            description: 'Items found at this location',
            relationship: {
                relationshipType: 'LOCATED_AT',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'HAS_ITEM',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'LOCATION',
            label: 'Location Profile',
            icon: 'MapPin',
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
            subtype: 'HISTORICAL',
            label: 'Historical Event',
            icon: 'History',
            relationship: {
                relationshipType: 'OCCURRED_AT',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'SITE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'SCENE',
            label: 'Scene',
            icon: 'Film',
            relationship: {
                relationshipType: 'SET_AT',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'SETTING_FOR',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#3b82f6', // Blue - matches ENTITY_COLORS.LOCATION
    icon: 'MapPin',
    propagateKindToChildren: true, // Sub-locations inherit LOCATION kind by default

    customAttributes: [
        { name: 'population', type: 'number' },
        { name: 'climate', type: 'string' },
        { name: 'government', type: 'string' },
        { name: 'foundingDate', type: 'date' },
    ],
};
