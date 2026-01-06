/**
 * useTimelineEvents Hook
 * Fetches and organizes calendar events for the Wiki Timelines view.
 */
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { calendarEventsAtom, calendarAtom } from '@/atoms/calendar';
import type { CalendarEvent } from '@/lib/fantasy-calendar/types';

export interface TimelineYear {
    year: number;
    formattedYear: string;
    events: CalendarEvent[];
}

export interface TimelineData {
    years: TimelineYear[];
    allEvents: CalendarEvent[];
    totalCount: number;
    isLoaded: boolean;
}

export function useTimelineEvents(): TimelineData {
    const events = useAtomValue(calendarEventsAtom);
    const calendar = useAtomValue(calendarAtom);

    const data = useMemo(() => {
        if (!events || events.length === 0) {
            return {
                years: [],
                allEvents: [],
                totalCount: 0,
                isLoaded: true
            };
        }

        // Sort events by date (year, month, day)
        const sortedEvents = [...events].sort((a, b) => {
            if (a.date.year !== b.date.year) return a.date.year - b.date.year;
            if (a.date.monthIndex !== b.date.monthIndex) return a.date.monthIndex - b.date.monthIndex;
            return a.date.dayIndex - b.date.dayIndex;
        });

        // Group by year
        const yearMap = new Map<number, CalendarEvent[]>();
        sortedEvents.forEach(event => {
            const year = event.date.year;
            if (!yearMap.has(year)) {
                yearMap.set(year, []);
            }
            yearMap.get(year)!.push(event);
        });

        // Convert to array with formatted year
        const years: TimelineYear[] = Array.from(yearMap.entries()).map(([year, yearEvents]) => {
            // Format year with era if available
            let formattedYear = `Year ${year}`;
            if (calendar?.eras && calendar.eras.length > 0) {
                const era = calendar.eras.find(e =>
                    year >= e.startYear && (!e.endYear || year <= e.endYear)
                );
                if (era) {
                    formattedYear = `${Math.abs(year)} ${era.abbreviation}`;
                }
            }

            return {
                year,
                formattedYear,
                events: yearEvents
            };
        });

        return {
            years,
            allEvents: sortedEvents,
            totalCount: sortedEvents.length,
            isLoaded: true
        };
    }, [events, calendar]);

    return data;
}

export default useTimelineEvents;
