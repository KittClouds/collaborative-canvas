/**
 * TemporalAhoMatcher - Pure Aho-Corasick temporal pattern detection
 * 
 * Detects temporal expressions in O(n) time using a comprehensive dictionary.
 * No NLP libraries - just fast pattern matching via AllProfanity's Trie engine.
 * 
 * Categories:
 * - Weekdays (monday, tue, etc.)
 * - Months (january, jan, etc.)
 * - Narrative markers (chapter, scene, act, etc.)
 * - Relative phrases (later that day, the next morning, etc.)
 * - Time of day (morning, dusk, midnight, etc.)
 * - Temporal connectors (before, after, during, etc.)
 * 
 * @module scanner-v3/extractors
 */

import { AllProfanity } from 'allprofanity';
import { TimeRegistry, type CalendarDictionary } from '@/lib/time';

// ==================== TYPE DEFINITIONS ====================

export type TemporalKind =
    | 'WEEKDAY'
    | 'MONTH'
    | 'TIME_OF_DAY'
    | 'NARRATIVE_MARKER'
    | 'RELATIVE'
    | 'CONNECTOR'
    | 'ERA';

export interface TemporalMention {
    kind: TemporalKind;
    text: string;
    start: number;
    end: number;
    confidence: number;
    metadata?: {
        weekdayIndex?: number;    // 0=Mon...6=Sun
        monthIndex?: number;      // 0=Jan...11=Dec
        narrativeNumber?: number; // Extracted from "Chapter 5"
        direction?: 'before' | 'after' | 'concurrent';
        eraYear?: number;         // Extracted from "Third Age 3019"
        eraName?: string;         // "Third Age", "AD", etc.
    };
}

export interface TemporalScanResult {
    mentions: TemporalMention[];
    stats: {
        patternsMatched: number;
        scanTimeMs: number;
    };
}

// ==================== COMPREHENSIVE DICTIONARY ====================

// Weekdays (14 entries)
const WEEKDAYS = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
];

const WEEKDAY_INDEX: Record<string, number> = {
    'monday': 0, 'mon': 0,
    'tuesday': 1, 'tue': 1,
    'wednesday': 2, 'wed': 2,
    'thursday': 3, 'thu': 3,
    'friday': 4, 'fri': 4,
    'saturday': 5, 'sat': 5,
    'sunday': 6, 'sun': 6,
};

// Months (24 entries)
const MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

const MONTH_INDEX: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
};

// Narrative Markers (12 entries)
const NARRATIVE_MARKERS = [
    'chapter', 'ch.', 'scene', 'act', 'part', 'book',
    'episode', 'ep.', 'sequence', 'prologue', 'epilogue', 'interlude'
];

// Relative Time Phrases (~50 entries)
const RELATIVE_PHRASES = [
    // Same-day progressions
    'later that day', 'later that night', 'later that evening', 'later that morning',
    'that morning', 'that afternoon', 'that evening', 'that night',
    'earlier that day', 'earlier that morning', 'earlier that evening',

    // Next period
    'the next day', 'the next morning', 'the next evening', 'the next night',
    'the next week', 'the next month', 'the next year',
    'next morning', 'next evening', 'next night', 'next week', 'next month', 'next year',

    // Following period
    'the following day', 'the following morning', 'the following evening',
    'the following week', 'the following month', 'the following year',

    // Previous period  
    'the previous day', 'the previous morning', 'the previous evening',
    'the day before', 'the night before', 'the week before',

    // Concurrent markers
    'meanwhile', 'at the same time', 'simultaneously', 'in the meantime',
    'at that moment', 'at that very moment', 'just then',

    // Progression markers
    'moments later', 'hours later', 'days later', 'weeks later', 'months later', 'years later',
    'a moment later', 'an hour later', 'a day later', 'a week later', 'a month later', 'a year later',
    'some time later', 'shortly after', 'shortly before',

    // Vague/abstract temporal
    'long ago', 'once upon a time', 'in the beginning', 'at the end',
    'eventually', 'soon', 'finally', 'at last', 'in time',
    'ages ago', 'not long after', 'before long'
];

// Time of Day (20 entries)
const TIME_OF_DAY = [
    'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon', 'midday',
    'dawn', 'dusk', 'twilight', 'sunrise', 'sunset', 'nightfall', 'daybreak',
    'early morning', 'late morning', 'early afternoon', 'late afternoon',
    'late evening', 'late night'
];

// Temporal Connectors (25 entries)
const TEMPORAL_CONNECTORS = [
    'before', 'after', 'during', 'while', 'when', 'until', 'since',
    'prior to', 'following', 'preceding', 'throughout',
    'at the start of', 'at the end of', 'in the middle of',
    'by the time', 'as soon as', 'just before', 'just after',
    'right before', 'right after', 'immediately after', 'immediately before',
    'long before', 'long after', 'ever since'
];

