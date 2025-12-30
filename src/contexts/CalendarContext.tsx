/**
 * CalendarContext - Centralized state management for Fantasy Calendar
 * Provides unified API for sidebar, timeline, and grid components
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    CalendarDefinition,
    FantasyDate,
    CalendarEvent,
    OrbitalMechanics,
    MonthDefinition,
    EraDefinition,
    WeekdayDefinition,
    EpochDefinition,
    TimeMarker,
    Period,
    EditorScope,
    EntityRef,
    CausalChain
} from '@/lib/fantasy-calendar/types';
import { generateOrbitalCalendar } from '@/lib/fantasy-calendar/orbital';
import {
    generateUUID,
    getDaysInMonth,
    formatYearWithEra,
    navigateYear as utilNavigateYear
} from '@/lib/fantasy-calendar/utils';
import { generateId } from '@/lib/utils/ids';
import { executeGenesis, clearCalendarTimeUnits } from '@/lib/time';
import { temporalAhoMatcher } from '@/lib/entities/scanner-v3/extractors/TemporalAhoMatcher';

// Configuration passed from the wizard
export interface CalendarConfig {
    name: string;
    startingYear: number;
    eraName: string;
    eraAbbreviation: string;
    monthNames: string[];
    weekdayNames: string[];
    orbitalMechanics?: OrbitalMechanics;
    eras?: EraDefinition[];
    epochs?: EpochDefinition[];
    timeMarkers?: TimeMarker[];
    hasYearZero?: boolean;
}

// Context value type - the API all components consume
export interface CalendarContextValue {
    // State
    calendar: CalendarDefinition;
    viewDate: FantasyDate;
    events: CalendarEvent[];
    isSetupMode: boolean;

    // Computed values
    currentMonth: MonthDefinition;
    daysInCurrentMonth: number;
    viewYearFormatted: string;
    eventsForCurrentMonth: CalendarEvent[];

    // Navigation
    navigateMonth: (dir: 'prev' | 'next') => void;
    navigateYear: (dir: 'prev' | 'next') => void;
    navigateDay: (dir: 'prev' | 'next') => void;
    selectDay: (dayIndex: number) => void;
    goToYear: (year: number) => void;
    goToDate: (date: FantasyDate) => void;

    // Events
    addEvent: (event: Omit<CalendarEvent, 'id' | 'calendarId'>) => CalendarEvent;
    updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'calendarId'>>) => void;
    removeEvent: (id: string) => void;
    getEventById: (id: string) => CalendarEvent | undefined;
    getEventsForDay: (date: FantasyDate) => CalendarEvent[];
    toggleEventStatus: (id: string) => void;

    // Time Markers
    addTimeMarker: (marker: Omit<TimeMarker, 'id' | 'calendarId'>) => void;
    removeTimeMarker: (id: string) => void;

    // Calendar Management
    createCalendar: (config: CalendarConfig) => Promise<void>;
    setIsSetupMode: (mode: boolean) => void;
    isGenerating: boolean;

    // UI State
    highlightedEventId: string | null;
    setHighlightedEventId: (id: string | null) => void;

    // Period Management
    periods: Period[];
    addPeriod: (period: Omit<Period, 'id' | 'calendarId'>) => Period;
    updatePeriod: (id: string, updates: Partial<Omit<Period, 'id' | 'calendarId'>>) => void;
    removePeriod: (id: string) => void;
    getPeriodById: (id: string) => Period | undefined;
    getRootPeriods: () => Period[];
    getChildPeriods: (periodId: string) => Period[];
    getEventsInPeriod: (periodId: string) => CalendarEvent[];
    getPeriodForYear: (year: number) => Period | undefined;

    // === NARRATIVE API ===

    // Editor Scope Control
    editorScope: EditorScope;
    setEditorScope: (scope: EditorScope) => void;
    getEventsForScope: () => CalendarEvent[];

    // Causality
    getCausalChain: (eventId: string) => CausalChain;
    linkEvents: (causeId: string, effectId: string, weight?: number) => void;
    unlinkEvents: (causeId: string, effectId: string) => void;

    // Entity References
    addParticipant: (eventId: string, entityRef: EntityRef) => void;
    removeParticipant: (eventId: string, entityId: string) => void;
    getEventsByEntity: (entityId: string) => CalendarEvent[];

    // Display Control
    toggleCellVisibility: (eventId: string) => void;
    toggleTimelinePin: (eventId: string) => void;
    setCellDisplayMode: (eventId: string, mode: 'minimal' | 'badge' | 'full') => void;
}

// Default calendar for initial state
const DEFAULT_CALENDAR: CalendarDefinition = {
    id: 'cal_default',
    name: 'New World Calendar',
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
    weekdays: Array.from({ length: 7 }, (_, i) => ({
        id: `wd_${i}`, index: i, name: `Day ${i + 1}`, shortName: `D${i + 1}`
    })),
    months: Array.from({ length: 12 }, (_, i) => ({
        id: `mo_${i}`, index: i, name: `Month ${i + 1}`, shortName: `M${i + 1}`, days: 30
    })),
    eras: [{ id: 'era_1', name: 'Common Era', abbreviation: 'CE', startYear: 1, direction: 'ascending' }],
    defaultEraId: 'era_1',
    epochs: [],
    timeMarkers: [],
    hasYearZero: false,
    moons: [{ id: 'moon_1', name: 'Luna', cycleDays: 28, color: '#e2e8f0' }],
    seasons: [],
    createdFrom: 'manual'
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

interface CalendarProviderProps {
    children: ReactNode;
}

export function CalendarProvider({ children }: CalendarProviderProps) {
    const [calendar, setCalendar] = useState<CalendarDefinition>(DEFAULT_CALENDAR);
    const [viewDate, setViewDate] = useState<FantasyDate>({ year: 1, monthIndex: 0, dayIndex: 0 });
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
    const [editorScope, setEditorScope] = useState<EditorScope>('day');
    const [isGenerating, setIsGenerating] = useState(false);

    // Computed values
    const currentMonth = useMemo(() =>
        calendar.months[viewDate.monthIndex] || calendar.months[0],
        [calendar.months, viewDate.monthIndex]
    );

    const daysInCurrentMonth = useMemo(() =>
        getDaysInMonth(currentMonth, viewDate.year),
        [currentMonth, viewDate.year]
    );

    const viewYearFormatted = useMemo(() =>
        formatYearWithEra(calendar, viewDate.year),
        [calendar, viewDate.year]
    );

    const eventsForCurrentMonth = useMemo(() =>
        events.filter(e =>
            e.date.year === viewDate.year &&
            e.date.monthIndex === viewDate.monthIndex
        ),
        [events, viewDate.year, viewDate.monthIndex]
    );

    // Navigation
    const navigateMonth = useCallback((dir: 'prev' | 'next') => {
        setViewDate(prev => {
            let newMonth = prev.monthIndex + (dir === 'next' ? 1 : -1);
            let newYear = prev.year;

            if (newMonth < 0) {
                newMonth = calendar.months.length - 1;
                newYear = utilNavigateYear(prev.year, 'prev', calendar.hasYearZero);
            } else if (newMonth >= calendar.months.length) {
                newMonth = 0;
                newYear = utilNavigateYear(prev.year, 'next', calendar.hasYearZero);
            }

            return { ...prev, monthIndex: newMonth, year: newYear, dayIndex: 0 };
        });
    }, [calendar.months.length, calendar.hasYearZero]);

    const navigateYear = useCallback((dir: 'prev' | 'next') => {
        setViewDate(prev => ({
            ...prev,
            year: utilNavigateYear(prev.year, dir, calendar.hasYearZero)
        }));
    }, [calendar.hasYearZero]);

    const navigateDay = useCallback((dir: 'prev' | 'next') => {
        setViewDate(prev => {
            const currentMonth = calendar.months[prev.monthIndex];
            const daysInMonth = getDaysInMonth(currentMonth, prev.year);
            let newDay = prev.dayIndex + (dir === 'next' ? 1 : -1);
            let newMonth = prev.monthIndex;
            let newYear = prev.year;

            if (newDay < 0) {
                // Go to previous month's last day
                newMonth = prev.monthIndex - 1;
                if (newMonth < 0) {
                    newMonth = calendar.months.length - 1;
                    newYear = utilNavigateYear(prev.year, 'prev', calendar.hasYearZero);
                }
                const prevMonthDef = calendar.months[newMonth];
                newDay = getDaysInMonth(prevMonthDef, newYear) - 1;
            } else if (newDay >= daysInMonth) {
                // Go to next month's first day
                newMonth = prev.monthIndex + 1;
                if (newMonth >= calendar.months.length) {
                    newMonth = 0;
                    newYear = utilNavigateYear(prev.year, 'next', calendar.hasYearZero);
                }
                newDay = 0;
            }

            return { ...prev, dayIndex: newDay, monthIndex: newMonth, year: newYear };
        });
    }, [calendar.months, calendar.hasYearZero]);

    const selectDay = useCallback((dayIndex: number) => {
        setViewDate(prev => ({ ...prev, dayIndex }));
    }, []);

    const goToYear = useCallback((year: number) => {
        setViewDate(prev => ({ ...prev, year, monthIndex: 0, dayIndex: 0 }));
    }, []);

    const goToDate = useCallback((date: FantasyDate) => {
        setViewDate(date);
    }, []);


    // Events
    const addEvent = useCallback((event: Omit<CalendarEvent, 'id' | 'calendarId'>): CalendarEvent => {
        const newEvent: CalendarEvent = {
            ...event,
            id: generateId(),
            calendarId: calendar.id
        };
        setEvents(prev => [...prev, newEvent]);
        return newEvent;
    }, [calendar.id]);

    const updateEvent = useCallback((id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'calendarId'>>) => {
        setEvents(prev => prev.map(e =>
            e.id === id ? { ...e, ...updates } : e
        ));
    }, []);

    const removeEvent = useCallback((id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
    }, []);

    const getEventById = useCallback((id: string): CalendarEvent | undefined => {
        return events.find(e => e.id === id);
    }, [events]);

    const getEventsForDay = useCallback((date: FantasyDate) => {
        return events.filter(e =>
            e.date.year === date.year &&
            e.date.monthIndex === date.monthIndex &&
            e.date.dayIndex === date.dayIndex
        );
    }, [events]);

    const toggleEventStatus = useCallback((id: string) => {
        setEvents(prev => prev.map(e => {
            if (e.id !== id) return e;
            // Cycle: undefined/todo -> in-progress -> completed -> todo
            const statusCycle: Record<string, 'todo' | 'in-progress' | 'completed'> = {
                'undefined': 'in-progress',
                'todo': 'in-progress',
                'in-progress': 'completed',
                'completed': 'todo'
            };
            const current = e.status || 'todo';
            return { ...e, status: statusCycle[current] };
        }));
    }, []);

    // Periods
    const addPeriod = useCallback((period: Omit<Period, 'id' | 'calendarId'>): Period => {
        const newPeriod: Period = {
            ...period,
            id: generateId(),
            calendarId: calendar.id,
            createdAt: new Date().toISOString()
        };
        setPeriods(prev => [...prev, newPeriod].sort((a, b) => a.startYear - b.startYear));
        return newPeriod;
    }, [calendar.id]);

    const updatePeriod = useCallback((id: string, updates: Partial<Omit<Period, 'id' | 'calendarId'>>) => {
        setPeriods(prev => prev.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ));
    }, []);

    const removePeriod = useCallback((id: string) => {
        // Also clear periodId from any events that reference this period
        setEvents(prev => prev.map(e =>
            e.periodId === id ? { ...e, periodId: undefined } : e
        ));
        // Remove child periods
        setPeriods(prev => prev.filter(p => p.id !== id && p.parentPeriodId !== id));
    }, []);

    const getPeriodById = useCallback((id: string): Period | undefined => {
        return periods.find(p => p.id === id);
    }, [periods]);

    const getRootPeriods = useCallback((): Period[] => {
        return periods.filter(p => !p.parentPeriodId);
    }, [periods]);

    const getChildPeriods = useCallback((periodId: string): Period[] => {
        return periods.filter(p => p.parentPeriodId === periodId);
    }, [periods]);

    const getEventsInPeriod = useCallback((periodId: string): CalendarEvent[] => {
        return events.filter(e => e.periodId === periodId);
    }, [events]);

    const getPeriodForYear = useCallback((year: number): Period | undefined => {
        // Find the most specific period (deepest in hierarchy) that contains this year
        return periods
            .filter(p => p.startYear <= year && (!p.endYear || p.endYear >= year))
            .sort((a, b) => {
                // Prefer periods with parents (more specific)
                if (a.parentPeriodId && !b.parentPeriodId) return -1;
                if (!a.parentPeriodId && b.parentPeriodId) return 1;
                // Prefer smaller ranges (more specific)
                const aRange = (a.endYear || year) - a.startYear;
                const bRange = (b.endYear || year) - b.startYear;
                return aRange - bRange;
            })[0];
    }, [periods]);

    // Time Markers
    const addTimeMarker = useCallback((marker: Omit<TimeMarker, 'id' | 'calendarId'>) => {
        const newMarker: TimeMarker = {
            ...marker,
            id: generateUUID(),
            calendarId: calendar.id
        };
        setCalendar(prev => ({
            ...prev,
            timeMarkers: [...prev.timeMarkers, newMarker].sort((a, b) => a.year - b.year)
        }));
    }, [calendar.id]);

    const removeTimeMarker = useCallback((id: string) => {
        setCalendar(prev => ({
            ...prev,
            timeMarkers: prev.timeMarkers.filter(m => m.id !== id)
        }));
    }, []);

    // Calendar creation from wizard config
    const createCalendar = useCallback(async (config: CalendarConfig) => {
        setIsGenerating(true);

        const calId = generateUUID();
        const eraId = generateUUID();

        const months: MonthDefinition[] = config.monthNames.map((name, i) => ({
            id: generateUUID(),
            index: i,
            name: name || `Month ${i + 1}`,
            shortName: name?.substring(0, 3) || `M${i + 1}`,
            days: 30
        }));

        if (months.length === 0) {
            for (let i = 0; i < 12; i++) {
                months.push({
                    id: generateUUID(),
                    index: i,
                    name: `Month ${i + 1}`,
                    shortName: `M${i + 1}`,
                    days: 30
                });
            }
        }

        const era: EraDefinition = {
            id: eraId,
            name: config.eraName || 'Common Era',
            abbreviation: config.eraAbbreviation || 'CE',
            startYear: 1,
            direction: 'ascending'
        };

        const weekdays: WeekdayDefinition[] = (config.weekdayNames || []).map((name, i) => ({
            id: generateUUID(),
            index: i,
            name: name || `Day ${i + 1}`,
            shortName: name?.substring(0, 3) || `D${i + 1}`
        }));

        if (weekdays.length === 0) {
            for (let i = 0; i < 7; i++) {
                weekdays.push({
                    id: generateUUID(),
                    index: i,
                    name: `Day ${i + 1}`,
                    shortName: `D${i + 1}`
                });
            }
        }

        const eras: EraDefinition[] = config.eras && config.eras.length > 0 ? config.eras : [era];
        const defaultEra = eras[0];

        const newCalendar: CalendarDefinition = {
            ...DEFAULT_CALENDAR,
            id: calId,
            name: config.name || 'Unnamed Calendar',
            weekdays,
            months,
            eras,
            defaultEraId: defaultEra.id,
            epochs: config.epochs || [],
            timeMarkers: config.timeMarkers || [],
            hasYearZero: config.hasYearZero ?? false,
            orbitalMechanics: config.orbitalMechanics,
            createdFrom: config.orbitalMechanics ? 'orbital' : 'manual'
        };

        // Execute World Genesis - register time units in CozoDB
        try {
            console.log('[CalendarContext] Executing world genesis for calendar:', calId);
            await clearCalendarTimeUnits(calId); // Clean slate
            await executeGenesis(config, calId, months);

            // Hydrate the scanner with new calendar terms
            await temporalAhoMatcher.hydrate(calId);

            console.log('[CalendarContext] World genesis complete for:', calId);
        } catch (err) {
            console.error('[CalendarContext] Genesis failed:', err);
        }

        setCalendar(newCalendar);
        setViewDate({
            year: config.startingYear || 1,
            monthIndex: 0,
            dayIndex: 0,
            eraId: defaultEra.id
        });
        setEvents([]);
        setIsGenerating(false);
    }, []);

    // === NARRATIVE API IMPLEMENTATIONS ===

    // Get events based on current editor scope
    const getEventsForScope = useCallback((): CalendarEvent[] => {
        switch (editorScope) {
            case 'day':
                return events.filter(e =>
                    e.date.year === viewDate.year &&
                    e.date.monthIndex === viewDate.monthIndex &&
                    e.date.dayIndex === viewDate.dayIndex
                );
            case 'week': {
                // Get events for current week (7 days from selected day)
                const weekStart = viewDate.dayIndex;
                const weekEnd = Math.min(weekStart + 6, daysInCurrentMonth - 1);
                return events.filter(e =>
                    e.date.year === viewDate.year &&
                    e.date.monthIndex === viewDate.monthIndex &&
                    e.date.dayIndex >= weekStart &&
                    e.date.dayIndex <= weekEnd
                );
            }
            case 'month':
                return eventsForCurrentMonth;
            case 'period':
                // If a period is selected, filter by that
                return events; // All events for now, can be filtered by selected period
            default:
                return events;
        }
    }, [editorScope, events, viewDate, daysInCurrentMonth, eventsForCurrentMonth]);

    // Get causal chain for an event
    const getCausalChain = useCallback((eventId: string): CausalChain => {
        const event = events.find(e => e.id === eventId);
        if (!event) {
            return { upstream: [], downstream: [], depth: 0 };
        }
        return {
            upstream: event.causedBy || [],
            downstream: event.causes || [],
            depth: Math.max(
                (event.causedBy?.length || 0) > 0 ? 1 : 0,
                (event.causes?.length || 0) > 0 ? 1 : 0
            )
        };
    }, [events]);

    // Link two events causally
    const linkEvents = useCallback((causeId: string, effectId: string, weight: number = 1) => {
        setEvents(prev => prev.map(e => {
            if (e.id === causeId) {
                const causes = new Set(e.causes || []);
                causes.add(effectId);
                return { ...e, causes: Array.from(causes), causalityWeight: weight };
            }
            if (e.id === effectId) {
                const causedBy = new Set(e.causedBy || []);
                causedBy.add(causeId);
                return { ...e, causedBy: Array.from(causedBy) };
            }
            return e;
        }));
    }, []);

    // Unlink two events
    const unlinkEvents = useCallback((causeId: string, effectId: string) => {
        setEvents(prev => prev.map(e => {
            if (e.id === causeId && e.causes) {
                return { ...e, causes: e.causes.filter(id => id !== effectId) };
            }
            if (e.id === effectId && e.causedBy) {
                return { ...e, causedBy: e.causedBy.filter(id => id !== causeId) };
            }
            return e;
        }));
    }, []);

    // Add participant to event
    const addParticipant = useCallback((eventId: string, entityRef: EntityRef) => {
        setEvents(prev => prev.map(e => {
            if (e.id !== eventId) return e;
            const participants = e.participants || [];
            if (participants.some(p => p.id === entityRef.id)) return e;
            return { ...e, participants: [...participants, entityRef] };
        }));
    }, []);

    // Remove participant from event
    const removeParticipant = useCallback((eventId: string, entityId: string) => {
        setEvents(prev => prev.map(e => {
            if (e.id !== eventId || !e.participants) return e;
            return { ...e, participants: e.participants.filter(p => p.id !== entityId) };
        }));
    }, []);

    // Get events by entity
    const getEventsByEntity = useCallback((entityId: string): CalendarEvent[] => {
        return events.filter(e =>
            e.participants?.some(p => p.id === entityId) ||
            e.locations?.some(l => l.id === entityId) ||
            e.artifacts?.some(a => a.id === entityId)
        );
    }, [events]);

    // Toggle cell visibility
    const toggleCellVisibility = useCallback((eventId: string) => {
        setEvents(prev => prev.map(e =>
            e.id === eventId ? { ...e, showInCell: !(e.showInCell ?? true) } : e
        ));
    }, []);

    // Toggle timeline pin
    const toggleTimelinePin = useCallback((eventId: string) => {
        setEvents(prev => prev.map(e =>
            e.id === eventId ? { ...e, pinnedToTimeline: !e.pinnedToTimeline } : e
        ));
    }, []);

    // Set cell display mode
    const setCellDisplayMode = useCallback((eventId: string, mode: 'minimal' | 'badge' | 'full') => {
        setEvents(prev => prev.map(e =>
            e.id === eventId ? { ...e, cellDisplayMode: mode } : e
        ));
    }, []);

    const value: CalendarContextValue = {
        // State
        calendar,
        viewDate,
        events,
        isSetupMode,
        highlightedEventId,

        // Computed
        currentMonth,
        daysInCurrentMonth,
        viewYearFormatted,
        eventsForCurrentMonth,

        // Navigation
        navigateMonth,
        navigateYear,
        navigateDay,
        selectDay,
        goToYear,
        goToDate,

        // Events
        addEvent,
        updateEvent,
        removeEvent,
        getEventById,
        getEventsForDay,
        toggleEventStatus,
        setHighlightedEventId,

        // Periods
        periods,
        addPeriod,
        updatePeriod,
        removePeriod,
        getPeriodById,
        getRootPeriods,
        getChildPeriods,
        getEventsInPeriod,
        getPeriodForYear,

        // Time Markers
        addTimeMarker,
        removeTimeMarker,

        // Calendar Management
        createCalendar,
        setIsSetupMode,
        isGenerating,

        // === NARRATIVE API ===
        editorScope,
        setEditorScope,
        getEventsForScope,
        getCausalChain,
        linkEvents,
        unlinkEvents,
        addParticipant,
        removeParticipant,
        getEventsByEntity,
        toggleCellVisibility,
        toggleTimelinePin,
        setCellDisplayMode
    };

    return (
        <CalendarContext.Provider value={value}>
            {children}
        </CalendarContext.Provider>
    );
}

// Hook to consume the context
export function useCalendarContext(): CalendarContextValue {
    const context = useContext(CalendarContext);
    if (!context) {
        throw new Error('useCalendarContext must be used within a CalendarProvider');
    }
    return context;
}

export default CalendarContext;
