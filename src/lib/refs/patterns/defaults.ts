/**
 * Default Pattern Definitions
 * 
 * Built-in patterns for standard syntax elements.
 * These provide backward compatibility with existing documents.
 */

import type { PatternDefinition } from './schema';
import { ENTITY_COLORS } from '../../entities/entityTypes';

/**
 * Helper: uppercase transform
 */
const toUpperCase = (s: string) => s.toUpperCase();

/**
 * Helper: trim transform
 */
const trim = (s: string) => s.trim();

/**
 * Helper: parse JSON transform
 */
const parseJSON = (s: string) => {
    try {
        return JSON.parse(s.replace(/'/g, '"'));
    } catch {
        return s;
    }
};

/**
 * Default Entity Pattern
 * Matches: [KIND|Label], [KIND:SUBTYPE|Label], [KIND|Label|{attrs}]
 */
export const ENTITY_PATTERN: PatternDefinition = {
    id: 'builtin:entity',
    name: 'Entity Syntax',
    description: 'Explicit entity declarations like [CHARACTER|Jon]',
    kind: 'entity',
    enabled: true,
    priority: 100,
    pattern: '\\[([A-Z_]+)(?::([A-Z_]+))?\\|([^\\]|]+)(?:\\|(\\{[^}]+\\}))?\\]',
    flags: 'g',
    captures: {
        entityKind: { group: 1, transform: toUpperCase, required: true },
        subtype: { group: 2, transform: toUpperCase },
        label: { group: 3, transform: trim, required: true },
        attributes: { group: 4, transform: parseJSON },
    },
    rendering: {
        template: '{{label}}',
        widgetMode: true,
    },
    isBuiltIn: true,
    createdAt: Date.now(),
};

/**
 * Wikilink Pattern
 * Matches: [[Page Title]], [[Page Title|Display Text]]
 */
export const WIKILINK_PATTERN: PatternDefinition = {
    id: 'builtin:wikilink',
    name: 'Wikilink',
    description: 'Wiki-style links like [[Page Title]]',
    kind: 'wikilink',
    enabled: true,
    priority: 90,
    pattern: '\\[\\[([^\\]|]+)(?:\\|([^\\]]+))?\\]\\]',
    flags: 'g',
    captures: {
        target: { group: 1, transform: trim, required: true },
        displayText: { group: 2, transform: trim },
    },
    rendering: {
        color: 'hsl(var(--primary))',
        backgroundColor: 'hsl(var(--primary) / 0.15)',
        template: '{{displayText || target}}',
        widgetMode: true,
    },
    isBuiltIn: true,
    createdAt: Date.now(),
};

/**
 * Backlink Pattern
 * Matches: <<Page Title>>, <<Page Title|Display>>
 */
export const BACKLINK_PATTERN: PatternDefinition = {
    id: 'builtin:backlink',
    name: 'Backlink',
    description: 'Reverse links like <<Page Title>>',
    kind: 'backlink',
    enabled: true,
    priority: 85,
    pattern: '<<([^>|]+)(?:\\|([^>]+))?>>',
    flags: 'g',
    captures: {
        target: { group: 1, transform: trim, required: true },
        displayText: { group: 2, transform: trim },
    },
    rendering: {
        color: 'hsl(var(--primary))',
        backgroundColor: 'hsl(var(--primary) / 0.20)',
        template: '{{displayText || target}}',
        widgetMode: true,
    },
    isBuiltIn: true,
    createdAt: Date.now(),
};

/**
 * Tag Pattern
 * Matches: #tagname
 */
export const TAG_PATTERN: PatternDefinition = {
    id: 'builtin:tag',
    name: 'Tag',
    description: 'Hashtags like #important',
    kind: 'tag',
    enabled: true,
    priority: 70,
    pattern: '#(\\w+)',
    flags: 'g',
    captures: {
        tagName: { group: 1, transform: trim, required: true },
    },
    rendering: {
        color: '#3b82f6',
        backgroundColor: '#3b82f620',
        template: '#{{tagName}}',
        widgetMode: false,
    },
    isBuiltIn: true,
    createdAt: Date.now(),
};

/**
 * Mention Pattern
 * Matches: @username
 */
export const MENTION_PATTERN: PatternDefinition = {
    id: 'builtin:mention',
    name: 'Mention',
    description: 'User mentions like @alice',
    kind: 'mention',
    enabled: true,
    priority: 70,
    pattern: '@(\\w+)',
    flags: 'g',
    captures: {
        username: { group: 1, transform: trim, required: true },
    },
    rendering: {
        color: '#8b5cf6',
        backgroundColor: '#8b5cf620',
        template: '@{{username}}',
        widgetMode: false,
    },
    isBuiltIn: true,
    createdAt: Date.now(),
};

/**
 * Triple Pattern
 * Matches: [KIND|Label] ->PREDICATE-> [KIND|Label]
 */
export const TRIPLE_PATTERN: PatternDefinition = {
    id: 'builtin:triple',
    name: 'Triple',
    description: 'Relationship triples like [PERSON|Jon] ->KNOWS-> [PERSON|Jane]',
    kind: 'triple',
    enabled: true,
    priority: 95,
    pattern: '\\[([A-Z_]+)\\|([^\\]]+)\\]\\s*->([A-Z_]+)->\\s*\\[([A-Z_]+)\\|([^\\]]+)\\]',
    flags: 'g',
    captures: {
        subjectKind: { group: 1, transform: toUpperCase, required: true },
        subjectLabel: { group: 2, transform: trim, required: true },
        predicate: { group: 3, transform: toUpperCase, required: true },
        objectKind: { group: 4, transform: toUpperCase, required: true },
        objectLabel: { group: 5, transform: trim, required: true },
    },
    rendering: {
        template: '{{subjectLabel}} →{{predicate}}→ {{objectLabel}}',
        widgetMode: true,
    },
    isBuiltIn: true,
    createdAt: Date.now(),
};

/**
 * Temporal Patterns (combined)
 * Matches various temporal expressions
 */
export const TEMPORAL_PATTERNS: PatternDefinition[] = [
    {
        id: 'builtin:temporal-relative',
        name: 'Relative Time',
        description: 'Relative time expressions like "two days later"',
        kind: 'temporal',
        enabled: true,
        priority: 60,
        pattern: '\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(second|minute|hour|day|week|month|year)s?\\s+(later|before|after|earlier|ago)\\b',
        flags: 'gi',
        captures: {
            amount: { group: 1, required: true },
            unit: { group: 2, required: true },
            direction: { group: 3, required: true },
        },
        rendering: {
            color: 'hsl(var(--chart-4))',
            backgroundColor: 'hsl(var(--chart-4) / 0.15)',
            widgetMode: false,
        },
        isBuiltIn: true,
        createdAt: Date.now(),
    },
    {
        id: 'builtin:temporal-named',
        name: 'Named Time',
        description: 'Named time expressions like "next morning"',
        kind: 'temporal',
        enabled: true,
        priority: 60,
        pattern: '\\b(next|last|the following|the previous)\\s+(morning|afternoon|evening|night|day|week|month|year|dawn|dusk|midnight|noon)\\b',
        flags: 'gi',
        captures: {
            modifier: { group: 1, required: true },
            period: { group: 2, required: true },
        },
        rendering: {
            color: 'hsl(var(--chart-4))',
            backgroundColor: 'hsl(var(--chart-4) / 0.15)',
            widgetMode: false,
        },
        isBuiltIn: true,
        createdAt: Date.now(),
    },
    {
        id: 'builtin:temporal-simple',
        name: 'Simple Temporal',
        description: 'Simple temporal words like "yesterday", "tomorrow"',
        kind: 'temporal',
        enabled: true,
        priority: 55,
        pattern: '\\b(yesterday|tomorrow|today|tonight|nowadays)\\b',
        flags: 'gi',
        captures: {
            word: { group: 1, required: true },
        },
        rendering: {
            color: 'hsl(var(--chart-4))',
            backgroundColor: 'hsl(var(--chart-4) / 0.15)',
            widgetMode: false,
        },
        isBuiltIn: true,
        createdAt: Date.now(),
    },
    {
        id: 'builtin:temporal-transition',
        name: 'Temporal Transition',
        description: 'Transition words like "meanwhile", "eventually"',
        kind: 'temporal',
        enabled: true,
        priority: 50,
        pattern: '\\b(meanwhile|eventually|suddenly|immediately|soon|later|afterwards|beforehand)\\b',
        flags: 'gi',
        captures: {
            word: { group: 1, required: true },
        },
        rendering: {
            color: 'hsl(var(--chart-4))',
            backgroundColor: 'hsl(var(--chart-4) / 0.15)',
            widgetMode: false,
        },
        isBuiltIn: true,
        createdAt: Date.now(),
    },
];

/**
 * All default patterns
 */
export const DEFAULT_PATTERNS: PatternDefinition[] = [
    ENTITY_PATTERN,
    WIKILINK_PATTERN,
    BACKLINK_PATTERN,
    TAG_PATTERN,
    MENTION_PATTERN,
    TRIPLE_PATTERN,
    ...TEMPORAL_PATTERNS,
];

/**
 * Get default patterns by kind
 */
export function getDefaultPatternsByKind(kind: string): PatternDefinition[] {
    return DEFAULT_PATTERNS.filter(p => p.kind === kind);
}

/**
 * Get a specific default pattern by ID
 */
export function getDefaultPatternById(id: string): PatternDefinition | undefined {
    return DEFAULT_PATTERNS.find(p => p.id === id);
}
