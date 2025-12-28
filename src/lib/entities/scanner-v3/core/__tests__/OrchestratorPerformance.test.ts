import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScannerOrchestrator } from '../Orchestrator';
import { scannerEventBus } from '../ScannerEventBus';
import { patternExtractor } from '../../extractors/PatternExtractor';
import { tripleExtractor } from '../../extractors/TripleExtractor';
import { implicitEntityMatcher } from '../../extractors/ImplicitEntityMatcher';
import { getRelationshipExtractor } from '../../extractors/RelationshipExtractor';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import { ChangeDetector } from '../ChangeDetector';

// Mock dependencies
vi.mock('../ScannerEventBus', () => ({
    scannerEventBus: {
        on: vi.fn(),
        emit: vi.fn(),
        clear: vi.fn(),
    }
}));

vi.mock('../../extractors/PatternExtractor', () => ({
    patternExtractor: {
        extractEntities: vi.fn().mockReturnValue([]),
        extractTriples: vi.fn().mockReturnValue([]),
    }
}));

vi.mock('../../extractors/TripleExtractor', () => ({
    tripleExtractor: {
        parseTriple: vi.fn(),
        validateTriple: vi.fn(),
    }
}));

vi.mock('../../extractors/ImplicitEntityMatcher', () => ({
    implicitEntityMatcher: {
        findImplicitMentions: vi.fn().mockReturnValue([]),
        filterExplicitSyntax: vi.fn().mockReturnValue([]),
    }
}));

vi.mock('../../extractors/RelationshipExtractor', () => ({
    getRelationshipExtractor: vi.fn(),
}));

vi.mock('@/lib/cozo/graph/adapters', () => ({
    entityRegistry: {
        registerEntity: vi.fn(),
        getAllEntities: vi.fn().mockReturnValue([]),
        updateNoteMentions: vi.fn(),
        getEntityById: vi.fn(),
    }
}));

vi.mock('../persistence/TriplePersistence', () => ({
    triplePersistence: {
        persistTriples: vi.fn(),
    }
}));

// Mock Enrichment to avoid side effects
vi.mock('../enrichers/NLPEnricher', () => ({
    nlpEnricher: {
        enrichMatches: vi.fn((matches) => matches),
    }
}));

vi.mock('../enrichers/EntityDisambiguator', () => ({
    entityDisambiguator: {
        disambiguateMatches: vi.fn().mockReturnValue(new Map()),
    }
}));

describe('ScannerOrchestrator Performance', () => {
    let orchestrator: ScannerOrchestrator;
    let mockRelationshipExtractor: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRelationshipExtractor = {
            loadPatternsFromCoZo: vi.fn(),
            extractFromText: vi.fn().mockReturnValue([]),
            deduplicateRelationships: vi.fn().mockReturnValue([]),
            persistRelationships: vi.fn().mockReturnValue({ added: 0, failed: 0 }),
        };
        (getRelationshipExtractor as any).mockReturnValue(mockRelationshipExtractor);

        orchestrator = new ScannerOrchestrator({
            debounceMs: 10,
            enableRelationshipInference: true,
            enableNLP: false,
        });
    });

    afterEach(() => {
        orchestrator.shutdown();
    });

    it('should deduplicate validation contexts to avoid redundant relationship inference', async () => {
        const noteId = 'test-note-1';
        const contextText = "Alice talks to Bob about the secret plan.";

        // Simulate 3 changes (e.g. 3 entities found) that all share the exact same context string
        const changes = [
            { from: 0, to: 5, text: '[Alice]', context: contextText, noteId, timestamp: Date.now() },
            { from: 15, to: 18, text: '[Bob]', context: contextText, noteId, timestamp: Date.now() },
            { from: 25, to: 30, text: '[Plan]', context: contextText, noteId, timestamp: Date.now() },
        ];

        // Inject into private ChangeDetector
        const changeDetector = (orchestrator as any).changeDetector;
        changes.forEach(c => changeDetector.recordChange(c));

        // Mock entities so that entity spans are found and inference is triggered
        (entityRegistry.getAllEntities as any).mockReturnValue([
            { id: '1', label: 'Alice', kind: 'CHARACTER' },
            { id: '2', label: 'Bob', kind: 'CHARACTER' },
        ]);

        const extractSpy = mockRelationshipExtractor.extractFromText;

        // Execute processing
        await (orchestrator as any).processPendingChanges(noteId);

        expect(extractSpy).toHaveBeenCalled();
        const calledText = extractSpy.mock.calls[0][0];

        // The current implementation simply joins all contexts with a space.
        // So 3 identical contexts -> "Context Context Context"
        // If deduplication works -> "Context"

        console.log('Passed Text Length:', calledText.length);
        console.log('Single Context Length:', contextText.length);

        // We expect the passed text to be roughly the length of a single context (plus maybe a trailing space)
        // Definitely much smaller than 3x
        expect(calledText.length).toBeLessThan(contextText.length * 2);
    });
    it('should use cached entities and call getAllEntities exactly once per scan cycle', async () => {
        const noteId = 'perf-test-cache';
        const changes = [
            { from: 0, to: 20, text: 'Alice met Bob', context: 'Alice met Bob', noteId, timestamp: Date.now() }
        ];

        // Inject into private ChangeDetector
        const changeDetector = (orchestrator as any).changeDetector;
        changes.forEach(c => changeDetector.recordChange(c));

        // Mock implicit matching to be enabled
        (orchestrator as any).config.enableImplicitMatching = true;

        // Mock entities
        const mockEntities = [
            { id: '1', label: 'Alice', kind: 'CHARACTER' },
            { id: '2', label: 'Bob', kind: 'CHARACTER' },
        ];
        (entityRegistry.getAllEntities as any).mockReturnValue(mockEntities);

        // Execute processing
        await (orchestrator as any).processPendingChanges(noteId);

        // VERIFICATION: 
        // 1. getAllEntities should be called EXACTLY ONCE (by Orchestrator)
        // If it's called more than once, then downstream extractors are not using the cache
        expect(entityRegistry.getAllEntities).toHaveBeenCalledTimes(1);

        // 2. Check if extractFromText received the cached entities as 3rd argument
        const extractSpy = mockRelationshipExtractor.extractFromText;
        expect(extractSpy).toHaveBeenCalled();
        const thirdArg = extractSpy.mock.calls[0][2]; // 0th call, 2nd index (3rd arg)
        expect(thirdArg).toBe(mockEntities); // Should be strictly equal to the mock return
    });
});
