/**
 * TimeRegistry - Read API for Time Units
 * 
 * Provides:
 * - getMonths(calendarId) -> ordered list
 * - getWeekdays(calendarId) -> ordered list
 * - validateDate(calendarId, monthName, day) -> { valid, maxDays }
 * - getCalendarDictionary(calendarId) -> for scanner hydration
 */

import { cozoDb } from '@/lib/cozo/db';
import { TIME_UNIT_QUERIES, TimeUnitType } from '@/lib/cozo/schema/layer2-time-registry';

export interface MonthInfo {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    index: number;
    daysInUnit: number;
}

export interface WeekdayInfo {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    index: number;
}

export interface EraInfo {
    id: string;
    name: string;
    normalizedName: string;
    abbreviation?: string;
    index: number;
    direction: 'ascending' | 'descending';
    startYear?: number;
    endYear?: number;
}

export interface DateValidation {
    valid: boolean;
    maxDays: number;
    monthName: string;
}

export interface CalendarDictionary {
    calendarId: string;
    months: string[];
    weekdays: string[];
    eras: string[];
    monthIndex: Record<string, number>;
    weekdayIndex: Record<string, number>;
    monthDays: Record<string, number>;
}

class TimeRegistryImpl {
    /**
     * Get all months for a calendar, ordered by index
     */
    getMonths(calendarId: string): MonthInfo[] {
        if (!cozoDb.isReady()) return [];

        try {
            const result = cozoDb.runQuery(TIME_UNIT_QUERIES.getMonthsByCalendar, {
                calendar_id: calendarId
            });

            if (!result.ok || !result.rows) return [];

            return result.rows.map((row: any[]) => ({
                id: row[0],
                name: row[1],
                normalizedName: row[2],
                shortName: row[3] ?? undefined,
                index: row[4],
                daysInUnit: row[5] ?? 30
            }));
        } catch (err) {
            console.error('[TimeRegistry] getMonths failed:', err);
            return [];
        }
    }

    /**
     * Get all weekdays for a calendar, ordered by index
     */
    getWeekdays(calendarId: string): WeekdayInfo[] {
        if (!cozoDb.isReady()) return [];

        try {
            const result = cozoDb.runQuery(TIME_UNIT_QUERIES.getWeekdaysByCalendar, {
                calendar_id: calendarId
            });

            if (!result.ok || !result.rows) return [];

            return result.rows.map((row: any[]) => ({
                id: row[0],
                name: row[1],
                normalizedName: row[2],
                shortName: row[3] ?? undefined,
                index: row[4]
            }));
        } catch (err) {
            console.error('[TimeRegistry] getWeekdays failed:', err);
            return [];
        }
    }

    /**
     * Get all eras for a calendar
     */
    getEras(calendarId: string): EraInfo[] {
        if (!cozoDb.isReady()) return [];

        try {
            const result = cozoDb.runQuery(TIME_UNIT_QUERIES.getErasByCalendar, {
                calendar_id: calendarId
            });

            if (!result.ok || !result.rows) return [];

            return result.rows.map((row: any[]) => ({
                id: row[0],
                name: row[1],
                normalizedName: row[2],
                abbreviation: row[3] ?? undefined,
                index: row[4],
                direction: (row[5] as 'ascending' | 'descending') ?? 'ascending',
                startYear: row[6] ?? undefined,
                endYear: row[7] ?? undefined
            }));
        } catch (err) {
            console.error('[TimeRegistry] getEras failed:', err);
            return [];
        }
    }

    /**
     * Validate a day number against a month's physics
     */
    validateDate(calendarId: string, monthName: string, day: number): DateValidation {
        const normalized = monthName.toLowerCase().trim();

        if (!cozoDb.isReady()) {
            return { valid: true, maxDays: 31, monthName: monthName };
        }

        try {
            const result = cozoDb.runQuery(TIME_UNIT_QUERIES.findByName, {
                normalized_name: normalized,
                calendar_id: calendarId
            });

            if (!result.ok || !result.rows || result.rows.length === 0) {
                return { valid: true, maxDays: 31, monthName: monthName }; // Unknown month, assume valid
            }

            const row = result.rows[0];
            const daysInUnit = row[5] ?? 30;

            return {
                valid: day >= 1 && day <= daysInUnit,
                maxDays: daysInUnit,
                monthName: row[3] // The original name
            };
        } catch (err) {
            console.error('[TimeRegistry] validateDate failed:', err);
            return { valid: true, maxDays: 31, monthName: monthName };
        }
    }

    /**
     * Build a dictionary for the temporal scanner
     */
    getCalendarDictionary(calendarId: string): CalendarDictionary {
        const months = this.getMonths(calendarId);
        const weekdays = this.getWeekdays(calendarId);
        const eras = this.getEras(calendarId);

        const monthIndex: Record<string, number> = {};
        const weekdayIndex: Record<string, number> = {};
        const monthDays: Record<string, number> = {};

        const monthTerms: string[] = [];
        const weekdayTerms: string[] = [];
        const eraTerms: string[] = [];

        for (const m of months) {
            // Add normalized name
            monthIndex[m.normalizedName] = m.index;
            monthDays[m.normalizedName] = m.daysInUnit;
            monthTerms.push(m.normalizedName);

            // Add short name variant
            if (m.shortName) {
                const shortNorm = m.shortName.toLowerCase();
                monthIndex[shortNorm] = m.index;
                monthDays[shortNorm] = m.daysInUnit;
                monthTerms.push(shortNorm);
            }
        }

        for (const w of weekdays) {
            weekdayIndex[w.normalizedName] = w.index;
            weekdayTerms.push(w.normalizedName);

            if (w.shortName) {
                const shortNorm = w.shortName.toLowerCase();
                weekdayIndex[shortNorm] = w.index;
                weekdayTerms.push(shortNorm);
            }
        }

        for (const e of eras) {
            eraTerms.push(e.normalizedName);
            if (e.abbreviation) {
                eraTerms.push(e.abbreviation.toLowerCase());
            }
        }

        return {
            calendarId,
            months: monthTerms,
            weekdays: weekdayTerms,
            eras: eraTerms,
            monthIndex,
            weekdayIndex,
            monthDays
        };
    }

    /**
     * Check if a calendar has any registered time units
     */
    hasTimeUnits(calendarId: string): boolean {
        const months = this.getMonths(calendarId);
        return months.length > 0;
    }
}

export const TimeRegistry = new TimeRegistryImpl();
