/**
 * Calendar Atoms - SQLite-backed state management for Fantasy Calendar
 * Uses lazy loading pattern: hydrates when CalendarContext mounts
 */
import { atom, type WritableAtom } from 'jotai';
import { dbClient } from '@/lib/db/client/db-client';
import { generateId } from '@/lib/utils/ids';
import type { SQLiteNode, SQLiteNodeInput } from '@/lib/db/client/types';
import type {
    CalendarDefinition,
    CalendarEvent,
    Period,
    FantasyDate,
    EditorScope,
} from '@/lib/fantasy-calendar/types';

// ============================================
// TYPES
// ============================================

export interface CalendarViewState {
    viewDate: FantasyDate;
    editorScope: EditorScope;
    highlightedEventId: string | null;
    isSetupMode: boolean;
}

// ============================================
// BASE ATOMS (In-Memory State) - Internal
// ============================================

// Using explicit writable atoms pattern for type safety
const _calendarBaseAtom = atom<CalendarDefinition | null>(null);
const _eventsBaseAtom = atom<CalendarEvent[]>([]);
const _periodsBaseAtom = atom<Period[]>([]);
const _viewStateBaseAtom = atom<CalendarViewState>({
    viewDate: { year: 1, monthIndex: 0, dayIndex: 0 },
    editorScope: 'day',
    highlightedEventId: null,
    isSetupMode: false,
});
const _isHydratedBaseAtom = atom(false);
const _isLoadingBaseAtom = atom(false);

// Writable derived atoms (same pattern as notes.ts)
const _calendarAtom: WritableAtom<CalendarDefinition | null, [CalendarDefinition | null], void> = atom(
    (get) => get(_calendarBaseAtom),
    (_get, set, val) => set(_calendarBaseAtom as any, val)
);

const _eventsAtom: WritableAtom<CalendarEvent[], [CalendarEvent[]], void> = atom(
    (get) => get(_eventsBaseAtom),
    (_get, set, val) => set(_eventsBaseAtom as any, val)
);

const _periodsAtom: WritableAtom<Period[], [Period[]], void> = atom(
    (get) => get(_periodsBaseAtom),
    (_get, set, val) => set(_periodsBaseAtom as any, val)
);

const _viewStateAtom: WritableAtom<CalendarViewState, [CalendarViewState], void> = atom(
    (get) => get(_viewStateBaseAtom),
    (_get, set, val) => set(_viewStateBaseAtom as any, val)
);

const _isHydratedAtom: WritableAtom<boolean, [boolean], void> = atom(
    (get) => get(_isHydratedBaseAtom),
    (_get, set, val) => set(_isHydratedBaseAtom as any, val)
);

const _isLoadingAtom: WritableAtom<boolean, [boolean], void> = atom(
    (get) => get(_isLoadingBaseAtom),
    (_get, set, val) => set(_isLoadingBaseAtom as any, val)
);


// ============================================
// EXPORTED READ ATOMS
// ============================================

export const calendarAtom = atom((get) => get(_calendarAtom));
export const calendarEventsAtom = atom((get) => get(_eventsAtom));
export const calendarPeriodsAtom = atom((get) => get(_periodsAtom));
export const calendarViewStateAtom = atom((get) => get(_viewStateAtom));
export const isCalendarHydratedAtom = atom((get) => get(_isHydratedAtom));
export const isCalendarLoadingAtom = atom((get) => get(_isLoadingAtom));


// ============================================
// TRANSFORMATION UTILITIES
// ============================================

function transformNodeToCalendar(node: SQLiteNode): CalendarDefinition {
    try {
        const data = node.content ? JSON.parse(node.content) : {};
        return {
            ...data,
            id: node.id,
            name: node.label,
        };
    } catch {
        throw new Error(`Invalid calendar data for node ${node.id}`);
    }
}

function transformNodeToEvent(node: SQLiteNode): CalendarEvent {
    try {
        const data = node.content ? JSON.parse(node.content) : {};
        return {
            ...data,
            id: node.id,
            title: node.label,
            calendarId: node.parent_id || '',
        };
    } catch {
        throw new Error(`Invalid event data for node ${node.id}`);
    }
}

function transformNodeToPeriod(node: SQLiteNode): Period {
    try {
        const data = node.content ? JSON.parse(node.content) : {};
        return {
            ...data,
            id: node.id,
            name: node.label,
            calendarId: node.parent_id || '',
        };
    } catch {
        throw new Error(`Invalid period data for node ${node.id}`);
    }
}

