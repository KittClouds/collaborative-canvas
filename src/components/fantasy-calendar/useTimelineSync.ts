/**
 * useTimelineSync - Shared state hook for dual-timeline synchronization
 * Now uses hierarchical Periods from context
 */

import { useState, useCallback, useMemo } from 'react';
import { CalendarEvent, CalendarDefinition, Period } from '@/lib/fantasy-calendar/types';
import { formatYearWithEra } from '@/lib/fantasy-calendar/utils';

export interface TimelineItem {
    id: string;
    label: string;
    subLabel: string;
    year: number;
    endYear?: number;
    monthIndex?: number;
    dayIndex?: number;
    events: CalendarEvent[];
    icon?: string;
    color?: string;
    isCompleted: boolean;
    periodType?: string;
    childItems?: TimelineItem[];
}

export interface UseTimelineSyncResult {
    // Track A: Periods (from context, hierarchical)
    periodItems: TimelineItem[];
    // Track B: Individual Events
    eventItems: TimelineItem[];
    // Shared state
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    // Highlighted from calendar click
    highlightedEventId: string | null;
    // Filter by period
    activePeriodId: string | null;
    setActivePeriodId: (id: string | null) => void;
}

export function useTimelineSync(
    events: CalendarEvent[],
    calendar: CalendarDefinition,
    viewYear: number,
    highlightedEventId: string | null,
    periods: Period[] = []
): UseTimelineSyncResult {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activePeriodId, setActivePeriodId] = useState<string | null>(null);

    // Track A: Convert Period[] to TimelineItem[] (use context periods)
    const periodItems = useMemo((): TimelineItem[] => {
        // If we have periods from context, use those
        if (periods.length > 0) {
            // Get root periods (no parent)
            const rootPeriods = periods.filter(p => !p.parentPeriodId);

            return rootPeriods.map(period => {
                const periodEvents = events.filter(e => e.periodId === period.id);
                const childPeriods = periods.filter(p => p.parentPeriodId === period.id);

                return {
                    id: period.id,
                    label: period.name,
                    subLabel: `${period.startYear}–${period.endYear || 'now'}`,
                    year: period.startYear,
                    endYear: period.endYear,
                    events: periodEvents,
                    color: period.color,
                    icon: period.icon,
                    isCompleted: period.endYear ? period.endYear < viewYear : false,
                    periodType: period.periodType,
                    childItems: childPeriods.map(child => ({
                        id: child.id,
                        label: child.name,
                        subLabel: `${child.startYear}–${child.endYear || 'now'}`,
                        year: child.startYear,
                        endYear: child.endYear,
                        events: events.filter(e => e.periodId === child.id),
                        color: child.color,
                        icon: child.icon,
                        isCompleted: child.endYear ? child.endYear < viewYear : false,
                        periodType: child.periodType,
                    })),
                };
            });
        }

        // Fallback: Auto-generate periods from events by year (legacy behavior)
        const byYear = new Map<number, CalendarEvent[]>();

        events.forEach(e => {
            const arr = byYear.get(e.date.year) || [];
            arr.push(e);
            byYear.set(e.date.year, arr);
        });

        const years = Array.from(byYear.keys()).sort((a, b) => a - b);
        if (years.length === 0) years.push(viewYear);

        return years.map(year => {
            const yearEvents = byYear.get(year) || [];
            return {
                id: `period-${year}`,
                label: formatYearWithEra(calendar, year),
                subLabel: `${yearEvents.length} event${yearEvents.length !== 1 ? 's' : ''}`,
                year,
                events: yearEvents,
                isCompleted: year < viewYear,
            };
        });
    }, [events, calendar, viewYear, periods]);

    // Track B: Individual events (optionally filtered by activePeriodId)
    const eventItems = useMemo((): TimelineItem[] => {
        let filteredEvents = events;

        // Filter by active period if set
        if (activePeriodId) {
            filteredEvents = events.filter(e => e.periodId === activePeriodId);
        }

        const sorted = [...filteredEvents].sort((a, b) => {
            if (a.date.year !== b.date.year) return a.date.year - b.date.year;
            if (a.date.monthIndex !== b.date.monthIndex) return a.date.monthIndex - b.date.monthIndex;
            return a.date.dayIndex - b.date.dayIndex;
        });

        return sorted.map(e => {
            const monthName = calendar.months[e.date.monthIndex]?.name || `Month ${e.date.monthIndex + 1}`;
            return {
                id: e.id,
                label: e.title,
                subLabel: `${monthName} ${e.date.dayIndex + 1}, ${formatYearWithEra(calendar, e.date.year)}`,
                year: e.date.year,
                monthIndex: e.date.monthIndex,
                dayIndex: e.date.dayIndex,
                events: [e],
                icon: e.eventTypeId,
                color: e.color,
                isCompleted: e.date.year < viewYear,
            };
        });
    }, [events, calendar, viewYear, activePeriodId]);

    return {
        periodItems,
        eventItems,
        expandedId,
        setExpandedId: useCallback((id: string | null) => setExpandedId(id), []),
        highlightedEventId,
        activePeriodId,
        setActivePeriodId: useCallback((id: string | null) => setActivePeriodId(id), []),
    };
}
