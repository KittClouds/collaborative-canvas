/**
 * Timeline Folder Schema
 * 
 * Defines the semantic structure for TIMELINE-type folders:
 * - Story timelines with temporal ordering
 * - Events, Scenes, Chapters, Beats as temporally-ordered children
 * - PRECEDES/FOLLOWS relationships auto-created based on sibling order
 * 
 * Timeline types:
 * - MASTER: Main story timeline
 * - ARC: Timeline scoped to a story arc
 * - CHARACTER: Character's personal timeline
 * - LOCATION: Events at a specific location
 * - CUSTOM: User-defined timeline scope
 */

import type { FolderSchema } from '../schemas';

export const TIMELINE_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'TIMELINE',
    name: 'Timeline',
    description: 'A chronological timeline of events, scenes, and story beats',

    allowedSubfolders: [
        {
            entityKind: 'EVENT',
            label: 'Add Event',
            icon: 'Calendar',
            description: 'A story event (temporally ordered with siblings)',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'SCENE',
            label: 'Add Scene',
            icon: 'Film',
            description: 'A scene (temporally ordered with siblings)',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'CHAPTER',
            label: 'Add Chapter',
            icon: 'BookOpen',
            description: 'A chapter (temporally ordered with siblings)',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'ACT',
            label: 'Add Act',
            icon: 'Drama',
            description: 'A story act (temporally ordered with siblings)',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'BEAT',
            label: 'Add Beat',
            icon: 'Zap',
            description: 'A story beat (temporally ordered with siblings)',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'ARC',
            label: 'Add Story Arc',
            icon: 'Waves',
            description: 'A story arc (temporally ordered with siblings)',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'TIMELINE',
            subtype: 'NESTED',
            label: 'Add Sub-Timeline',
            icon: 'Hourglass',
            description: 'A nested timeline (e.g., flashback sequence)',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'PART_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'EVENT',
            label: 'New Event',
            icon: 'Calendar',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'SCENE',
            label: 'New Scene',
            icon: 'Film',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'BEAT',
            label: 'New Beat',
            icon: 'Zap',
            relationship: {
                relationshipType: 'CONTAINS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'TIMELINE_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'TIMELINE',
            label: 'Timeline Overview',
            icon: 'Hourglass',
            relationship: {
                relationshipType: 'DESCRIBES',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#eab308', // Gold - matches ENTITY_COLORS.TIMELINE
    icon: 'Hourglass',
    containerOnly: false,
    propagateKindToChildren: false,

    customAttributes: [
        { name: 'timelineType', type: 'string' },
        { name: 'startDate', type: 'date' },
        { name: 'endDate', type: 'date' },
        { name: 'timeScale', type: 'string' },
        { name: 'description', type: 'string' },
    ],
};

export const TIMELINE_SUBTYPES = {
    MASTER: {
        name: 'Master Timeline',
        description: 'Main story timeline spanning entire narrative',
        icon: 'Clock',
    },
    ARC: {
        name: 'Arc Timeline',
        description: 'Timeline scoped to a specific story arc',
        icon: 'Waves',
    },
    CHARACTER: {
        name: 'Character Timeline',
        description: 'Personal timeline for a character',
        icon: 'User',
    },
    LOCATION: {
        name: 'Location Timeline',
        description: 'Events at a specific location over time',
        icon: 'MapPin',
    },
    FLASHBACK: {
        name: 'Flashback Sequence',
        description: 'Non-linear timeline for flashbacks',
        icon: 'Rewind',
    },
    CUSTOM: {
        name: 'Custom Timeline',
        description: 'User-defined timeline scope',
        icon: 'Hourglass',
    },
} as const;

export type TimelineSubtype = keyof typeof TIMELINE_SUBTYPES;
