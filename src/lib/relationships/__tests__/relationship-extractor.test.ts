import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { RelationshipExtractor } from '../../entities/scanner-v3/extractors/RelationshipExtractor';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';

// Mock both registries
vi.mock('@/lib/cozo/graph/adapters', () => ({
    entityRegistry: {
        findEntityByLabel: vi.fn(),
        getAllEntities: vi.fn(),
        registerEntity: vi.fn(), // If used
    },
    relationshipRegistry: {
        add: vi.fn(),
        registerRelationship: vi.fn(),
    }
}));

describe('RelationshipExtractor', () => {
    let extractor: RelationshipExtractor;

    // Helper to create mock entity
    const createMockEntity = (label: string, kind: string): RegisteredEntity => ({
        id: `mock-${label}`,
        label,
        kind: kind as any,
        aliases: [],
        firstNote: 'note-1',
        mentionsByNote: new Map(),
        totalMentions: 1,
        lastSeenDate: new Date(),
        createdAt: new Date(),
        createdBy: 'user'
    });

    beforeEach(() => {
        vi.clearAllMocks();
        extractor = new RelationshipExtractor();

        // Default mock behavior
        (entityRegistry.getAllEntities as Mock).mockResolvedValue([]);
        (entityRegistry.findEntityByLabel as Mock).mockResolvedValue(null);
    });

    describe('SVO Pattern Extraction', () => {
        it('should extract SVO relationship with known verb', () => {
            const aragorn = createMockEntity('Aragorn', 'CHARACTER');
            const orcs = createMockEntity('Orcs', 'FACTION');

            // Setup mocks
            (entityRegistry.getAllEntities as Mock).mockReturnValue([aragorn, orcs]);
            (entityRegistry.findEntityByLabel as Mock).mockImplementation((label) => {
                if (label === 'Aragorn') return aragorn;
                if (label === 'Orcs') return orcs;
                return null;
            });

            const text = 'Aragorn defeated the Orcs in the battle.';
            const relationships = extractor.extractFromText(text, 'test-note');

            expect(relationships.length).toBeGreaterThan(0);
            expect(relationships[0].source.entity.label).toBe('Aragorn');
            expect(relationships[0].target.entity.label).toBe('Orcs');
            expect(relationships[0].predicate).toBe('DEFEATED');
            expect(relationships[0].pattern).toBe('SVO');
            expect(relationships[0].confidence).toBeGreaterThan(0.5);
        });

        it('should extract SVO relationship with unknown verb using verb lemma', () => {
            const gandalf = createMockEntity('Gandalf', 'CHARACTER');
            const balrog = createMockEntity('Balrog', 'CHARACTER');

            (entityRegistry.getAllEntities as Mock).mockReturnValue([gandalf, balrog]);

            const text = 'Gandalf confronted the Balrog on the bridge.';
            const relationships = extractor.extractFromText(text, 'test-note');

            expect(relationships.length).toBeGreaterThan(0);
            expect(relationships[0].predicate).toBe('CONFRONT');
            expect(relationships[0].confidence).toBeLessThan(0.7);
        });
    });

    describe('Prepositional Pattern Extraction', () => {
        it('should extract PREP relationship for location', () => {
            const frodo = createMockEntity('Frodo', 'CHARACTER');
            const mordor = createMockEntity('Mordor', 'LOCATION');

            (entityRegistry.getAllEntities as Mock).mockReturnValue([frodo, mordor]);

            const text = 'Frodo traveled to Mordor with the ring.';
            const relationships = extractor.extractFromText(text, 'test-note');

            const prepRel = relationships.find(r => r.pattern === 'PREP');
            expect(prepRel).toBeDefined();
            expect(prepRel!.target.entity.kind).toBe('LOCATION');
            expect(prepRel!.predicate).toBe('TRAVELED_TO');
        });
    });

    describe('Possession Pattern Extraction', () => {
        it('should extract possession relationship using apostrophe-s', () => {
            const frodo = createMockEntity('Frodo', 'CHARACTER');
            const ring = createMockEntity('Ring', 'ITEM');

            (entityRegistry.getAllEntities as Mock).mockReturnValue([frodo, ring]);

            const text = "Frodo's Ring was powerful.";
            const relationships = extractor.extractFromText(text, 'test-note');

            const possRel = relationships.find(r => r.pattern === 'POSSESSION');
            expect(possRel).toBeDefined();
            expect(possRel!.source.entity.label).toBe('Frodo');
            expect(possRel!.target.entity.label).toBe('Ring');
            expect(possRel!.predicate).toBe('POSSESSES');
        });
    });
});
