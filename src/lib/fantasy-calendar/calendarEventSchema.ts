/**
 * Calendar Event Schema - Zod validation for calendar events
 * Uses UUIDv7 for IDs, supports recurrence, time-of-day, importance levels
 */

import { z } from 'zod';

// =============================================================================
// FANTASY DATE SCHEMA
// =============================================================================

export const fantasyDateSchema = z.object({
    year: z.number().int(),
    eraId: z.string().optional(),
    monthIndex: z.number().int().min(0),
    dayIndex: z.number().int().min(0),
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
});

export type FantasyDateInput = z.infer<typeof fantasyDateSchema>;

// =============================================================================
// EVENT IMPORTANCE
// =============================================================================

export const eventImportanceSchema = z.enum([
    'trivial',      // Background flavor
    'minor',        // Side events  
    'moderate',     // Notable events
    'major',        // Key plot points
    'critical'      // World-changing moments
]);

export type EventImportance = z.infer<typeof eventImportanceSchema>;

/**
 * Default colors for each importance level
 * Can be overridden via event.color
 */
export const IMPORTANCE_COLORS: Record<EventImportance, string> = {
    trivial: '#9ca3af',   // Gray
    minor: '#60a5fa',     // Blue
    moderate: '#34d399',  // Green (primary)
    major: '#fbbf24',     // Yellow/Gold
    critical: '#f87171',  // Red
};

// =============================================================================
// EVENT CATEGORY
// =============================================================================

export const eventCategorySchema = z.enum([
    'general',
    'battle',
    'political',
    'personal',
    'discovery',
    'disaster',
    'celebration',
    'death',
    'birth',
    'travel',
    'custom'
]);

export type EventCategory = z.infer<typeof eventCategorySchema>;

/**
 * Icons for each category (Lucide icon names)
 */
export const CATEGORY_ICONS: Record<EventCategory, string> = {
    general: 'calendar',
    battle: 'swords',
    political: 'landmark',
    personal: 'user',
    discovery: 'lightbulb',
    disaster: 'flame',
    celebration: 'party-popper',
    death: 'skull',
    birth: 'baby',
    travel: 'map-pin',
    custom: 'star',
};

// =============================================================================
// RECURRENCE SCHEMA
// =============================================================================

export const recurrenceFrequencySchema = z.enum([
    'daily',
    'weekly',
    'monthly',
    'yearly',
    'custom'
]);

export const recurrenceSchema = z.object({
    frequency: recurrenceFrequencySchema,
    interval: z.number().int().min(1).default(1),  // Every X days/weeks/etc
    endDate: fantasyDateSchema.optional(),         // When to stop recurring
    count: z.number().int().min(1).optional(),     // Or stop after X occurrences
    customDays: z.number().int().min(1).optional(), // For 'custom' frequency: every X days
}).optional();

export type EventRecurrence = z.infer<typeof recurrenceSchema>;

// =============================================================================
// MAIN CALENDAR EVENT SCHEMA
// =============================================================================

export const calendarEventSchema = z.object({
    // Identity (UUIDv7)
    id: z.string(),
    calendarId: z.string(),

    // Timing
    date: fantasyDateSchema,
    endDate: fantasyDateSchema.optional(),
    isAllDay: z.boolean().default(true),

    // Recurrence
    recurrence: recurrenceSchema,
    parentEventId: z.string().optional(),  // If this is an instance of a recurring event

    // Core content
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),

    // Categorization
    importance: eventImportanceSchema.default('moderate'),
    category: eventCategorySchema.default('general'),
    tags: z.array(z.string().max(50)).max(20).default([]),

    // Display
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    icon: z.string().max(50).optional(),  // Lucide icon name override

    // Legacy entity linking (single link - backward compat)
    entityId: z.string().optional(),
    entityKind: z.string().optional(),

    // Source tracking
    sourceNoteId: z.string().optional(),

    // Metadata
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// =============================================================================
// INPUT SCHEMAS (FOR FORMS)
// =============================================================================

/**
 * Schema for creating a new event (omits auto-generated fields)
 */
export const createEventInputSchema = calendarEventSchema.omit({
    id: true,
    calendarId: true,
    createdAt: true,
    updatedAt: true,
    parentEventId: true,
});

export type CreateEventInput = z.infer<typeof createEventInputSchema>;

/**
 * Schema for updating an existing event (all fields optional except id)
 */
export const updateEventInputSchema = calendarEventSchema
    .partial()
    .required({ id: true });

export type UpdateEventInput = z.infer<typeof updateEventInputSchema>;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the display color for an event (user color or importance default)
 */
export function getEventColor(event: Pick<CalendarEvent, 'color' | 'importance'>): string {
    return event.color || IMPORTANCE_COLORS[event.importance || 'moderate'];
}

/**
 * Get the display icon for an event (user icon or category default)
 */
export function getEventIcon(event: Pick<CalendarEvent, 'icon' | 'category'>): string {
    return event.icon || CATEGORY_ICONS[event.category || 'general'];
}

/**
 * Validate and parse an event, returning typed result
 */
export function parseCalendarEvent(data: unknown): CalendarEvent {
    return calendarEventSchema.parse(data);
}

/**
 * Safe parse that returns null on failure
 */
export function safeParseCalendarEvent(data: unknown): CalendarEvent | null {
    const result = calendarEventSchema.safeParse(data);
    return result.success ? result.data : null;
}
