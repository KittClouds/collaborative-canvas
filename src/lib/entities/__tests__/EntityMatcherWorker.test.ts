/**
 * Test parallel entity matching performance
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { entityRegistry } from '../entity-registry';
import { getWinkProcessor } from '../nlp/WinkProcessor';
import { findEntityMentionsParallel } from '../documentScanner';
import { AhoCorasickMatcher } from '../workers/EntityMatcherWorker';

describe('EntityMatcherWorker Performance', () => {
    it('should match multiple patterns using Aho-Corasick algorithm', () => {
        const matcher = new AhoCorasickMatcher();
        matcher.build([
            { id: '1', label: 'Apple', aliases: ['MacBook'] },
            { id: '2', label: 'Orange', aliases: [] },
            { id: '3', label: 'Pineapple', aliases: [] }
        ]);

        const text = "I have an Apple, a MacBook, and a Pineapple. But no Orange.";
        const matches = matcher.search(text);

        // Should find:
        // 1. Apple (id: 1)
        // 2. MacBook (id: 1)
        // 3. Pineapple (id: 3)
        // 4. Orange (id: 2)

        expect(matches).toHaveLength(4);
        expect(matches.some(m => m.entityId === '1' && m.term === 'apple')).toBe(true);
        expect(matches.some(m => m.entityId === '1' && m.term === 'macbook')).toBe(true);
        expect(matches.some(m => m.entityId === '3' && m.term === 'pineapple')).toBe(true);
        expect(matches.some(m => m.entityId === '2' && m.term === 'orange')).toBe(true);
    });
    beforeAll(() => {
        // Seed registry with test entities
        for (let i = 0; i < 100; i++) { // Using 100 instead of 1000 for faster test run
            entityRegistry.registerEntity(
                `Entity${i}`,
                'CONCEPT' as any,
                'test-note',
                {
                    aliases: [`Alias${i}A`, `Alias${i}B`]
                }
            );
        }
    });

    it('should match entities', async () => {
        const testText = `
      Entity0 and Entity1 are related.
      Alias2A appeared with Entity3.
      This is Entity99 in the final sentence.
    `.repeat(2);

        const wink = getWinkProcessor();
        const analysis = wink.analyze(testText);

        const startTime = performance.now();
        const mentions = await findEntityMentionsParallel(
            analysis.sentences,
            testText
        );
        const duration = performance.now() - startTime;

        console.log(`Parallel matching: ${mentions.length} mentions in ${duration}ms`);

        expect(mentions.length).toBeGreaterThan(0);
    });
});
