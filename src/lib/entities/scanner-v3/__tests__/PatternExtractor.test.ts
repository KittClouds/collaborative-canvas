import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patternExtractor, tripleExtractor } from '../extractors';
import { patternRegistry } from '@/lib/refs/patterns/registry';

// Mock entityRegistry for TripleExtractor
vi.mock('@/lib/cozo/graph/adapters', () => ({
    entityRegistry: {
        findEntityByLabel: vi.fn().mockReturnValue(null),
    },
}));

describe('PatternExtractor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        patternRegistry.reset();
    });

    it('extracts entities from text', () => {
        const text = 'Hello [CHARACTER|Jon] and [LOCATION:CITY|Winterfell].';
        const events = patternExtractor.extractEntities(text, 'test-note');

        expect(events).toHaveLength(2);
        expect(events[0].kind).toBe('entity');
        expect(events[0].captures.label).toBe('Jon');
        expect(events[0].captures.entityKind).toBe('CHARACTER');

        expect(events[1].captures.label).toBe('Winterfell');
        expect(events[1].captures.entityKind).toBe('LOCATION');
        expect(events[1].captures.subtype).toBe('CITY');
    });

    it('extracts inline triples', () => {
        const text = '[CHARACTER|Jon->LOVES->Jane]';
        const events = patternExtractor.extractTriples(text, 'test-note');

        expect(events).toHaveLength(1);
        expect(events[0].kind).toBe('triple');
        expect(events[0].captures.subjectLabel).toBe('Jon');
        expect(events[0].captures.predicate).toBe('LOVES');
        expect(events[0].captures.objectLabel).toBe('Jane');
    });

    it('extracts full triples', () => {
        const text = '[CHARACTER|Jon] ->KNOWS-> [CHARACTER|Sam]';
        const events = patternExtractor.extractTriples(text, 'test-note');

        expect(events).toHaveLength(1);
        expect(events[0].captures.subjectLabel).toBe('Jon');
        expect(events[0].captures.predicate).toBe('KNOWS');
        expect(events[0].captures.objectLabel).toBe('Sam');
    });

    it('extracts wikilinks', () => {
        const text = 'See [[Project Specs]] for details.';
        const events = patternExtractor.extractWikilinks(text, 'test-note');

        expect(events).toHaveLength(1);
        expect(events[0].captures.target).toBe('Project Specs');
    });

    it('extracts tags', () => {
        const text = 'This is #important and #urgent';
        const events = patternExtractor.extractTags(text, 'test-note');

        expect(events).toHaveLength(2);
        expect(events[0].captures.tagName).toBe('important');
        expect(events[1].captures.tagName).toBe('urgent');
    });

    it('extracts mentions', () => {
        const text = 'Ping @alice and @bob';
        const events = patternExtractor.extractMentions(text, 'test-note');

        expect(events).toHaveLength(2);
        expect(events[0].captures.username).toBe('alice');
        expect(events[1].captures.username).toBe('bob');
    });

    it('resolves overlapping patterns (higher priority wins)', () => {
        // INLINE_RELATIONSHIP has priority 106, ENTITY has priority 100
        // So inline rel should win over entity
        const text = '[CHARACTER|Jon->LOVES->Jane]';
        const allEvents = patternExtractor.extractFromText(text, 'test-note');

        // Should only have the triple, not a partial entity match
        expect(allEvents.filter(e => e.kind === 'triple')).toHaveLength(1);
    });
});

describe('TripleExtractor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        patternRegistry.reset();
    });

    it('parses triple from pattern event', () => {
        const text = '[CHARACTER|Jon] ->KNOWS-> [CHARACTER|Sam]';
        const events = patternExtractor.extractTriples(text, 'test-note');

        const triple = tripleExtractor.parseTriple(events[0], text);

        expect(triple).not.toBeNull();
        expect(triple!.subject.label).toBe('Jon');
        expect(triple!.subject.kind).toBe('CHARACTER');
        expect(triple!.predicate).toBe('KNOWS');
        expect(triple!.object.label).toBe('Sam');
        expect(triple!.object.kind).toBe('CHARACTER');
        expect(triple!.confidence).toBe(0.95);
    });

    it('parses inline triple', () => {
        const text = '[CHARACTER|Jon->LOVES->Jane]';
        const events = patternExtractor.extractTriples(text, 'test-note');

        const triple = tripleExtractor.parseTriple(events[0], text);

        expect(triple).not.toBeNull();
        expect(triple!.subject.label).toBe('Jon');
        expect(triple!.predicate).toBe('LOVES');
        expect(triple!.object.label).toBe('Jane');
        expect(triple!.object.kind).toBe('CONCEPT'); // Default for inline
    });

    it('validates triples', () => {
        const validTriple = {
            subject: { kind: 'CHARACTER', label: 'Jon' },
            predicate: 'KNOWS',
            object: { kind: 'CHARACTER', label: 'Sam' },
            context: '',
            confidence: 0.95,
            position: 0,
        };

        expect(tripleExtractor.validateTriple(validTriple)).toBe(true);
    });

    it('parseTriples handles array input', () => {
        // Single triple
        const text = '[ITEM|Book] ->HAS-> [ITEM|Page]';
        const events = patternExtractor.extractTriples(text, 'test-note');
        const triples = tripleExtractor.parseTriples(events, text);

        expect(Array.isArray(triples)).toBe(true);
        expect(triples.length).toBe(1);
        expect(triples[0].subject.label).toBe('Book');
    });
});
