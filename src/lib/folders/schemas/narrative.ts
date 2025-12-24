/**
 * Narrative Folder Schema
 * 
 * Defines the semantic structure for NARRATIVE-type folders:
 * - Story structure (Acts, Chapters, Scenes)
 * - Character arcs
 * - Timelines
 * - World-building elements
 */

import type { FolderSchema } from '../schemas';

export const NARRATIVE_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'NARRATIVE',
    name: 'Narrative',
    description: 'A complete story, series, or narrative project',

    allowedSubfolders: [
        // Acts - major story divisions
        {
            entityKind: 'ACT',
            label: 'Acts',
            icon: 'Drama',
            description: 'Major story divisions',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'PART_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // Chapters
        {
            entityKind: 'CHAPTER',
            label: 'Chapters',
            icon: 'BookOpen',
            description: 'Chapter divisions',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'PART_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // Story arcs
        {
            entityKind: 'ARC',
            label: 'Story Arcs',
            icon: 'Waves',
            description: 'Major storylines and arcs',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'PART_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // Characters in this narrative
        {
            entityKind: 'CHARACTER',
            label: 'Characters',
            icon: 'User',
            description: 'Characters in this narrative',
            relationship: {
                relationshipType: 'FEATURES',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'APPEARS_IN',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },

        // Locations in this narrative
        {
            entityKind: 'LOCATION',
            label: 'Locations',
            icon: 'MapPin',
            description: 'Locations and settings',
            relationship: {
                relationshipType: 'SET_IN',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'SETTING_FOR',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },

        // Timelines
        {
            entityKind: 'TIMELINE',
            label: 'Timelines',
            icon: 'Hourglass',
            description: 'Story timelines and chronologies',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },

        // World-building concepts
        {
            entityKind: 'CONCEPT',
            label: 'World Building',
            icon: 'Lightbulb',
            description: 'Concepts, magic systems, and world rules',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'PART_OF',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'NARRATIVE',
            label: 'Story Overview',
            icon: 'Book',
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
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#4f46e5', // Indigo - matches ENTITY_COLORS.NARRATIVE
    icon: 'Book',
    containerOnly: false,
    propagateKindToChildren: false,

    customAttributes: [
        { name: 'genre', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'wordCount', type: 'number' },
        { name: 'targetAudience', type: 'string' },
    ],
};
