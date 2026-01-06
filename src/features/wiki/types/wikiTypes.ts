/**
 * Wiki Types
 * Types for the Story Wiki feature.
 * Phase 2A: Added new categories (Worldbuilding, Story Beats, Timelines, Relationships, Media Gallery)
 */

/** View modes for Collections */
export type WikiViewMode = 'table' | 'cards' | 'board';

/** Navigation items for the Wiki sidebar */
export interface WikiNavItem {
    id: string;
    label: string;
    icon: string; // Lucide icon name
    href: string;
    entityKind?: string;
    isSpecial?: boolean; // For non-entity based categories
}

/** Entity category for Collection views */
export interface WikiCategory {
    id: string;
    label: string;
    pluralLabel: string;
    entityKind: string;
    icon: string;
    color: string;
    description?: string;
}

/** Special wiki sections (not entity-based) */
export interface WikiSection {
    id: string;
    label: string;
    icon: string;
    color: string;
    description: string;
    href: string;
}

/** Common wiki categories derived from entity kinds */
export const WIKI_CATEGORIES: WikiCategory[] = [
    {
        id: 'characters',
        label: 'Character',
        pluralLabel: 'Characters',
        entityKind: 'CHARACTER',
        icon: 'User',
        color: '#f59e0b',
        description: 'Protagonists, antagonists, NPCs, and all the souls in your world'
    },
    {
        id: 'factions',
        label: 'Faction',
        pluralLabel: 'Factions',
        entityKind: 'FACTION',
        icon: 'Flag',
        color: '#ef4444',
        description: 'Organizations, groups, alliances, and power structures'
    },
    {
        id: 'locations',
        label: 'Location',
        pluralLabel: 'Locations',
        entityKind: 'LOCATION',
        icon: 'MapPin',
        color: '#10b981',
        description: 'Continents, countries, cities, and places of interest'
    },
    {
        id: 'items',
        label: 'Item',
        pluralLabel: 'Items',
        entityKind: 'ITEM',
        icon: 'Package',
        color: '#8b5cf6',
        description: 'Artifacts, weapons, treasures, and objects of significance'
    },
    {
        id: 'lore',
        label: 'Lore',
        pluralLabel: 'Lore',
        entityKind: 'CONCEPT',
        icon: 'BookOpen',
        color: '#3b82f6',
        description: 'Magic systems, religions, cultures, and world concepts'
    },
    {
        id: 'chapters',
        label: 'Chapter',
        pluralLabel: 'Chapters',
        entityKind: 'CHAPTER',
        icon: 'FileText',
        color: '#ec4899',
        description: 'Story chapters, scenes, and narrative beats'
    },
];

/** Special wiki sections that aren't entity-based collections */
export const WIKI_SECTIONS: WikiSection[] = [
    {
        id: 'worldbuilding',
        label: 'Worldbuilding',
        icon: 'Globe',
        color: '#06b6d4',
        description: 'Guided prompts to develop your world from the ground up',
        href: '/wiki/worldbuilding'
    },
    {
        id: 'story-beats',
        label: 'Story Beats',
        icon: 'Clapperboard',
        color: '#f97316',
        description: 'Plan your narrative with beat sheets and story structure',
        href: '/wiki/beats'
    },
    {
        id: 'timelines',
        label: 'Timelines',
        icon: 'Clock',
        color: '#14b8a6',
        description: 'Chronological events linked to your fantasy calendar',
        href: '/wiki/timelines'
    },
    {
        id: 'relationships',
        label: 'Relationships',
        icon: 'Network',
        color: '#a855f7',
        description: 'Visual web of connections between entities',
        href: '/wiki/relationships'
    },
    {
        id: 'media',
        label: 'Media Gallery',
        icon: 'Image',
        color: '#64748b',
        description: 'Images, maps, and mood boards for your world',
        href: '/wiki/media'
    },
];

/** Get a category by its ID */
export function getCategoryById(id: string): WikiCategory | undefined {
    return WIKI_CATEGORIES.find(c => c.id === id);
}

/** Get a category by entity kind */
export function getCategoryByKind(kind: string): WikiCategory | undefined {
    return WIKI_CATEGORIES.find(c => c.entityKind === kind);
}

/** Get a special section by its ID */
export function getSectionById(id: string): WikiSection | undefined {
    return WIKI_SECTIONS.find(s => s.id === id);
}
