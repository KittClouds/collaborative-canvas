import { describe, it, expect, beforeEach } from 'vitest';
import { getWinkProcessor } from '../nlp/WinkProcessor';
import {
    scanDocumentWithLinguistics,
    detectCoOccurrencesEnhanced,
    getEntityDisambiguationContext,
} from '../documentScanner';
import { entityRegistry } from '../entity-registry';
import type { JSONContent } from '@tiptap/react';

describe('WinkProcessor Integration Tests', () => {
    beforeEach(() => {
        // Clear registry before each test
        // Assuming entityRegistry has methods to clear or accessing private validly in tests
        // Using any cast to access private members if necessary or public API
        (entityRegistry as any)['entities'].clear();
        (entityRegistry as any)['labelIndex'].clear();
        (entityRegistry as any)['aliasIndex'].clear();
        (entityRegistry as any)['relationships'].clear();
        (entityRegistry as any)['coOccurrences'].clear();
    });

    it('should detect sentence boundaries accurately (Dr. test)', () => {
        const wink = getWinkProcessor();
        const text = 'Dr. Smith works at NASA. He founded SpaceX in 2002.';

        const sentences = wink.getSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toBe('Dr. Smith works at NASA.');
        expect(sentences[1].text).toBe('He founded SpaceX in 2002.');
    });

    it('should extract proper noun sequences', () => {
        const wink = getWinkProcessor();
        const text = 'Elon Musk founded Tesla Motors in Palo Alto.';

        const properNouns = wink.extractProperNounSequences(text);

        expect(properNouns.length).toBeGreaterThan(0);
        expect(properNouns.some(pn => pn.text === 'Elon Musk')).toBe(true);
    });

    it('should provide POS context for disambiguation', () => {
        const wink = getWinkProcessor();
        const text = 'Apple Inc. released new products. I ate an apple yesterday.';

        // First "Apple" - company (proper noun)
        const context1 = wink.getContextualPOS(text, 0, 2);
        // Note: wink lite model might use different tags or robust handling
        // Check coverage. expecting PROPN or similar.
        expect(context1.after.some(t => t === 'PROPN' || t === 'NNP')).toBe(true);

        // Second "apple" - fruit (common noun after determiner)
        // "I ate an apple"
        // text index: "Apple Inc. released new products. I ate an apple yesterday."
        // 012345678901234567890123456789012345678901234567890123456789
        // Apple... 34 chars prefix. "I ate an " -> 34+9 = 43. 
        // "apple" starts around 43. User snippet used 42.
        // "Apple Inc. released new products. " -> 34 chars. 
        // "I ate an " -> 9 chars. Total 43.
        // Let's use string search to be safe.
        const index2 = text.lastIndexOf('apple');

        const context2 = wink.getContextualPOS(text, index2, 2);

        expect(context2.before.some(t => t === 'DET' || t === 'DT')).toBe(true);
    });

    it('should integrate with document scanner and disambiguate', () => {
        // Register entity for disambiguation
        entityRegistry.registerEntity('NASA', 'FACTION', 'test-note');

        const doc: JSONContent = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        { type: 'text', text: 'NASA and SpaceX collaborate on space missions.' }
                    ]
                }
            ]
        };

        const result = scanDocumentWithLinguistics('test-note', doc);

        expect(result.statistics.sentenceCount).toBe(1);
        expect(result.statistics.tokenCount).toBeGreaterThan(5);
        expect(result.sentences[0].text).toBe('NASA and SpaceX collaborate on space missions.');

        // Check if NASA was disambiguated
        expect(result.disambiguatedEntities.length).toBeGreaterThan(0);
        expect(result.disambiguatedEntities[0].entity.label).toBe('NASA');
    });

    it('should detect co-occurrences with linguistic precision', () => {
        // Register entities first
        entityRegistry.registerEntity('Elon Musk', 'CHARACTER', 'test-note');
        entityRegistry.registerEntity('Tesla', 'FACTION', 'test-note');

        const doc: JSONContent = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        { type: 'text', text: 'Elon Musk founded Tesla in 2003. Tesla is an electric car company.' }
                    ]
                }
            ]
        };

        const coOccurrences = detectCoOccurrencesEnhanced('test-note', doc);

        expect(coOccurrences.length).toBeGreaterThan(0);
        const pair = coOccurrences.find(
            c => (c.entity1 === 'Elon Musk' && c.entity2 === 'Tesla') ||
                (c.entity1 === 'Tesla' && c.entity2 === 'Elon Musk')
        );
        expect(pair).toBeDefined();
        expect(pair?.frequency).toBeGreaterThan(0);
    });

    it('should provide entity disambiguation context', () => {
        const text = 'Apple Inc. is a technology company.';

        const context = getEntityDisambiguationContext(text, 'Apple', 0);

        expect(context.posContext).toBeDefined();
        expect(context.sentence).toBe('Apple Inc. is a technology company.');
        expect(context.confidence).toBe('high'); // Followed by proper noun "Inc."
    });
});