// Direction mapping for connectors
const CONNECTOR_DIRECTION: Record<string, 'before' | 'after' | 'concurrent'> = {
    'before': 'before', 'prior to': 'before', 'preceding': 'before',
    'just before': 'before', 'right before': 'before', 'immediately before': 'before',
    'long before': 'before',

    'after': 'after', 'following': 'after',
    'just after': 'after', 'right after': 'after', 'immediately after': 'after',
    'long after': 'after', 'ever since': 'after',

    'during': 'concurrent', 'while': 'concurrent', 'throughout': 'concurrent',
    'in the middle of': 'concurrent',
};

// Era Markers
const ERA_MARKERS = [
    'third age', 'second age', 'first age', 'fourth age', 'fifth age',
    'year', 'stardate', 'epoch', 'era', 'age of', 'millennium',
    'ad', 'bc', 'bce', 'ce', 'a.d.', 'b.c.', 'b.c.e.', 'c.e.'
];

// ==================== MAIN CLASS ====================

/**
 * Aho-Corasick based temporal pattern matcher
 * 
 * Uses AllProfanity's optimized Trie engine with a 126+ pattern dictionary
 * for O(n) temporal detection regardless of dictionary size.
 */
class TemporalAhoMatcher {
    private filter: AllProfanity;
    private patternKinds: Map<string, TemporalKind> = new Map();
    private initialized = false;

    // Calendar-specific state for hydration
    private calendarDictionary: CalendarDictionary | null = null;
    private activeCalendarId: string | null = null;
    private customMonthIndex: Record<string, number> = {};
    private customWeekdayIndex: Record<string, number> = {};
    private customMonthDays: Record<string, number> = {};

    constructor() {
        // Lazy initialization
    }

