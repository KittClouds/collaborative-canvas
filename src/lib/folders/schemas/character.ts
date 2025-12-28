/**
 * Character Folder Schema
 * 
 * Defines the semantic structure for CHARACTER-type folders:
 * - Allies/Enemies/Family subfolders with bidirectional relationships
 * - Possessions (ITEM) with OWNS relationship
 * - Locations visited with VISITED relationship
 */

import type { FolderSchema } from '../schemas';

export const CHARACTER_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'CHARACTER',
    name: 'Character',
    description: 'A person, creature, or sentient being in your world',

    allowedSubfolders: [
        // Allies subfolder - bidirectional ALLY_OF relationship
        {
            entityKind: 'CHARACTER',
            subtype: 'ALLY',
            label: 'Allies',
            icon: 'Users',
            description: 'Characters who are allies of this character',
            relationship: {
                relationshipType: 'ALLY_OF',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                bidirectional: true,
                inverseType: 'ALLIED_WITH',
                category: 'social',
                defaultConfidence: 1.0,
            },
            // Auto-create social network when allies are added
            autoCreateNetwork: true,
            networkSchemaId: 'SOCIAL_CIRCLE',
            networkCreationThreshold: 2,
        },

        // Enemies subfolder - bidirectional ENEMY_OF relationship
        {
            entityKind: 'CHARACTER',
            subtype: 'ENEMY',
            label: 'Enemies',
            icon: 'Swords',
            description: 'Characters who are enemies of this character',
            relationship: {
                relationshipType: 'ENEMY_OF',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                bidirectional: true,
                inverseType: 'OPPOSED_BY',
                category: 'social',
                defaultConfidence: 1.0,
            },
            // Auto-create rivalry network when enemies are added
            autoCreateNetwork: true,
            networkSchemaId: 'RIVALRY',
            networkCreationThreshold: 2,
        },

        // Family subfolder - bidirectional FAMILY_OF relationship
        {
            entityKind: 'CHARACTER',
            subtype: 'ALLY', // Family members are typically allies
            label: 'Family Members',
            icon: 'Heart',
            description: 'Family members and relatives',
            relationship: {
                relationshipType: 'FAMILY_OF',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                bidirectional: true,
                category: 'social',
                defaultConfidence: 1.0,
            },
            // Auto-create family network
            autoCreateNetwork: true,
            networkSchemaId: 'FAMILY',
            networkCreationThreshold: 2,
        },

        // Possessions subfolder - OWNS relationship (parent owns child)
        {
            entityKind: 'ITEM',
            label: 'Possessions',
            icon: 'Package',
            description: 'Items owned by this character',
            relationship: {
                relationshipType: 'OWNS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'OWNED_BY',
                category: 'ownership',
                defaultConfidence: 1.0,
            },
        },

        // Locations visited - character has VISITED locations
        {
            entityKind: 'LOCATION',
            label: 'Places Visited',
            icon: 'MapPin',
            description: 'Locations this character has visited',
            relationship: {
                relationshipType: 'VISITED',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'VISITED_BY',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'CHARACTER',
            label: 'Character Profile',
            icon: 'User',
            relationship: {
                relationshipType: 'PROFILE_OF',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'EVENT',
            subtype: 'PERSONAL',
            label: 'Character Event',
            icon: 'Calendar',
            relationship: {
                relationshipType: 'PARTICIPATED_IN',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'INVOLVES',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#8b5cf6', // Purple - matches ENTITY_COLORS.CHARACTER
    icon: 'User',
    propagateKindToChildren: false, // Subfolders can have different kinds

    customAttributes: [
        { name: 'age', type: 'number' },
        { name: 'occupation', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'birthdate', type: 'date' },
    ],
};
