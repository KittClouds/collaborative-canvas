import { describe, it, expect, beforeAll } from 'vitest';
import { temporalAhoMatcher } from '../TemporalAhoMatcher';

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
});