function transformCalendarToNode(calendar: CalendarDefinition): SQLiteNodeInput {
    const { id, name, ...rest } = calendar;
    return {
        id,
        type: 'CALENDAR',
        label: name,
        content: JSON.stringify(rest),
        parent_id: null,
    };
}

function transformEventToNode(event: CalendarEvent): SQLiteNodeInput {
    const { id, title, calendarId, ...rest } = event;
    return {
        id,
        type: 'CALENDAR_EVENT',
        label: title,
        content: JSON.stringify(rest),
        parent_id: calendarId,
    };
}

function transformPeriodToNode(period: Period): SQLiteNodeInput {
    const { id, name, calendarId, ...rest } = period;
    return {
        id,
        type: 'CALENDAR_PERIOD',
        label: name,
        content: JSON.stringify(rest),
        parent_id: calendarId,
    };
}

// ============================================
// HYDRATION ATOM (Lazy Load)
// ============================================

/**
 * Hydrate calendar data from SQLite
 * Called when CalendarProvider mounts
 */
export const hydrateCalendarAtom = atom(
    null,
    async (get, set) => {
        // Skip if already hydrated or loading
        if (get(_isHydratedAtom) || get(_isLoadingAtom)) {
            return;
        }

        set(_isLoadingAtom, true);

        try {
            const allNodes = await dbClient.getAllNodes();

            // Filter by type
            const calendarNodes = allNodes.filter(n => n.type === 'CALENDAR');
            const eventNodes = allNodes.filter(n => n.type === 'CALENDAR_EVENT');
            const periodNodes = allNodes.filter(n => n.type === 'CALENDAR_PERIOD');

            // Transform and set
            if (calendarNodes.length > 0) {
                set(_calendarAtom, transformNodeToCalendar(calendarNodes[0]));
            }
            set(_eventsAtom, eventNodes.map(transformNodeToEvent));
            set(_periodsAtom, periodNodes.map(transformNodeToPeriod));
            set(_isHydratedAtom, true);

            console.log(`[Calendar] Hydrated: ${calendarNodes.length} calendars, ${eventNodes.length} events, ${periodNodes.length} periods`);
        } catch (error) {
            console.error('[Calendar] Hydration failed:', error);
            throw error;
        } finally {
            set(_isLoadingAtom, false);
        }
    }
);

// ============================================
// CALENDAR MUTATION ATOMS
// ============================================

/**
 * Create or update calendar definition
 */
export const saveCalendarAtom = atom(
    null,
    async (get, set, calendar: CalendarDefinition) => {
        const previous = get(_calendarAtom);

        // Optimistic update
        set(_calendarAtom, calendar);

        try {
            const nodeInput = transformCalendarToNode(calendar);

            if (previous?.id === calendar.id) {
                // Update existing
                await dbClient.updateNode(calendar.id, {
                    label: calendar.name,
                    content: nodeInput.content,
                });
            } else {
                // Insert new
                await dbClient.insertNode(nodeInput);
            }

            console.log(`[Calendar] Saved calendar: ${calendar.name}`);
        } catch (error) {
            // Rollback
            set(_calendarAtom, previous);
            console.error('[Calendar] Failed to save calendar:', error);
            throw error;
        }
    }
);

// ============================================
// EVENT MUTATION ATOMS
// ============================================

/**
 * Add a new event
 */
export const createEventAtom = atom(
    null,
    async (get, set, event: Omit<CalendarEvent, 'id'>) => {
        const newEvent: CalendarEvent = {
            ...event,
            id: generateId(),
        };

        const currentEvents = get(_eventsAtom);

        // Optimistic add
        set(_eventsAtom, [...currentEvents, newEvent]);

        try {
            await dbClient.insertNode(transformEventToNode(newEvent));
            console.log(`[Calendar] Created event: ${newEvent.title}`);
            return newEvent;
        } catch (error) {
            // Rollback
            set(_eventsAtom, currentEvents);
            console.error('[Calendar] Failed to create event:', error);
            throw error;
        }
    }
);

/**
 * Update an existing event
 */
