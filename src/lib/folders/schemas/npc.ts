/**
 * NPC Folder Schema
 * 
 * Defines the semantic structure for NPC-type folders:
 * - Quests given by this NPC
 * - Inventory/Items sold or carried
 * - Location where NPC is found
 * - Social relationships with characters
 */

import type { FolderSchema } from '../schemas';

export const NPC_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'NPC',
    name: 'NPC',
    description: 'A non-player character with functional roles in the narrative',

    allowedSubfolders: [
        {
            entityKind: 'EVENT',
            label: 'Quests',
            icon: 'Scroll',
            description: 'Quests or tasks given by this NPC',
            relationship: {
                relationshipType: 'GIVES_QUEST',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'QUEST_FROM',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'ITEM',
            label: 'Inventory',
            icon: 'Package',
            description: 'Items sold or carried by this NPC',
            relationship: {
                relationshipType: 'SELLS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'SOLD_BY',
                category: 'ownership',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'LOCATION',
            label: 'Location',
            icon: 'MapPin',
            description: 'Where this NPC is typically found',
            relationship: {
                relationshipType: 'FOUND_AT',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'HAS_NPC',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'CHARACTER',
            subtype: 'ALLY',
            label: 'Allies',
            icon: 'Users',
            description: 'Characters allied with this NPC',
            relationship: {
                relationshipType: 'ALLY_OF',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                bidirectional: true,
                inverseType: 'ALLIED_WITH',
                category: 'social',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'CHARACTER',
            subtype: 'ENEMY',
            label: 'Enemies',
            icon: 'Swords',
            description: 'Characters hostile to this NPC',
            relationship: {
                relationshipType: 'ENEMY_OF',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                bidirectional: true,
                inverseType: 'OPPOSED_BY',
                category: 'social',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'NPC',
            label: 'Associated NPCs',
            icon: 'UserCircle',
            description: 'Other NPCs associated with this one',
            relationship: {
                relationshipType: 'ASSOCIATED_WITH',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                bidirectional: true,
                category: 'social',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'NPC',
            label: 'NPC Profile',
            icon: 'UserCircle',
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
            label: 'NPC Event',
            icon: 'Calendar',
            relationship: {
                relationshipType: 'INVOLVES',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'PARTICIPATED_IN',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#f59e0b', // Orange - matches ENTITY_COLORS.NPC
    icon: 'Users',
    propagateKindToChildren: false,

    customAttributes: [
        { name: 'role', type: 'string' },
        { name: 'faction', type: 'entity_ref' },
        { name: 'disposition', type: 'string' },
        { name: 'services', type: 'string' },
    ],
};
