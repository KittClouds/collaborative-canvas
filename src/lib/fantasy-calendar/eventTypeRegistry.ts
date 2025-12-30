/**
 * Event Type Registry - Preset event types for narrative worldbuilding
 * Organized by time scale with appropriate categories and icons
 */

import { EventCategory, EventImportance } from './types';

export type TimeScale = 'month' | 'year' | 'decade' | 'century';

export interface EventTypeDefinition {
    id: string;
    label: string;
    icon: string;              // Lucide icon name
    category: EventCategory;
    importance: EventImportance;
    scales: TimeScale[];       // Which scales this type appears in
    color: string;
    description?: string;
    isBuiltIn: boolean;
}

/**
 * Built-in event types organized for narrative worldbuilding
 */
export const BUILTIN_EVENT_TYPES: EventTypeDefinition[] = [
    // === Personal & Day-to-Day Events ===
    { id: 'encounter', label: 'Encounter', icon: 'users', category: 'personal', importance: 'minor', scales: ['month'], color: '#60a5fa', isBuiltIn: true },
    { id: 'discovery', label: 'Discovery', icon: 'lightbulb', category: 'discovery', importance: 'moderate', scales: ['month', 'year'], color: '#fbbf24', isBuiltIn: true },
    { id: 'decision', label: 'Decision', icon: 'scale', category: 'personal', importance: 'moderate', scales: ['month'], color: '#a78bfa', isBuiltIn: true },
    { id: 'dream', label: 'Dream/Vision', icon: 'moon', category: 'personal', importance: 'minor', scales: ['month'], color: '#818cf8', isBuiltIn: true },
    { id: 'journey_start', label: 'Journey Begins', icon: 'map', category: 'travel', importance: 'moderate', scales: ['month'], color: '#34d399', isBuiltIn: true },
    { id: 'journey_end', label: 'Journey Ends', icon: 'flag', category: 'travel', importance: 'moderate', scales: ['month'], color: '#34d399', isBuiltIn: true },

    // === Celebrations & Ceremonies ===
    { id: 'festival', label: 'Festival', icon: 'party-popper', category: 'celebration', importance: 'moderate', scales: ['month', 'year'], color: '#f472b6', isBuiltIn: true },
    { id: 'ceremony', label: 'Ceremony', icon: 'sparkles', category: 'celebration', importance: 'moderate', scales: ['month'], color: '#c084fc', isBuiltIn: true },
    { id: 'wedding', label: 'Wedding', icon: 'heart', category: 'celebration', importance: 'moderate', scales: ['month'], color: '#fb7185', isBuiltIn: true },
    { id: 'coming_of_age', label: 'Coming of Age', icon: 'user-check', category: 'personal', importance: 'moderate', scales: ['month'], color: '#4ade80', isBuiltIn: true },

    // === Life Events ===
    { id: 'birth', label: 'Birth', icon: 'baby', category: 'birth', importance: 'moderate', scales: ['month', 'year'], color: '#86efac', isBuiltIn: true },
    { id: 'death', label: 'Death', icon: 'skull', category: 'death', importance: 'major', scales: ['month', 'year'], color: '#94a3b8', isBuiltIn: true },
    { id: 'resurrection', label: 'Resurrection', icon: 'rotate-ccw', category: 'general', importance: 'critical', scales: ['month', 'year'], color: '#fde047', isBuiltIn: true },

    // === Conflict Events ===
    { id: 'battle', label: 'Battle', icon: 'swords', category: 'battle', importance: 'major', scales: ['month', 'year'], color: '#ef4444', isBuiltIn: true },
    { id: 'siege', label: 'Siege', icon: 'shield', category: 'battle', importance: 'major', scales: ['month', 'year'], color: '#f97316', isBuiltIn: true },
    { id: 'war_start', label: 'War Begins', icon: 'flame', category: 'battle', importance: 'critical', scales: ['year', 'decade'], color: '#dc2626', isBuiltIn: true },
    { id: 'war_end', label: 'War Ends', icon: 'dove', category: 'battle', importance: 'critical', scales: ['year', 'decade'], color: '#22c55e', isBuiltIn: true },
    { id: 'rebellion', label: 'Rebellion', icon: 'flag', category: 'battle', importance: 'major', scales: ['year'], color: '#ea580c', isBuiltIn: true },

    // === Political Events ===
    { id: 'coronation', label: 'Coronation', icon: 'crown', category: 'political', importance: 'major', scales: ['year'], color: '#eab308', isBuiltIn: true },
    { id: 'abdication', label: 'Abdication', icon: 'user-minus', category: 'political', importance: 'major', scales: ['year'], color: '#f59e0b', isBuiltIn: true },
    { id: 'treaty', label: 'Treaty', icon: 'scroll', category: 'political', importance: 'major', scales: ['year', 'decade'], color: '#14b8a6', isBuiltIn: true },
    { id: 'founding', label: 'Founding', icon: 'landmark', category: 'political', importance: 'major', scales: ['year', 'decade'], color: '#0ea5e9', isBuiltIn: true },
    { id: 'election', label: 'Election', icon: 'vote', category: 'political', importance: 'moderate', scales: ['year'], color: '#6366f1', isBuiltIn: true },

    // === Disasters ===
    { id: 'plague', label: 'Plague', icon: 'bug', category: 'disaster', importance: 'critical', scales: ['year', 'decade'], color: '#84cc16', isBuiltIn: true },
    { id: 'famine', label: 'Famine', icon: 'wheat-off', category: 'disaster', importance: 'critical', scales: ['year'], color: '#a3a3a3', isBuiltIn: true },
    { id: 'natural_disaster', label: 'Natural Disaster', icon: 'cloud-lightning', category: 'disaster', importance: 'major', scales: ['month', 'year'], color: '#78716c', isBuiltIn: true },
    { id: 'destruction', label: 'Destruction', icon: 'bomb', category: 'disaster', importance: 'critical', scales: ['year', 'decade'], color: '#b91c1c', isBuiltIn: true },

    // === Epoch-Scale Events ===
    { id: 'age_begins', label: 'Age Begins', icon: 'sunrise', category: 'general', importance: 'critical', scales: ['decade', 'century'], color: '#fb923c', isBuiltIn: true },
    { id: 'age_ends', label: 'Age Ends', icon: 'sunset', category: 'general', importance: 'critical', scales: ['decade', 'century'], color: '#f87171', isBuiltIn: true },
    { id: 'cataclysm', label: 'Cataclysm', icon: 'mountain', category: 'disaster', importance: 'critical', scales: ['century'], color: '#7c3aed', isBuiltIn: true },
    { id: 'prophecy', label: 'Prophecy', icon: 'eye', category: 'discovery', importance: 'major', scales: ['decade', 'century'], color: '#c084fc', isBuiltIn: true },
    { id: 'divine_event', label: 'Divine Event', icon: 'sparkles', category: 'general', importance: 'critical', scales: ['century'], color: '#fde68a', isBuiltIn: true },
    { id: 'first_contact', label: 'First Contact', icon: 'globe', category: 'discovery', importance: 'critical', scales: ['decade', 'century'], color: '#22d3d1', isBuiltIn: true },

    // === General/Custom ===
    { id: 'custom', label: 'Custom Event', icon: 'plus-circle', category: 'custom', importance: 'moderate', scales: ['month', 'year', 'decade', 'century'], color: '#6b7280', isBuiltIn: true },
];

