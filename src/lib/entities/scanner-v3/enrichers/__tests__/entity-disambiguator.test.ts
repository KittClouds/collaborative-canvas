import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { EntityDisambiguator } from '../EntityDisambiguator';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import type { EnrichedMatch } from '../types';

// Mock dependencies
vi.mock('@/lib/cozo/graph/adapters', () => ({
    entityRegistry: {
        getAllEntities: vi.fn(),
        getEntityById: vi.fn(),
    }
}));

// Mock ContextualDisambiguator to avoid loading full ResoRank/Wink
vi.mock('@/lib/entities/nlp/ContextualDisambiguator', () => {
    return {
        ContextualDisambiguator: vi.fn().mockImplementation(() => ({
            disambiguate: vi.fn((text) => {
                if (text.toLowerCase() === 'jon') {
                    return [{
                        entity: { id: 'jon-snow-id', label: 'Jon Snow' },
                        score: 0.9,
                        confidence: 'high'
                    }];
                }
                return [];
            })
        }))
    };
});

describe('EntityDisambiguator', () => {
    let disambiguator: EntityDisambiguator;

    beforeEach(() => {
        vi.clearAllMocks();
        disambiguator = new EntityDisambiguator();
    });

    it('should resolve "Jon" to "Jon Snow" when confidence is high', () => {
        const matches: EnrichedMatch[] = [{
            kind: 'entity',
            fullMatch: '[CHARACTER|Jon]',
            captures: { label: 'Jon', entityKind: 'CHARACTER' },
            position: 0,
            length: 15,
            patternId: 'explicit',
            noteId: 'note-1',
            timestamp: Date.now(),
            sentence: {
                text: 'Jon went to the wall.',
                start: 0,
                end: 20,
                tokens: []
            } as any, // semantic mock
            baseConfidence: 1,
            nlpConfidence: 1,
            finalConfidence: 1,
            validatedByPOS: true,
            validatedByChunk: true
        }];

        const resolutions = disambiguator.disambiguateMatches(matches);

        expect(resolutions.size).toBe(1);
        expect(resolutions.get('jon')).toBe('jon-snow-id');
    });

    it('should return empty map if no resolution found', () => {
        const matches: EnrichedMatch[] = [{
            kind: 'entity',
            fullMatch: '[CHARACTER|Unknown]',
            captures: { label: 'Unknown', entityKind: 'CHARACTER' },
            position: 0,
            length: 20,
            patternId: 'explicit',
            noteId: 'note-1',
            timestamp: Date.now(),
            sentence: {
                text: 'Unknown person appeared.',
                start: 0,
                end: 20,
                tokens: []
            } as any,
            baseConfidence: 1,
            nlpConfidence: 1,
            finalConfidence: 1,
            validatedByPOS: true,
            validatedByChunk: true
        }];

        const resolutions = disambiguator.disambiguateMatches(matches);
        expect(resolutions.size).toBe(0);
    });
});
