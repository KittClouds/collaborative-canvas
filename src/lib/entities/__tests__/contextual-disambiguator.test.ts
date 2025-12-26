import { describe, it, expect, beforeEach } from 'vitest';
import { ContextualDisambiguator } from '../nlp/ContextualDisambiguator';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import { getWinkProcessor } from '../nlp/WinkProcessor';

describe('ContextualDisambiguator', () => {
    let disambiguator: ContextualDisambiguator;

    beforeEach(() => {
        // Clear registry
        (entityRegistry as any)['entities'].clear();
        (entityRegistry as any)['labelIndex'].clear();
        (entityRegistry as any)['aliasIndex'].clear();

        disambiguator = new ContextualDisambiguator();
    });

    it('should index entities and perform basic search', () => {
        // Register entities
        entityRegistry.registerEntity('Elon Musk', 'CHARACTER', 'test-note');
        entityRegistry.registerEntity('Tesla', 'FACTION', 'test-note');

        // Create a fake sentence context
        const wink = getWinkProcessor();
        const text = 'Elon Musk is the CEO of Tesla.';
        const analysis = wink.analyze(text);
        const sentence = analysis.sentences[0];

        // Search for "Elon"
        const results = disambiguator.disambiguate('Elon', sentence, 0);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].entity.label).toBe('Elon Musk');
        expect(results[0].confidence).toBe('high');
    });

    it('should boost confidence based on POS context', () => {
        // Register entity
        entityRegistry.registerEntity('Apple', 'FACTION', 'test-note'); // Organization/Faction

        const wink = getWinkProcessor();
        // Context matching ORGANIZATION/FACTION: "at Apple" (ADP before) or "Apple announced" (VERB after)
        const text = 'She works at Apple.';
        const analysis = wink.analyze(text);
        const sentence = analysis.sentences[0];
        const position = text.indexOf('Apple');

        // Disambiguate
        const results = disambiguator.disambiguate('Apple', sentence, position);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].entity.label).toBe('Apple');
        // 'at' is ADP. FACTION/ORGANIZATION logic: before=['ADP', 'DET']. Should match.
        // Therefore score boost -> high confidence.
        expect(results[0].confidence).toBe('high');
    });

    it('should distinguish candidates with similar names', () => {
        entityRegistry.registerEntity('Steve Jobs', 'CHARACTER', 'n1');
        entityRegistry.registerEntity('Steve Wozniak', 'CHARACTER', 'n2');

        const wink = getWinkProcessor();
        const text = 'Steve Wozniak created the Apple I.';
        const analysis = wink.analyze(text);
        const sentence = analysis.sentences[0];

        // Search for "Steve" at position 0
        const results = disambiguator.disambiguate('Steve', sentence, 0);

        // Should return both, but Wozniak potentially higher if we searched "Steve Wozniak" query?
        // Disambiguate uses `mentionText` as query. If mentionText is "Steve", both match "Steve".
        // ResoRank score depends on length/tf. Both "Steve" tokens are equal.
        // If query is ["Steve"], scores should be similar.
        // However, if we improve query construction later to include context, it might differ.
        // For now, checks that both are found.

        expect(results.some(r => r.entity.label === 'Steve Jobs')).toBe(true);
        expect(results.some(r => r.entity.label === 'Steve Wozniak')).toBe(true);
    });
});