/**
 * Get event types appropriate for a given scale
 */
export function getEventTypesForScale(scale: TimeScale): EventTypeDefinition[] {
    return BUILTIN_EVENT_TYPES.filter(t => t.scales.includes(scale));
}

/**
 * Get event type by ID
 */
export function getEventTypeById(id: string): EventTypeDefinition | undefined {
    return BUILTIN_EVENT_TYPES.find(t => t.id === id);
}

/**
 * Get all event types
 */
export function getAllEventTypes(): EventTypeDefinition[] {
    return BUILTIN_EVENT_TYPES;
}

/**
 * Get all unique categories from event types
 */
export function getEventCategories(): EventCategory[] {
    const categories = new Set(BUILTIN_EVENT_TYPES.map(t => t.category));
    return Array.from(categories);
}

/**
 * Group event types by category for a given scale
 */
export function getEventTypesByCategory(scale: TimeScale): Map<EventCategory, EventTypeDefinition[]> {
    const types = getEventTypesForScale(scale);
    const grouped = new Map<EventCategory, EventTypeDefinition[]>();

    types.forEach(t => {
        const list = grouped.get(t.category) || [];
        list.push(t);
        grouped.set(t.category, list);
    });

    return grouped;
}

/**
 * Default event type when none is selected
 */
export const DEFAULT_EVENT_TYPE_ID = 'custom';
