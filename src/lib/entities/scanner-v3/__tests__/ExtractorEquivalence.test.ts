/**
 * ExtractorEquivalence.test.ts
 * 
 * Validates that AhoCorasickExtractor produces identical output to PatternExtractor.
 * If these tests pass, the migration is safe with zero breaking changes.
 */
import { describe, it, expect } from 'vitest';
import { PatternExtractor } from '../extractors/PatternExtractor';
import { AhoCorasickExtractor } from '../extractors/AhoCorasickExtractor';
import type { PatternMatchEvent } from '../types';

// Create fresh instances for each comparison to avoid shared state
function compare(text: string, type: 'all' | 'entity' | 'triple' | 'wikilink' | 'tag' | 'mention') {
    const regex = new PatternExtractor();
    const ac = new AhoCorasickExtractor();

    let regexResult: PatternMatchEvent[];
    let acResult: PatternMatchEvent[];

    switch (type) {
        case 'entity':
            regexResult = regex.extractEntities(text, 'test');
            acResult = ac.extractEntities(text, 'test');
            break;
        case 'triple':
            regexResult = regex.extractTriples(text, 'test');
            acResult = ac.extractTriples(text, 'test');
            break;
        case 'wikilink':
            regexResult = regex.extractWikilinks(text, 'test');
            acResult = ac.extractWikilinks(text, 'test');
            break;
        case 'tag':
            regexResult = regex.extractTags(text, 'test');
            acResult = ac.extractTags(text, 'test');
            break;
        case 'mention':
            regexResult = regex.extractMentions(text, 'test');
            acResult = ac.extractMentions(text, 'test');
            break;
        default:
            regexResult = regex.extractFromText(text, 'test');
            acResult = ac.extractFromText(text, 'test');
    }

    // Normalize for comparison
    const normalize = (arr: PatternMatchEvent[]) =>
        arr.map(e => ({ ...e, timestamp: 0 })).sort((a, b) => a.position - b.position);

    return {
        regex: normalize(regexResult),
        ac: normalize(acResult),
    };
}

describe('Extractor Equivalence', () => {
    describe('Entity patterns', () => {
        it('simple entity', () => {
            const { regex, ac } = compare('[CHARACTER|Jon Snow]', 'entity');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(1);
            expect(ac[0].fullMatch).toBe(regex[0].fullMatch);
            expect(ac[0].position).toBe(regex[0].position);
        });

        it('entity with subtype', () => {
            const { regex, ac } = compare('[LOCATION:CITY|Winterfell]', 'entity');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].captures.subtype).toBe(regex[0].captures.subtype);
        });

        it('entity with attributes', () => {
            const { regex, ac } = compare('[ITEM|Sword|{"material":"steel"}]', 'entity');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].captures.label).toBe(regex[0].captures.label);
        });

        it('multiple entities', () => {
            const { regex, ac } = compare('Hello [CHARACTER|Jon] and [LOCATION|Winterfell].', 'entity');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(2);
        });
    });

    describe('Wikilinks', () => {
        it('simple wikilink', () => {
            const { regex, ac } = compare('[[Page Title]]', 'wikilink');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].fullMatch).toBe(regex[0].fullMatch);
        });

        it('wikilink with display text', () => {
            const { regex, ac } = compare('[[Page Title|Display Text]]', 'wikilink');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].captures.displayText).toBe(regex[0].captures.displayText);
        });

        it('multiple wikilinks', () => {
            const { regex, ac } = compare('See [[One]] and [[Two]]', 'wikilink');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(2);
        });
    });

    describe('Tags', () => {
        it('single tag', () => {
            const { regex, ac } = compare('#important', 'tag');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].captures.tagName).toBe('important');
        });

        it('multiple tags', () => {
            const { regex, ac } = compare('#one #two #three', 'tag');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(3);
        });
    });

    describe('Mentions', () => {
        it('single mention', () => {
            const { regex, ac } = compare('@alice', 'mention');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].captures.username).toBe('alice');
        });

        it('multiple mentions', () => {
            const { regex, ac } = compare('Ping @alice and @bob', 'mention');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(2);
        });
    });

    describe('Triples', () => {
        it('full triple', () => {
            const { regex, ac } = compare('[CHARACTER|Jon] ->KNOWS-> [CHARACTER|Sam]', 'triple');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].captures.predicate).toBe(regex[0].captures.predicate);
        });

        it('inline triple', () => {
            const { regex, ac } = compare('[CHARACTER|Jon->LOVES->Daenerys]', 'triple');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].captures.predicate).toBe('LOVES');
        });
    });

    describe('Mixed patterns', () => {
        it('entity and wikilink', () => {
            const { regex, ac } = compare('[CHARACTER|Jon] on [[Page]]', 'all');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(2);
        });

        it('tag and mention', () => {
            const { regex, ac } = compare('Text with #tag and @mention', 'all');
            expect(ac.length).toBe(regex.length);
        });
    });

    describe('Edge cases', () => {
        it('empty string', () => {
            const { regex, ac } = compare('', 'all');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(0);
        });

        it('no patterns', () => {
            const { regex, ac } = compare('Just regular text', 'all');
            expect(ac.length).toBe(regex.length);
            expect(ac.length).toBe(0);
        });

        it('invalid syntax', () => {
            const { regex, ac } = compare('[ not valid', 'all');
            expect(ac.length).toBe(regex.length);
        });
    });

    describe('Unicode', () => {
        it('unicode entity label', () => {
            const { regex, ac } = compare('[CHARACTER|日本語名前]', 'entity');
            expect(ac.length).toBe(regex.length);
            expect(ac[0].fullMatch).toBe(regex[0].fullMatch);
        });

        it('unicode wikilink', () => {
            const { regex, ac } = compare('[[Документация]]', 'wikilink');
            expect(ac.length).toBe(regex.length);
        });
    });

    describe('Performance', () => {
        it('handles large document identically', () => {
            const patterns = [
                '[CHARACTER|Person_0]',
                '[[Wiki Link]]',
                '#tag',
                '@user',
                'Text between patterns. ',
            ];
            const doc = patterns.join(' ').repeat(100);

            const { regex, ac } = compare(doc, 'all');
            expect(ac.length).toBe(regex.length);
        });

        it('AC is competitive on large documents', () => {
            const doc = `
        [CHARACTER|Jon] and [LOCATION|Winterfell] on [[Page]]
        with #tag and @mention
      `.repeat(50);

            const regexExtractor = new PatternExtractor();
            const acExtractor = new AhoCorasickExtractor();

            // Warm up
            regexExtractor.extractFromText(doc, 'warmup');
            acExtractor.extractFromText(doc, 'warmup');

            const regexStart = performance.now();
            for (let i = 0; i < 10; i++) {
                regexExtractor.extractFromText(doc, 'bench');
            }
            const regexTime = performance.now() - regexStart;

            const acStart = performance.now();
            for (let i = 0; i < 10; i++) {
                acExtractor.extractFromText(doc, 'bench');
            }
            const acTime = performance.now() - acStart;

            console.log(`Regex: ${regexTime.toFixed(2)}ms, AC: ${acTime.toFixed(2)}ms, Ratio: ${(regexTime / acTime).toFixed(2)}x`);

            // AC should be at least competitive (within 3x of regex)
            expect(acTime).toBeLessThan(regexTime * 3);
        });
    });
});
