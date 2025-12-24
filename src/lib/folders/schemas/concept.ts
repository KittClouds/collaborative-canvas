/**
 * Concept Folder Schema
 * 
 * Defines the semantic structure for CONCEPT-type folders:
 * - Ontological relationships for world-building elements
 * - Foundations: concepts this is based on
 * - Refinements: concepts that refine or extend this
 * - Applications: how this concept applies to entities
 * - Antitheses: opposing or contradicting concepts
 */

import type { FolderSchema } from '../schemas';

export const CONCEPT_FOLDER_SCHEMA: FolderSchema = {
    entityKind: 'CONCEPT',
    name: 'Concept',
    description: 'An abstract idea, magic system, rule, or world-building element',

    allowedSubfolders: [
        {
            entityKind: 'CONCEPT',
            label: 'Foundations',
            icon: 'GitBranch',
            description: 'Foundational concepts this is based on',
            relationship: {
                relationshipType: 'BASED_ON',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'FOUNDATION_FOR',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'CONCEPT',
            label: 'Refinements',
            icon: 'Sparkles',
            description: 'Concepts that refine or extend this one',
            relationship: {
                relationshipType: 'REFINES',
                sourceType: 'CHILD',
                targetType: 'PARENT',
                inverseType: 'REFINED_BY',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'CONCEPT',
            label: 'Antitheses',
            icon: 'Split',
            description: 'Concepts that contradict or oppose this one',
            relationship: {
                relationshipType: 'CONTRADICTS',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                bidirectional: true,
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'CONCEPT',
            label: 'Related Concepts',
            icon: 'Link',
            description: 'Related concepts and ideas',
            relationship: {
                relationshipType: 'RELATED_TO',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                bidirectional: true,
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'CHARACTER',
            label: 'Practitioners',
            icon: 'User',
            description: 'Characters who practice or embody this concept',
            relationship: {
                relationshipType: 'PRACTICED_BY',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'PRACTICES',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'ITEM',
            label: 'Artifacts',
            icon: 'Package',
            description: 'Items that embody or utilize this concept',
            relationship: {
                relationshipType: 'MANIFESTS_IN',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'EMBODIES',
                category: 'custom',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'LOCATION',
            label: 'Sacred Sites',
            icon: 'MapPin',
            description: 'Locations associated with this concept',
            relationship: {
                relationshipType: 'ASSOCIATED_WITH',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'SITE_OF',
                category: 'spatial',
                defaultConfidence: 1.0,
            },
        },
        {
            entityKind: 'EVENT',
            label: 'Key Events',
            icon: 'Calendar',
            description: 'Events where this concept played a role',
            relationship: {
                relationshipType: 'INVOLVED_IN',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'INVOLVES_CONCEPT',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    allowedNoteTypes: [
        {
            entityKind: 'CONCEPT',
            label: 'Concept Description',
            icon: 'Lightbulb',
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
            label: 'Discovery/Origin',
            icon: 'History',
            relationship: {
                relationshipType: 'ORIGINATED_FROM',
                sourceType: 'PARENT',
                targetType: 'CHILD',
                inverseType: 'ORIGIN_OF',
                category: 'temporal',
                defaultConfidence: 1.0,
            },
        },
    ],

    color: '#6366f1', // Indigo - matches ENTITY_COLORS.CONCEPT
    icon: 'Lightbulb',
    propagateKindToChildren: false,

    customAttributes: [
        { name: 'type', type: 'string' },
        { name: 'origin', type: 'string' },
        { name: 'practitioners', type: 'number' },
        { name: 'power_level', type: 'string' },
    ],
};
