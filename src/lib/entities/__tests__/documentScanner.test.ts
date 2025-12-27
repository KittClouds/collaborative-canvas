import { describe, test, expect, vi, beforeEach } from 'vitest';
import { scanDocument, parseNoteConnectionsFromDocument } from '../documentScanner';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import { patternRegistry } from '@/lib/refs/patterns/registry';

// Mock dependencies
vi.mock('@/lib/cozo/graph/adapters', () => ({
    entityRegistry: {
        registerEntity: vi.fn(),
        getAllEntities: vi.fn().mockReturnValue([]),
        findEntityByLabel: vi.fn().mockReturnValue(null), // TripleExtractor calls this
    },
    relationshipRegistry: {
        findByEntities: vi.fn(),
        add: vi.fn(),
        update: vi.fn(),
    }
}));

describe('Document Scanner V3', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset patterns to ensure defaults are loaded
        patternRegistry.reset();
    });

    test('scans entities using unified patterns', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Hello [CHARACTER|Jon] and [LOCATION:CITY|Winterfell].' }] }
            ]
        };

        scanDocument('note1', doc);

        expect(entityRegistry.registerEntity).toHaveBeenCalledWith('Jon', 'CHARACTER', 'note1', expect.objectContaining({ subtype: undefined }));
        expect(entityRegistry.registerEntity).toHaveBeenCalledWith('Winterfell', 'LOCATION', 'note1', expect.objectContaining({ subtype: 'CITY' }));
    });

    test('extracts inline relationships (compact syntax)', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: '[CHARACTER|Jon->LOVES->Jane].' }] }
            ]
        };

        const connections = parseNoteConnectionsFromDocument(doc);

        expect(connections.triples).toHaveLength(1);
        expect(connections.triples[0]).toEqual(expect.objectContaining({
            subject: expect.objectContaining({ label: 'Jon', kind: 'CHARACTER' }),
            predicate: 'LOVES',
            object: expect.objectContaining({ label: 'Jane' }) // Kind might be implicit/concept
        }));
    });

    test('extracts full triples', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: '[CHARACTER|Jon] ->KNOWS-> [CHARACTER|Sam]' }] }
            ]
        };

        const connections = parseNoteConnectionsFromDocument(doc);

        expect(connections.triples).toHaveLength(1);
        expect(connections.triples[0]).toEqual(expect.objectContaining({
            subject: expect.objectContaining({ label: 'Jon', kind: 'CHARACTER' }),
            predicate: 'KNOWS',
            object: expect.objectContaining({ label: 'Sam', kind: 'CHARACTER' })
        }));
    });

    test('extracts wikilinks', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'See [[Project Specs]] for details.' }] }
            ]
        };

        const connections = parseNoteConnectionsFromDocument(doc);

        expect(connections.wikilinks).toContain('Project Specs');
    });
});