export const updateEventAtom = atom(
    null,
    async (get, set, params: { id: string; updates: Partial<CalendarEvent> }) => {
        const { id, updates } = params;
        const currentEvents = get(_eventsAtom);
        const originalEvent = currentEvents.find(e => e.id === id);

        if (!originalEvent) {
            console.error(`[Calendar] Event ${id} not found`);
            return;
        }

        const updatedEvent = { ...originalEvent, ...updates };

        // Optimistic update
        set(_eventsAtom, currentEvents.map(e => e.id === id ? updatedEvent : e));

        try {
            const nodeInput = transformEventToNode(updatedEvent);
            await dbClient.updateNode(id, {
                label: nodeInput.label,
                content: nodeInput.content,
            });
            console.log(`[Calendar] Updated event: ${updatedEvent.title}`);
        } catch (error) {
            // Rollback
            set(_eventsAtom, currentEvents);
            console.error('[Calendar] Failed to update event:', error);
            throw error;
        }
    }
);

/**
 * Delete an event
 */
export const deleteEventAtom = atom(
    null,
    async (get, set, eventId: string) => {
        const currentEvents = get(_eventsAtom);

        // Optimistic delete
        set(_eventsAtom, currentEvents.filter(e => e.id !== eventId));

        try {
            await dbClient.deleteNode(eventId);
            console.log(`[Calendar] Deleted event: ${eventId}`);
        } catch (error) {
            // Rollback
            set(_eventsAtom, currentEvents);
            console.error('[Calendar] Failed to delete event:', error);
            throw error;
        }
    }
);

// ============================================
// PERIOD MUTATION ATOMS
// ============================================

/**
 * Add a new period
 */
export const createPeriodAtom = atom(
    null,
    async (get, set, period: Omit<Period, 'id'>) => {
        const newPeriod: Period = {
            ...period,
            id: generateId(),
        };

        const currentPeriods = get(_periodsAtom);

        // Optimistic add
        set(_periodsAtom, [...currentPeriods, newPeriod]);

        try {
            await dbClient.insertNode(transformPeriodToNode(newPeriod));
            console.log(`[Calendar] Created period: ${newPeriod.name}`);
            return newPeriod;
        } catch (error) {
            // Rollback
            set(_periodsAtom, currentPeriods);
            console.error('[Calendar] Failed to create period:', error);
            throw error;
        }
    }
);

/**
 * Update an existing period
 */
export const updatePeriodAtom = atom(
    null,
    async (get, set, params: { id: string; updates: Partial<Period> }) => {
        const { id, updates } = params;
        const currentPeriods = get(_periodsAtom);
        const originalPeriod = currentPeriods.find(p => p.id === id);

        if (!originalPeriod) {
            console.error(`[Calendar] Period ${id} not found`);
            return;
        }

        const updatedPeriod = { ...originalPeriod, ...updates };

        // Optimistic update
        set(_periodsAtom, currentPeriods.map(p => p.id === id ? updatedPeriod : p));

        try {
            const nodeInput = transformPeriodToNode(updatedPeriod);
            await dbClient.updateNode(id, {
                label: nodeInput.label,
                content: nodeInput.content,
            });
            console.log(`[Calendar] Updated period: ${updatedPeriod.name}`);
        } catch (error) {
            // Rollback
            set(_periodsAtom, currentPeriods);
            console.error('[Calendar] Failed to update period:', error);
            throw error;
        }
    }
);

/**
 * Delete a period
 */
export const deletePeriodAtom = atom(
    null,
    async (get, set, periodId: string) => {
        const currentPeriods = get(_periodsAtom);
        const currentEvents = get(_eventsAtom);

        // Optimistic delete
        set(_periodsAtom, currentPeriods.filter(p => p.id !== periodId));
        // Also clear periodId from events referencing this period
        set(_eventsAtom, currentEvents.map(e =>
            e.periodId === periodId ? { ...e, periodId: undefined } : e
        ));

        try {
            await dbClient.deleteNode(periodId);
            console.log(`[Calendar] Deleted period: ${periodId}`);
        } catch (error) {
            // Rollback
            set(_periodsAtom, currentPeriods);
            set(_eventsAtom, currentEvents);
            console.error('[Calendar] Failed to delete period:', error);
            throw error;
        }
    }
);

// ============================================
// VIEW STATE ATOMS (Memory-only, no persistence)
// ============================================

/**
 * Update view state (viewDate, editorScope, etc.)
 */
export const updateViewStateAtom = atom(
    null,
    (get, set, updates: Partial<CalendarViewState>) => {
        const current = get(_viewStateAtom);
        set(_viewStateAtom, { ...current, ...updates });
    }
);

/**
 * Set setup mode
 */
export const setSetupModeAtom = atom(
    null,
    (get, set, isSetupMode: boolean) => {
        const current = get(_viewStateAtom);
        set(_viewStateAtom, { ...current, isSetupMode });
    }
);
