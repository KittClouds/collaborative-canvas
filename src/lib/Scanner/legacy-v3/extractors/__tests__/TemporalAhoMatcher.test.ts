import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { temporalAhoMatcher } from '../TemporalAhoMatcher';

// Mock TimeRegistry for hydration tests
vi.mock('@/lib/time', () => ({
    TimeRegistry: {
        getCalendarDictionary: vi.fn(() => ({
            calendarId: 'cal_test',
            months: ['flob', 'flo', 'bork', 'bor', 'zam'],
            weekdays: ['sunfall', 'sun', 'moonrise', 'moo'],
            eras: ['first age', 'fa'],
            monthIndex: { 'flob': 0, 'flo': 0, 'bork': 1, 'bor': 1, 'zam': 2 },
            weekdayIndex: { 'sunfall': 0, 'sun': 0, 'moonrise': 1, 'moo': 1 },
            monthDays: { 'flob': 30, 'flo': 30, 'bork': 28, 'bor': 28, 'zam': 31 }
        }))
    }
}));

describe('TemporalAhoMatcher', () => {
    beforeAll(() => {
        temporalAhoMatcher.initialize();
    });

    describe('initialization', () => {
        it('should be initialized after init call', () => {
            expect(temporalAhoMatcher.isInitialized()).toBe(true);
        });

        it('should have correct pattern count', () => {
            const stats = temporalAhoMatcher.getStats();
            expect(stats.totalPatterns).toBeGreaterThan(100);
            console.log('[Test] Total patterns:', stats.totalPatterns);
            console.log('[Test] By kind:', stats.byKind);
        });
    });

    describe('weekday detection', () => {
        it('should detect full weekday names', () => {
            const result = temporalAhoMatcher.findMentions('We met on Monday and again on Friday');
            const weekdays = result.filter(m => m.kind === 'WEEKDAY');

            expect(weekdays.length).toBe(2);
            expect(weekdays[0].text.toLowerCase()).toBe('monday');
            expect(weekdays[0].metadata?.weekdayIndex).toBe(0);
            expect(weekdays[1].text.toLowerCase()).toBe('friday');
            expect(weekdays[1].metadata?.weekdayIndex).toBe(4);
        });

        it('should detect abbreviated weekdays', () => {
            const result = temporalAhoMatcher.findMentions('Meeting on Wed and Thu');
            const weekdays = result.filter(m => m.kind === 'WEEKDAY');

            expect(weekdays.length).toBe(2);
        });
    });

    describe('month detection', () => {
        it('should detect full month names', () => {
            const result = temporalAhoMatcher.findMentions('Born in January, died in December');
            const months = result.filter(m => m.kind === 'MONTH');

            expect(months.length).toBe(2);
            expect(months[0].metadata?.monthIndex).toBe(0);
            expect(months[1].metadata?.monthIndex).toBe(11);
        });
    });

    describe('narrative marker detection', () => {
        it('should detect chapter markers with numbers', () => {
            const result = temporalAhoMatcher.findMentions('In Chapter 5, the hero arrives');
            const markers = result.filter(m => m.kind === 'NARRATIVE_MARKER');

            expect(markers.length).toBe(1);
            expect(markers[0].text.toLowerCase()).toBe('chapter');
            expect(markers[0].metadata?.narrativeNumber).toBe(5);
        });

        it('should detect multiple narrative markers', () => {
            const result = temporalAhoMatcher.findMentions('Act 2, Scene 3: The confrontation');
            const markers = result.filter(m => m.kind === 'NARRATIVE_MARKER');

            expect(markers.length).toBe(2);
        });

        it('should detect prologue and epilogue', () => {
            const result = temporalAhoMatcher.findMentions('From the prologue to the epilogue');
            const markers = result.filter(m => m.kind === 'NARRATIVE_MARKER');

            expect(markers.length).toBe(2);
        });
    });

    describe('relative phrase detection', () => {
        it('should detect "later that day"', () => {
            const result = temporalAhoMatcher.findMentions('Later that day, they reunited');
            const relatives = result.filter(m => m.kind === 'RELATIVE');

            expect(relatives.length).toBe(1);
            expect(relatives[0].text.toLowerCase()).toBe('later that day');
        });

        it('should detect "the next morning"', () => {
            const result = temporalAhoMatcher.findMentions('The next morning brought clarity');
            const relatives = result.filter(m => m.kind === 'RELATIVE');

            expect(relatives.length).toBe(1);
            expect(relatives[0].text.toLowerCase()).toBe('the next morning');
        });

        it('should detect "meanwhile"', () => {
            const result = temporalAhoMatcher.findMentions('Meanwhile, in another castle...');
            const relatives = result.filter(m => m.kind === 'RELATIVE');

            expect(relatives.length).toBe(1);
            expect(relatives[0].text.toLowerCase()).toBe('meanwhile');
        });

        it('should detect multiple relative phrases', () => {
            const result = temporalAhoMatcher.findMentions(
                'Days later, they met again. Eventually, they became friends.'
            );
            const relatives = result.filter(m => m.kind === 'RELATIVE');

            expect(relatives.length).toBe(2);
        });
    });

    describe('time of day detection', () => {
        it('should detect basic times of day', () => {
            const result = temporalAhoMatcher.findMentions('From morning to night');
            const times = result.filter(m => m.kind === 'TIME_OF_DAY');

            expect(times.length).toBe(2);
        });

        it('should detect compound times', () => {
            const result = temporalAhoMatcher.findMentions('In the early morning, before sunrise');
            const times = result.filter(m => m.kind === 'TIME_OF_DAY');

            expect(times.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('connector detection', () => {
        it('should detect "before" and "after"', () => {
            const result = temporalAhoMatcher.findMentions('Before the storm and after the calm');
            const connectors = result.filter(m => m.kind === 'CONNECTOR');

            expect(connectors.length).toBe(2);
            expect(connectors[0].metadata?.direction).toBe('before');
            expect(connectors[1].metadata?.direction).toBe('after');
        });

        it('should detect "during"', () => {
            const result = temporalAhoMatcher.findMentions('During the battle, heroes emerged');
            const connectors = result.filter(m => m.kind === 'CONNECTOR');

            expect(connectors.length).toBe(1);
            expect(connectors[0].metadata?.direction).toBe('concurrent');
        });
    });

    describe('era detection', () => {
        it('should detect Third Age years', () => {
            const result = temporalAhoMatcher.findMentions('In the Third Age 3019 of the Sun');
            const eras = result.filter(m => m.kind === 'ERA');

            expect(eras.length).toBe(1);
            expect(eras[0].text.toLowerCase()).toBe('third age');
            expect(eras[0].metadata?.eraYear).toBe(3019);
        });

        it('should detect Years', () => {
            const result = temporalAhoMatcher.findMentions('The event happened in Year 2024');
            const eras = result.filter(m => m.kind === 'ERA');

            expect(eras.length).toBe(1);
            expect(eras[0].text.toLowerCase()).toBe('year');
            expect(eras[0].metadata?.eraYear).toBe(2024);
        });

        it('should detect Stardates', () => {
            const result = temporalAhoMatcher.findMentions('Captain\'s Log, Stardate 41254.7');
            const eras = result.filter(m => m.kind === 'ERA');

            expect(eras.length).toBe(1);
            expect(eras[0].text.toLowerCase()).toBe('stardate');
            expect(eras[0].metadata?.eraYear).toBe(41254.7);
        });

        it('should detect abstract eras with "of"', () => {
            const result = temporalAhoMatcher.findMentions('In the Age of 500 Kings');
            const eras = result.filter(m => m.kind === 'ERA');

            expect(eras.length).toBe(1);
            expect(eras[0].text.toLowerCase()).toBe('age of');
            expect(eras[0].metadata?.eraYear).toBe(500);
        });
    });

    describe('performance', () => {
        it('should scan text in under 5ms', () => {
            const text = `
        Chapter 1: The Beginning
        
        On Monday morning, before sunrise, the hero awoke. Later that day,
        he embarked on his journey. Meanwhile, in another kingdom, his rival
        plotted against him.
        
        The next morning brought challenges. During the battle, many fell.
        Eventually, by the time the sun set, victory was achieved.
        
        Chapter 2: The Return
        
        Weeks later, on a cold December evening, he returned home.
      `;

            const result = temporalAhoMatcher.scan(text);

            console.log('[Test] Scan time:', result.stats.scanTimeMs.toFixed(2), 'ms');
            console.log('[Test] Patterns matched:', result.stats.patternsMatched);

            expect(result.stats.scanTimeMs).toBeLessThan(5);
            expect(result.mentions.length).toBeGreaterThan(10);
        });

        it('should handle large text efficiently', () => {
            // Create 10KB of text
            const paragraph = `On Monday, the hero woke up. Later that day, after the battle, 
        he rested. The next morning, he continued. Meanwhile, others waited. `;
            const largeText = paragraph.repeat(100);

            const result = temporalAhoMatcher.scan(largeText);

            console.log('[Test] Large text scan time:', result.stats.scanTimeMs.toFixed(2), 'ms');
            console.log('[Test] Matches in large text:', result.stats.patternsMatched);

            // Should still be fast even with large text
            expect(result.stats.scanTimeMs).toBeLessThan(50);
        });
    });

    describe('deduplication', () => {
        it('should prefer longer matches over shorter overlapping ones', () => {
            const result = temporalAhoMatcher.findMentions('the next morning came');

            // Should have "the next morning", not just "morning"
            const hasFullPhrase = result.some(m =>
                m.text.toLowerCase().includes('next morning')
            );

            expect(hasFullPhrase).toBe(true);
        });
    });

    // ==================== HYDRATION TESTS ====================

    describe('hydration', () => {
        beforeEach(() => {
            // Reset to clean state before each hydration test
            temporalAhoMatcher.clearHydration();
        });

        afterEach(() => {
            // Clean up after hydration tests
            temporalAhoMatcher.clearHydration();
        });

        it('should have no active calendar before hydration', () => {
            expect(temporalAhoMatcher.getActiveCalendarId()).toBeNull();
        });

        it('should set active calendar ID after hydration', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            expect(temporalAhoMatcher.getActiveCalendarId()).toBe('cal_test');
        });

        it('should detect custom month names after hydration', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            const result = temporalAhoMatcher.findMentions('The battle occurred on Flob 5th');
            const months = result.filter(m => m.kind === 'MONTH');

            expect(months.length).toBe(1);
            expect(months[0].text.toLowerCase()).toBe('flob');
        });

        it('should detect custom weekday names after hydration', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            const result = temporalAhoMatcher.findMentions('It was Sunfall when they arrived');
            const weekdays = result.filter(m => m.kind === 'WEEKDAY');

            expect(weekdays.length).toBe(1);
            expect(weekdays[0].text.toLowerCase()).toBe('sunfall');
        });

        it('should return correct custom month index', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            expect(temporalAhoMatcher.getMonthIndex('flob')).toBe(0);
            expect(temporalAhoMatcher.getMonthIndex('bork')).toBe(1);
            expect(temporalAhoMatcher.getMonthIndex('zam')).toBe(2);
        });

        it('should return correct custom weekday index', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            expect(temporalAhoMatcher.getWeekdayIndex('sunfall')).toBe(0);
            expect(temporalAhoMatcher.getWeekdayIndex('moonrise')).toBe(1);
        });

        it('should fallback to Earth months when not hydrated', () => {
            // Before hydration, should use Earth indices
            expect(temporalAhoMatcher.getMonthIndex('january')).toBe(0);
            expect(temporalAhoMatcher.getMonthIndex('december')).toBe(11);
        });

        it('should still detect Earth months after hydration', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            // Earth months should still work as fallback
            const result = temporalAhoMatcher.findMentions('In January and February');
            const months = result.filter(m => m.kind === 'MONTH');

            expect(months.length).toBe(2);
        });
    });

    describe('validateDate', () => {
        beforeEach(() => {
            temporalAhoMatcher.clearHydration();
        });

        afterEach(() => {
            temporalAhoMatcher.clearHydration();
        });

        it('should return valid=true for days within month range', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            const result = temporalAhoMatcher.validateDate('Flob', 15);

            expect(result.valid).toBe(true);
            expect(result.maxDays).toBe(30);
        });

        it('should return valid=false for days exceeding month range', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            const result = temporalAhoMatcher.validateDate('Flob', 35);

            expect(result.valid).toBe(false);
            expect(result.maxDays).toBe(30);
        });

        it('should use 31 as default when not hydrated', () => {
            const result = temporalAhoMatcher.validateDate('SomeMonth', 15);

            expect(result.valid).toBe(true);
            expect(result.maxDays).toBe(31);
        });

        it('should validate edge case of day 1', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            const result = temporalAhoMatcher.validateDate('Bork', 1);

            expect(result.valid).toBe(true);
        });

        it('should validate edge case of max day', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            // Bork has 28 days
            expect(temporalAhoMatcher.validateDate('Bork', 28).valid).toBe(true);
            expect(temporalAhoMatcher.validateDate('Bork', 29).valid).toBe(false);
        });

        it('should handle case-insensitive month names', async () => {
            await temporalAhoMatcher.hydrate('cal_test');

            expect(temporalAhoMatcher.validateDate('FLOB', 15).valid).toBe(true);
            expect(temporalAhoMatcher.validateDate('flob', 15).valid).toBe(true);
            expect(temporalAhoMatcher.validateDate('Flob', 15).valid).toBe(true);
        });
    });

    describe('clearHydration', () => {
        it('should reset active calendar ID', async () => {
            await temporalAhoMatcher.hydrate('cal_test');
            expect(temporalAhoMatcher.getActiveCalendarId()).toBe('cal_test');

            temporalAhoMatcher.clearHydration();

            expect(temporalAhoMatcher.getActiveCalendarId()).toBeNull();
        });

        it('should reset to Earth month indices after clearing', async () => {
            await temporalAhoMatcher.hydrate('cal_test');
            expect(temporalAhoMatcher.getMonthIndex('flob')).toBe(0);

            temporalAhoMatcher.clearHydration();
            temporalAhoMatcher.initialize(); // Re-initialize with defaults

            expect(temporalAhoMatcher.getMonthIndex('flob')).toBeUndefined();
            expect(temporalAhoMatcher.getMonthIndex('january')).toBe(0);
        });
    });
});
