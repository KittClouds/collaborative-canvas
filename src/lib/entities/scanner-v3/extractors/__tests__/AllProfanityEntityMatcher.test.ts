import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AllProfanityEntityMatcher } from '../AllProfanityEntityMatcher';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';

describe('AllProfanityEntityMatcher', () => {
    let matcher: AllProfanityEntityMatcher;

    // Helper to create properly typed mock entities
    const createMockEntity = (
        id: string,
        label: string,
        kind: string,
        aliases: string[] = []
    ): RegisteredEntity => ({
        id,
        label,
        aliases,
        kind: kind as any,
        firstNote: 'note-1',
        mentionsByNote: new Map(),
        totalMentions: 0,
        lastSeenDate: new Date(),
        createdAt: new Date(),
        createdBy: 'user',
    });

    // Mock entities for testing
    const mockEntities: RegisteredEntity[] = [
        createMockEntity('1', 'Frodo Baggins', 'CHARACTER', ['Frodo', 'Ring-bearer']),
        createMockEntity('2', 'Gandalf', 'CHARACTER', ['Mithrandir', 'Grey Pilgrim']),
        createMockEntity('3', 'Mordor', 'LOCATION', ['Black Land']),
        createMockEntity('4', 'The One Ring', 'ITEM', ['Isildur\'s Bane']),
        createMockEntity('5', 'Shire', 'LOCATION'),
    ];

    beforeEach(() => {
        matcher = new AllProfanityEntityMatcher({
            enableCaching: true,
            cacheSize: 100,
            enableLeetSpeak: true,
        });
    });

    describe('initialization', () => {
        it('should not be initialized before calling initialize()', () => {
            expect(matcher.isInitialized()).toBe(false);
        });

        it('should be initialized after calling initialize()', () => {
            matcher.initialize(mockEntities);
            expect(matcher.isInitialized()).toBe(true);
        });

        it('should handle empty entity list', () => {
            matcher.initialize([]);
            expect(matcher.isInitialized()).toBe(true);
        });

        it('should skip entities with labels shorter than 3 characters', () => {
            const entitiesWithShort: RegisteredEntity[] = [
                createMockEntity('1', 'Al', 'CHARACTER'), // Too short
                createMockEntity('2', 'Bob', 'CHARACTER'), // OK
            ];
            matcher.initialize(entitiesWithShort);
            expect(matcher.isInitialized()).toBe(true);
        });
    });

    describe('findMentions - exact matching', () => {
        beforeEach(() => {
            matcher.initialize(mockEntities);
        });

        it('should find exact label matches', () => {
            const text = 'Gandalf arrived at the Shire last night.';
            const matches = matcher.findMentions(text);

            expect(matches).toHaveLength(2);
            expect(matches[0].entity.label).toBe('Gandalf');
            expect(matches[0].matchType).toBe('exact');
            expect(matches[0].confidence).toBe(1.0);
            expect(matches[1].entity.label).toBe('Shire');
        });

        it('should find multi-word entity labels', () => {
            const text = 'Frodo Baggins left the Shire with The One Ring.';
            const matches = matcher.findMentions(text);

            const frodoMatch = matches.find(m => m.entity.label === 'Frodo Baggins');
            const ringMatch = matches.find(m => m.entity.label === 'The One Ring');

            expect(frodoMatch).toBeDefined();
            expect(ringMatch).toBeDefined();
        });

        it('should return correct positions', () => {
            const text = 'Gandalf is wise.';
            const matches = matcher.findMentions(text);

            expect(matches[0].position).toBe(0);
            expect(matches[0].length).toBe(7); // 'Gandalf'.length
            expect(matches[0].matchedText).toBe('Gandalf');
        });
    });

    describe('findMentions - alias matching', () => {
        beforeEach(() => {
            matcher.initialize(mockEntities);
        });

        it('should find alias matches with medium confidence', () => {
            const text = 'Mithrandir walked through the Black Land.';
            const matches = matcher.findMentions(text);

            const gandalfMatch = matches.find(m => m.entity.label === 'Gandalf');
            expect(gandalfMatch).toBeDefined();
            expect(gandalfMatch!.matchType).toBe('alias');
            expect(gandalfMatch!.confidence).toBe(0.9);
        });

        it('should find Ring-bearer alias for Frodo', () => {
            const text = 'The Ring-bearer must complete the quest.';
            const matches = matcher.findMentions(text);

            const frodoMatch = matches.find(m => m.entity.label === 'Frodo Baggins');
            expect(frodoMatch).toBeDefined();
            expect(frodoMatch!.matchType).toBe('alias');
        });
    });

    describe('findMentions - case insensitivity', () => {
        beforeEach(() => {
            matcher.initialize(mockEntities);
        });

        it('should match regardless of case', () => {
            const text = 'GANDALF shouted at gandalf about GANDALF.';
            const matches = matcher.findMentions(text);

            expect(matches.length).toBeGreaterThanOrEqual(1);
            matches.forEach(m => {
                expect(m.entity.label).toBe('Gandalf');
            });
        });
    });

    describe('containsEntities', () => {
        beforeEach(() => {
            matcher.initialize(mockEntities);
        });

        it('should return true when entities are present', () => {
            expect(matcher.containsEntities('Gandalf is here.')).toBe(true);
        });

        it('should return false when no entities are present', () => {
            expect(matcher.containsEntities('No known entities here.')).toBe(false);
        });

        it('should return false when not initialized', () => {
            const uninitMatcher = new AllProfanityEntityMatcher();
            expect(uninitMatcher.containsEntities('Gandalf')).toBe(false);
        });
    });

    describe('whitelist management', () => {
        beforeEach(() => {
            matcher.initialize(mockEntities);
        });

        it('should not match whitelisted words', () => {
            // 'character' is in default whitelist
            const text = 'The character development was excellent.';
            const matches = matcher.findMentions(text);

            const characterMatch = matches.find(m =>
                m.matchedText.toLowerCase() === 'character'
            );
            expect(characterMatch).toBeUndefined();
        });

        it('should allow adding to whitelist', () => {
            matcher.addToWhitelist(['gandalf']);
            const matches = matcher.findMentions('Gandalf walked by.');

            // After whitelisting, should not match
            const gandalfMatch = matches.find(m => m.entity.label === 'Gandalf');
            expect(gandalfMatch).toBeUndefined();
        });

        it('should allow removing from whitelist', () => {
            matcher.addToWhitelist(['gandalf']);
            matcher.removeFromWhitelist(['gandalf']);

            const matches = matcher.findMentions('Gandalf walked by.');
            expect(matches.length).toBeGreaterThan(0);
        });
    });

    describe('performance - caching', () => {
        beforeEach(() => {
            matcher.initialize(mockEntities);
        });

        it('should return consistent results on repeated calls', () => {
            const text = 'Gandalf and Frodo Baggins went to Mordor.';

            const result1 = matcher.findMentions(text);
            const result2 = matcher.findMentions(text);

            expect(result1).toEqual(result2);
        });

        it('should handle large documents efficiently', () => {
            // Create a large document with repeated entity mentions
            const paragraph = 'Gandalf and Frodo Baggins traveled through the Shire. ';
            const largeDoc = paragraph.repeat(100); // ~5KB

            const start = performance.now();
            const matches = matcher.findMentions(largeDoc);
            const duration = performance.now() - start;

            expect(matches.length).toBeGreaterThan(100);
            expect(duration).toBeLessThan(500); // Should complete in <500ms
        });
    });

    describe('edge cases', () => {
        beforeEach(() => {
            matcher.initialize(mockEntities);
        });

        it('should handle empty text', () => {
            const matches = matcher.findMentions('');
            expect(matches).toHaveLength(0);
        });

        it('should handle text with no entity mentions', () => {
            const matches = matcher.findMentions('Just a normal sentence with no special names.');
            expect(matches).toHaveLength(0);
        });

        it('should return empty array when not initialized', () => {
            const uninitMatcher = new AllProfanityEntityMatcher();
            const matches = uninitMatcher.findMentions('Gandalf is here.');
            expect(matches).toHaveLength(0);
        });
    });

    describe('configuration', () => {
        it('should return current config', () => {
            const config = matcher.getConfig();
            expect(config.enableCaching).toBe(true);
            expect(config.cacheSize).toBe(100);
            expect(config.enableLeetSpeak).toBe(true);
        });

        it('should merge partial config on initialize', () => {
            matcher.initialize(mockEntities, { cacheSize: 500 });
            const config = matcher.getConfig();
            expect(config.cacheSize).toBe(500);
        });
    });
});
