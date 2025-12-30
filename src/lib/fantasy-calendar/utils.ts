
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
    CalendarDefinition,
    FantasyDate,
    MonthDefinition,
    WeekdayDefinition,
    MoonDefinition,
    EraDefinition
} from "./types";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Get the total number of days in a specific year
 * Handles leap years
 */
export function getDaysInYear(calendar: CalendarDefinition, year: number): number {
    return calendar.months.reduce((total, month) => {
        return total + getDaysInMonth(month, year);
    }, 0);
}

/**
 * Get days in a specific month, accounting for leap years
 */
export function getDaysInMonth(month: MonthDefinition, year: number): number {
    if (!month.leapDayRule) return month.days;

    const rule = month.leapDayRule;

    // Simple interval check (every 4 years)
    if (year % rule.interval === 0) {
        // Exception check (unless divisible by 100)
        if (rule.unlessDivisibleBy && year % rule.unlessDivisibleBy === 0) {
            return month.days;
        }
        return month.days + rule.daysToAdd;
    }

    return month.days;
}

/**
 * Get the era for a given year
 * Searches eras by year range, falls back to default
 */
export function getEraForYear(calendar: CalendarDefinition, year: number): EraDefinition | undefined {
    // Find era that contains this year
    const matchingEra = calendar.eras.find(era => {
        const inStart = year >= era.startYear;
        const inEnd = era.endYear === undefined || year <= era.endYear;
        return inStart && inEnd;
    });

    return matchingEra || calendar.eras.find(e => e.id === calendar.defaultEraId);
}

/**
 * Format year with era abbreviation
 * Handles negative years as BCE-style (e.g., -500 displays as "500 BCE")
 */
export function formatYearWithEra(calendar: CalendarDefinition, year: number, eraId?: string): string {
    const era = eraId
        ? calendar.eras.find(e => e.id === eraId)
        : getEraForYear(calendar, year);

    if (!era) {
        return String(year);
    }

    // Handle negative years / descending eras
    if (era.isNegative || year < 0) {
        return `${Math.abs(year)} ${era.abbreviation}`;
    }

    return `${year} ${era.abbreviation}`;
}

/**
 * Navigate year with year-zero handling
 * Returns the next/previous year accounting for hasYearZero setting
 */
export function navigateYear(currentYear: number, direction: 'next' | 'prev', hasYearZero: boolean): number {
    const delta = direction === 'next' ? 1 : -1;
    let newYear = currentYear + delta;

    // Skip year 0 if calendar doesn't have it
    if (!hasYearZero && newYear === 0) {
        newYear = direction === 'next' ? 1 : -1;
    }

    return newYear;
}

/**
 * Calculate which weekday a specific date falls on
 * (Simplified algorithm assuming year 1, month 1, day 1 was weekday 0)
 */
export function getWeekdayIndex(calendar: CalendarDefinition, date: FantasyDate): number {
    let totalDays = 0;

    // Add days for full months in current year
    for (let m = 0; m < date.monthIndex; m++) {
        totalDays += getDaysInMonth(calendar.months[m], date.year);
    }

    // Add days in current month
    totalDays += date.dayIndex;

    return totalDays % calendar.weekdays.length;
}

/**
 * Calculate moon phase (0.0 to 1.0) for a specific date
 */
export function getMoonPhase(moon: MoonDefinition, calendar: CalendarDefinition, date: FantasyDate): number {
    let totalDays = 0;

    for (let m = 0; m < date.monthIndex; m++) {
        totalDays += calendar.months[m]?.days || 30;
    }
    totalDays += date.dayIndex;

    // Add phase offset
    const phase = ((totalDays / moon.cycleDays) + (moon.phaseOffset || 0)) % 1;
    return phase;
}

/**
 * Format a fantasy date string with era
 */
export function formatFantasyDate(calendar: CalendarDefinition, date: FantasyDate): string {
    const month = calendar.months[date.monthIndex];
    const yearStr = formatYearWithEra(calendar, date.year, date.eraId);

    return `${date.dayIndex + 1} ${month?.name || 'Unknown'}, ${yearStr}`;
}

export function generateUUID(): string {
    return crypto.randomUUID();
}