    /**
     * Initialize the matcher with the temporal dictionary
     * Called automatically on first use
     */
    initialize(): void {
        if (this.initialized) return;

        const allPatterns: string[] = [];

        // Register all patterns with their kinds
        for (const p of WEEKDAYS) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'WEEKDAY');
        }
        for (const p of MONTHS) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'MONTH');
        }
        for (const p of NARRATIVE_MARKERS) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'NARRATIVE_MARKER');
        }
        for (const p of RELATIVE_PHRASES) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'RELATIVE');
        }
        for (const p of TIME_OF_DAY) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'TIME_OF_DAY');
        }
        for (const p of TEMPORAL_CONNECTORS) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'CONNECTOR');
        }
        for (const p of ERA_MARKERS) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'ERA');
        }

        // Build the Aho-Corasick automaton with explicit config
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.filter = new AllProfanity({
            algorithm: {
                matching: 'aho-corasick',
            },
        } as any);

        // Clear default dictionary and add our temporal patterns
        this.filter.clearList();
        if (allPatterns.length > 0) {
            this.filter.add(allPatterns);
        }

        console.log(`[TemporalAho] Initialized with ${allPatterns.length} temporal patterns`);
        this.initialized = true;
    }

    /**
     * Check if matcher is ready
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get the active calendar ID (if hydrated)
     */
    getActiveCalendarId(): string | null {
        return this.activeCalendarId;
    }

    /**
     * Hydrate the matcher with custom calendar terms from CozoDB
     * This adds calendar-specific months, weekdays, and eras to the detection dictionary
     */
    async hydrate(calendarId: string): Promise<void> {
        console.log('[TemporalAho] Hydrating with calendar:', calendarId);

        const dictionary = TimeRegistry.getCalendarDictionary(calendarId);

        if (dictionary.months.length === 0 && dictionary.weekdays.length === 0) {
            console.log('[TemporalAho] No time units found for calendar, using defaults');
            return;
        }

        this.calendarDictionary = dictionary;
        this.activeCalendarId = calendarId;
        this.customMonthIndex = dictionary.monthIndex;
        this.customWeekdayIndex = dictionary.weekdayIndex;
        this.customMonthDays = dictionary.monthDays;

        // Reset and rebuild with custom + default patterns
        this.initialized = false;
        this.patternKinds.clear();
        this.initializeWithDictionary(dictionary);

        console.log('[TemporalAho] Hydrated with', dictionary.months.length, 'months,',
            dictionary.weekdays.length, 'weekdays,', dictionary.eras.length, 'eras');
    }

    /**
     * Initialize with a custom dictionary (custom months, weekdays, eras)
     */
    private initializeWithDictionary(dictionary: CalendarDictionary): void {
        if (this.initialized) return;

        const allPatterns: string[] = [];

        // Add custom calendar patterns FIRST (higher priority)
        for (const month of dictionary.months) {
            if (month && !allPatterns.includes(month)) {
                allPatterns.push(month);
                this.patternKinds.set(month.toLowerCase(), 'MONTH');
            }
        }

        for (const weekday of dictionary.weekdays) {
            if (weekday && !allPatterns.includes(weekday)) {
                allPatterns.push(weekday);
                this.patternKinds.set(weekday.toLowerCase(), 'WEEKDAY');
            }
        }

        for (const era of dictionary.eras) {
            if (era && !allPatterns.includes(era)) {
                allPatterns.push(era);
                this.patternKinds.set(era.toLowerCase(), 'ERA');
            }
        }

        // Then add the hardcoded patterns (fallback for universal terms)
        // Skip if they conflict with custom patterns
        for (const p of WEEKDAYS) {
            if (!this.patternKinds.has(p.toLowerCase())) {
                allPatterns.push(p);
                this.patternKinds.set(p.toLowerCase(), 'WEEKDAY');
            }
        }
        for (const p of MONTHS) {
            if (!this.patternKinds.has(p.toLowerCase())) {
                allPatterns.push(p);
                this.patternKinds.set(p.toLowerCase(), 'MONTH');
            }
        }
        for (const p of NARRATIVE_MARKERS) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'NARRATIVE_MARKER');
        }
        for (const p of RELATIVE_PHRASES) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'RELATIVE');
        }
        for (const p of TIME_OF_DAY) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'TIME_OF_DAY');
        }
        for (const p of TEMPORAL_CONNECTORS) {
            allPatterns.push(p);
            this.patternKinds.set(p.toLowerCase(), 'CONNECTOR');
        }
        for (const p of ERA_MARKERS) {
            if (!this.patternKinds.has(p.toLowerCase())) {
                allPatterns.push(p);
                this.patternKinds.set(p.toLowerCase(), 'ERA');
            }
        }

        // Build the Aho-Corasick automaton
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.filter = new AllProfanity({
            algorithm: {
                matching: 'aho-corasick',
            },
        } as any);

        this.filter.clearList();
        if (allPatterns.length > 0) {
            this.filter.add(allPatterns);
        }

        console.log(`[TemporalAho] Initialized with ${allPatterns.length} temporal patterns (including custom)`);
        this.initialized = true;
    }

    /**
     * Validate a detected date against calendar physics
     * Returns whether the day number is valid for the given month
     */
    validateDate(monthName: string, day: number): { valid: boolean; maxDays: number } {
        if (!this.activeCalendarId) {
            // No calendar hydrated, use generic validation
            return { valid: day >= 1 && day <= 31, maxDays: 31 };
        }

        const normalized = monthName.toLowerCase().trim();
        const maxDays = this.customMonthDays[normalized];

        if (maxDays === undefined) {
            // Unknown month in this calendar, assume valid with 31 day max
            return { valid: day >= 1 && day <= 31, maxDays: 31 };
        }

        return {
            valid: day >= 1 && day <= maxDays,
            maxDays
        };
    }

    /**
     * Get custom month index (for calendar-aware ordering)
     * Returns undefined if month not found in active calendar
     */
    getMonthIndex(monthName: string): number | undefined {
        const normalized = monthName.toLowerCase().trim();

        // Check custom calendar first
        if (this.customMonthIndex[normalized] !== undefined) {
            return this.customMonthIndex[normalized];
        }

        // Fall back to hardcoded Earth months
        return MONTH_INDEX[normalized];
    }

    /**
     * Get custom weekday index (for calendar-aware ordering)
     * Returns undefined if weekday not found in active calendar
     */
    getWeekdayIndex(weekdayName: string): number | undefined {
        const normalized = weekdayName.toLowerCase().trim();

        // Check custom calendar first
        if (this.customWeekdayIndex[normalized] !== undefined) {
            return this.customWeekdayIndex[normalized];
        }

        // Fall back to hardcoded Earth weekdays
        return WEEKDAY_INDEX[normalized];
    }

    /**
     * Clear hydration state (revert to defaults)
     */
    clearHydration(): void {
        this.calendarDictionary = null;
        this.activeCalendarId = null;
        this.customMonthIndex = {};
        this.customWeekdayIndex = {};
        this.customMonthDays = {};
        this.initialized = false;
        this.patternKinds.clear();
        console.log('[TemporalAho] Cleared hydration, will use defaults on next scan');
    }

    /**
     * Find all temporal mentions in text
     * 
     * @param text - Text to scan
     * @returns Array of temporal mentions with positions and metadata
     */
    findMentions(text: string): TemporalMention[] {
        if (!this.initialized) this.initialize();

        const mentions: TemporalMention[] = [];

        // Get all matches from AllProfanity using detect()
        const result = this.filter.detect(text);

        if (!result.hasProfanity || !result.positions) {
            return mentions;
        }

        for (const pos of result.positions) {
            const matchedWord = pos.word.toLowerCase();
            const kind = this.patternKinds.get(matchedWord);

            if (!kind) continue;

            const mention: TemporalMention = {
                kind,
                text: text.slice(pos.start, pos.end),
                start: pos.start,
                end: pos.end,
                confidence: this.getConfidence(kind),
                metadata: this.extractMetadata(matchedWord, kind, text, pos.end)
            };

            mentions.push(mention);
        }

        // Sort by position, dedupe overlapping (keep longer match)
        return this.dedupeOverlapping(mentions);
    }

    /**
     * Scan text and return structured result with stats
     */
    scan(text: string): TemporalScanResult {
        const start = performance.now();
        const mentions = this.findMentions(text);

        return {
            mentions,
            stats: {
                patternsMatched: mentions.length,
                scanTimeMs: performance.now() - start
            }
        };
    }

    /**
     * Get confidence score based on temporal kind
     */
    private getConfidence(kind: TemporalKind): number {
        switch (kind) {
            case 'NARRATIVE_MARKER': return 0.95;
            case 'WEEKDAY': return 0.90;
            case 'MONTH': return 0.90;
            case 'TIME_OF_DAY': return 0.85;
            case 'RELATIVE': return 0.80;
            case 'CONNECTOR': return 0.70;
            case 'ERA': return 0.90;
            default: return 0.75;
        }
    }

    /**
     * Extract additional metadata based on pattern type
     */
    private extractMetadata(
        pattern: string,
        kind: TemporalKind,
        fullText: string,
        endPos: number
    ): TemporalMention['metadata'] {
        const metadata: TemporalMention['metadata'] = {};

        // Weekday index - check custom calendar first, then fallback
        if (kind === 'WEEKDAY') {
            const idx = this.getWeekdayIndex(pattern);
            if (idx !== undefined) {
                metadata.weekdayIndex = idx;
            }
        }

        // Month index - check custom calendar first, then fallback
        if (kind === 'MONTH') {
            const idx = this.getMonthIndex(pattern);
            if (idx !== undefined) {
                metadata.monthIndex = idx;
            }
        }

        // Narrative number (e.g., "Chapter 5" → 5)
        if (kind === 'NARRATIVE_MARKER') {
            const after = fullText.slice(endPos, endPos + 15);
            const numMatch = after.match(/^\s*(\d+)/);
            if (numMatch) {
                metadata.narrativeNumber = parseInt(numMatch[1], 10);
            }
        }

        // Connector direction
        if (kind === 'CONNECTOR' && pattern in CONNECTOR_DIRECTION) {
            metadata.direction = CONNECTOR_DIRECTION[pattern];
        }

        // Era year
        if (kind === 'ERA') {
            metadata.eraName = pattern;
            // Look ahead for a year number (e.g. "Third Age 3019" or "Year 2024")
            // Can be "of 3019", " in 3019", or just " 3019"
            const after = fullText.slice(endPos, endPos + 20);
            const numMatch = after.match(/^(?:\s+(?:of|in))?\s*(\d+(?:\.\d+)?)/i);
            if (numMatch) {
                metadata.eraYear = parseFloat(numMatch[1]);
            }
        }

        return Object.keys(metadata).length > 0 ? metadata : undefined;
    }

    /**
     * Remove overlapping mentions, keeping longer matches
     */
    private dedupeOverlapping(mentions: TemporalMention[]): TemporalMention[] {
        if (mentions.length === 0) return [];

        // Sort by start position, then by length (longer first)
        mentions.sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start;
            return (b.end - b.start) - (a.end - a.start);
        });

        const result: TemporalMention[] = [mentions[0]];

        for (let i = 1; i < mentions.length; i++) {
            const current = mentions[i];
            const last = result[result.length - 1];

            // Check overlap
            if (current.start >= last.end) {
                // No overlap
                result.push(current);
            } else if ((current.end - current.start) > (last.end - last.start)) {
                // Current is longer, replace last
                result[result.length - 1] = current;
            }
            // Otherwise skip (last is longer or equal)
        }

        return result;
    }

    /**
     * Get dictionary statistics
     */
    getStats(): { totalPatterns: number; byKind: Record<TemporalKind, number> } {
        const byKind: Record<TemporalKind, number> = {
            WEEKDAY: WEEKDAYS.length,
            MONTH: MONTHS.length,
            NARRATIVE_MARKER: NARRATIVE_MARKERS.length,
            RELATIVE: RELATIVE_PHRASES.length,
            TIME_OF_DAY: TIME_OF_DAY.length,
            CONNECTOR: TEMPORAL_CONNECTORS.length,
            ERA: ERA_MARKERS.length,
        };

        return {
            totalPatterns: Object.values(byKind).reduce((a, b) => a + b, 0),
            byKind
        };
    }
}

// ==================== SINGLETON ====================

export const temporalAhoMatcher = new TemporalAhoMatcher();
