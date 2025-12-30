import { useState, useCallback } from 'react';
import {
    CalendarDefinition,
    FantasyDate,
    CalendarEvent,
    OrbitalMechanics,
    MonthDefinition,
    EraDefinition,
    WeekdayDefinition,
    EpochDefinition,
    TimeMarker
} from '@/lib/fantasy-calendar/types';
import { generateOrbitalCalendar } from '@/lib/fantasy-calendar/orbital';
import { generateUUID } from '@/lib/fantasy-calendar/utils';

// Default settings for initial display
const DEFAULT_CALENDAR: CalendarDefinition = {
    id: 'cal_default',
    name: 'New World Calendar',
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
    weekdays: [
        { id: 'wd_1', index: 0, name: 'Day 1', shortName: 'D1' },
        { id: 'wd_2', index: 1, name: 'Day 2', shortName: 'D2' },
        { id: 'wd_3', index: 2, name: 'Day 3', shortName: 'D3' },
        { id: 'wd_4', index: 3, name: 'Day 4', shortName: 'D4' },
        { id: 'wd_5', index: 4, name: 'Day 5', shortName: 'D5' },
        { id: 'wd_6', index: 5, name: 'Day 6', shortName: 'D6' },
        { id: 'wd_7', index: 6, name: 'Day 7', shortName: 'D7' },
    ],
    months: [
        { id: 'mo_1', index: 0, name: 'Month 1', shortName: 'M1', days: 30 },
        { id: 'mo_2', index: 1, name: 'Month 2', shortName: 'M2', days: 30 },
        { id: 'mo_3', index: 2, name: 'Month 3', shortName: 'M3', days: 30 },
        { id: 'mo_4', index: 3, name: 'Month 4', shortName: 'M4', days: 30 },
        { id: 'mo_5', index: 4, name: 'Month 5', shortName: 'M5', days: 30 },
        { id: 'mo_6', index: 5, name: 'Month 6', shortName: 'M6', days: 30 },
        { id: 'mo_7', index: 6, name: 'Month 7', shortName: 'M7', days: 30 },
        { id: 'mo_8', index: 7, name: 'Month 8', shortName: 'M8', days: 30 },
        { id: 'mo_9', index: 8, name: 'Month 9', shortName: 'M9', days: 30 },
        { id: 'mo_10', index: 9, name: 'Month 10', shortName: 'M10', days: 30 },
        { id: 'mo_11', index: 10, name: 'Month 11', shortName: 'M11', days: 30 },
        { id: 'mo_12', index: 11, name: 'Month 12', shortName: 'M12', days: 35 },
    ],
    eras: [
        { id: 'era_1', name: 'Common Era', abbreviation: 'CE', startYear: 1, direction: 'ascending' }
    ],
    defaultEraId: 'era_1',
    epochs: [],
    timeMarkers: [],
    hasYearZero: false,
    moons: [
        { id: 'moon_1', name: 'Luna', cycleDays: 28, color: '#e2e8f0' }
    ],
    seasons: [],
    createdFrom: 'manual'
};

// Configuration passed from the wizard
export interface CalendarConfig {
    name: string;
    startingYear: number;
    eraName: string;
    eraAbbreviation: string;
    monthNames: string[];
    weekdayNames: string[];
    orbitalMechanics?: OrbitalMechanics;
    // Advanced timeline options
    eras?: EraDefinition[];
    epochs?: EpochDefinition[];
    timeMarkers?: TimeMarker[];
    hasYearZero?: boolean;
}

