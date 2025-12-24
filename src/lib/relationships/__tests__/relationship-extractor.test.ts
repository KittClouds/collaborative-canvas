import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipExtractor, getRelationshipExtractor } from '../RelationshipExtractor';
import { entityRegistry } from '../../entities/entity-registry';

describe('RelationshipExtractor', () => {
    let extractor: RelationshipExtractor;

    beforeEach(() => {
        // Clear registry
        (entityRegistry as any)['entities'].clear();
        (entityRegistry as any)['labelIndex'].clear();
        (entityRegistry as any)['aliasIndex'].clear();

        extractor = new RelationshipExtractor();
    });

    describe('SVO Pattern Extraction', () => {
        it('should extract SVO relationship with known verb', () => {
            entityRegistry.registerEntity('Aragorn', 'CHARACTER', 'test-note');
            entityRegistry.registerEntity('Orcs', 'FACTION', 'test-note');

            const text = 'Aragorn defeated the Orcs in the battle.';
            const relationships = extractor.extractFromText(text, 'test-note');

            expect(relationships.length).toBeGreaterThan(0);
            expect(relationships[0].source.entity.label).toBe('Aragorn');
            expect(relationships[0].target.entity.label).toBe('Orcs');
            expect(relationships[0].predicate).toBe('defeated');
            expect(relationships[0].pattern).toBe('SVO');
            expect(relationships[0].confidence).toBeGreaterThan(0.5);
        });

        it('should extract SVO relationship with unknown verb using verb lemma', () => {
            entityRegistry.registerEntity('Gandalf', 'CHARACTER', 'test-note');
            entityRegistry.registerEntity('Balrog', 'CHARACTER', 'test-note');

            const text = 'Gandalf confronted the Balrog on the bridge.';
            const relationships = extractor.extractFromText(text, 'test-note');

            expect(relationships.length).toBeGreaterThan(0);
            // Unknown verb should use lemma as predicate
            expect(relationships[0].predicate).toBe('confront');
            expect(relationships[0].confidence).toBeLessThan(0.7); // Lower confidence for unknown verbs
        });
    });

    describe('Prepositional Pattern Extraction', () => {
        it('should extract PREP relationship for location', () => {
            entityRegistry.registerEntity('Frodo', 'CHARACTER', 'test-note');
            entityRegistry.registerEntity('Mordor', 'LOCATION', 'test-note');

            const text = 'Frodo traveled to Mordor with the ring.';
            const relationships = extractor.extractFromText(text, 'test-note');

            const prepRel = relationships.find(r => r.pattern === 'PREP');
            expect(prepRel).toBeDefined();
            expect(prepRel!.target.entity.kind).toBe('LOCATION');
            expect(prepRel!.predicate).toBe('traveled_to');
        });

        it('should extract member_of relationship', () => {
            entityRegistry.registerEntity('Legolas', 'CHARACTER', 'test-note');
            entityRegistry.registerEntity('Fellowship', 'FACTION', 'test-note');

            const text = 'Legolas is a member of the Fellowship.';
            const relationships = extractor.extractFromText(text, 'test-note');

            const memberRel = relationships.find(r => r.predicate === 'member_of');
            expect(memberRel).toBeDefined();
        });
    });

    describe('Possession Pattern Extraction', () => {
        it('should extract possession relationship using apostrophe-s', () => {
            entityRegistry.registerEntity('Frodo', 'CHARACTER', 'test-note');
            entityRegistry.registerEntity('Ring', 'ITEM', 'test-note');

            const text = "Frodo's Ring was powerful.";
            const relationships = extractor.extractFromText(text, 'test-note');

            const possRel = relationships.find(r => r.pattern === 'POSSESSION');
            expect(possRel).toBeDefined();
            expect(possRel!.source.entity.label).toBe('Frodo');
            expect(possRel!.target.entity.label).toBe('Ring');
            expect(possRel!.predicate).toBe('owns'); // CHARACTER + ITEM → owns
        });
    });

    describe('Multiple Relationships', () => {
        it('should extract multiple relationships from complex sentence', () => {
            entityRegistry.registerEntity('Aragorn', 'CHARACTER', 'test-note');
            entityRegistry.registerEntity('Arwen', 'CHARACTER', 'test-note');
            entityRegistry.registerEntity('Rivendell', 'LOCATION', 'test-note');

            const text = 'Aragorn loved Arwen in Rivendell.';
            const relationships = extractor.extractFromText(text, 'test-note');

            // Should find: Aragorn-loves-Arwen (SVO), Aragorn-in-Rivendell (PREP), Arwen-in-Rivendell (PREP)
            expect(relationships.length).toBeGreaterThanOrEqual(2);

            const loveRel = relationships.find(r => r.predicate === 'loves');
            expect(loveRel).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle sentence with only one entity', () => {
            entityRegistry.registerEntity('Gandalf', 'CHARACTER', 'test-note');

            const text = 'Gandalf was wise.';
            const relationships = extractor.extractFromText(text, 'test-note');

            expect(relationships.length).toBe(0); // Need at least 2 entities
        });

        it('should handle empty text', () => {
            const relationships = extractor.extractFromText('', 'test-note');
            expect(relationships.length).toBe(0);
        });

        it('should handle text with no registered entities', () => {
            const text = 'The quick brown fox jumped over the lazy dog.';
            const relationships = extractor.extractFromText(text, 'test-note');
            expect(relationships.length).toBe(0);
        });
    });
});