export function useFantasyCalendar(initialId?: string) {
    const [calendar, setCalendar] = useState<CalendarDefinition>(DEFAULT_CALENDAR);

    // Current view date (for navigation)
    const [viewDate, setViewDate] = useState<FantasyDate>({
        year: 1,
        monthIndex: 0,
        dayIndex: 0,
        eraId: 'era_1'
    });

    // Events state
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    // Create new calendar from wizard config
    const createCalendar = useCallback((config: CalendarConfig) => {
        const calId = generateUUID();
        const eraId = generateUUID();

        // Calculate days per month if orbital was used
        let months: MonthDefinition[];
        if (config.orbitalMechanics) {
            const calculated = generateOrbitalCalendar(config.orbitalMechanics);
            const monthCount = config.monthNames.length || 12;
            const daysPerMonth = Math.floor(calculated.daysPerYear / monthCount);

            months = config.monthNames.map((name, i) => ({
                id: generateUUID(),
                index: i,
                name: name || `Month ${i + 1}`,
                shortName: name?.substring(0, 3) || `M${i + 1}`,
                days: daysPerMonth
            }));

            // Distribute remainder days
            let remainder = calculated.daysPerYear % monthCount;
            let m = 0;
            while (remainder > 0) {
                months[m].days++;
                remainder--;
                m++;
            }
        } else {
            // Manual mode - use provided names with default 30 days each
            months = config.monthNames.map((name, i) => ({
                id: generateUUID(),
                index: i,
                name: name || `Month ${i + 1}`,
                shortName: name?.substring(0, 3) || `M${i + 1}`,
                days: 30
            }));
        }

        const era: EraDefinition = {
            id: eraId,
            name: config.eraName || 'Common Era',
            abbreviation: config.eraAbbreviation || 'CE',
            startYear: 0,
            direction: 'ascending'
        };

        // Build weekdays from config
        const weekdays: WeekdayDefinition[] = (config.weekdayNames || []).map((name, i) => ({
            id: generateUUID(),
            index: i,
            name: name || `Day ${i + 1}`,
            shortName: name?.substring(0, 3) || `D${i + 1}`
        }));

        // Fallback if no weekdays provided
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

        // Use provided eras or create default
        const eras: EraDefinition[] = config.eras && config.eras.length > 0
            ? config.eras
            : [era];

        const defaultEra = eras.find(e => e.id === eraId) || eras[0];

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

        setCalendar(newCalendar);

        // Reset view to starting year
        setViewDate({
            year: config.startingYear || 1,
            monthIndex: 0,
            dayIndex: 0,
            eraId: eraId
        });

        // Clear events for new calendar
        setEvents([]);

        return newCalendar;
    }, []);

    // Legacy orbital update (kept for compatibility)
    const updateOrbitalSettings = useCallback((mechanics: OrbitalMechanics) => {
        const calculated = generateOrbitalCalendar(mechanics);
        const monthCount = 12;
        const daysPerMonth = Math.floor(calculated.daysPerYear / monthCount);

        const newMonths: MonthDefinition[] = Array.from({ length: monthCount }).map((_, i) => ({
            id: generateUUID(),
            index: i,
            name: `Month ${i + 1}`,
            shortName: `M${i + 1}`,
            days: daysPerMonth
        }));

        let remainder = calculated.daysPerYear % monthCount;
        let m = 0;
        while (remainder > 0) {
            newMonths[m].days++;
            remainder--;
            m++;
        }

        setCalendar(prev => ({
            ...prev,
            createdFrom: 'orbital',
            orbitalMechanics: mechanics,
            months: newMonths
        }));
    }, []);

    const navigateMonth = useCallback((direction: 'prev' | 'next') => {
        setViewDate(current => {
            let newMonth = current.monthIndex + (direction === 'next' ? 1 : -1);
            let newYear = current.year;

            if (newMonth >= calendar.months.length) {
                newMonth = 0;
                newYear++;
            } else if (newMonth < 0) {
                newMonth = calendar.months.length - 1;
                newYear--;
            }

            return {
                ...current,
                monthIndex: newMonth,
                year: newYear
            };
        });
    }, [calendar.months.length]);

    const navigateYear = useCallback((direction: 'prev' | 'next') => {
        setViewDate(current => ({
            ...current,
            year: current.year + (direction === 'next' ? 1 : -1)
        }));
    }, []);

    const addEvent = useCallback((event: CalendarEvent) => {
        setEvents(prev => [...prev, event]);
    }, []);

    return {
        calendar,
        setCalendar,
        viewDate,
        setViewDate,
        events,
        createCalendar,
        updateOrbitalSettings,
        navigateMonth,
        navigateYear,
        addEvent
    };
}
